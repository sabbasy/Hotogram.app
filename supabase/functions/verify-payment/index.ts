import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerifyPaymentRequest {
  transactionId: string;
  orderId?: string;
  sessionId?: string;
  action: 'initiate' | 'confirm' | 'check_status' | 'staff_confirm' | 'staff_reject';
  amount?: number;
  restaurantId?: string;
  staffNotes?: string;
  upiReference?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: VerifyPaymentRequest = await req.json();
    const { transactionId, orderId, sessionId, action, amount, restaurantId, staffNotes, upiReference } = body;

    console.log(`[verify-payment] Action: ${action}, TxnId: ${transactionId}, OrderId: ${orderId}`);

    if (action === 'initiate') {
      if (!restaurantId || !amount) {
        return new Response(
          JSON.stringify({ error: 'restaurantId and amount are required for initiate' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: transaction, error: insertError } = await supabase
        .from('payment_transactions')
        .insert({
          restaurant_id: restaurantId,
          order_id: orderId || null,
          session_id: sessionId || null,
          transaction_id: transactionId,
          amount: amount,
          payment_method: 'upi',
          status: 'pending',
          initiated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('[verify-payment] Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, transaction }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'check_status') {
      const { data: transaction, error: fetchError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

      if (fetchError) {
        return new Response(
          JSON.stringify({ error: 'Transaction not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, transaction }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'confirm') {
      // Customer confirms they completed payment
      // This ONLY marks the transaction as "verifying" (awaiting staff verification)
      // It does NOT mark orders as paid - only staff can do that
      const { data: transaction, error: fetchError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

      if (fetchError || !transaction) {
        return new Response(
          JSON.stringify({ error: 'Transaction not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (transaction.status === 'paid') {
        return new Response(
          JSON.stringify({ success: true, status: 'already_paid', transaction }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update transaction to verifying status - awaiting staff confirmation
      const { error: updateTxnError } = await supabase
        .from('payment_transactions')
        .update({
          status: 'verifying',
          confirmed_by: 'customer',
          notes: 'Customer marked payment as completed — awaiting staff verification',
        })
        .eq('transaction_id', transactionId);

      if (updateTxnError) {
        console.error('[verify-payment] Update transaction error:', updateTxnError);
        return new Response(
          JSON.stringify({ error: 'Failed to update transaction' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch updated transaction
      const { data: updatedTxn } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

      console.log(`[verify-payment] Customer marked payment complete for txn ${transactionId} — awaiting staff verification`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'verifying',
          transaction: updatedTxn,
          message: 'Payment marked as completed. Awaiting staff verification.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'staff_confirm') {
      // Staff manually confirms a UPI payment — this is the ONLY way to mark as paid
      const { data: transaction, error: fetchError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

      if (fetchError || !transaction) {
        return new Response(
          JSON.stringify({ error: 'Transaction not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (transaction.status === 'paid') {
        return new Response(
          JSON.stringify({ success: true, status: 'already_paid', transaction }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date().toISOString();

      // Update transaction to paid
      await supabase
        .from('payment_transactions')
        .update({
          status: 'paid',
          verified_at: now,
          confirmed_by: 'staff',
          upi_reference: upiReference || transaction.upi_reference,
          notes: staffNotes || 'Verified by staff',
        })
        .eq('transaction_id', transactionId);

      // Update orders
      if (transaction.order_id) {
        await supabase
          .from('orders')
          .update({ payment_status: 'paid', payment_method: 'upi', paid_at: now, updated_at: now })
          .eq('id', transaction.order_id);
        console.log(`[verify-payment] Staff confirmed order ${transaction.order_id}`);
      } else if (transaction.session_id) {
        const { data: pendingOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('session_id', transaction.session_id)
          .eq('payment_status', 'pending')
          .neq('status', 'cancelled');

        if (pendingOrders && pendingOrders.length > 0) {
          await supabase
            .from('orders')
            .update({ payment_status: 'paid', payment_method: 'upi', paid_at: now, updated_at: now })
            .in('id', pendingOrders.map(o => o.id));
        }
      }

      // Create invoice
      if (transaction.order_id || transaction.session_id) {
        const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
        let invoiceOrderId = transaction.order_id;
        let subtotal = 0, taxAmount = 0, totalAmount = transaction.amount;

        if (transaction.order_id) {
          const { data: od } = await supabase.from('orders').select('subtotal, tax_amount, total_amount').eq('id', transaction.order_id).single();
          if (od) { subtotal = od.subtotal; taxAmount = od.tax_amount; totalAmount = od.total_amount; }
        } else if (transaction.session_id) {
          const { data: firstOrder } = await supabase.from('orders').select('id').eq('session_id', transaction.session_id).eq('payment_status', 'paid').limit(1).single();
          if (firstOrder) invoiceOrderId = firstOrder.id;
          const { data: paidOrders } = await supabase.from('orders').select('subtotal, tax_amount, total_amount').eq('session_id', transaction.session_id).eq('payment_status', 'paid');
          if (paidOrders) {
            subtotal = paidOrders.reduce((s, o) => s + (o.subtotal || 0), 0);
            taxAmount = paidOrders.reduce((s, o) => s + (o.tax_amount || 0), 0);
            totalAmount = paidOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
          }
        }

        if (invoiceOrderId) {
          await supabase.from('invoices').insert({
            order_id: invoiceOrderId,
            restaurant_id: transaction.restaurant_id,
            invoice_number: invoiceNumber,
            subtotal, tax_amount: taxAmount, total_amount: totalAmount,
            sent_via: 'upi',
          });
        }
      }

      // Log to audit
      await supabase.from('audit_logs').insert({
        restaurant_id: transaction.restaurant_id,
        action: 'staff_payment_verification',
        entity_type: 'payment_transaction',
        entity_id: transaction.id,
        details: { transaction_id: transactionId, amount: transaction.amount, upi_reference: upiReference, notes: staffNotes },
      });

      const { data: updatedTxn } = await supabase.from('payment_transactions').select('*').eq('transaction_id', transactionId).single();

      console.log(`[verify-payment] Staff confirmed txn ${transactionId}`);
      return new Response(
        JSON.stringify({ success: true, status: 'paid', transaction: updatedTxn }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'staff_reject') {
      const { data: transaction, error: fetchError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

      if (fetchError || !transaction) {
        return new Response(
          JSON.stringify({ error: 'Transaction not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('payment_transactions')
        .update({
          status: 'failed',
          confirmed_by: 'staff',
          notes: staffNotes || 'Rejected by staff',
          updated_at: new Date().toISOString(),
        })
        .eq('transaction_id', transactionId);

      await supabase.from('audit_logs').insert({
        restaurant_id: transaction.restaurant_id,
        action: 'staff_payment_rejection',
        entity_type: 'payment_transaction',
        entity_id: transaction.id,
        details: { transaction_id: transactionId, amount: transaction.amount, notes: staffNotes },
      });

      const { data: updatedTxn } = await supabase.from('payment_transactions').select('*').eq('transaction_id', transactionId).single();

      console.log(`[verify-payment] Staff rejected txn ${transactionId}`);
      return new Response(
        JSON.stringify({ success: true, status: 'failed', transaction: updatedTxn }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[verify-payment] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});