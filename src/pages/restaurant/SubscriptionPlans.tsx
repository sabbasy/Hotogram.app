import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Restaurant, SubscriptionPlan } from '@/types/database';
import { Crown, Check, X, ArrowLeft, Mic, BarChart3, Download, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const plans: { 
  key: SubscriptionPlan; 
  name: string; 
  tagline: string;
  features: { label: string; icon: React.ReactNode; included: boolean }[];
}[] = [
  {
    key: 'free',
    name: 'Free',
    tagline: 'Get started with the essentials',
    features: [
      { label: 'Menu & QR Ordering', icon: <Check className="h-4 w-4" />, included: true },
      { label: 'Table Management', icon: <Check className="h-4 w-4" />, included: true },
      { label: 'Billing & Invoices', icon: <Check className="h-4 w-4" />, included: true },
      { label: 'Voice Notes', icon: <Mic className="h-4 w-4" />, included: false },
      { label: 'Analytics Dashboard', icon: <BarChart3 className="h-4 w-4" />, included: false },
      { label: 'Customer Data Export', icon: <Download className="h-4 w-4" />, included: false },
    ],
  },
  {
    key: 'basic',
    name: 'Basic',
    tagline: 'Insights to grow your business',
    features: [
      { label: 'Menu & QR Ordering', icon: <Check className="h-4 w-4" />, included: true },
      { label: 'Table Management', icon: <Check className="h-4 w-4" />, included: true },
      { label: 'Billing & Invoices', icon: <Check className="h-4 w-4" />, included: true },
      { label: 'Voice Notes', icon: <Mic className="h-4 w-4" />, included: false },
      { label: 'Analytics Dashboard', icon: <BarChart3 className="h-4 w-4" />, included: true },
      { label: 'Customer Data Export', icon: <Download className="h-4 w-4" />, included: false },
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'Everything you need to scale',
    features: [
      { label: 'Menu & QR Ordering', icon: <Check className="h-4 w-4" />, included: true },
      { label: 'Table Management', icon: <Check className="h-4 w-4" />, included: true },
      { label: 'Billing & Invoices', icon: <Check className="h-4 w-4" />, included: true },
      { label: 'Voice Notes', icon: <Mic className="h-4 w-4" />, included: true },
      { label: 'Analytics Dashboard', icon: <BarChart3 className="h-4 w-4" />, included: true },
      { label: 'Customer Data Export', icon: <Download className="h-4 w-4" />, included: true },
    ],
  },
];

const planStyle: Record<SubscriptionPlan, { border: string; badge: string; accent: string }> = {
  free: { border: 'border-muted', badge: 'bg-muted text-muted-foreground', accent: 'text-muted-foreground' },
  basic: { border: 'border-info', badge: 'bg-info text-info-foreground', accent: 'text-info' },
  pro: { border: 'border-accent', badge: 'bg-accent text-accent-foreground', accent: 'text-accent' },
};

export default function SubscriptionPlans() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth/restaurant');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .eq('owner_id', user!.id)
      .limit(1);
    if (data?.[0]) setRestaurant(data[0] as unknown as Restaurant);
    setLoading(false);
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

  const currentPlan = restaurant?.subscription_plan || 'free';

  return (
    <DashboardLayout type="restaurant">
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/restaurant/settings')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
            <Crown className="h-8 w-8 text-accent" />
            Subscription Plans
          </h1>
          <p className="text-muted-foreground">
            Choose the plan that fits your business. Contact your Hotogram admin to upgrade.
          </p>
        </div>

        {/* Current Plan Banner */}
        <Card className={cn("shadow-card border-2", planStyle[currentPlan].border)}>
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Star className={cn("h-5 w-5", planStyle[currentPlan].accent)} />
              <div>
                <p className="font-medium">Your Current Plan</p>
                <p className="text-sm text-muted-foreground">
                  {restaurant?.name} is on the <span className="font-semibold uppercase">{currentPlan}</span> plan
                </p>
              </div>
            </div>
            <Badge className={cn("uppercase font-bold text-sm px-4 py-1", planStyle[currentPlan].badge)}>
              {currentPlan}
            </Badge>
          </CardContent>
        </Card>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isActive = currentPlan === plan.key;
            const style = planStyle[plan.key];

            return (
              <Card
                key={plan.key}
                className={cn(
                  "shadow-card relative overflow-hidden transition-all",
                  isActive && `ring-2 ${style.border} shadow-card-hover`,
                  plan.key === 'pro' && "border-accent/50"
                )}
              >
                {plan.key === 'pro' && (
                  <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                    POPULAR
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <Badge className={cn("mx-auto uppercase font-bold mb-2", style.badge)}>
                    {plan.name}
                  </Badge>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((f) => (
                      <li key={f.label} className="flex items-center gap-3 text-sm">
                        <div className={cn(
                          "p-1 rounded-full",
                          f.included ? "bg-success/15 text-success" : "bg-muted text-muted-foreground/40"
                        )}>
                          {f.included ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        </div>
                        <span className={cn(!f.included && "text-muted-foreground/60")}>
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {isActive ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Contact Admin to Upgrade
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Active Features */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Your Active Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={cn(
                "flex items-center gap-3 p-3 rounded-lg",
                restaurant?.feature_voice_notes ? "bg-success/10" : "bg-muted/50"
              )}>
                <div className={cn(
                  "p-2 rounded-md",
                  restaurant?.feature_voice_notes ? "bg-success/20 text-success" : "bg-muted text-muted-foreground/40"
                )}>
                  <Mic className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">Voice Notes</p>
                  <p className="text-xs text-muted-foreground">
                    {restaurant?.feature_voice_notes ? 'Enabled' : 'Not available'}
                  </p>
                </div>
              </div>

              <div className={cn(
                "flex items-center gap-3 p-3 rounded-lg",
                restaurant?.feature_analytics ? "bg-success/10" : "bg-muted/50"
              )}>
                <div className={cn(
                  "p-2 rounded-md",
                  restaurant?.feature_analytics ? "bg-success/20 text-success" : "bg-muted text-muted-foreground/40"
                )}>
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">Analytics</p>
                  <p className="text-xs text-muted-foreground">
                    {restaurant?.feature_analytics ? 'Enabled' : 'Not available'}
                  </p>
                </div>
              </div>

              <div className={cn(
                "flex items-center gap-3 p-3 rounded-lg",
                restaurant?.feature_customer_export ? "bg-success/10" : "bg-muted/50"
              )}>
                <div className={cn(
                  "p-2 rounded-md",
                  restaurant?.feature_customer_export ? "bg-success/20 text-success" : "bg-muted text-muted-foreground/40"
                )}>
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">Customer Export</p>
                  <p className="text-xs text-muted-foreground">
                    {restaurant?.feature_customer_export ? 'Enabled' : 'Not available'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Need a plan change? Contact your Hotogram platform administrator.
        </p>
      </div>
    </DashboardLayout>
  );
}
