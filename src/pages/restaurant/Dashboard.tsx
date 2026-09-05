import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Restaurant, Order } from '@/types/database';
import { UtensilsCrossed, ClipboardList, Table, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
import { useNotifications } from '@/hooks/useNotifications';

export default function RestaurantDashboard() {
  const { user, restaurant: authRestaurant, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(authRestaurant);
  const [stats, setStats] = useState({
    menuItems: 0,
    tables: 0,
    occupiedTables: 0,
    vacantTables: 0,
    todayOrders: 0,
    pendingOrders: 0,
  });
  const [loading, setLoading] = useState(!authRestaurant);
  
  const { 
    notifications, 
    addNotification,
    markRead, 
    clearAll, 
    processOrderChange, 
    processRequestChange,
    previousOrdersRef 
  } = useNotifications();

  useEffect(() => {
    if (authRestaurant) setRestaurant(authRestaurant);
  }, [authRestaurant]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/restaurant');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, authRestaurant]);

  const loadData = async () => {
    let rest = authRestaurant || restaurant;
    if (!rest && user) {
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1);
      if (restaurants?.[0]) rest = restaurants[0] as unknown as Restaurant;
    }

    if (rest) {
      setRestaurant(rest);

      const [menuItemsRes, tablesRes, ordersRes] = await Promise.all([
        supabase.from('menu_items').select('id', { count: 'exact' }).eq('restaurant_id', rest.id),
        supabase.from('restaurant_tables').select('*').eq('restaurant_id', rest.id),
        supabase.from('orders').select('*').eq('restaurant_id', rest.id),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const orders = (ordersRes.data || []) as unknown as Order[];
      const todayOrders = orders.filter(o => o.created_at.startsWith(today));
      const pendingOrders = orders.filter(o => o.status === 'new' || o.status === 'preparing');
      
      const allTables = (tablesRes.data || []) as any[];
      const occupiedCount = allTables.filter(t => t.status === 'occupied' || t.status === 'billing').length;
      const vacantCount = allTables.filter(t => t.status === 'vacant').length;

      setStats({
        menuItems: menuItemsRes.count || 0,
        tables: allTables.length,
        occupiedTables: occupiedCount,
        vacantTables: vacantCount,
        todayOrders: todayOrders.length,
        pendingOrders: pendingOrders.length,
      });
    }
    setLoading(false);
  };

  // Initialize previousOrdersRef with existing orders
  useEffect(() => {
    const initOrders = async () => {
      if (!restaurant) return;
      const { data } = await supabase
        .from('orders')
        .select('id')
        .eq('restaurant_id', restaurant.id);
      if (data) {
        data.forEach(order => previousOrdersRef.current.add(order.id));
      }
    };
    initOrders();
  }, [restaurant]);

  // Realtime subscription for orders
  useEffect(() => {
    if (!restaurant) return;
    
    const ordersChannel = supabase
      .channel('dashboard-orders-notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders', 
        filter: `restaurant_id=eq.${restaurant.id}` 
      }, (payload) => {
        const order = payload.new as any;
        processOrderChange(order, 'INSERT');
        loadData();
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders', 
        filter: `restaurant_id=eq.${restaurant.id}` 
      }, (payload) => {
        const order = payload.new as any;
        processOrderChange(order, 'UPDATE');
        loadData();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payment_transactions',
        filter: `restaurant_id=eq.${restaurant.id}`
      }, (payload) => {
        const txn = payload.new as any;
        if (txn.status === 'verifying' && txn.confirmed_by === 'customer') {
          addNotification(
            'Payment Awaiting Verification',
            `Customer marked payment of ₹${txn.amount} as completed`,
            'payment_pending',
            { tableNumber: undefined, customerName: undefined }
          );
        }
      })
      .subscribe();
    
    return () => { supabase.removeChannel(ordersChannel); };
  }, [restaurant, processOrderChange]);

  // Realtime subscription for customer requests
  useEffect(() => {
    if (!restaurant) return;
    
    const requestsChannel = supabase
      .channel('dashboard-requests-notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'customer_requests', 
        filter: `restaurant_id=eq.${restaurant.id}` 
      }, (payload) => {
        const request = payload.new as any;
        processRequestChange(request);
      })
      .subscribe();
    
    return () => { supabase.removeChannel(requestsChannel); };
  }, [restaurant, processRequestChange]);

  const handleCardClick = (path: string) => {
    navigate(path);
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout type="restaurant">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout type="restaurant">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{restaurant?.name || 'Dashboard'}</h1>
            <p className="text-muted-foreground mt-1">Welcome back! Here's your overview.</p>
          </div>
          <NotificationBell 
            notifications={notifications} 
            onMarkRead={markRead} 
            onClearAll={clearAll} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card 
            className={cn(
              "shadow-card hover:shadow-card-hover transition-all cursor-pointer",
              "hover:border-accent hover:scale-[1.02]"
            )}
            onClick={() => handleCardClick('/restaurant/menu')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Menu Items</CardTitle>
              <UtensilsCrossed className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.menuItems}</div>
              <p className="text-xs text-muted-foreground mt-1">Click to manage menu</p>
            </CardContent>
          </Card>

          <Card 
            className={cn(
              "shadow-card hover:shadow-card-hover transition-all cursor-pointer",
              "hover:border-accent hover:scale-[1.02]"
            )}
            onClick={() => handleCardClick('/restaurant/tables')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tables</CardTitle>
              <Table className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.tables}</div>
              <div className="flex items-center gap-3 text-xs mt-1">
                <span className="text-success">{stats.occupiedTables} occupied</span>
                <span className="text-muted-foreground">{stats.vacantTables} vacant</span>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={cn(
              "shadow-card hover:shadow-card-hover transition-all cursor-pointer",
              "hover:border-accent hover:scale-[1.02]"
            )}
            onClick={() => handleCardClick('/restaurant/kitchen')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.todayOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">Click to view orders</p>
            </CardContent>
          </Card>

          <Card 
            className={cn(
              "shadow-card hover:shadow-card-hover transition-all cursor-pointer",
              "hover:border-warning hover:scale-[1.02]"
            )}
            onClick={() => handleCardClick('/restaurant/kitchen')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
              <ClipboardList className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{stats.pendingOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">Click to view pending</p>
            </CardContent>
          </Card>
        </div>

        {restaurant && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Business Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium">{restaurant.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-medium">{restaurant.phone}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Address</dt>
                  <dd className="font-medium">{restaurant.address || 'Not set'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cuisine</dt>
                  <dd className="font-medium">{restaurant.cuisine_type || 'Not set'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Currency</dt>
                  <dd className="font-medium">{restaurant.currency}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium capitalize">{restaurant.status}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
