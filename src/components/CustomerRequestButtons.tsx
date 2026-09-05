import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bell, Droplets, Receipt } from 'lucide-react';
import { RequestType } from '@/types/database';

interface CustomerRequestButtonsProps {
  restaurantId: string;
  tableId: string;
  tableNumber: string;
}

export function CustomerRequestButtons({ restaurantId, tableId, tableNumber }: CustomerRequestButtonsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<RequestType | null>(null);

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
    }
    setLoading(null);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => sendRequest('call_waiter')}
        disabled={loading !== null}
        className="flex flex-col gap-1 h-auto py-3"
      >
        <Bell className="h-5 w-5 text-accent" />
        <span className="text-xs">Call Waiter</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => sendRequest('request_water')}
        disabled={loading !== null}
        className="flex flex-col gap-1 h-auto py-3"
      >
        <Droplets className="h-5 w-5 text-info" />
        <span className="text-xs">Water</span>
      </Button>
    </div>
  );
}