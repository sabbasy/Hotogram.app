import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Order, OrderItem, Restaurant, RestaurantTable } from '@/types/database';
import { OrderStatusBadge } from '@/components/ui/order-status-badge';
import { Clock, CreditCard, CheckCircle2, Loader2, XCircle, FileText, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OrderTrackerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: (Order & { items: OrderItem[] })[];
  restaurant: Restaurant | null;
  table: RestaurantTable | null;
  sessionId: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getLogoUrl = (path: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/restaurant-logos/${path}`;
};

const statusSteps = ['new', 'preparing', 'ready', 'served'] as const;

export const OrderTrackerDrawer = ({ 
  open, 
  onOpenChange, 
  orders, 
  restaurant,
  table,
  sessionId 
}: OrderTrackerDrawerProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const billRef = useRef<HTMLDivElement>(null);

  // Filter out cancelled orders from calculations
  const activeOrders = orders.filter(o => o.status !== 'cancelled');
  const unpaidOrders = activeOrders.filter(o => o.payment_status === 'pending');
  
  const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const sessionTotal = activeOrders.reduce((sum, o) => sum + o.total_amount, 0);

  const hasUpi = !!(restaurant as any)?.upi_id;

  // Get customer name from localStorage
  const customerName = sessionId ? localStorage.getItem(`customer_name_${sessionId}`) : null;

  // Navigate to full order tracker for payment & bill features
  const goToOrderTracker = () => {
    const token = table?.qr_code_token;
    if (token) {
      onOpenChange(false);
      navigate(`/order/${token}`);
    }
  };

  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<string | 'all' | null>(null);
  const [confirmingUpi, setConfirmingUpi] = useState<{orderId: string | 'all', amount: number} | null>(null);

  const handleCashSettle = async () => {
    if (!sessionId || !restaurant || !table || !selectedOrderForPayment) return;
    setProcessingId(selectedOrderForPayment);
    setShowPaymentOptions(false);
    
    // Update orders payment method
    let updateQuery = supabase.from('orders').update({ 
      payment_method: 'counter',
      payment_status: 'pending' 
    });
    
    if (selectedOrderForPayment === 'all') {
      const orderIds = unpaidOrders.map(o => o.id);
      if (orderIds.length > 0) {
        await updateQuery.in('id', orderIds);
      }
    } else {
      await updateQuery.eq('id', selectedOrderForPayment);
    }

    // Notify staff to send a waiter to collect cash payment
    const { error } = await supabase.from('customer_requests').insert({
      restaurant_id: restaurant.id,
      table_id: table.id,
      table_number: table.table_number,
      request_type: 'call_waiter',
      status: 'pending'
    });

    if (error) {
      toast({ title: 'Error', description: 'Could not notify staff', variant: 'destructive' });
    } else {
      toast({ 
        title: 'Cash payment request in process', 
        description: 'A waiter will come to your table shortly to collect cash payment.' 
      });
    }
    setProcessingId(null);
  };

  const handleUpiPayment = async () => {
    if (!restaurant || !table || !selectedOrderForPayment) return;
    const upiId = (restaurant as any)?.upi_id;
    if (!upiId) {
      toast({ title: 'Error', description: 'UPI is not configured for this restaurant.', variant: 'destructive' });
      return;
    }
    
    setShowPaymentOptions(false);

    const amount = selectedOrderForPayment === 'all' 
      ? unpaidTotal 
      : unpaidOrders.find(o => o.id === selectedOrderForPayment)?.total_amount || 0;

    const merchantName = encodeURIComponent(restaurant.name || 'Restaurant');
    const transactionNote = encodeURIComponent(`Payment for Table ${table.table_number}`);
    const url = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${merchantName}&am=${amount.toFixed(2)}&cu=INR&tn=${transactionNote}`;
    
    // Redirect to UPI app
    window.location.href = url;
    
    // Show confirmation dialog so they can verify if it succeeded when they return
    setConfirmingUpi({ orderId: selectedOrderForPayment, amount });
  };

  const handleConfirmUpiSuccess = async () => {
    if (!confirmingUpi) return;
    setProcessingId(confirmingUpi.orderId);
    
    // Update order payment method
    let updateQuery = supabase.from('orders').update({ 
      payment_method: 'upi',
      payment_status: 'pending' 
    });
    
    if (confirmingUpi.orderId === 'all') {
      const orderIds = unpaidOrders.map(o => o.id);
      if (orderIds.length > 0) await updateQuery.in('id', orderIds);
    } else {
      await updateQuery.eq('id', confirmingUpi.orderId);
    }
    
    toast({ title: 'Payment Initiated', description: 'Waiting for restaurant to confirm.' });
    setConfirmingUpi(null);
    setProcessingId(null);
  };

  const openPaymentOptions = (orderId: string | 'all') => {
    setSelectedOrderForPayment(orderId);
    setShowPaymentOptions(true);
  };

  const handleCancelOrder = async (orderId: string) => {
    setProcessingId(orderId);
    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
    if (error) {
      toast({ title: 'Error', description: 'Could not cancel order', variant: 'destructive' });
    } else {
      toast({ title: 'Order Cancelled', description: 'Your order has been cancelled successfully.' });
    }
    setProcessingId(null);
  };

  const downloadBillImage = async () => {
    if (!billRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(billRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true
      });
      const link = document.createElement('a');
      link.download = `bill-table-${table?.table_number}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: 'Success', description: 'Bill downloaded successfully!' });
    } catch (error) {
      console.error('Failed to download bill:', error);
      toast({ title: 'Error', description: 'Failed to download bill. Please try again.', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-info';
      case 'preparing': return 'bg-warning animate-pulse';
      case 'ready': return 'bg-accent';
      case 'served': return 'bg-success';
      default: return 'bg-muted';
    }
  };

  if (!restaurant || !table) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-background shadow-xl sm:rounded-l-2xl border-l border-border/50">
          <SheetHeader className="p-4 border-b border-border bg-muted/30">
            <SheetTitle className="text-xl">My Orders</SheetTitle>
            <SheetDescription>
              Table {table.table_number}{customerName ? ` • ${customerName}` : ''}
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Active Orders List */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Active Orders</h3>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No orders yet.</p>
              ) : (
                orders.map((order, i) => {
                  const stepIdx = statusSteps.indexOf(order.status as any);
                  const isPaid = order.payment_status === 'paid';
                  const canCancel = order.status === 'new';
                  
                  return (
                    <div key={order.id} className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-3 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">Order #{orders.length - i}</span>
                          {isPaid && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-bold tracking-wider uppercase">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </span>
                          )}
                        </div>
                        <OrderStatusBadge status={order.status} size="sm" />
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="flex items-center gap-1">
                        {statusSteps.map((step, idx) => (
                          <div key={step} className="flex-1 flex items-center h-1.5 rounded-full overflow-hidden bg-muted">
                            <div className={cn("h-full w-full transition-all", idx <= stepIdx ? getProgressColor(order.status) : "bg-transparent")} />
                          </div>
                        ))}
                      </div>

                      {/* Items */}
                      <div className="space-y-1 mt-2 pb-2">
                        {order.items.map(item => (
                          <div key={item.id} className="flex justify-between text-xs text-muted-foreground">
                            <span>{item.quantity}x {item.item_name}</span>
                            <span>{restaurant.currency} {(item.item_price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Order Actions */}
                      <div className="pt-3 border-t border-border flex flex-wrap gap-2">
                        {!isPaid && order.status !== 'cancelled' && (
                          order.payment_method === 'upi' ? (
                            <div className="flex-1 flex items-center justify-center gap-2 text-xs font-medium text-secondary-foreground bg-secondary/50 rounded-md h-8 border border-secondary/50">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Payment processing...
                            </div>
                          ) : order.payment_method === 'counter' ? (
                            <div className="flex-1 flex items-center justify-center gap-2 text-xs font-medium text-secondary-foreground bg-secondary/50 rounded-md h-8 border border-secondary/50">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Cash payment request in process
                            </div>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 text-xs h-8"
                              onClick={() => openPaymentOptions(order.id)}
                              disabled={processingId !== null}
                            >
                              {processingId === order.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CreditCard className="w-3 h-3 mr-1" />}
                              Pay
                            </Button>
                          )
                        )}
                        
                        {canCancel && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={processingId !== null}
                            onClick={() => handleCancelOrder(order.id)}
                          >
                            {processingId === order.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                            Cancel Order
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-border bg-muted/30 space-y-3">
            {/* View Bill Button - always visible */}
            <Button 
              className="w-full h-12 text-sm font-semibold" 
              variant="outline" 
              onClick={() => setShowBillDialog(true)}
            >
              <FileText className="h-4 w-4 mr-2" />
              View Bill
            </Button>
            
            {/* Pay Options for all unpaid orders */}
            {(() => {
              if (unpaidOrders.length === 0) return null;
              
              const allPending = unpaidOrders.every(o => o.payment_method !== 'none');
              
              if (allPending) {
                return (
                  <div className="w-full h-12 text-sm font-semibold bg-secondary/50 text-secondary-foreground rounded-md flex items-center justify-center border border-secondary/50 cursor-not-allowed opacity-80">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Payment processing...
                  </div>
                );
              }

              return (
                <Button 
                  className="w-full h-12 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90" 
                  variant="default"
                  onClick={() => openPaymentOptions('all')}
                  disabled={processingId !== null}
                >
                  {processingId === 'all' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                  {anyPending ? 'Pay Remaining' : 'Pay All'} ({restaurant.currency} {unpaidTotal.toFixed(2)})
                </Button>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Bill Dialog */}
      <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>View Bill</DialogTitle>
          </DialogHeader>
          
          <div ref={billRef} className="bg-white text-black p-6 rounded-xl space-y-5 shadow-lg border">
            {/* Header */}
            <div className="text-center space-y-1">
              {restaurant.logo_url && (
                <img src={getLogoUrl(restaurant.logo_url) || ''} alt={restaurant.name} className="h-12 mx-auto object-contain mb-2" />
              )}
              <h3 className="font-bold text-xl tracking-tight">{restaurant.name}</h3>
              {restaurant.address && (
                <p className="text-[11px] text-gray-500">{restaurant.address}</p>
              )}
              {restaurant.phone && (
                <p className="text-[11px] text-gray-500">Tel: {restaurant.phone}</p>
              )}
            </div>
            
            <div className="border-t border-dashed border-gray-300" />

            {/* Bill Meta */}
            <div className="grid grid-cols-2 gap-y-1 text-xs text-gray-600">
              <span>Table</span>
              <span className="text-right font-medium text-black">{table.table_number}</span>
              {customerName && (
                <>
                  <span>Customer</span>
                  <span className="text-right font-medium text-black">{customerName}</span>
                </>
              )}
              <span>Date & Time</span>
              <span className="text-right font-medium text-black">
                {new Date().toLocaleString('en-US', { 
                  day: '2-digit', 
                  month: 'short', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true 
                })}
              </span>
            </div>

            <div className="border-t border-dashed border-gray-300" />
            
            {/* Items */}
            <div className="space-y-4">
              {activeOrders.map((order, index) => (
                <div key={order.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Order #{activeOrders.length - index}</span>
                    <span className={cn(
                      "text-[9px] font-semibold px-1.5 py-0.5 rounded",
                      order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    )}>
                      {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                  {order.items.map(item => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="flex-1 text-gray-800">{item.item_name}</span>
                      <span className="w-8 text-center text-gray-500">x{item.quantity}</span>
                      <span className="w-20 text-right font-medium">{restaurant.currency} {(item.item_price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            
            <div className="border-t border-dashed border-gray-300" />

            {/* Totals */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{restaurant.currency} {activeOrders.reduce((sum, o) => sum + o.subtotal, 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Tax ({restaurant.tax_percentage || 0}%)</span>
                <span>{restaurant.currency} {activeOrders.reduce((sum, o) => sum + o.tax_amount, 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-2 border-t border-gray-300">
                <span>Grand Total</span>
                <span>{restaurant.currency} {sessionTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-300" />
            
            {/* Thank you & Branding */}
            <div className="text-center space-y-2 pt-1">
              <p className="text-xs italic text-gray-600 font-medium">
                Thank you for dining with us! Thanks for coming.
              </p>
              <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400 font-medium">
                <span>Powered by</span>
                <span className="font-bold text-gray-500 tracking-wider">HOTOGRAM</span>
              </div>
            </div>
          </div>

          <Button 
            className="w-full mt-4" 
            onClick={downloadBillImage}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating PNG...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download Bill (PNG)
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Payment Options Dialog */}
      <Dialog open={showPaymentOptions} onOpenChange={setShowPaymentOptions}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>Select Payment Method</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground mb-1">Amount to pay</p>
              <p className="text-3xl font-bold text-accent">
                {restaurant.currency} {selectedOrderForPayment === 'all' 
                  ? unpaidTotal.toFixed(2) 
                  : (unpaidOrders.find(o => o.id === selectedOrderForPayment)?.total_amount || 0).toFixed(2)}
              </p>
            </div>
            
            {hasUpi && (
              <Button 
                variant="accent" 
                className="w-full h-14 text-lg" 
                onClick={handleUpiPayment}
              >
                <CreditCard className="mr-2 h-5 w-5" />
                Pay via UPI
              </Button>
            )}
            
            <Button 
              variant="outline" 
              className="w-full h-14 text-lg border-2" 
              onClick={handleCashSettle}
            >
              Pay via Cash
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* UPI Confirmation Dialog */}
      <Dialog open={!!confirmingUpi} onOpenChange={(open) => !open && setConfirmingUpi(null)}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>Verify Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4 text-center">
            <div className="bg-accent/10 p-4 rounded-xl border border-accent/20">
              <p className="font-semibold text-lg text-accent">Did you complete the payment?</p>
              <p className="text-sm text-muted-foreground mt-2">
                We directed you to your UPI app. Please confirm if the payment was successful.
              </p>
            </div>
            
            <div className="space-y-3">
              <Button 
                variant="accent" 
                className="w-full h-14 text-lg font-bold shadow-md" 
                onClick={handleConfirmUpiSuccess}
                disabled={processingId !== null}
              >
                {processingId !== null ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                Yes, I have paid
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full h-14 text-lg" 
                onClick={() => setConfirmingUpi(null)}
                disabled={processingId !== null}
              >
                No, payment failed
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
