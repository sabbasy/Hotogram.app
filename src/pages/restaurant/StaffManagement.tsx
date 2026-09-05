import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Restaurant, UserRole, AppRole } from '@/types/database';
import { Plus, Trash2, Users, ChefHat, User, DollarSign } from 'lucide-react';

const roleLabels: Record<string, string> = {
  kitchen_staff: 'Kitchen Staff',
  waiter: 'Waiter / Floor Staff',
  cashier: 'Cashier',
};

const roleIcons: Record<string, typeof ChefHat> = {
  kitchen_staff: ChefHat,
  waiter: User,
  cashier: DollarSign,
};

const roleColors: Record<string, string> = {
  kitchen_staff: 'bg-warning',
  waiter: 'bg-info',
  cashier: 'bg-success',
};

export default function StaffManagement() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [staffRoles, setStaffRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('kitchen_staff');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth/restaurant');
  }, [user, authLoading, navigate]);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const { data: restaurants } = await supabase.from('restaurants').select('*').eq('owner_id', user!.id).limit(1);
    if (restaurants?.[0]) {
      const rest = restaurants[0] as unknown as Restaurant;
      setRestaurant(rest);

      const { data: roles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('restaurant_id', rest.id)
        .in('role', ['kitchen_staff', 'waiter', 'cashier']);
      
      setStaffRoles((roles || []) as unknown as UserRole[]);
    }
    setLoading(false);
  };

  const handleAddStaff = async () => {
    if (!restaurant || !newEmail.trim()) return;
    setAdding(true);

    // In a real app, you'd look up the user by email
    // For now, we'll create a placeholder - the user would need to sign up first
    toast({ 
      title: 'Note', 
      description: 'Staff member must first create an account with this email. Then you can assign their role.',
    });
    
    setDialogOpen(false);
    setNewEmail('');
    setAdding(false);
  };

  const handleRemoveStaff = async (roleId: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('id', roleId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Removed', description: 'Staff role removed' });
      loadData();
    }
  };

  if (authLoading || loading) {
    return <DashboardLayout type="restaurant"><div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading...</div></div></DashboardLayout>;
  }

  return (
    <DashboardLayout type="restaurant">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Staff Management</h1>
            <p className="text-muted-foreground mt-1">Manage roles and permissions</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="accent">
                <Plus className="h-4 w-4 mr-2" />
                Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Staff Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="staff@restaurant.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kitchen_staff">Kitchen Staff</SelectItem>
                      <SelectItem value="waiter">Waiter / Floor Staff</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddStaff} variant="accent" className="w-full" disabled={adding}>
                  {adding ? 'Adding...' : 'Add Staff Member'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(['kitchen_staff', 'waiter', 'cashier'] as const).map(role => {
            const Icon = roleIcons[role];
            const count = staffRoles.filter(r => r.role === role).length;
            return (
              <Card key={role} className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{roleLabels[role]}</CardTitle>
                  <Icon className="h-4 w-4 text-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{count}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {role === 'kitchen_staff' && 'View and manage orders'}
                    {role === 'waiter' && 'Table status & requests'}
                    {role === 'cashier' && 'Billing & payments'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Staff List */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staffRoles.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No staff members added yet</p>
            ) : (
              <div className="space-y-3">
                {staffRoles.map(role => {
                  const Icon = roleIcons[role.role] || User;
                  return (
                    <div key={role.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">User ID: {role.user_id.slice(0, 8)}...</p>
                          <Badge className={roleColors[role.role]}>{roleLabels[role.role]}</Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveStaff(role.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}