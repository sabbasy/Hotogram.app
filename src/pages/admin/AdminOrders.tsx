import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrderStatusBadge } from '@/components/ui/order-status-badge';

interface OrderWithRestaurant {
  id: string;
  table_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  restaurant_name: string;
  restaurant_id: string;
}

export default function AdminOrders() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');
  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => { 
    if (!authLoading && !user) navigate('/auth/admin'); 
  }, [user, authLoading, navigate]);
  
  useEffect(() => { 
    if (user) loadData(); 
  }, [user]);

  const loadData = async () => {
    // Load restaurants
    const { data: restData } = await supabase
      .from('restaurants')
      .select('id, name')
      .order('name');
    
    setRestaurants((restData || []) as { id: string; name: string }[]);

    // Load orders with restaurant info
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, table_number, status, payment_status, total_amount, created_at, restaurant_id')
      .order('created_at', { ascending: false })
      .limit(500);

    if (ordersData && restData) {
      const restMap = new Map(restData.map(r => [r.id, r.name]));
      const ordersWithRestaurant = (ordersData as any[]).map(order => ({
        ...order,
        restaurant_name: restMap.get(order.restaurant_id) || 'Unknown',
      }));
      setOrders(ordersWithRestaurant);
    }
    
    setLoading(false);
  };

  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (restaurantFilter !== 'all' && order.restaurant_id !== restaurantFilter) return false;
    return true;
  });

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

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package className="h-8 w-8 text-info" />
            All Orders
          </h1>
          <div className="flex gap-3">
            <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Restaurants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Restaurants</SelectItem>
                {restaurants.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="served">Served</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Orders ({filteredOrders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No orders found</p>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium">{order.restaurant_name}</p>
                      <p className="text-sm text-muted-foreground">Table {order.table_number}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center min-w-[100px]">
                        <p className="text-muted-foreground text-xs">Date</p>
                        <p className="font-medium">{new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <p className="text-muted-foreground text-xs">Amount</p>
                        <p className="font-bold text-accent">₹{(order.total_amount || 0).toLocaleString()}</p>
                      </div>
                      <OrderStatusBadge status={order.status as any} />
                      <Badge className={order.payment_status === 'paid' ? 'bg-success' : 'bg-warning'}>
                        {order.payment_status}
                      </Badge>
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
