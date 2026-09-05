import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Restaurant, Order } from '@/types/database';
import { Building2, Users, TrendingUp, DollarSign } from 'lucide-react';

interface RestaurantWithStats extends Restaurant {
  totalOrders: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<RestaurantWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) navigate('/auth/admin'); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const { data } = await supabase.from('restaurants').select('*').order('created_at', { ascending: false });
    const restaurantsWithStats: RestaurantWithStats[] = [];
    
    for (const rest of (data || []) as unknown as Restaurant[]) {
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, payment_status')
        .eq('restaurant_id', rest.id);
      
      const ordersData = (orders || []) as unknown as { total_amount: number; payment_status: string }[];
      const paidOrders = ordersData.filter(o => o.payment_status === 'paid');
      
      restaurantsWithStats.push({
        ...rest,
        totalOrders: ordersData.length,
        totalRevenue: paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      });
    }
    
    setRestaurants(restaurantsWithStats);
    setLoading(false);
  };

  const toggleStatus = async (rest: Restaurant) => {
    const newStatus = rest.status === 'active' ? 'disabled' : 'active';
    const { error } = await supabase.from('restaurants').update({ status: newStatus }).eq('id', rest.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Updated', description: `Restaurant ${newStatus}` });
    loadData();
  };

  const stats = { 
    total: restaurants.length, 
    active: restaurants.filter(r => r.status === 'active').length,
    totalOrders: restaurants.reduce((sum, r) => sum + r.totalOrders, 0),
    totalRevenue: restaurants.reduce((sum, r) => sum + r.totalRevenue, 0),
  };

  if (authLoading || loading) return <DashboardLayout type="platform"><div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading...</div></div></DashboardLayout>;

  return (
    <DashboardLayout type="platform">
      <div className="space-y-8">
        <h1 className="text-3xl font-bold">Platform Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Restaurants</CardTitle><Building2 className="h-4 w-4 text-accent" /></CardHeader><CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent></Card>
          <Card className="shadow-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Restaurants</CardTitle><Users className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-3xl font-bold text-success">{stats.active}</div></CardContent></Card>
          <Card className="shadow-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle><TrendingUp className="h-4 w-4 text-info" /></CardHeader><CardContent><div className="text-3xl font-bold text-info">{stats.totalOrders}</div></CardContent></Card>
          <Card className="shadow-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue (Paid)</CardTitle><DollarSign className="h-4 w-4 text-accent" /></CardHeader><CardContent><div className="text-3xl font-bold text-accent">₹{stats.totalRevenue.toFixed(2)}</div></CardContent></Card>
        </div>
        <Card className="shadow-card">
          <CardHeader><CardTitle>All Restaurants</CardTitle></CardHeader>
          <CardContent>
            {restaurants.length === 0 ? <p className="text-muted-foreground">No restaurants registered yet</p> : (
              <div className="space-y-4">
                {restaurants.map(rest => (
                  <div key={rest.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{rest.name}</p>
                      <p className="text-sm text-muted-foreground">{rest.email}</p>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-bold">{rest.totalOrders}</p>
                        <p className="text-muted-foreground">Orders</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-accent">₹{rest.totalRevenue.toFixed(2)}</p>
                        <p className="text-muted-foreground">Revenue</p>
                      </div>
                      <Badge className={rest.status === 'active' ? 'bg-success' : 'bg-muted'}>{rest.status}</Badge>
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(rest)}>{rest.status === 'active' ? 'Disable' : 'Enable'}</Button>
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
