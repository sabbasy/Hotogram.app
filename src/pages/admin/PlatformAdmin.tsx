import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Restaurant, SubscriptionPlan } from '@/types/database';
import { Building2, Users, TrendingUp, DollarSign, Settings, Mic, BarChart3, Download, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RestaurantWithStats extends Restaurant {
  totalOrders: number;
  totalRevenue: number;
  dailyOrders: number;
  todayRevenue: number;
}

const planColors: Record<SubscriptionPlan, string> = {
  free: 'bg-muted',
  basic: 'bg-info',
  pro: 'bg-accent',
};

// Feature defaults for each plan (matches user requirements)
const planFeatures: Record<SubscriptionPlan, { voice: boolean; analytics: boolean; export: boolean }> = {
  free: { voice: false, analytics: false, export: false },
  basic: { voice: false, analytics: true, export: false }, // Basic: optional analytics, no voice/export
  pro: { voice: true, analytics: true, export: true },
};

export default function PlatformAdmin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<RestaurantWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantWithStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'disabled'>('all');

  useEffect(() => { if (!authLoading && !user) navigate('/auth/admin'); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) loadData(); }, [user]);
  
  // Handle URL params for filters
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'active') setStatusFilter('active');
    else if (filter === 'pending') setStatusFilter('pending');
    else if (filter === 'disabled') setStatusFilter('disabled');
  }, [searchParams]);

  // Real-time subscription for orders and restaurants
  useEffect(() => {
    const channel = supabase
      .channel('platform-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => {
        loadData();
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    const { data } = await supabase.from('restaurants').select('*').order('created_at', { ascending: false });
    const restaurantsWithStats: RestaurantWithStats[] = [];
    const today = new Date().toISOString().split('T')[0];
    
    for (const rest of (data || []) as unknown as Restaurant[]) {
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, payment_status, created_at')
        .eq('restaurant_id', rest.id);
      
      const ordersData = (orders || []) as unknown as { total_amount: number; payment_status: string; created_at: string }[];
      const paidOrders = ordersData.filter(o => o.payment_status === 'paid');
      const todayOrders = ordersData.filter(o => o.created_at.startsWith(today));
      const todayPaidOrders = paidOrders.filter(o => o.created_at.startsWith(today));
      
      restaurantsWithStats.push({
        ...rest,
        totalOrders: ordersData.length,
        totalRevenue: paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
        dailyOrders: todayOrders.length,
        todayRevenue: todayPaidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
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

  const updatePlan = async (restId: string, plan: SubscriptionPlan) => {
    const features = planFeatures[plan];
    const { error } = await supabase.from('restaurants').update({
      subscription_plan: plan,
      feature_voice_notes: features.voice,
      feature_analytics: features.analytics,
      feature_customer_export: features.export,
    }).eq('id', restId);
    
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Updated', description: `Plan changed to ${plan}` });
    loadData();
    setSelectedRestaurant(null);
  };

  const toggleFeature = async (restId: string, feature: 'feature_voice_notes' | 'feature_analytics' | 'feature_customer_export', value: boolean) => {
    const { error } = await supabase.from('restaurants').update({ [feature]: value }).eq('id', restId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    loadData();
    if (selectedRestaurant) {
      setSelectedRestaurant({ ...selectedRestaurant, [feature]: value });
    }
  };

  const filteredRestaurants = statusFilter === 'all' 
    ? restaurants 
    : restaurants.filter(r => r.status === statusFilter);

  const stats = { 
    total: restaurants.length, 
    active: restaurants.filter(r => r.status === 'active').length,
    totalOrders: restaurants.reduce((sum, r) => sum + r.totalOrders, 0),
    totalRevenue: restaurants.reduce((sum, r) => sum + r.totalRevenue, 0),
    proCount: restaurants.filter(r => r.subscription_plan === 'pro').length,
  };

  const handleCardClick = (target: string, filter?: string) => {
    if (target === 'restaurants') {
      if (filter) {
        setStatusFilter(filter as any);
      } else {
        setStatusFilter('all');
      }
    } else if (target === 'orders') {
      navigate('/admin/orders');
    } else if (target === 'revenue') {
      navigate('/admin/revenue');
    } else if (target === 'subscribers') {
      navigate('/admin/subscribers?plan=pro');
    }
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
      <div className="space-y-8">
        <h1 className="text-3xl font-bold">Platform Dashboard</h1>
        
        {/* Stats - Clickable Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card 
            className={cn(
              "shadow-card cursor-pointer transition-all",
              "hover:shadow-card-hover hover:border-accent hover:scale-[1.02]"
            )}
            onClick={() => handleCardClick('restaurants')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Restaurants</CardTitle>
              <Building2 className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Click to view all</p>
            </CardContent>
          </Card>
          
          <Card 
            className={cn(
              "shadow-card cursor-pointer transition-all",
              "hover:shadow-card-hover hover:border-success hover:scale-[1.02]"
            )}
            onClick={() => handleCardClick('restaurants', 'active')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
              <Users className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.active}</div>
              <p className="text-xs text-muted-foreground">Click to filter active</p>
            </CardContent>
          </Card>
          
          <Card 
            className={cn(
              "shadow-card cursor-pointer transition-all",
              "hover:shadow-card-hover hover:border-info hover:scale-[1.02]"
            )}
            onClick={() => handleCardClick('orders')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">Click to view all</p>
            </CardContent>
          </Card>
          
          <Card 
            className={cn(
              "shadow-card cursor-pointer transition-all",
              "hover:shadow-card-hover hover:border-accent hover:scale-[1.02]"
            )}
            onClick={() => handleCardClick('revenue')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">₹{stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Click for breakdown</p>
            </CardContent>
          </Card>
          
          <Card 
            className={cn(
              "shadow-card cursor-pointer transition-all",
              "hover:shadow-card-hover hover:border-warning hover:scale-[1.02]"
            )}
            onClick={() => handleCardClick('subscribers')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pro Subscribers</CardTitle>
              <Calendar className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.proCount}</div>
              <p className="text-xs text-muted-foreground">Click to view</p>
            </CardContent>
          </Card>
        </div>

        {/* Restaurant List */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {statusFilter === 'all' ? 'All Restaurants' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Restaurants`}
            </CardTitle>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {filteredRestaurants.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No restaurants found</p>
            ) : (
              <div className="space-y-4">
                {filteredRestaurants.map(rest => (
                  <div key={rest.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium">{rest.name}</p>
                      <p className="text-sm text-muted-foreground">{rest.email}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center min-w-[60px]">
                        <p className="font-bold">{rest.dailyOrders}</p>
                        <p className="text-muted-foreground text-xs">Today</p>
                      </div>
                      <div className="text-center min-w-[60px]">
                        <p className="font-bold">{rest.totalOrders}</p>
                        <p className="text-muted-foreground text-xs">Total</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <p className="font-bold text-accent">₹{rest.totalRevenue.toLocaleString()}</p>
                        <p className="text-muted-foreground text-xs">Revenue</p>
                      </div>
                      <div className="text-center min-w-[70px]">
                        <p className="font-bold text-warning">₹{rest.todayRevenue.toLocaleString()}</p>
                        <p className="text-muted-foreground text-xs">Today</p>
                      </div>
                      <Badge className={planColors[rest.subscription_plan]}>{rest.subscription_plan}</Badge>
                      <Badge className={rest.status === 'active' ? 'bg-success' : 'bg-muted'}>{rest.status}</Badge>
                      <Button variant="outline" size="sm" onClick={() => setSelectedRestaurant(rest)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(rest)}>
                        {rest.status === 'active' ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Restaurant Settings Dialog */}
      <Dialog open={!!selectedRestaurant} onOpenChange={() => setSelectedRestaurant(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedRestaurant?.name} - Settings</DialogTitle>
          </DialogHeader>
          {selectedRestaurant && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Subscription Plan</label>
                <Select value={selectedRestaurant.subscription_plan} onValueChange={(v) => updatePlan(selectedRestaurant.id, v as SubscriptionPlan)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium">Feature Toggles</h4>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Voice Notes</span>
                  </div>
                  <Switch
                    checked={selectedRestaurant.feature_voice_notes}
                    onCheckedChange={(v) => toggleFeature(selectedRestaurant.id, 'feature_voice_notes', v)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Analytics</span>
                  </div>
                  <Switch
                    checked={selectedRestaurant.feature_analytics}
                    onCheckedChange={(v) => toggleFeature(selectedRestaurant.id, 'feature_analytics', v)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Customer Export</span>
                  </div>
                  <Switch
                    checked={selectedRestaurant.feature_customer_export}
                    onCheckedChange={(v) => toggleFeature(selectedRestaurant.id, 'feature_customer_export', v)}
                  />
                </div>
              </div>
              
              {/* Revenue Summary */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Revenue Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Revenue</p>
                    <p className="font-bold text-lg text-accent">₹{selectedRestaurant.totalRevenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Today's Revenue</p>
                    <p className="font-bold text-lg text-warning">₹{selectedRestaurant.todayRevenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Orders</p>
                    <p className="font-bold">{selectedRestaurant.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Today's Orders</p>
                    <p className="font-bold">{selectedRestaurant.dailyOrders}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
