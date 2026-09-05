import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Crown, Mic, BarChart3, Download, Settings, RefreshCw } from 'lucide-react';
import { Restaurant, SubscriptionPlan } from '@/types/database';
import { cn } from '@/lib/utils';

const planColors: Record<SubscriptionPlan, string> = {
  free: 'bg-muted text-muted-foreground',
  basic: 'bg-info text-info-foreground',
  pro: 'bg-accent text-accent-foreground',
};

// Feature defaults for each plan (can be overridden)
const planFeatures: Record<SubscriptionPlan, { voice: boolean; analytics: boolean; export: boolean }> = {
  free: { voice: false, analytics: false, export: false },
  basic: { voice: false, analytics: true, export: false },
  pro: { voice: true, analytics: true, export: true },
};

export default function AdminSubscribers() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  useEffect(() => { 
    if (!authLoading && !user) navigate('/auth/admin'); 
  }, [user, authLoading, navigate]);
  
  useEffect(() => {
    const plan = searchParams.get('plan');
    if (plan) setPlanFilter(plan);
  }, [searchParams]);
  
  useEffect(() => { 
    if (user) loadData(); 
  }, [user]);

  // Real-time subscription for restaurant updates
  useEffect(() => {
    const channel = supabase
      .channel('subscriber-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => {
        loadData();
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .order('subscription_plan', { ascending: false });
    
    setRestaurants((data || []) as unknown as Restaurant[]);
    setLoading(false);
  };

  const updatePlan = async (restId: string, plan: SubscriptionPlan) => {
    const features = planFeatures[plan];
    const { error } = await supabase.from('restaurants').update({
      subscription_plan: plan,
      feature_voice_notes: features.voice,
      feature_analytics: features.analytics,
      feature_customer_export: features.export,
      updated_at: new Date().toISOString(),
    }).eq('id', restId);
    
    if (error) { 
      toast({ title: 'Error', description: error.message, variant: 'destructive' }); 
      return; 
    }
    toast({ title: 'Updated', description: `Plan changed to ${plan.toUpperCase()}` });
    
    // Update local state immediately
    setRestaurants(prev => prev.map(r => 
      r.id === restId 
        ? { ...r, subscription_plan: plan, feature_voice_notes: features.voice, feature_analytics: features.analytics, feature_customer_export: features.export }
        : r
    ));
    
    if (selectedRestaurant?.id === restId) {
      setSelectedRestaurant(prev => prev ? { 
        ...prev, 
        subscription_plan: plan,
        feature_voice_notes: features.voice,
        feature_analytics: features.analytics,
        feature_customer_export: features.export,
      } : null);
    }
  };

  const toggleFeature = async (restId: string, feature: 'feature_voice_notes' | 'feature_analytics' | 'feature_customer_export', value: boolean) => {
    const { error } = await supabase.from('restaurants').update({ 
      [feature]: value,
      updated_at: new Date().toISOString(),
    }).eq('id', restId);
    
    if (error) { 
      toast({ title: 'Error', description: error.message, variant: 'destructive' }); 
      return; 
    }
    
    // Update local state immediately
    setRestaurants(prev => prev.map(r => 
      r.id === restId ? { ...r, [feature]: value } : r
    ));
    
    if (selectedRestaurant?.id === restId) {
      setSelectedRestaurant(prev => prev ? { ...prev, [feature]: value } : null);
    }
    
    toast({ title: 'Updated', description: `Feature ${value ? 'enabled' : 'disabled'}` });
  };

  const filteredRestaurants = planFilter === 'all' 
    ? restaurants 
    : restaurants.filter(r => r.subscription_plan === planFilter);

  const stats = {
    total: restaurants.length,
    free: restaurants.filter(r => r.subscription_plan === 'free').length,
    basic: restaurants.filter(r => r.subscription_plan === 'basic').length,
    pro: restaurants.filter(r => r.subscription_plan === 'pro').length,
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

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Crown className="h-8 w-8 text-accent" />
            Subscribers Management
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Plan Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card 
            className={cn("shadow-card cursor-pointer hover:shadow-card-hover transition-all", planFilter === 'all' && "ring-2 ring-accent")}
            onClick={() => setPlanFilter('all')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Subscribers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card 
            className={cn("shadow-card cursor-pointer hover:shadow-card-hover transition-all", planFilter === 'free' && "ring-2 ring-muted-foreground")}
            onClick={() => setPlanFilter('free')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Free Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{stats.free}</div>
            </CardContent>
          </Card>

          <Card 
            className={cn("shadow-card cursor-pointer hover:shadow-card-hover transition-all", planFilter === 'basic' && "ring-2 ring-info")}
            onClick={() => setPlanFilter('basic')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Basic Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">{stats.basic}</div>
            </CardContent>
          </Card>

          <Card 
            className={cn("shadow-card cursor-pointer hover:shadow-card-hover transition-all", planFilter === 'pro' && "ring-2 ring-accent")}
            onClick={() => setPlanFilter('pro')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pro Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{stats.pro}</div>
            </CardContent>
          </Card>
        </div>

        {/* Feature Access Legend */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Plan Features Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Badge className="bg-muted">Free</Badge>
                <span className="text-muted-foreground">No features</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-info">Basic</Badge>
                <span className="text-muted-foreground">Analytics (optional)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-accent">Pro</Badge>
                <span className="text-muted-foreground">Voice + Analytics + Export</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscriber List */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>
              {planFilter === 'all' ? 'All Subscribers' : `${planFilter.charAt(0).toUpperCase() + planFilter.slice(1)} Plan`} 
              ({filteredRestaurants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredRestaurants.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No subscribers found</p>
            ) : (
              <div className="space-y-3">
                {filteredRestaurants.map(rest => (
                  <div key={rest.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{rest.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{rest.email}</p>
                    </div>
                    
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {/* Features - Visual Indicators */}
                      <div className="flex items-center gap-1.5" title="Enabled Features">
                        <div 
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            rest.feature_voice_notes 
                              ? 'bg-success/20 text-success' 
                              : 'bg-muted/50 text-muted-foreground/40'
                          )}
                          title="Voice Notes"
                        >
                          <Mic className="h-3.5 w-3.5" />
                        </div>
                        <div 
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            rest.feature_analytics 
                              ? 'bg-success/20 text-success' 
                              : 'bg-muted/50 text-muted-foreground/40'
                          )}
                          title="Analytics"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                        </div>
                        <div 
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            rest.feature_customer_export 
                              ? 'bg-success/20 text-success' 
                              : 'bg-muted/50 text-muted-foreground/40'
                          )}
                          title="Customer Export"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      
                      {/* Last Updated */}
                      <div className="text-right min-w-[100px]">
                        <p className="text-xs text-muted-foreground">Updated</p>
                        <p className="text-sm">{new Date(rest.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      
                      {/* Plan Badge */}
                      <Badge className={cn("min-w-[60px] justify-center uppercase font-semibold", planColors[rest.subscription_plan])}>
                        {rest.subscription_plan}
                      </Badge>
                      
                      {/* Status Badge */}
                      <Badge className={cn(
                        "min-w-[70px] justify-center capitalize",
                        rest.status === 'active' ? 'bg-success text-success-foreground' : 
                        rest.status === 'pending' ? 'bg-warning text-warning-foreground' : 'bg-muted'
                      )}>
                        {rest.status}
                      </Badge>
                      
                      {/* Settings Button */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedRestaurant(rest)}
                        className="shrink-0"
                      >
                        <Settings className="h-4 w-4" />
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
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {selectedRestaurant?.name} - Settings
            </DialogTitle>
          </DialogHeader>
          {selectedRestaurant && (
            <div className="space-y-6">
              {/* Plan Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Subscription Plan</label>
                <Select 
                  value={selectedRestaurant.subscription_plan} 
                  onValueChange={(v) => updatePlan(selectedRestaurant.id, v as SubscriptionPlan)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        Free
                      </div>
                    </SelectItem>
                    <SelectItem value="basic">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-info" />
                        Basic
                      </div>
                    </SelectItem>
                    <SelectItem value="pro">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent" />
                        Pro
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Changing plan will reset features to plan defaults
                </p>
              </div>
              
              {/* Feature Toggles */}
              <div className="space-y-4">
                <h4 className="font-medium">Feature Overrides</h4>
                <p className="text-xs text-muted-foreground">
                  Toggle features individually (overrides plan defaults)
                </p>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-md",
                      selectedRestaurant.feature_voice_notes ? 'bg-success/20 text-success' : 'bg-muted'
                    )}>
                      <Mic className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-sm font-medium">Voice Notes</span>
                      <p className="text-xs text-muted-foreground">Customer voice messages</p>
                    </div>
                  </div>
                  <Switch
                    checked={selectedRestaurant.feature_voice_notes}
                    onCheckedChange={(v) => toggleFeature(selectedRestaurant.id, 'feature_voice_notes', v)}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-md",
                      selectedRestaurant.feature_analytics ? 'bg-success/20 text-success' : 'bg-muted'
                    )}>
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-sm font-medium">Analytics</span>
                      <p className="text-xs text-muted-foreground">Performance insights</p>
                    </div>
                  </div>
                  <Switch
                    checked={selectedRestaurant.feature_analytics}
                    onCheckedChange={(v) => toggleFeature(selectedRestaurant.id, 'feature_analytics', v)}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-md",
                      selectedRestaurant.feature_customer_export ? 'bg-success/20 text-success' : 'bg-muted'
                    )}>
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-sm font-medium">Customer Export</span>
                      <p className="text-xs text-muted-foreground">Export contact data</p>
                    </div>
                  </div>
                  <Switch
                    checked={selectedRestaurant.feature_customer_export}
                    onCheckedChange={(v) => toggleFeature(selectedRestaurant.id, 'feature_customer_export', v)}
                  />
                </div>
              </div>
              
              {/* Current Status */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={cn(
                    selectedRestaurant.status === 'active' ? 'bg-success' : 
                    selectedRestaurant.status === 'pending' ? 'bg-warning' : 'bg-muted'
                  )}>
                    {selectedRestaurant.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Member Since</span>
                  <span>{new Date(selectedRestaurant.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>{new Date(selectedRestaurant.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
