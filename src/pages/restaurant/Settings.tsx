import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Restaurant } from '@/types/database';
import { Upload, X, Building2, Image as ImageIcon, Save, Volume2, VolumeX, BellRing } from 'lucide-react';
import { sanitizeError } from '@/lib/errorUtils';
import { restaurantSettingsSchema, validateData } from '@/lib/validation';
import { isSoundEnabled, setSoundEnabled, playChimeSound } from '@/hooks/useNotifications';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getLogoUrl = (path: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/restaurant-logos/${path}`;
};

export default function RestaurantSettings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [cuisineType, setCuisineType] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [taxPercentage, setTaxPercentage] = useState('5');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [upiId, setUpiId] = useState('');
  const [soundEnabledState, setSoundEnabledState] = useState<boolean>(() => isSoundEnabled());
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleSound = (checked: boolean) => {
    setSoundEnabled(checked);
    setSoundEnabledState(checked);
    toast({
      title: checked ? 'Sound Notifications Enabled 🔔' : 'Sound Notifications Muted 🔇',
      description: checked ? 'Audible chime sounds will play for new orders and requests' : 'Audio chime alerts are now turned off',
    });
    if (checked) {
      playChimeSound(true);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/restaurant');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('*')
      .eq('owner_id', user!.id)
      .limit(1);

    if (restaurants && restaurants.length > 0) {
      const rest = restaurants[0] as unknown as Restaurant;
      setRestaurant(rest);
      setName(rest.name);
      setEmail(rest.email);
      setPhone(rest.phone);
      setAddress(rest.address || '');
      setCuisineType(rest.cuisine_type || '');
      setCurrency(rest.currency);
      setTaxPercentage(rest.tax_percentage.toString());
      setLogoUrl(rest.logo_url || null);
      setUpiId((rest as any).upi_id || '');
    }
    setLoading(false);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !restaurant) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please upload JPG, PNG, or WEBP images only', variant: 'destructive' });
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 2MB', variant: 'destructive' });
      return;
    }

    setUploadingLogo(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${restaurant.id}/logo.${fileExt}`;

      // Delete old logo if exists
      if (logoUrl) {
        await supabase.storage.from('restaurant-logos').remove([logoUrl]);
      }

      const { error: uploadError } = await supabase.storage
        .from('restaurant-logos')
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast({ title: 'Upload failed', description: sanitizeError(uploadError), variant: 'destructive' });
        return;
      }

      // Update database
      const { error: updateError } = await supabase
        .from('restaurants')
        .update({ logo_url: fileName })
        .eq('id', restaurant.id);

      if (updateError) {
        console.error('Update error:', updateError);
        toast({ title: 'Failed to save', description: sanitizeError(updateError), variant: 'destructive' });
        return;
      }

      setLogoUrl(fileName);
      toast({ title: 'Logo uploaded', description: 'Your restaurant logo has been updated' });
    } catch (err) {
      console.error('Upload exception:', err);
      toast({ title: 'Upload failed', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    if (!restaurant || !logoUrl) return;

    try {
      await supabase.storage.from('restaurant-logos').remove([logoUrl]);
      
      const { error } = await supabase
        .from('restaurants')
        .update({ logo_url: null })
        .eq('id', restaurant.id);

      if (error) {
        toast({ title: 'Error', description: sanitizeError(error), variant: 'destructive' });
        return;
      }

      setLogoUrl(null);
      toast({ title: 'Logo removed', description: 'Your restaurant logo has been removed' });
    } catch (err) {
      console.error('Remove error:', err);
    }
  };

  const handleSave = async () => {
    if (!restaurant) return;

    // Validate settings data
    const validation = validateData(restaurantSettingsSchema, {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim() || null,
      cuisine_type: cuisineType.trim() || null,
      currency: currency.trim(),
      tax_percentage: parseFloat(taxPercentage) || 5,
    });

    if (!validation.success) {
      toast({ title: 'Validation Error', description: validation.errors[0], variant: 'destructive' });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: validation.data.name,
          email: validation.data.email,
          phone: validation.data.phone,
          address: validation.data.address,
          cuisine_type: validation.data.cuisine_type,
          currency: validation.data.currency,
          tax_percentage: validation.data.tax_percentage,
          upi_id: upiId.trim() || null,
        })
        .eq('id', restaurant.id);

      if (error) {
        toast({ title: 'Error', description: sanitizeError(error), variant: 'destructive' });
        return;
      }

      toast({ title: 'Saved', description: 'Restaurant settings updated successfully' });
      loadData();
    } catch (err) {
      console.error('Save error:', err);
      toast({ title: 'Error', description: sanitizeError(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
      <div className="space-y-8 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your business profile and branding</p>
        </div>

        {/* Logo Section */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Restaurant Logo
            </CardTitle>
            <CardDescription>
              Your logo appears on the customer menu and order screens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {logoUrl ? (
                <div className="relative">
                  <img 
                    src={getLogoUrl(logoUrl) || ''} 
                    alt="Restaurant logo" 
                    className="w-24 h-24 object-cover rounded-xl border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={removeLogo}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-24 h-24 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed">
                  <Building2 className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-3">
                  Square images work best. Maximum size: 2MB. Supported formats: JPG, PNG, WEBP
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {logoUrl ? 'Change Logo' : 'Upload Logo'}
                    </>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic Info Section */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Business" />
              </div>
              <div className="space-y-2">
                <Label>Cuisine Type</Label>
                <Input value={cuisineType} onChange={(e) => setCuisineType(e.target.value)} placeholder="e.g., Indian, Italian" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@restaurant.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="INR" />
              </div>
              <div className="space-y-2">
                <Label>Tax Percentage (%)</Label>
                <Input type="number" value={taxPercentage} onChange={(e) => setTaxPercentage(e.target.value)} placeholder="5" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>UPI ID (for receiving payments)</Label>
              <Input 
                value={upiId} 
                onChange={(e) => setUpiId(e.target.value)} 
                placeholder="yourname@upi or 9876543210@ybl" 
              />
              <p className="text-xs text-muted-foreground">
                Enter your UPI ID to receive payments directly from customers
              </p>
            </div>

            <Button onClick={handleSave} variant="accent" disabled={saving} className="w-full md:w-auto">
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-foreground mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Sound Notifications Preferences Section */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5" />
              Sound Notifications
            </CardTitle>
            <CardDescription>
              Control audio chime alerts when new orders or customer requests arrive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  {soundEnabledState ? <Volume2 className="h-4 w-4 text-accent" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                  Sound Notifications {soundEnabledState ? 'Enabled' : 'Disabled'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Play an audible chime when new orders, payment updates, or waiter requests occur
                </p>
              </div>
              <Switch
                checked={soundEnabledState}
                onCheckedChange={handleToggleSound}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Test notification sound:</span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => playChimeSound(true)}
              >
                <Volume2 className="h-3.5 w-3.5" />
                Play Test Chime
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}