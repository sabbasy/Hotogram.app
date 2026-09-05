import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SidebarBadges {
  kitchen: number;
  requests: number;
  tables: number;
  billing: number;
}

let globalBadgesCache: SidebarBadges = {
  kitchen: 0,
  requests: 0,
  tables: 0,
  billing: 0,
};

export function useSidebarBadges(restaurantId: string | null) {
  const [badges, setBadges] = useState<SidebarBadges>(globalBadgesCache);

  const loadBadges = useCallback(async () => {
    if (!restaurantId) return;

    // Get active orders (not served, not cancelled)
    const { count: ordersCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .in('status', ['new', 'preparing', 'ready']);

    // Get pending customer requests
    const { count: requestsCount } = await supabase
      .from('customer_requests')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pending');

    // Get occupied/billing tables
    const { count: tablesCount } = await supabase
      .from('restaurant_tables')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .in('status', ['occupied', 'billing']);

    // Get unpaid orders (pending payment, not cancelled)
    const { count: billingCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('payment_status', 'pending')
      .neq('status', 'cancelled');

    const newBadges: SidebarBadges = {
      kitchen: ordersCount || 0,
      requests: requestsCount || 0,
      tables: tablesCount || 0,
      billing: billingCount || 0,
    };

    globalBadgesCache = newBadges;
    setBadges(newBadges);
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;

    loadBadges();

    // Real-time subscriptions
    const channel = supabase
      .channel(`sidebar-badges-${restaurantId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders', 
        filter: `restaurant_id=eq.${restaurantId}` 
      }, loadBadges)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'customer_requests', 
        filter: `restaurant_id=eq.${restaurantId}` 
      }, loadBadges)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'restaurant_tables', 
        filter: `restaurant_id=eq.${restaurantId}` 
      }, loadBadges)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, loadBadges]);

  const formatBadge = (count: number): string | null => {
    if (count === 0) return null;
    if (count > 9) return '9+';
    return count.toString();
  };

  return {
    badges,
    formatBadge,
    refresh: loadBadges,
  };
}
