import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PaymentTransaction, Restaurant } from '@/types/database';
import { Check, XCircle, Clock, Eye, ShieldCheck, AlertTriangle, History } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  restaurant: Restaurant;
  onPaymentUpdate: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning/15 text-warning border border-warning/30',
  verifying: 'bg-info/15 text-info border border-info/30',
  paid: 'bg-success/15 text-success border border-success/30',
  failed: 'bg-destructive/15 text-destructive border border-destructive/30',
  expired: 'bg-muted text-muted-foreground border border-border',
};

export function PaymentTransactionsPanel({ restaurant, onPaymentUpdate }: Props) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTxn, setSelectedTxn] = useState<PaymentTransaction | null>(null);
  const [verifyDialog, setVerifyDialog] = useState(false);
  const [upiRef, setUpiRef] = useState('');
  const [staffNotes, setStaffNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');

  useEffect(() => {
    loadTransactions();

    const channel = supabase
      .channel('payment-txn-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_transactions', filter: `restaurant_id=eq.${restaurant.id}` }, () => loadTransactions())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurant.id]);

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setTransactions((data || []) as unknown as PaymentTransaction[]);
    setLoading(false);
  };

  const filteredTxns = filter === 'all' ? transactions : transactions.filter(t => t.status === filter);
  const pendingCount = transactions.filter(t => t.status === 'pending' || t.status === 'verifying').length;

  const handleStaffConfirm = async () => {
    if (!selectedTxn) return;
    setProcessing(true);
    try {
      const res = await supabase.functions.invoke('verify-payment', {
        body: {
          transactionId: selectedTxn.transaction_id,
          action: 'staff_confirm',
          upiReference: upiRef || undefined,
          staffNotes: staffNotes || undefined,
        },
      });
      if (res.error) throw new Error(res.error.message);
      toast({ title: 'Payment Confirmed', description: `Transaction ${selectedTxn.transaction_id.slice(0, 8)}... verified` });
      setVerifyDialog(false);
      setSelectedTxn(null);
      setUpiRef('');
      setStaffNotes('');
      loadTransactions();
      onPaymentUpdate();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleStaffReject = async () => {
    if (!selectedTxn) return;
    setProcessing(true);
    try {
      const res = await supabase.functions.invoke('verify-payment', {
        body: {
          transactionId: selectedTxn.transaction_id,
          action: 'staff_reject',
          staffNotes: staffNotes || 'Payment not received',
        },
      });
      if (res.error) throw new Error(res.error.message);
      toast({ title: 'Payment Rejected', description: 'Transaction marked as failed' });
      setVerifyDialog(false);
      setSelectedTxn(null);
      setStaffNotes('');
      loadTransactions();
      onPaymentUpdate();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground animate-pulse">Loading transactions...</div>;
  }

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              UPI Transactions
              {pendingCount > 0 && (
                <Badge className="bg-warning/15 text-warning border border-warning/30 ml-2">
                  {pendingCount} pending
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-1">
              {(['all', 'pending', 'paid', 'failed'] as const).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? 'default' : 'ghost'}
                  className="text-xs capitalize"
                  onClick={() => setFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTxns.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No transactions found</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredTxns.map(txn => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm truncate">{txn.transaction_id.slice(0, 12)}...</p>
                      <Badge className={cn('text-xs capitalize', statusColors[txn.status])}>
                        {txn.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(txn.initiated_at).toLocaleString()}
                      {txn.confirmed_by && ` • by ${txn.confirmed_by}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="font-bold whitespace-nowrap">
                      {restaurant.currency} {txn.amount.toFixed(2)}
                    </span>
                    {(txn.status === 'pending' || txn.status === 'verifying') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedTxn(txn); setVerifyDialog(true); setUpiRef(''); setStaffNotes(''); }}
                      >
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Verify
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setSelectedTxn(txn); }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verify Dialog */}
      <Dialog open={verifyDialog} onOpenChange={v => { if (!v) { setVerifyDialog(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify UPI Payment</DialogTitle>
          </DialogHeader>
          {selectedTxn && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-mono text-xs">{selectedTxn.transaction_id.slice(0, 16)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold">{restaurant.currency} {selectedTxn.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={cn('text-xs capitalize', statusColors[selectedTxn.status])}>
                    {selectedTxn.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Initiated</span>
                  <span>{new Date(selectedTxn.initiated_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">UPI Reference (optional)</label>
                <Input
                  placeholder="e.g. 123456789012"
                  value={upiRef}
                  onChange={e => setUpiRef(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Staff Notes (optional)</label>
                <Textarea
                  placeholder="Any notes about this verification..."
                  value={staffNotes}
                  onChange={e => setStaffNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 bg-success hover:bg-success/90"
                  onClick={handleStaffConfirm}
                  disabled={processing}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {processing ? 'Processing...' : 'Confirm Paid'}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleStaffReject}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction Detail Dialog (view-only, when not in verify mode) */}
      <Dialog open={!!selectedTxn && !verifyDialog} onOpenChange={() => setSelectedTxn(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTxn && (
            <div className="space-y-3 text-sm">
              {[
                ['Transaction ID', selectedTxn.transaction_id],
                ['Amount', `${restaurant.currency} ${selectedTxn.amount.toFixed(2)}`],
                ['Status', selectedTxn.status],
                ['Payment Method', selectedTxn.payment_method],
                ['Initiated', new Date(selectedTxn.initiated_at).toLocaleString()],
                ['Verified', selectedTxn.verified_at ? new Date(selectedTxn.verified_at).toLocaleString() : '-'],
                ['Confirmed By', selectedTxn.confirmed_by || '-'],
                ['UPI Reference', selectedTxn.upi_reference || '-'],
                ['Notes', selectedTxn.notes || '-'],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right max-w-[60%] break-all">{value}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
