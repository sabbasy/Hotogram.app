import { supabase } from '@/integrations/supabase/client';

export async function calculateItemPrepTime(
  itemId: string,
  defaultMinutes: number = 15
): Promise<number> {
  try {
    // Fetch last 20 completed orders for this item
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('menu_item_id', itemId)
      .limit(20);

    if (!orderItems || orderItems.length === 0) {
      return defaultMinutes;
    }

    const orderIds = orderItems.map(o => o.order_id);

    const { data: completedOrders } = await supabase
      .from('orders')
      .select('created_at, ready_at, served_at')
      .in('id', orderIds)
      .not('ready_at', 'is', null);

    if (!completedOrders || completedOrders.length === 0) {
      return defaultMinutes;
    }

    // Calculate average elapsed preparation time in minutes
    let totalMinutes = 0;
    let count = 0;

    for (const order of completedOrders) {
      if (order.created_at && (order.ready_at || order.served_at)) {
        const start = new Date(order.created_at).getTime();
        const end = new Date(order.ready_at || order.served_at!).getTime();
        const diffMinutes = Math.max(3, Math.round((end - start) / (1000 * 60)));
        if (diffMinutes > 0 && diffMinutes < 120) { // filter outliers
          totalMinutes += diffMinutes;
          count++;
        }
      }
    }

    if (count > 0) {
      const avg = Math.round(totalMinutes / count);
      // Round to nearest 5-minute bucket (e.g. 10, 15, 20 mins)
      return Math.max(5, Math.ceil(avg / 5) * 5);
    }
  } catch (err) {
    console.error('Prep time calculation error:', err);
  }

  return defaultMinutes;
}
