import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { playChimeSound } from '@/hooks/useNotifications';
import { Restaurant, Order, OrderItem, RestaurantTable, TableSession } from '@/types/database';
import { OrderStatusBadge, PaymentStatusIndicator } from '@/components/ui/order-status-badge';
import { 
  UtensilsCrossed, Check,
  CreditCard, Building2, Mail, Phone,
  ArrowLeft, ShoppingBag, Download, FileText, XCircle, AlertTriangle, Smartphone,
  Loader2, CheckCircle2, Clock, Bell, History
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { cn } from '@/lib/utils';
import { CustomerHelpButton } from '@/components/CustomerHelpButton';
import { QRCodeSVG } from 'qrcode.react';

const statusLabels: Record<string, string> = {
  new: 'Order Received',
  preparing: 'Being Prepared',
  ready: 'Ready for Pickup',
  served: 'Served',
  cancelled: 'Cancelled',
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getLogoUrl = (path: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/restaurant-logos/${path}`;
};

// Status step progress
const statusSteps = ['new', 'preparing', 'ready', 'served'] as const;

export default function OrderTracker() {
  const { token, orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [table, setTable] = useState<RestaurantTable | null>(null);
  const [session, setSession] = useState<TableSession | null>(null);
  const [sessionOrders, setSessionOrders] = useState<(Order & { items: OrderItem[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBill, setShowBill] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);
  const [showOrderInvoice, setShowOrderInvoice] = useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<(Order & { items: OrderItem[] }) | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<'whatsapp' | 'email' | null>(null);
  const [contactValue, setContactValue] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [consent, setConsent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const combinedInvoiceRef = useRef<HTMLDivElement>(null);
  const orderInvoiceRef = useRef<HTMLDivElement>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [selectedCancelItems, setSelectedCancelItems] = useState<Set<string>>(new Set());
  const [cancelMode, setCancelMode] = useState<'full' | 'partial'>('full');
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [paymentTransactions, setPaymentTransactions] = useState<any[]>([]);
  
  // UPI Payment confirmation state
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  const [paymentConfirmationState, setPaymentConfirmationState] = useState<'idle' | 'waiting' | 'confirming' | 'confirmed' | 'failed'>('idle');
  const [upiAppOpened, setUpiAppOpened] = useState(false);

  useEffect(() => { 
    if (token && orderId) loadData(); 
  }, [token, orderId]);

  // Track previous statuses for notification detection
  const prevStatusesRef = useRef<Record<string, string>>({});
  const prevPaymentStatusesRef = useRef<Record<string, string>>({});
  const isInitialLoadRef = useRef<boolean>(true);

  // Show customer notification on status change
  const checkForStatusChanges = useCallback((orders: (Order & { items: OrderItem[] })[]) => {
    for (const order of orders) {
      const prevStatus = prevStatusesRef.current[order.id];
      const currentStatus = order.status;
      const prevPaymentStatus = prevPaymentStatusesRef.current[order.id];
      const currentPaymentStatus = order.payment_status;

      // Payment completion notification
      if (prevPaymentStatus && prevPaymentStatus !== 'paid' && currentPaymentStatus === 'paid') {
        playChimeSound();
        toast({
          title: '💰 Payment Received!',
          description: `Your payment has been confirmed by the restaurant. Thank you!`,
        });
      }

      // New order punched by staff/kitchen
      if (!prevStatus && !isInitialLoadRef.current) {
        playChimeSound();
        toast({
          title: '🔔 New Item Added to Order',
          description: `The kitchen added a new item to your table.`,
        });
      }
      
      // Skip if no previous status (initial load) or same status
      if (!prevStatus || prevStatus === currentStatus) continue;
      
      // Notify customer of status changes
      if (currentStatus === 'cancelled') {
        playChimeSound();
        toast({
          title: '❌ Order Cancelled',
          description: `Your order has been cancelled by the kitchen.`,
          variant: 'destructive',
        });
      } else if (currentStatus === 'preparing') {
        playChimeSound();
        toast({
          title: '👨‍🍳 Preparing Your Order',
          description: `The kitchen has started preparing your order!`,
        });
      } else if (currentStatus === 'ready') {
        playChimeSound();
        toast({
          title: '🔔 Order Ready!',
          description: `Your order is ready for pickup!`,
        });
      } else if (currentStatus === 'served') {
        playChimeSound();
        toast({
          title: '✅ Order Served',
          description: `Your order has been served. Enjoy your meal!`,
        });
      }
    }
    
    // Update tracked statuses
    const newStatuses: Record<string, string> = {};
    const newPaymentStatuses: Record<string, string> = {};
    for (const order of orders) {
      newStatuses[order.id] = order.status;
      newPaymentStatuses[order.id] = order.payment_status;
    }
    prevStatusesRef.current = newStatuses;
    prevPaymentStatusesRef.current = newPaymentStatuses;
    isInitialLoadRef.current = false;
  }, [toast]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`session-orders-${session.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders', 
        filter: `session_id=eq.${session.id}` 
      }, () => loadSessionOrders(session.id))
      .subscribe();
      
    const txnChannel = supabase
      .channel(`session-txns-${session.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payment_transactions',
        filter: `session_id=eq.${session.id}`
      }, () => loadSessionTransactions(session.id))
      .subscribe();

    loadSessionTransactions(session.id);

    return () => { 
      supabase.removeChannel(channel); 
      supabase.removeChannel(txnChannel); 
    };
  }, [session?.id]);

  const loadSessionTransactions = async (sessionId: string) => {
    const { data } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('session_id', sessionId);
    if (data) {
      setPaymentTransactions(data);
    }
  };

  const loadData = async () => {
    try {
      const { data: tableData, error: tableError } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('qr_code_token', token)
        .maybeSingle();
      
      if (tableError || !tableData) { 
        console.error('Table error:', tableError);
        setLoading(false); 
        return; 
      }
      setTable(tableData as unknown as RestaurantTable);

      // Get restaurant via secure RPC function (only returns non-sensitive data)
      const { data: restData, error: restError } = await supabase
        .rpc('get_public_restaurant_info', { _restaurant_id: tableData.restaurant_id })
        .single();
      
      if (restError) console.error('Restaurant error:', restError);
      if (restData) setRestaurant(restData as unknown as Restaurant);

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (orderError) console.error('Order error:', orderError);
      
      if (orderData) {
        const order = orderData as unknown as Order;
        
        if (order.session_id) {
          const { data: sessionData, error: sessionError } = await supabase
            .from('table_sessions')
            .select('*')
            .eq('id', order.session_id)
            .single();
          
          if (sessionError) console.error('Session error:', sessionError);
          
          if (sessionData) {
            setSession(sessionData as unknown as TableSession);
            await loadSessionOrders(sessionData.id);
          }
        } else {
          const { data: itemsData } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderId);
          setSessionOrders([{ ...order, items: (itemsData || []) as unknown as OrderItem[] }]);
        }
      }
    } catch (err) {
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionOrders = async (sessionId: string) => {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, restaurant_id, table_id, table_number, session_id, status, payment_status, payment_method, total_amount, subtotal, tax_amount, special_instructions, voice_note_url, voice_note_listened, created_at, updated_at, placed_at, accepted_at, preparing_at, ready_at, served_at, paid_at, closed_at, cancelled_items')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
      if (ordersData) {
      const ordersWithItems: (Order & { items: OrderItem[] })[] = [];
      for (const order of ordersData as unknown as Order[]) {
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id);
        ordersWithItems.push({ ...order, items: (itemsData || []) as unknown as OrderItem[] });
      }
      
      // Check for status changes and notify customer
      checkForStatusChanges(ordersWithItems);
      
      setSessionOrders(ordersWithItems);
      
      // Restore customer details from localStorage (not from DB to avoid exposing PII via RLS)
      const savedName = localStorage.getItem(`customer_name_${sessionId}`);
      const savedPhone = localStorage.getItem(`customer_phone_${sessionId}`);
      if (savedName) setCustomerName(savedName);
      if (savedPhone) setContactValue(savedPhone);
    }
  };

  const handlePayOrder = (order: Order) => {
    setSelectedOrderForPayment(order);
    setShowPayment(true);
  };

  const handleViewInvoice = (order: Order & { items: OrderItem[] }) => {
    setSelectedOrderForInvoice(order);
    setShowOrderInvoice(true);
  };

  const handlePayment = async (method: 'upi' | 'counter', order: Order) => {
    if (method === 'upi') {
      // Generate transaction ID and initiate payment
      await initiateUpiPayment(order.id, null, order.total_amount);
      return;
    }
    
    setProcessing(true);
    
    // For counter payment, just mark the payment method as counter (still pending)
    const { error } = await supabase
      .from('orders')
      .update({ 
        payment_method: method,
        payment_status: 'pending',
      })
      .eq('id', order.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Please pay at counter' });
      setShowPayment(false);
      setSelectedOrderForPayment(null);
      if (session) loadSessionOrders(session.id);
    }
    setProcessing(false);
  };

  const handlePayAllPending = async (method: 'upi' | 'counter') => {
    if (method === 'upi') {
      // Generate transaction ID and initiate payment for all pending
      await initiateUpiPayment(null, session?.id || null, pendingTotal);
      return;
    }
    
    setProcessing(true);
    // Only include non-cancelled, unpaid orders
    const pendingOrders = sessionOrders.filter(o => o.payment_status === 'pending' && o.status !== 'cancelled');
    
    for (const order of pendingOrders) {
      await supabase
        .from('orders')
        .update({ 
          payment_method: method,
          payment_status: 'pending',
        })
        .eq('id', order.id);
    }

    playChimeSound();
    toast({ title: 'Success', description: 'Payment verification requested' });
    setShowPayment(false);
    if (session) loadSessionOrders(session.id);
    setProcessing(false);
  };

  // Generate unique transaction ID
  const generateTransactionId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `TXN-${timestamp}-${random}`.toUpperCase();
  };

  // Initiate UPI payment with transaction tracking
  const initiateUpiPayment = async (orderId: string | null, sessionId: string | null, amount: number) => {
    if (!restaurant) return;
    
    const txnId = generateTransactionId();
    setCurrentTransactionId(txnId);
    setPaymentConfirmationState('idle');
    setUpiAppOpened(false);
    setShowUpiQr(true);

    try {
      // Create transaction record in backend
      const { error } = await supabase.functions.invoke('verify-payment', {
        body: {
          action: 'initiate',
          transactionId: txnId,
          orderId: orderId,
          sessionId: sessionId,
          amount: amount,
          restaurantId: restaurant.id,
        }
      });

      if (error) {
        console.error('Failed to initiate payment:', error);
        toast({
          title: 'Error',
          description: 'Could not initiate payment. Please try again.',
          variant: 'destructive'
        });
      }
      // Removed auto-redirect. User must explicitly click "Open UPI App".
    } catch (err) {
      console.error('Payment initiation error:', err);
    }
  };

  // Generate UPI payment URL with transaction reference
  const getUpiPaymentUrl = (amount: number) => {
    const upiId = (restaurant as any)?.upi_id;
    if (!upiId) return null;
    
    const merchantName = encodeURIComponent(restaurant?.name || 'Restaurant');
    const transactionNote = encodeURIComponent(`Payment for Table ${table?.table_number}`);
    const txnRef = currentTransactionId ? encodeURIComponent(currentTransactionId) : '';
    
    // Include transaction reference in UPI URL for tracking
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${merchantName}&am=${amount.toFixed(2)}&cu=INR&tn=${transactionNote}&tr=${txnRef}`;
  };

  // Handle "Open UPI App" button click
  const handleOpenUpiApp = () => {
    const amount = selectedOrderForPayment ? selectedOrderForPayment.total_amount : pendingTotal;
    const url = getUpiPaymentUrl(amount);
    if (url) {
      window.location.href = url;
      setUpiAppOpened(true);
      setPaymentConfirmationState('waiting');
    }
  };

  // Handle payment confirmation by customer — marks as "awaiting verification" only
  const handleConfirmPaymentComplete = async () => {
    if (!currentTransactionId) {
      toast({
        title: 'Error',
        description: 'No active transaction found',
        variant: 'destructive'
      });
      return;
    }

    setPaymentConfirmationState('confirming');

    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
          action: 'confirm',
          transactionId: currentTransactionId,
        }
      });

      if (error) {
        console.error('Payment confirmation error:', error);
        setPaymentConfirmationState('failed');
        toast({
          title: 'Submission Failed',
          description: 'Could not submit payment. Please contact staff.',
          variant: 'destructive'
        });
        return;
      }

      if (data?.status === 'verifying') {
        setPaymentConfirmationState('confirmed');
        toast({
          title: 'Payment Submitted',
          description: 'Awaiting verification from staff. You will be notified once confirmed.',
        });
        
        // Close dialog after short delay
        setTimeout(() => {
          setShowUpiQr(false);
          setShowPayment(false);
          setSelectedOrderForPayment(null);
          setPaymentConfirmationState('idle');
          setCurrentTransactionId(null);
          setUpiAppOpened(false);
        }, 2000);
      } else if (data?.status === 'already_paid') {
        setPaymentConfirmationState('confirmed');
        toast({
          title: 'Already Confirmed',
          description: 'This payment has already been verified.',
        });
        if (session) await loadSessionOrders(session.id);
        setTimeout(() => {
          setShowUpiQr(false);
          setShowPayment(false);
          setSelectedOrderForPayment(null);
          setPaymentConfirmationState('idle');
          setCurrentTransactionId(null);
          setUpiAppOpened(false);
        }, 1500);
      } else {
        setPaymentConfirmationState('failed');
        toast({
          title: 'Submission Failed',
          description: 'Could not submit payment. Please try again or contact staff.',
          variant: 'destructive'
        });
      }
    } catch (err) {
      console.error('Confirmation error:', err);
      setPaymentConfirmationState('failed');
      toast({
        title: 'Error',
        description: 'Failed to submit payment. Please contact staff.',
        variant: 'destructive'
      });
    }
  };

  // Reset UPI payment state
  const resetUpiPaymentState = () => {
    setShowUpiQr(false);
    setPaymentConfirmationState('idle');
    setCurrentTransactionId(null);
    setUpiAppOpened(false);
  };

  const handleDelivery = async () => {
    if (!session || !restaurant || !consent || !contactValue) return;
    setProcessing(true);

    const paidOrders = sessionOrders.filter(o => o.payment_status === 'paid');
    const totalAmount = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const subtotal = paidOrders.reduce((sum, o) => sum + o.subtotal, 0);
    const taxAmount = paidOrders.reduce((sum, o) => sum + o.tax_amount, 0);

    if (paidOrders.length > 0) {
      // Use deduplication function to prevent duplicate contacts
      await supabase.rpc('upsert_customer_contact', {
        p_restaurant_id: restaurant.id,
        p_order_id: paidOrders[0].id,
        p_name: customerName || null,
        p_phone: deliveryMethod === 'whatsapp' ? contactValue : null,
        p_email: deliveryMethod === 'email' ? contactValue : null,
        p_consent_given: true,
        p_total_spend: totalAmount
      });

      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      await supabase.from('invoices').insert({
        order_id: paidOrders[0].id,
        restaurant_id: restaurant.id,
        invoice_number: invoiceNumber,
        subtotal: subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        sent_via: deliveryMethod,
        sent_to: contactValue,
      });

      toast({ 
        title: 'Bill Sent!', 
        description: `Invoice ${invoiceNumber} sent via ${deliveryMethod}` 
      });
    }
    
    setShowDelivery(false);
    setProcessing(false);
  };

  const handleDownloadCombinedBill = async () => {
    if (!combinedInvoiceRef.current) return;
    
    try {
      const canvas = await html2canvas(combinedInvoiceRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      
      const link = document.createElement('a');
      link.download = `table-bill-${table?.table_number}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to download bill:', error);
    }
  };

  const handleDownloadOrderInvoice = async () => {
    if (!orderInvoiceRef.current || !selectedOrderForInvoice) return;
    
    try {
      const canvas = await html2canvas(orderInvoiceRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      
      const orderIndex = sessionOrders.findIndex(o => o.id === selectedOrderForInvoice.id);
      const link = document.createElement('a');
      link.download = `invoice-order-${orderIndex + 1}-${selectedOrderForInvoice.id.slice(0, 8)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to download invoice:', error);
    }
  };

  // Check if order can be cancelled (only new orders before preparation)
  const canCancelOrder = (order: Order) => {
    return order.status === 'new' && order.payment_status !== 'paid';
  };

  const handleCancelClick = (order: Order) => {
    setOrderToCancel(order);
    setSelectedCancelItems(new Set());
    setCancelMode('full');
    setShowCancelConfirm(true);
  };

  const toggleCancelItem = (itemId: string) => {
    setSelectedCancelItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleConfirmCancel = async () => {
    if (!orderToCancel || !session) return;
    
    const orderItems = sessionOrders.find(o => o.id === orderToCancel.id)?.items || [];
    const isPartial = cancelMode === 'partial' && selectedCancelItems.size > 0 && selectedCancelItems.size < orderItems.length;
    
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-order', {
        body: {
          orderId: orderToCancel.id,
          sessionId: session.id,
          ...(isPartial ? { itemIds: Array.from(selectedCancelItems) } : {}),
        }
      });

      if (error) {
        toast({ 
          title: 'Error', 
          description: 'Failed to cancel. Please try again.', 
          variant: 'destructive' 
        });
      } else if (data?.error) {
        toast({ 
          title: 'Cannot Cancel', 
          description: data.error, 
          variant: 'destructive' 
        });
      } else {
        const msg = data?.type === 'partial' 
          ? `${data.cancelledItems?.length || 0} item(s) cancelled successfully.`
          : 'Your order has been cancelled successfully.';
        toast({ title: 'Cancelled', description: msg });
        await loadSessionOrders(session.id);
      }
    } catch (err) {
      toast({ 
        title: 'Error', 
        description: 'Something went wrong. Please try again.', 
        variant: 'destructive' 
      });
    }
    
    setCancelling(false);
    setShowCancelConfirm(false);
    setOrderToCancel(null);
    setSelectedCancelItems(new Set());
  };

  // Get status color for progress bar
  const getProgressColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-info';
      case 'preparing': return 'bg-warning';
      case 'ready': return 'bg-accent';
      case 'served': return 'bg-success';
      case 'cancelled': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-info/10';
      case 'preparing': return 'bg-warning/10';
      case 'ready': return 'bg-accent/10';
      case 'served': return 'bg-success/10';
      case 'cancelled': return 'bg-destructive/10';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">Loading order...</div>
      </div>
    );
  }

  if (!restaurant || !table || sessionOrders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Order not found</div>
      </div>
    );
  }

  // Filter out cancelled orders from billing calculations
  const activeOrders = sessionOrders.filter(o => o.status !== 'cancelled');
  const cancelledOrders = sessionOrders.filter(o => o.status === 'cancelled');
  const pendingOrders = activeOrders.filter(o => o.payment_status === 'pending');
  const paidOrders = activeOrders.filter(o => o.payment_status === 'paid');
  const pendingTotal = pendingOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const paidTotal = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const sessionTotal = activeOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const allPaid = pendingOrders.length === 0 && activeOrders.length > 0;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Help Button */}
      <CustomerHelpButton
        restaurantId={restaurant.id}
        tableId={table.id}
        tableNumber={table.table_number}
      />
      <header className="sticky top-0 bg-card border-b p-4 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/menu/${token}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {restaurant.logo_url ? (
            <img src={getLogoUrl(restaurant.logo_url) || ''} alt={restaurant.name} className="h-8 w-8 object-contain rounded" />
          ) : (
            <img src="/hotogram-logo.svg" alt="Hotogram Logo" className="w-8 h-8 object-contain" />
          )}
          <div>
            <h1 className="font-bold">{restaurant.name}</h1>
            <p className="text-xs text-muted-foreground">
              {table.table_number} {customerName ? `• ${customerName} ` : ''}• {sessionOrders.length} order{sessionOrders.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Session Summary */}
        <Card className="shadow-card bg-accent/5 border-accent/20">
          <CardContent className="pt-4">
            {customerName && (
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3 pb-2 border-b border-accent/10">
                <span>Customer</span>
                <span className="font-medium text-foreground">{customerName}</span>
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Session Total</span>
              <span className="font-bold text-lg">{restaurant.currency} {sessionTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Paid</span>
              <span className="text-success">{restaurant.currency} {paidTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Unpaid</span>
              <span className="text-warning">{restaurant.currency} {pendingTotal.toFixed(2)}</span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-accent/10">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-accent border-accent/30 hover:bg-accent/10"
                onClick={() => setShowBill(true)}
              >
                <FileText className="h-4 w-4 mr-2" />
                View & Download Bill
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Orders List */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Your Orders
          </h2>
          
          {activeOrders.map((order, index) => {
            const currentStepIndex = statusSteps.indexOf(order.status as typeof statusSteps[number]);
            const isPaid = order.payment_status === 'paid';
            const canCancel = canCancelOrder(order);
            
            return (
              <Card key={order.id} className="shadow-card overflow-hidden">
                {/* Status Header */}
                <div className={cn('px-4 py-3 border-b', getStatusBgColor(order.status))}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-muted-foreground">
                        Order #{sessionOrders.indexOf(order) + 1}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <OrderStatusBadge status={order.status} size="md" />
                  </div>
                </div>
                
                <CardContent className="p-4 space-y-4">
                  {/* Status Progress Bar */}
                  <div className="flex items-center gap-1">
                    {statusSteps.map((step, stepIndex) => (
                      <div key={step} className="flex-1 flex items-center">
                        <div className={cn(
                          "h-2 flex-1 rounded-full transition-colors",
                          stepIndex <= currentStepIndex 
                            ? getProgressColor(order.status) 
                            : "bg-muted"
                        )} />
                      </div>
                    ))}
                  </div>
                  
                   {/* Order Items */}
                  <ul className="space-y-1.5">
                    {order.items.map(item => (
                      <li key={item.id} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.item_name}</span>
                        <span className="text-muted-foreground">
                          {restaurant.currency} {(item.item_price * item.quantity).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Cancelled items from partial cancellation */}
                  {(() => {
                    const cancelledItems = ((order as any).cancelled_items as any[]) || [];
                    if (cancelledItems.length === 0) return null;
                    return (
                      <div className="border border-destructive/20 rounded-lg p-2 bg-destructive/5">
                        <p className="text-[10px] font-medium text-destructive mb-1 flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Cancelled Items
                        </p>
                        <ul className="space-y-0.5">
                          {cancelledItems.map((item: any, idx: number) => (
                            <li key={idx} className="flex justify-between text-xs text-muted-foreground line-through">
                              <span>{item.quantity}x {item.item_name}</span>
                              <span>{restaurant.currency} {(item.item_price * item.quantity).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-[10px] text-destructive/60 mt-1 italic">
                          By {cancelledItems[0]?.cancelled_by || 'unknown'}
                        </p>
                      </div>
                    );
                  })()}
                  
                  {/* Order Total */}
                  <div className="flex justify-between font-medium pt-2 border-t">
                    <span>Order Total</span>
                    <span className="text-accent">
                      {restaurant.currency} {order.total_amount.toFixed(2)}
                    </span>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <PaymentStatusIndicator status={order.payment_status} paymentMethod={order.payment_method} />
                    
                    <div className="flex gap-2">
                      {canCancel && (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleCancelClick(order)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                      
                      {isPaid && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewInvoice(order)}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Invoice
                        </Button>
                      )}
                      
                      {!isPaid && (
                        (() => {
                          const isVerifying = paymentTransactions.some(t => t.status === 'verifying' && (t.order_id === order.id || !t.order_id));
                          return (
                            <Button 
                              variant={isVerifying ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => !isVerifying && handlePayOrder(order)}
                              disabled={isVerifying}
                            >
                              {isVerifying ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  Processing
                                </>
                              ) : (
                                <>
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Pay This
                                </>
                              )}
                            </Button>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {activeOrders.length === 0 && cancelledOrders.length > 0 && (
            <Card className="shadow-card">
              <CardContent className="py-8 text-center text-muted-foreground">
                <XCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p>All orders have been cancelled</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Cancellation History */}
        {cancelledOrders.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
              <History className="h-4 w-4" />
              Cancellation History ({cancelledOrders.length})
            </h2>
            
            {cancelledOrders.map((order, index) => (
              <Card key={order.id} className="shadow-card overflow-hidden opacity-60 border-destructive/20">
                <div className="px-4 py-2 border-b bg-destructive/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-xs font-medium text-destructive">
                        Order #{sessionOrders.indexOf(order) + 1} — Cancelled
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(order.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <CardContent className="p-3 space-y-2">
                  {/* Show remaining items if any */}
                  {order.items.length > 0 && (
                    <ul className="space-y-1">
                      {order.items.map(item => (
                        <li key={item.id} className="flex justify-between text-xs text-muted-foreground line-through">
                          <span>{item.quantity}x {item.item_name}</span>
                          <span>{restaurant.currency} {(item.item_price * item.quantity).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* Show cancelled items from stored records */}
                  {(() => {
                    const cancelledItems = ((order as any).cancelled_items as any[]) || [];
                    if (cancelledItems.length === 0 && order.items.length === 0) {
                      return <p className="text-xs text-muted-foreground italic">No item details available</p>;
                    }
                    if (cancelledItems.length === 0) return null;
                    return (
                      <ul className="space-y-1">
                        {cancelledItems.map((item: any, idx: number) => (
                          <li key={`c-${idx}`} className="flex justify-between text-xs text-muted-foreground line-through">
                            <span>{item.quantity}x {item.item_name}</span>
                            <span>{restaurant.currency} {(item.item_price * item.quantity).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                  <div className="flex justify-between text-xs pt-1 border-t text-muted-foreground">
                    <span>Cancelled by</span>
                    <span className="capitalize">{((order as any).cancelled_items as any[])?.[0]?.cancelled_by || 'unknown'}</span>
                  </div>
                  <p className="text-[10px] text-destructive/70 italic">
                    Not included in billing
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Payment Actions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {allPaid ? (
              <>
                <div className="text-center py-4">
                  <Check className="h-12 w-12 text-success mx-auto mb-2" />
                  <p className="font-medium text-success">All Dues Cleared!</p>
                  <p className="text-sm text-muted-foreground">Thank you for dining with us</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" className="w-full" onClick={() => setShowBill(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    View Full Bill
                  </Button>
                  {/* Digital Bill delivery hidden — future phase feature */}
                  {/* <Button variant="outline" className="w-full" onClick={() => setShowDelivery(true)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Get Digital Bill
                  </Button> */}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span>Pending Amount</span>
                  <span className="font-bold text-lg text-warning">{restaurant.currency} {pendingTotal.toFixed(2)}</span>
                </div>
                {(() => {
                  const allOrdersPaying = sessionOrders.filter(o => o.payment_status !== 'paid').every(o => o.payment_method !== 'none');
                  const isVerifying = paymentTransactions.some(t => t.status === 'verifying') || allOrdersPaying;
                  return (
                    <Button 
                      variant="accent" 
                      className="w-full" 
                      onClick={() => { setSelectedOrderForPayment(null); setShowPayment(true); }}
                      disabled={isVerifying}
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Payment Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Pay All Unpaid Orders ({restaurant.currency} {pendingTotal.toFixed(2)})
                        </>
                      )}
                    </Button>
                  );
                })()}
                <Button variant="outline" className="w-full" onClick={() => setShowBill(true)}>
                  <FileText className="h-4 w-4 mr-2" />
                  View Full Bill
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Combined Bill Dialog */}
      <Dialog open={showBill} onOpenChange={setShowBill}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Full Table Bill</DialogTitle>
          </DialogHeader>
          
          <div ref={combinedInvoiceRef} className="bg-white text-black p-6 rounded-xl space-y-5 shadow-lg border">
            {/* Header */}
            <div className="text-center space-y-1">
              {restaurant.logo_url && (
                <img src={getLogoUrl(restaurant.logo_url) || ''} alt={restaurant.name} className="h-14 mx-auto object-contain mb-2" />
              )}
              <h3 className="font-bold text-xl tracking-tight">{restaurant.name}</h3>
              {restaurant.address && (
                <p className="text-xs text-gray-500">{restaurant.address}</p>
              )}
              {restaurant.phone && (
                <p className="text-xs text-gray-500">Tel: {restaurant.phone}</p>
              )}
            </div>
            
            <div className="border-t border-dashed border-gray-300" />

            {/* Bill Meta */}
            <div className="grid grid-cols-2 gap-y-1 text-xs text-gray-600">
              <span>Table</span>
              <span className="text-right font-medium text-black">{table.table_number}</span>
              <span>Date</span>
              <span className="text-right font-medium text-black">{new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              <span>Time</span>
              <span className="text-right font-medium text-black">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              <span>Orders</span>
              <span className="text-right font-medium text-black">{activeOrders.length}</span>
            </div>

            <div className="border-t border-dashed border-gray-300" />
            
            {/* Items Table Header */}
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-gray-400 font-semibold pb-1">
              <span className="flex-1">Item</span>
              <span className="w-8 text-center">Qty</span>
              <span className="w-20 text-right">Amount</span>
            </div>

            {sessionOrders.filter(o => o.status !== 'cancelled').map((order, index) => (
              <div key={order.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Order #{index + 1}</span>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  )}>
                    {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="flex-1">{item.item_name}</span>
                    <span className="w-8 text-center text-gray-500">{item.quantity}</span>
                    <span className="w-20 text-right">{restaurant.currency} {(item.item_price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ))}
            
            <div className="border-t border-dashed border-gray-300" />

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{restaurant.currency} {activeOrders.reduce((sum, o) => sum + o.subtotal, 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Tax ({restaurant.tax_percentage || 0}%)</span>
                <span>{restaurant.currency} {activeOrders.reduce((sum, o) => sum + o.tax_amount, 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-300">
                <span>Grand Total</span>
                <span>{restaurant.currency} {sessionTotal.toFixed(2)}</span>
              </div>
              {paidTotal > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>✓ Paid</span>
                  <span>{restaurant.currency} {paidTotal.toFixed(2)}</span>
                </div>
              )}
              {pendingTotal > 0 && (
                <div className="flex justify-between text-xs text-amber-600">
                  <span>○ Pending</span>
                  <span>{restaurant.currency} {pendingTotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-300" />

            {/* Footer */}
            <div className="text-center space-y-1 pt-1">
              <p className="text-xs text-gray-500">Thank you for dining with us!</p>
              <p className="text-[10px] font-semibold text-gray-400 tracking-wider uppercase">Powered by Hotogram</p>
            </div>
          </div>
          
          <Button onClick={handleDownloadCombinedBill} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download Full Bill
          </Button>
        </DialogContent>
      </Dialog>

      {/* Individual Order Invoice Dialog */}
      <Dialog open={showOrderInvoice} onOpenChange={setShowOrderInvoice}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Invoice</DialogTitle>
          </DialogHeader>
          
          {selectedOrderForInvoice && (
            <>
              <div ref={orderInvoiceRef} className="bg-white text-black p-6 rounded-xl space-y-4 max-w-sm mx-auto border shadow-lg">
                {/* Header */}
                <div className="text-center space-y-1">
                  {restaurant.logo_url && (
                    <img src={getLogoUrl(restaurant.logo_url) || ''} alt={restaurant.name} className="h-14 mx-auto object-contain mb-2" />
                  )}
                  <h2 className="font-bold text-xl tracking-tight">{restaurant.name}</h2>
                  {restaurant.address && (
                    <p className="text-xs text-gray-500">{restaurant.address}</p>
                  )}
                  {restaurant.phone && (
                    <p className="text-xs text-gray-500">Tel: {restaurant.phone}</p>
                  )}
                </div>
                
                <div className="border-t border-dashed border-gray-300" />
                
                {/* Invoice Meta */}
                <div className="grid grid-cols-2 gap-y-1 text-xs text-gray-600">
                  <span>Invoice #</span>
                  <span className="text-right font-mono font-medium text-black">{selectedOrderForInvoice.id.slice(0, 8).toUpperCase()}</span>
                  <span>Table</span>
                  <span className="text-right font-medium text-black">{table.table_number}</span>
                  <span>Order</span>
                  <span className="text-right font-medium text-black">#{sessionOrders.findIndex(o => o.id === selectedOrderForInvoice.id) + 1}</span>
                  <span>Date</span>
                  <span className="text-right font-medium text-black">{new Date(selectedOrderForInvoice.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <span>Time</span>
                  <span className="text-right font-medium text-black">{new Date(selectedOrderForInvoice.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                  <span>Status</span>
                  <span className="text-right font-semibold text-green-600">Paid ✓</span>
                </div>
                
                <div className="border-t border-dashed border-gray-300" />
                
                {/* Items */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                    <span className="flex-1">Item</span>
                    <span className="w-8 text-center">Qty</span>
                    <span className="w-20 text-right">Amount</span>
                  </div>
                  {selectedOrderForInvoice.items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="flex-1">{item.item_name}</span>
                      <span className="w-8 text-center text-gray-500">{item.quantity}</span>
                      <span className="w-20 text-right">
                        {restaurant.currency} {(item.item_price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="border-t border-dashed border-gray-300" />
                
                {/* Totals */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>{restaurant.currency} {selectedOrderForInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Tax ({restaurant.tax_percentage || 0}%)</span>
                    <span>{restaurant.currency} {selectedOrderForInvoice.tax_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-300">
                    <span>Total</span>
                    <span>{restaurant.currency} {selectedOrderForInvoice.total_amount.toFixed(2)}</span>
                  </div>
                </div>
                
                {selectedOrderForInvoice.paid_at && (
                  <div className="text-center text-xs text-gray-500 pt-2">
                    Paid on {new Date(selectedOrderForInvoice.paid_at).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    {selectedOrderForInvoice.payment_method && selectedOrderForInvoice.payment_method !== 'none' && (
                      <span className="block">via {selectedOrderForInvoice.payment_method.toUpperCase()}</span>
                    )}
                  </div>
                )}
                
                <div className="border-t border-dashed border-gray-300" />

                {/* Footer */}
                <div className="text-center space-y-1 pt-1">
                  <p className="text-xs text-gray-500">Thank you for dining with us!</p>
                  <p className="text-[10px] font-semibold text-gray-400 tracking-wider uppercase">Powered by Hotogram</p>
                </div>
              </div>
              
              <Button onClick={handleDownloadOrderInvoice} className="w-full mt-4">
                <Download className="h-4 w-4 mr-2" />
                Download Invoice
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={(open) => {
        setShowPayment(open);
        if (!open) resetUpiPaymentState();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {showUpiQr 
                ? (paymentConfirmationState === 'confirmed' ? 'Payment Submitted' : 'Scan to Pay')
                : (selectedOrderForPayment ? 'Pay Order' : 'Pay All Pending Orders')
              }
            </DialogTitle>
          </DialogHeader>
          
          {showUpiQr ? (
            // UPI QR Code View with confirmation flow
            <div className="space-y-4">
              {(restaurant as any)?.upi_id ? (
                <>
                  {/* Payment Confirmed State */}
                  {paymentConfirmationState === 'confirmed' ? (
                    <div className="text-center py-6 space-y-4">
                      <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto">
                        <Clock className="h-10 w-10 text-warning" />
                      </div>
                      <div>
                        <p className="font-bold text-lg text-warning">Awaiting Verification</p>
                        <p className="text-sm text-muted-foreground">
                          {restaurant.currency} {selectedOrderForPayment ? selectedOrderForPayment.total_amount.toFixed(2) : pendingTotal.toFixed(2)}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your payment has been submitted. Staff will verify and confirm it shortly.
                      </p>
                    </div>
                  ) : (
                    <>
                {/* Amount Display */}
                      <div className="text-center text-2xl font-bold text-accent">
                        {restaurant.currency} {selectedOrderForPayment ? selectedOrderForPayment.total_amount.toFixed(2) : pendingTotal.toFixed(2)}
                      </div>
                      
                      {/* Transaction ID */}
                      {currentTransactionId && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Transaction Ref:</p>
                          <p className="text-xs font-mono bg-muted px-2 py-1 rounded inline-block">
                            {currentTransactionId}
                          </p>
                        </div>
                      )}
                      
                      {/* QR Code - show only if not in waiting/confirming state */}
                      {paymentConfirmationState !== 'waiting' && paymentConfirmationState !== 'confirming' && (
                        <>
                          <div className="flex justify-center p-4 bg-white rounded-lg">
                            <QRCodeSVG 
                              value={getUpiPaymentUrl(selectedOrderForPayment ? selectedOrderForPayment.total_amount : pendingTotal) || ''} 
                              size={180}
                              level="H"
                              includeMargin
                            />
                          </div>
                          
                          <div className="text-center space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Scan with any UPI app to pay
                            </p>
                            <p className="text-xs font-mono bg-muted px-2 py-1 rounded inline-block">
                              {(restaurant as any).upi_id}
                            </p>
                          </div>
                          
                          {/* Open UPI app button for mobile */}
                          <Button 
                            variant="accent" 
                            className="w-full" 
                            onClick={handleOpenUpiApp}
                          >
                            <Smartphone className="h-4 w-4 mr-2" />
                            Open UPI App
                          </Button>
                        </>
                      )}
                      
                      {/* Waiting for payment confirmation */}
                      {paymentConfirmationState === 'waiting' && (
                        <div className="space-y-4 pt-2">
                          <div className="text-center py-4 bg-warning/10 rounded-lg border border-warning/20">
                            <Clock className="h-8 w-8 text-warning mx-auto mb-2" />
                            <p className="font-medium text-sm">Waiting for Payment</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Complete the payment in your UPI app
                            </p>
                          </div>
                          
                          <Button 
                            variant="accent"
                            className="w-full h-12"
                            onClick={handleConfirmPaymentComplete}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            I Have Paid
                          </Button>
                          
                          <p className="text-xs text-center text-muted-foreground">
                            Staff will verify and confirm your payment
                          </p>
                          
                          <Button 
                            variant="ghost" 
                            className="w-full"
                            onClick={() => {
                              setPaymentConfirmationState('idle');
                              setUpiAppOpened(false);
                            }}
                          >
                            Show QR Code Again
                          </Button>
                        </div>
                      )}
                      
                      {/* Confirming state */}
                      {paymentConfirmationState === 'confirming' && (
                        <div className="text-center py-6 space-y-3">
                          <Loader2 className="h-10 w-10 text-accent mx-auto animate-spin" />
                          <p className="font-medium">Verifying Payment...</p>
                          <p className="text-sm text-muted-foreground">
                            Please wait while we confirm your payment
                          </p>
                        </div>
                      )}
                      
                      {/* Failed state */}
                      {paymentConfirmationState === 'failed' && (
                        <div className="space-y-4">
                          <div className="text-center py-4 bg-destructive/10 rounded-lg border border-destructive/20">
                            <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                            <p className="font-medium text-sm text-destructive">Verification Failed</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              We couldn't verify your payment
                            </p>
                          </div>
                          
                          <Button 
                            variant="outline"
                            className="w-full"
                            onClick={() => setPaymentConfirmationState('waiting')}
                          >
                            Try Again
                          </Button>
                          
                          <p className="text-xs text-center text-muted-foreground">
                            If payment was deducted, please contact restaurant staff
                          </p>
                        </div>
                      )}
                      
                      {/* Action buttons - show only when in idle state */}
                      {paymentConfirmationState === 'idle' && (
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            onClick={resetUpiPaymentState}
                          >
                            Back
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <AlertTriangle className="h-12 w-12 mx-auto text-warning" />
                  <p className="text-muted-foreground">
                    UPI payment is not configured for this restaurant.
                  </p>
                  <Button 
                    variant="outline"
                    onClick={resetUpiPaymentState}
                  >
                    Back to Payment Options
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // Payment Options View
            <div className="space-y-4">
              <div className="text-center text-2xl font-bold text-accent">
                {restaurant.currency} {selectedOrderForPayment ? selectedOrderForPayment.total_amount.toFixed(2) : pendingTotal.toFixed(2)}
              </div>
              {(restaurant as any)?.upi_id && (
                <Button 
                  variant="accent" 
                  className="w-full h-14" 
                  onClick={() => selectedOrderForPayment 
                    ? handlePayment('upi', selectedOrderForPayment) 
                    : handlePayAllPending('upi')
                  }
                  disabled={processing}
                >
                  <CreditCard className="h-5 w-5 mr-2" />
                  Pay via UPI
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full h-14" 
                onClick={() => selectedOrderForPayment 
                  ? handlePayment('counter', selectedOrderForPayment) 
                  : handlePayAllPending('counter')
                }
                disabled={processing}
              >
                <Building2 className="h-5 w-5 mr-2" />
                Pay via Cash
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delivery Dialog */}
      <Dialog open={showDelivery} onOpenChange={(open) => {
        setShowDelivery(open);
        // Pre-select WhatsApp if phone is available
        if (open && !deliveryMethod) {
          const savedPhone = localStorage.getItem(`customer_phone_${session?.id}`);
          if (savedPhone) {
            setDeliveryMethod('whatsapp');
            setContactValue(savedPhone);
          }
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Get Your Bill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Customer Name Display */}
            {customerName && (
              <div className="bg-accent/10 rounded-lg p-3 text-sm">
                <span className="text-muted-foreground">Sending bill to: </span>
                <span className="font-medium">{customerName}</span>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                variant={deliveryMethod === 'whatsapp' ? 'accent' : 'outline'}
                className="flex-1"
                onClick={() => { 
                  setDeliveryMethod('whatsapp'); 
                  // Pre-fill with saved phone if switching to WhatsApp
                  const savedPhone = localStorage.getItem(`customer_phone_${session?.id}`);
                  setContactValue(savedPhone || ''); 
                }}
              >
                <Phone className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button 
                variant={deliveryMethod === 'email' ? 'accent' : 'outline'}
                className="flex-1"
                onClick={() => { setDeliveryMethod('email'); setContactValue(''); }}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
            
            {deliveryMethod && (
              <>
                <div className="space-y-2">
                  <Label>{deliveryMethod === 'whatsapp' ? 'Phone Number' : 'Email Address'}</Label>
                  <Input
                    type={deliveryMethod === 'whatsapp' ? 'tel' : 'email'}
                    value={contactValue}
                    onChange={(e) => setContactValue(e.target.value)}
                    placeholder={deliveryMethod === 'whatsapp' ? '+91 98765 43210' : 'your@email.com'}
                  />
                  {deliveryMethod === 'whatsapp' && contactValue && (
                    <p className="text-xs text-muted-foreground">
                      Bill will be sent to this WhatsApp number
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox 
                    id="consent" 
                    checked={consent}
                    onCheckedChange={(checked) => setConsent(checked as boolean)}
                  />
                  <label htmlFor="consent" className="text-sm text-muted-foreground leading-tight">
                    I agree to receive my bill and updates from {restaurant.name}
                  </label>
                </div>
                <Button 
                  variant="accent" 
                  className="w-full"
                  onClick={handleDelivery}
                  disabled={!consent || !contactValue || processing}
                >
                  Send Bill
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Confirmation Dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={(open) => {
        setShowCancelConfirm(open);
        if (!open) {
          setOrderToCancel(null);
          setSelectedCancelItems(new Set());
          setCancelMode('full');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Cancel Order
            </DialogTitle>
            <DialogDescription>
              Choose to cancel the entire order or select specific items.
            </DialogDescription>
          </DialogHeader>
          
          {orderToCancel && (() => {
            const orderItems = sessionOrders.find(o => o.id === orderToCancel.id)?.items || [];
            const hasMultipleItems = orderItems.length > 1;
            
            return (
              <div className="space-y-4">
                {/* Mode toggle - only show if multiple items */}
                {hasMultipleItems && (
                  <div className="flex gap-2">
                    <Button
                      variant={cancelMode === 'full' ? 'destructive' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => { setCancelMode('full'); setSelectedCancelItems(new Set()); }}
                    >
                      Cancel Entire Order
                    </Button>
                    <Button
                      variant={cancelMode === 'partial' ? 'destructive' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCancelMode('partial')}
                    >
                      Cancel Selected Items
                    </Button>
                  </div>
                )}

                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  {cancelMode === 'partial' && hasMultipleItems ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">Select items to cancel:</p>
                      {orderItems.map(item => (
                        <label
                          key={item.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors text-sm",
                            selectedCancelItems.has(item.id) 
                              ? "bg-destructive/10 border border-destructive/20" 
                              : "hover:bg-muted"
                          )}
                        >
                          <Checkbox
                            checked={selectedCancelItems.has(item.id)}
                            onCheckedChange={() => toggleCancelItem(item.id)}
                          />
                          <span className="flex-1">{item.quantity}x {item.item_name}</span>
                          <span className="text-muted-foreground">
                            {restaurant?.currency} {(item.item_price * item.quantity).toFixed(2)}
                          </span>
                        </label>
                      ))}
                      {selectedCancelItems.size > 0 && selectedCancelItems.size === orderItems.length && (
                        <p className="text-xs text-warning mt-2">
                          All items selected — this will cancel the entire order.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium">All items will be cancelled:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {orderItems.map(item => (
                          <li key={item.id} className="flex justify-between">
                            <span>{item.quantity}x {item.item_name}</span>
                            <span>{restaurant?.currency} {(item.item_price * item.quantity).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="text-sm font-medium pt-2 border-t">
                    {cancelMode === 'partial' && selectedCancelItems.size > 0 
                      ? `Cancelling: ${restaurant?.currency} ${orderItems
                          .filter(i => selectedCancelItems.has(i.id))
                          .reduce((sum, i) => sum + i.item_price * i.quantity, 0)
                          .toFixed(2)}`
                      : `Total: ${restaurant?.currency} ${orderToCancel.total_amount.toFixed(2)}`
                    }
                  </p>
                </div>
                
                <p className="text-xs text-destructive/80">
                  This action cannot be undone. Cancelled items are excluded from billing.
                </p>
              </div>
            );
          })()}
          
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelConfirm(false);
                setOrderToCancel(null);
                setSelectedCancelItems(new Set());
              }}
              disabled={cancelling}
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelling || (cancelMode === 'partial' && selectedCancelItems.size === 0)}
            >
              {cancelling ? 'Cancelling...' : cancelMode === 'partial' && selectedCancelItems.size > 0 
                ? `Cancel ${selectedCancelItems.size} Item(s)` 
                : 'Cancel Entire Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}