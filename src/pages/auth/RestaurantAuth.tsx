import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { sanitizeError } from '@/lib/errorUtils';
import { restaurantSetupSchema, validateData } from '@/lib/validation';

export default function RestaurantAuth() {
  const [searchParams] = useSearchParams();
  const isSignup = searchParams.get('mode') === 'signup';
  const [mode, setMode] = useState<'login' | 'signup' | 'setup'>(isSignup ? 'signup' : 'login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [address, setAddress] = useState('');
  const [cuisineType, setCuisineType] = useState('');
  const [newUserId, setNewUserId] = useState<string | null>(null);
  
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: 'Login failed',
        description: sanitizeError(error),
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Check if user has a restaurant
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id')
      .limit(1);

    if (restaurants && restaurants.length > 0) {
      navigate('/restaurant/dashboard');
    } else {
      setMode('setup');
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signUp(email, password);

    if (error) {
      toast({
        title: 'Signup failed',
        description: sanitizeError(error),
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Get the new user's ID
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setNewUserId(user.id);
      setMode('setup');
    } else {
      // If user is null, it means Supabase requires email confirmation before logging them in.
      toast({
        title: 'Check your email',
        description: 'We sent a confirmation link to your email. Please click it to continue.',
      });
      // Optionally reset to login mode so they can login after clicking the link
      setMode('login');
    }
    setLoading(false);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: 'Error',
        description: 'Please sign in first',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Validate restaurant data
    const validation = validateData(restaurantSetupSchema, {
      name: restaurantName,
      phone: phone,
      email: email || user.email,
      address: address || null,
      cuisine_type: cuisineType || null,
    });

    if (!validation.success) {
      toast({
        title: 'Validation Error',
        description: validation.errors[0],
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Create restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .insert({
        owner_id: user.id,
        name: validation.data.name,
        email: validation.data.email || user.email,
        phone: validation.data.phone,
        address: validation.data.address,
        cuisine_type: validation.data.cuisine_type,
        status: 'active',
      })
      .select()
      .single();

    if (restaurantError) {
      toast({
        title: 'Setup failed',
        description: sanitizeError(restaurantError),
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Add restaurant_admin role
    await supabase
      .from('user_roles')
      .insert({
        user_id: user.id,
        role: 'restaurant_admin',
        restaurant_id: restaurant.id,
      });

    toast({
      title: 'Welcome!',
      description: 'Your restaurant has been set up successfully.',
    });

    navigate('/restaurant/dashboard');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">


        <Card className="shadow-card">
          <CardHeader className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <Logo iconOnly className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl">
              {mode === 'login' && 'Hotogram Login'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'setup' && 'Setup Your Business'}
            </CardTitle>
            <CardDescription>
              {mode === 'login' && 'Sign in to manage your business'}
              {mode === 'signup' && 'Register your business on Hotogram'}
              {mode === 'setup' && 'Complete your business profile'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="restaurant@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" variant="accent" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="text-accent hover:underline font-medium"
                  >
                    Sign up
                  </button>
                </p>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="restaurant@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" variant="accent" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-accent hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}

            {mode === 'setup' && (
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="restaurantName">Business Name *</Label>
                  <Input
                    id="restaurantName"
                    type="text"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="My Restaurant"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main Street, City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuisineType">Cuisine Type</Label>
                  <Input
                    id="cuisineType"
                    type="text"
                    value={cuisineType}
                    onChange={(e) => setCuisineType(e.target.value)}
                    placeholder="Indian, Italian, Chinese..."
                  />
                </div>
                <Button type="submit" variant="accent" className="w-full" disabled={loading}>
                  {loading ? 'Setting up...' : 'Complete Setup'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
