import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Restaurant, CustomerContact } from '@/types/database';
import { Download, Users, Mail, Phone } from 'lucide-react';

export default function ContactExport() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
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
      const { data: contactsData } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('restaurant_id', rest.id)
        .eq('consent_given', true)
        .order('created_at', { ascending: false });
      setContacts((contactsData || []) as unknown as CustomerContact[]);
    }
    setLoading(false);
  };

  const exportCSV = () => {
    if (contacts.length === 0) {
      toast({ title: 'No Data', description: 'No contacts to export', variant: 'destructive' });
      return;
    }

    const headers = ['Name', 'Phone', 'Email', 'Consent Date', 'Created At'];
    const rows = contacts.map(c => [
      c.name || '',
      c.phone || '',
      c.email || '',
      c.consent_timestamp ? new Date(c.consent_timestamp).toISOString() : '',
      new Date(c.created_at).toISOString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${restaurant?.name?.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${contacts.length} contacts exported` });
  };

  const stats = {
    total: contacts.length,
    withPhone: contacts.filter(c => c.phone).length,
    withEmail: contacts.filter(c => c.email).length,
  };

  if (authLoading || loading) {
    return <DashboardLayout type="restaurant"><div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading...</div></div></DashboardLayout>;
  }

  return (
    <DashboardLayout type="restaurant">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customer Contacts</h1>
            <p className="text-muted-foreground mt-1">Consented customer contact information</p>
          </div>
          <Button variant="accent" onClick={exportCSV} disabled={contacts.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">With Phone</CardTitle>
              <Phone className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats.withPhone}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">With Email</CardTitle>
              <Mail className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-info">{stats.withEmail}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Contact List</CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No contacts with consent yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Name</th>
                      <th className="text-left py-3 px-2">Phone</th>
                      <th className="text-left py-3 px-2">Email</th>
                      <th className="text-left py-3 px-2">Consent Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(contact => (
                      <tr key={contact.id} className="border-b last:border-0">
                        <td className="py-3 px-2 font-medium">{contact.name || '-'}</td>
                        <td className="py-3 px-2">{contact.phone || '-'}</td>
                        <td className="py-3 px-2">{contact.email || '-'}</td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {contact.consent_timestamp ? new Date(contact.consent_timestamp).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}