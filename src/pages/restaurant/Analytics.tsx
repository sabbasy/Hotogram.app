import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Restaurant, Order, OrderItem } from '@/types/database';
import { TrendingUp, DollarSign, Clock, UtensilsCrossed, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

export default function Analytics() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth/restaurant');
  }, [user, authLoading, navigate]);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const { data: restaurants } = await supabase.from('restaurants').select('*').eq('owner_id', user!.id).limit(1);
    if (restaurants?.[0]) {
      const rest = restaurants[0] as unknown as Restaurant;
      setRestaurant(rest);

      // Get last 30 days of orders
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', rest.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      setOrders((ordersData || []) as unknown as Order[]);

      // Get order items for popular items
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id);
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);
        setOrderItems((itemsData || []) as unknown as OrderItem[]);
      }
    }
    setLoading(false);
  };

  // Calculate metrics
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.created_at.startsWith(today));
  const paidOrders = orders.filter(o => o.payment_status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const todayRevenue = todayOrders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + o.total_amount, 0);

  // Daily orders chart
  const dailyData = orders.reduce((acc, order) => {
    const date = order.created_at.split('T')[0];
    const existing = acc.find(d => d.date === date);
    if (existing) {
      existing.orders++;
      if (order.payment_status === 'paid') existing.revenue += order.total_amount;
    } else {
      acc.push({ date, orders: 1, revenue: order.payment_status === 'paid' ? order.total_amount : 0 });
    }
    return acc;
  }, [] as { date: string; orders: number; revenue: number }[]);

  // Hourly distribution
  const hourlyData = orders.reduce((acc, order) => {
    const hour = new Date(order.created_at).getHours();
    const existing = acc.find(d => d.hour === hour);
    if (existing) existing.orders++;
    else acc.push({ hour, orders: 1 });
    return acc;
  }, [] as { hour: number; orders: number }[]).sort((a, b) => a.hour - b.hour);

  // Popular items
  const itemCounts = orderItems.reduce((acc, item) => {
    const existing = acc.find(i => i.name === item.item_name);
    if (existing) existing.count += item.quantity;
    else acc.push({ name: item.item_name, count: item.quantity });
    return acc;
  }, [] as { name: string; count: number }[]).sort((a, b) => b.count - a.count).slice(0, 5);

  const COLORS = ['hsl(var(--accent))', 'hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--muted))'];

  if (authLoading || loading) {
    return <DashboardLayout type="restaurant"><div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading...</div></div></DashboardLayout>;
  }

  if (!restaurant?.feature_analytics) {
    return (
      <DashboardLayout type="restaurant">
        <Card className="shadow-card">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Analytics Unavailable</h2>
            <p className="text-muted-foreground">Upgrade to Basic or Pro plan to access analytics.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout type="restaurant">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Insights for the last 30 days</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{orders.length}</div>
              <p className="text-xs text-muted-foreground">{todayOrders.length} today</p>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{restaurant.currency} {totalRevenue.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">{restaurant.currency} {todayRevenue.toFixed(0)} today</p>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order Value</CardTitle>
              <UtensilsCrossed className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{restaurant.currency} {paidOrders.length > 0 ? (totalRevenue / paidOrders.length).toFixed(0) : 0}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Peak Hour</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {hourlyData.length > 0 ? `${hourlyData.reduce((max, h) => h.orders > max.orders ? h : max, hourlyData[0]).hour}:00` : '-'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Daily Orders & Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData.slice(-14)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Line yAxisId="left" type="monotone" dataKey="orders" stroke="hsl(var(--accent))" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Orders by Hour</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tickFormatter={(v) => `${v}:00`} />
                  <YAxis />
                  <Tooltip labelFormatter={(v) => `${v}:00`} />
                  <Bar dataKey="orders" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Popular Items */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Most Ordered Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={itemCounts} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {itemCounts.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {itemCounts.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="text-muted-foreground">{item.count} orders</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}