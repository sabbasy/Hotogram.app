import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CancelOrderRequest {
  orderId: string;
  sessionId: string;
  reason?: string;
  itemIds?: string[];
  cancelledBy?: 'customer' | 'kitchen';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CancelOrderRequest = await req.json();
    const { orderId, sessionId, reason, itemIds, cancelledBy = 'customer' } = body;

    if (!orderId || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'orderId and sessionId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate active session
    const { data: session, error: sessionError } = await supabase
      .from('table_sessions')
      .select('id, status, restaurant_id, table_id')
      .eq('id', sessionId)
      .eq('status', 'active')
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Active session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, session_id, restaurant_id, table_id, payment_status, subtotal, tax_amount, total_amount, cancelled_items')
      .eq('id', orderId)
      .eq('session_id', sessionId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found in this session' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Customers can only cancel 'new' orders; kitchen can cancel new/preparing/ready
    if (cancelledBy === 'customer' && order.status !== 'new') {
      return new Response(
        JSON.stringify({ error: `Cannot cancel order with status "${order.status}". Only new orders can be cancelled by customers.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (cancelledBy === 'kitchen' && !['new', 'preparing', 'ready'].includes(order.status)) {
      return new Response(
        JSON.stringify({ error: `Cannot cancel order with status "${order.status}".` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.payment_status === 'paid') {
      return new Response(
        JSON.stringify({ error: 'Cannot cancel a paid order' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();

    // Get all items
    const { data: allItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (!allItems || allItems.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No items found for this order' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingCancelledItems = (order.cancelled_items as any[]) || [];
    const isPartialCancel = itemIds && itemIds.length > 0 && itemIds.length < allItems.length;

    if (isPartialCancel) {
      // PARTIAL CANCELLATION
      const validItemIds = allItems.map(i => i.id);
      const invalidIds = itemIds.filter(id => !validItemIds.includes(id));
      if (invalidIds.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Some item IDs do not belong to this order' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('tax_percentage')
        .eq('id', order.restaurant_id)
        .single();

      const taxPercentage = restaurant?.tax_percentage || 0;

      // Build cancelled items record BEFORE deleting
      const cancelledItemRecords = allItems
        .filter(i => itemIds.includes(i.id))
        .map(i => ({
          item_name: i.item_name,
          item_price: i.item_price,
          quantity: i.quantity,
          cancelled_at: now,
          cancelled_by: cancelledBy,
        }));

      // Delete the items
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .in('id', itemIds);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: 'Failed to cancel items' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Recalculate totals
      const remainingItems = allItems.filter(i => !itemIds.includes(i.id));
      const newSubtotal = remainingItems.reduce((sum, i) => sum + (i.item_price * i.quantity), 0);
      const newTaxAmount = newSubtotal * (taxPercentage / 100);
      const newTotal = newSubtotal + newTaxAmount;

      // Store cancelled items in order record
      const updatedCancelledItems = [...existingCancelledItems, ...cancelledItemRecords];

      await supabase
        .from('orders')
        .update({
          subtotal: newSubtotal,
          tax_amount: newTaxAmount,
          total_amount: newTotal,
          cancelled_items: updatedCancelledItems,
          updated_at: now,
        })
        .eq('id', orderId);

      // Update session total
      const cancelledItemsTotal = allItems
        .filter(i => itemIds.includes(i.id))
        .reduce((sum, i) => sum + (i.item_price * i.quantity), 0);
      const cancelledAmount = cancelledItemsTotal + cancelledItemsTotal * (taxPercentage / 100);

      const { data: currentSession } = await supabase
        .from('table_sessions')
        .select('total_amount')
        .eq('id', sessionId)
        .single();

      if (currentSession) {
        const newSessionTotal = Math.max(0, (currentSession.total_amount || 0) - cancelledAmount);
        await supabase
          .from('table_sessions')
          .update({ total_amount: newSessionTotal })
          .eq('id', sessionId);
      }

      const cancelledItemNames = cancelledItemRecords.map(i => `${i.quantity}x ${i.item_name}`);

      await supabase.from('audit_logs').insert({
        restaurant_id: order.restaurant_id,
        action: `${cancelledBy}_item_cancellation`,
        entity_type: 'order',
        entity_id: orderId,
        details: {
          session_id: sessionId,
          cancelled_items: cancelledItemNames,
          cancelled_item_ids: itemIds,
          cancelled_amount: cancelledAmount,
          cancelled_by: cancelledBy,
          reason: reason || `Items cancelled by ${cancelledBy}`,
          cancelled_at: now,
        },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          type: 'partial',
          message: `${itemIds.length} item(s) cancelled successfully`,
          cancelledItems: cancelledItemNames,
          newTotal: newTotal,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FULL ORDER CANCELLATION — record all items as cancelled
    const cancelledItemRecords = allItems.map(i => ({
      item_name: i.item_name,
      item_price: i.item_price,
      quantity: i.quantity,
      cancelled_at: now,
      cancelled_by: cancelledBy,
    }));

    const updatedCancelledItems = [...existingCancelledItems, ...cancelledItemRecords];

    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled',
        cancelled_items: updatedCancelledItems,
        updated_at: now,
      })
      .eq('id', orderId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to cancel order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reduce session total
    const { data: currentSession } = await supabase
      .from('table_sessions')
      .select('total_amount')
      .eq('id', sessionId)
      .single();

    if (currentSession) {
      const cancelledAmount = order.total_amount || 0;
      const newSessionTotal = Math.max(0, (currentSession.total_amount || 0) - cancelledAmount);
      await supabase
        .from('table_sessions')
        .update({ total_amount: newSessionTotal })
        .eq('id', sessionId);
    }

    // Check remaining active orders
    const { data: remainingOrders } = await supabase
      .from('orders')
      .select('id, status, payment_status')
      .eq('session_id', sessionId)
      .not('status', 'eq', 'cancelled');

    if (!remainingOrders || remainingOrders.length === 0) {
      if (order.table_id) {
        await supabase
          .from('restaurant_tables')
          .update({ status: 'vacant' })
          .eq('id', order.table_id);
      }
    }

    const cancelledItemNames = allItems.map(i => `${i.quantity}x ${i.item_name}`);
    await supabase.from('audit_logs').insert({
      restaurant_id: order.restaurant_id,
      action: `${cancelledBy}_order_cancellation`,
      entity_type: 'order',
      entity_id: orderId,
      details: { 
        session_id: sessionId,
        cancelled_items: cancelledItemNames,
        cancelled_amount: order.total_amount,
        cancelled_by: cancelledBy,
        reason: reason || `Cancelled by ${cancelledBy}`,
        cancelled_at: now,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        type: 'full',
        message: 'Order cancelled successfully',
        cancelledItems: cancelledItemNames,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});