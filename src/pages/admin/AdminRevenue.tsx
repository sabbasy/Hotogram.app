import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, TrendingUp, Calendar, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RevenueByRestaurant {
  id: string;
  name: string;
  totalRevenue: number;
  todayRevenue: number;
  weekRevenue: number;
  orderCount: number;
}

interface DailyRevenue {
  date: string;
  amount: number;
}

export default function AdminRevenue() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [revenueData, setRevenueData] = useState<RevenueByRestaurant[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ total: 0, today: 0, week: 0, orders: 0 });

  useEffect(() => { 
    if (!authLoading && !user) navigate('/auth/admin'); 
  }, [user, authLoading, navigate]);
  
  useEffect(() => { 
    if (user) loadData(); 
  }, [user]);

  const loadData = async () => {
    const today = new Date();
    const todayStartObj = new Date(today);
    todayStartObj.setHours(0, 0, 0, 0);
    const todayStart = todayStartObj.toISOString();

    const weekStartObj = new Date(today);
    weekStartObj.setDate(weekStartObj.getDate() - 7);
    weekStartObj.setHours(0, 0, 0, 0);
    const weekStart = weekStartObj.toISOString();

    // Load restaurants
    const { data: restData } = await supabase
      .from('restaurants')
      .select('id, name')
      .order('name');

    // Load all paid orders
    const { data: ordersData } = await supabase
      .from('orders')
      .select('restaurant_id, total_amount, created_at')
      .eq('payment_status', 'paid');

    if (restData && ordersData) {
      const orders = ordersData as { restaurant_id: string; total_amount: number; created_at: string }[];
      
      // Calculate revenue by restaurant
      const revenueMap = new Map<string, RevenueByRestaurant>();
      
      for (const rest of restData) {
        revenueMap.set(rest.id, {
          id: rest.id,
          name: rest.name,
          totalRevenue: 0,
          todayRevenue: 0,
          weekRevenue: 0,
          orderCount: 0,
        });
      }

      // Calculate daily revenue for the last 7 days
      const dailyMap = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const date = d.toISOString().split('T')[0];
        dailyMap.set(date, 0);
      }

      for (const order of orders) {
        const restRevenue = revenueMap.get(order.restaurant_id);
        if (restRevenue) {
          restRevenue.totalRevenue += order.total_amount || 0;
          restRevenue.orderCount += 1;
          
          if (order.created_at >= todayStart) {
            restRevenue.todayRevenue += order.total_amount || 0;
          }
          if (order.created_at >= weekStart) {
            restRevenue.weekRevenue += order.total_amount || 0;
          }
        }

        // Daily revenue
        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        if (dailyMap.has(orderDate)) {
          dailyMap.set(orderDate, (dailyMap.get(orderDate) || 0) + (order.total_amount || 0));
        }
      }

      const revenueList = Array.from(revenueMap.values())
        .filter(r => r.totalRevenue > 0)
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      const dailyList = Array.from(dailyMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .reverse();

      setRevenueData(revenueList);
      setDailyRevenue(dailyList);
      setTotals({
        total: revenueList.reduce((sum, r) => sum + r.totalRevenue, 0),
        today: revenueList.reduce((sum, r) => sum + r.todayRevenue, 0),
        week: revenueList.reduce((sum, r) => sum + r.weekRevenue, 0),
        orders: revenueList.reduce((sum, r) => sum + r.orderCount, 0),
      });
    }

    setLoading(false);
  };

  if (authLoading || loading) return (
    <DashboardLayout type="platform">
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout type="platform">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <h1 className="text-3xl font-bold flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-accent" />
          Revenue Breakdown
        </h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">₹{totals.total.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Revenue</CardTitle>
              <Calendar className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">₹{totals.today.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Live</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Weekly Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">₹{totals.week.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Paid Orders</CardTitle>
              <Building2 className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">{totals.orders}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Revenue */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {dailyRevenue.map(day => (
                <div key={day.date} className="text-center p-3 border rounded-lg">
                  <p className="text-xs text-muted-foreground">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                  <p className="text-sm font-medium">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  <p className="font-bold text-accent mt-1">₹{day.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Restaurant */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Revenue by Restaurant</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No revenue data</p>
            ) : (
              <div className="space-y-3">
                {revenueData.map((rest, idx) => (
                  <div key={rest.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-muted-foreground w-8">#{idx + 1}</span>
                      <div>
                        <p className="font-medium">{rest.name}</p>
                        <p className="text-sm text-muted-foreground">{rest.orderCount} orders</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-muted-foreground">Today</p>
                        <p className="font-medium text-warning">₹{rest.todayRevenue.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Week</p>
                        <p className="font-medium text-success">₹{rest.weekRevenue.toLocaleString()}</p>
                      </div>
                      <div className="min-w-[100px]">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-bold text-lg text-accent">₹{rest.totalRevenue.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
