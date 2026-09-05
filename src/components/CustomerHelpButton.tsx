import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bell, Droplets, Receipt, User, MessageSquare } from 'lucide-react';
import { RequestType } from '@/types/database';
import { Textarea } from '@/components/ui/textarea';

interface CustomerHelpButtonProps {
  restaurantId: string;
  tableId: string;
  tableNumber: string;
}

export function CustomerHelpButton({ restaurantId, tableId, tableNumber }: CustomerHelpButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<RequestType | 'other' | null>(null);
  const [showOther, setShowOther] = useState(false);
  const [otherMessage, setOtherMessage] = useState('');

  const sendRequest = async (type: RequestType) => {
    setLoading(type);
    
    const { error } = await supabase.from('customer_requests').insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      table_number: tableNumber,
      request_type: type,
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to send request', variant: 'destructive' });
    } else {
      const messages: Record<RequestType, string> = {
        call_waiter: 'Waiter has been notified!',
        request_water: 'Water request sent!',
        request_bill: 'Bill request sent!',
      };
      toast({ title: 'Request Sent', description: messages[type] });
      setOpen(false);
    }
    setLoading(null);
  };

  const requestOptions = [
    { type: 'call_waiter' as RequestType, icon: User, label: 'Call Waiter', color: 'text-accent' },
    { type: 'request_water' as RequestType, icon: Droplets, label: 'Need Water', color: 'text-info' },
  ];

  return (
    <>
      {/* Floating Bell Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-accent text-accent-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-accent/90 transition-all hover:scale-110 animate-pulse"
        aria-label="Request Help"
      >
        <Bell className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-accent" />
              Need Assistance?
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 gap-3 py-4">
            {requestOptions.map(({ type, icon: Icon, label, color }) => (
              <Button
                key={type}
                variant="outline"
                size="lg"
                onClick={() => sendRequest(type)}
                disabled={loading !== null}
                className="w-full justify-start gap-3 h-14"
              >
                <Icon className={`h-5 w-5 ${color}`} />
                <span>{label}</span>
                {loading === type && (
                  <div className="ml-auto animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>
                )}
              </Button>
            ))}
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Your request will be sent to the staff immediately
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
