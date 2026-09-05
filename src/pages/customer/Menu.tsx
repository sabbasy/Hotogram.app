import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Restaurant, MenuCategory, MenuItem, CartItem, RestaurantTable, TableSession, Order, OrderItem } from '@/types/database';
import { Plus, Minus, ShoppingCart, Check, UtensilsCrossed, Clock, ListOrdered, Mic, ArrowRight, ImageOff, MessageSquare, ChevronDown, ChevronUp, LayoutGrid, List, Search, ShoppingBag, Bell, User, Droplets, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { CustomerHelpButton } from '@/components/CustomerHelpButton';
import { CustomerIdentityDialog } from '@/components/CustomerIdentityDialog';
import { OrderTrackerDrawer } from '@/components/menu/OrderTrackerDrawer';
import { cn, generateUUID } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { HotogramLoader } from '@/components/HotogramLoader';
import { DishDetailDialog } from '@/components/menu/DishDetailDialog';
import { calculateItemPrepTime } from '@/lib/prepTimeEngine';
import { playChimeSound } from '@/hooks/useNotifications';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getImageUrl = (path: string | null, bucket: string): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
};

export default function CustomerMenu() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [table, setTable] = useState<RestaurantTable | null>(null);
  const [session, setSession] = useState<TableSession | null>(null);
  const [activeOrders, setActiveOrders] = useState<(Order & { items: OrderItem[] })[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [tableClosed, setTableClosed] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [showIdentityDialog, setShowIdentityDialog] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // New UI state
  const [activeCategory, setActiveCategory] = useState<string | null>('All');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [customizationOpen, setCustomizationOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [helpLoading, setHelpLoading] = useState<string | null>(null);

  // Use a ref to access the current session in callbacks without recreating listeners
  const sessionRef = useRef<TableSession | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Dish Detail Modal State
  const [selectedDishItem, setSelectedDishItem] = useState<MenuItem | null>(null);
  const [showDishModal, setShowDishModal] = useState(false);
  const [dishPrepTime, setDishPrepTime] = useState(15);

  const openDishModal = async (item: MenuItem) => {
    setSelectedDishItem(item);
    setShowDishModal(true);
    const computed = await calculateItemPrepTime(item.id, item.preparation_time_minutes || 15);
    setDishPrepTime(computed);
  };
  
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const prevStatusesRef = useRef<Record<string, string>>({});
  const prevPaymentStatusesRef = useRef<Record<string, string>>({});
  const isInitialLoadRef = useRef<boolean>(true);
  // Replaced with playChimeSound from useNotifications

  // Check for order status changes and notify customer
  const checkForStatusChanges = useCallback((orders: (Order & { items: OrderItem[] })[]) => {
    const statusLabels: Record<string, string> = {
      new: 'Order Received',
      preparing: 'Being Prepared',
      ready: 'Ready for Pickup',
      served: 'Served',
      cancelled: 'Cancelled',
    };

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

      if (!prevStatus || prevStatus === currentStatus) continue;
      
      if (currentStatus === 'cancelled') {
        playChimeSound();
        toast({ title: '❌ Order Cancelled', description: 'Your order has been cancelled.', variant: 'destructive' });
      } else if (currentStatus === 'preparing') {
        playChimeSound();
        toast({ title: '👨‍🍳 Preparing Your Order', description: 'The kitchen has started preparing your order!' });
      } else if (currentStatus === 'ready') {
        playChimeSound();
        toast({ title: '🔔 Order Ready!', description: 'Your order is ready for pickup!' });
      } else if (currentStatus === 'served') {
        playChimeSound();
        toast({ title: '✅ Order Served', description: 'Your order has been served. Enjoy!' });
      }
    }
    
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

  // Real-time subscription for order updates on menu page
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`menu-orders-${session.id}`)
      .on('postgres_changes', {
        event: '*', // Listen to INSERT as well as UPDATE for shared sessions
        schema: 'public',
        table: 'orders',
        filter: `session_id=eq.${session.id}`
      }, () => {
        setTimeout(() => loadSessionOrders(session.id), 500);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.id]);

  // Real-time subscription for table sessions
  useEffect(() => {
    if (!table) return;
    const channel = supabase
      .channel(`table-session-${table.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'table_sessions',
        filter: `table_id=eq.${table.id}`
      }, (payload) => {
        // If we don't have a session but someone else just created one for this table
        if (!sessionRef.current && payload.new.status === 'active') {
          const activeSession = payload.new as TableSession;
          setSession(activeSession);
          loadSessionOrders(activeSession.id);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'table_sessions',
        filter: `table_id=eq.${table.id}`
      }, (payload) => {
        if (payload.new.status && payload.new.status !== 'active') {
          setTableClosed(true);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table?.id]);

  useEffect(() => { if (token) loadData(); }, [token]);

  // Set initial active category
  useEffect(() => {
    if (!activeCategory) {
      setActiveCategory('All');
    }
  }, []);

  const loadData = async () => {
    // 1. Instant Cache Hydration on Frame 0 (0ms Load Speed)
    const cached = sessionStorage.getItem(`menu_cache_${token}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.table) setTable(parsed.table);
        if (parsed.restaurant) setRestaurant(parsed.restaurant);
        if (parsed.categories) setCategories(parsed.categories);
        if (parsed.items) setItems(parsed.items);
        if (parsed.session) setSession(parsed.session);
        setLoading(false); // Instantly display menu
      } catch (_) {}
    }

    try {
      // 2. Fetch table info from token
      const { data: tableData, error: tableError } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('qr_code_token', token)
        .maybeSingle();
      
      if (tableError) {
        console.error('Table fetch error:', tableError);
        setLoading(false);
        return;
      }
      
      if (!tableData) { setLoading(false); return; }
      const tableInfo = tableData as unknown as RestaurantTable;
      setTable(tableInfo);
      
      // 3. Fetch restaurant info, active session, categories, and items ALL IN PARALLEL
      const [restRes, sessionRes, catRes, itemRes] = await Promise.all([
        supabase.rpc('get_public_restaurant_info', { _restaurant_id: tableData.restaurant_id }).single(),
        supabase.from('table_sessions').select('*').eq('table_id', tableData.id).eq('status', 'active').maybeSingle(),
        supabase.from('menu_categories').select('*').eq('restaurant_id', tableData.restaurant_id).order('sort_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', tableData.restaurant_id).eq('is_available', true).order('sort_order'),
      ]);

      const rest = restRes.data as unknown as Restaurant | null;
      const catList = (catRes.data || []) as unknown as MenuCategory[];
      const itemList = (itemRes.data || []) as unknown as MenuItem[];
      const activeSession = sessionRes.data as unknown as TableSession | null;

      if (rest) setRestaurant(rest);
      setCategories(catList);
      setItems(itemList);
      if (activeSession) setSession(activeSession);

      // Save to session cache for instant load next time
      sessionStorage.setItem(`menu_cache_${token}`, JSON.stringify({
        table: tableInfo,
        restaurant: rest,
        categories: catList,
        items: itemList,
        session: activeSession,
      }));
      
      if (activeSession) {
        loadSessionOrders(activeSession.id);
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
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    
    if (ordersData && ordersData.length > 0) {
      const orders = ordersData as unknown as Order[];
      const orderIds = orders.map(o => o.id);

      // Single query for all order items instead of N+1 loop
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      const itemsByOrderId = ((itemsData || []) as unknown as OrderItem[]).reduce<Record<string, OrderItem[]>>((acc, item) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(item);
        return acc;
      }, {});

      const ordersWithItems = orders.map(order => ({
        ...order,
        items: itemsByOrderId[order.id] || []
      }));
      
      checkForStatusChanges(ordersWithItems);
      setActiveOrders(ordersWithItems);
    }
  };

  const updateCart = (item: MenuItem, delta: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter(c => c.menuItem.id !== item.id);
        return prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: newQty } : c);
      }
      return delta > 0 ? [...prev, { menuItem: item, quantity: 1 }] : prev;
    });
  };

  const getQty = (itemId: string) => cart.find(c => c.menuItem.id === itemId)?.quantity || 0;
  const subtotal = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0);
  const taxAmount = restaurant ? subtotal * (restaurant.tax_percentage / 100) : 0;
  const total = subtotal + taxAmount;

  const uploadVoiceNote = async (orderId: string): Promise<string | null> => {
    if (!voiceBlob || !restaurant) return null;
    
    const fileName = `${restaurant.id}/${table?.id}/${orderId}/${Date.now()}.webm`;
    const { data, error } = await supabase.storage
      .from('voice-notes')
      .upload(fileName, voiceBlob, { contentType: 'audio/webm' });
    
    if (error) {
      console.error('Voice upload error:', error);
      return null;
    }
    
    return data.path;
  };

  const handlePlaceOrderClick = () => {
    if (!restaurant) {
      toast({ title: 'Error', description: 'Restaurant information not loaded', variant: 'destructive' });
      return;
    }
    if (!table) {
      toast({ title: 'Error', description: 'Table information not loaded', variant: 'destructive' });
      return;
    }
    if (cart.length === 0) {
      toast({ title: 'Empty Cart', description: 'Please add items to your cart first', variant: 'destructive' });
      return;
    }
    
    const hasCustomerInfo = customerName && customerPhone;
    if (!hasCustomerInfo && activeOrders.length === 0) {
      setShowIdentityDialog(true);
    } else {
      placeOrder(customerName, customerPhone);
    }
  };

  const handleIdentitySubmit = (name: string, phone: string, email?: string) => {
    setCustomerName(name);
    setCustomerPhone(phone);
    setShowIdentityDialog(false);
    placeOrder(name, phone, email);
  };

  const placeOrder = async (name: string, phone: string, email?: string) => {
    if (!restaurant || !table) return;
    
    const invalidItems = cart.filter(c => c.quantity <= 0);
    if (invalidItems.length > 0) {
      toast({ title: 'Error', description: 'Invalid item quantities in cart', variant: 'destructive' });
      return;
    }
    
    if (ordering) return;
    setOrdering(true);
    
    try {
      let currentSession = session;
      if (!currentSession) {
        // Double check if another user at the table just created a session
        const { data: existingSession } = await supabase
          .from('table_sessions')
          .select('*')
          .eq('table_id', table.id)
          .eq('status', 'active')
          .maybeSingle();

        if (existingSession) {
          currentSession = existingSession as unknown as TableSession;
          setSession(currentSession);
        } else {
          const { data: newSession, error: sessionError } = await supabase
            .from('table_sessions')
            .insert({ 
              restaurant_id: restaurant.id, 
              table_id: table.id,
              session_token: generateUUID() // Explicitly generate token
            })
            .select()
            .single();
          
          if (sessionError) {
            toast({ title: 'Session Error', description: `Failed to create session: ${sessionError.message}`, variant: 'destructive' });
            setOrdering(false);
            return;
          }
          
          if (!newSession) {
            toast({ title: 'Error', description: 'No session returned from creation', variant: 'destructive' });
            setOrdering(false);
            return;
          }
          
          currentSession = newSession as unknown as TableSession;
          setSession(currentSession);
        }
      }
      
      if (name || phone) {
        await supabase.from('table_sessions').update({ 
          customer_name: name || null,
          customer_phone: phone || null 
        } as Record<string, unknown>).eq('id', currentSession.id);
      }
      
      // Mark table as occupied when an order is placed
      await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', table.id);
      
      if (name) localStorage.setItem(`customer_name_${currentSession.id}`, name);
      if (phone) localStorage.setItem(`customer_phone_${currentSession.id}`, phone);
      if (email) localStorage.setItem(`customer_email_${currentSession.id}`, email);

      const orderData = { 
        restaurant_id: restaurant.id, 
        table_id: table.id,
        session_id: currentSession.id,
        table_number: table.table_number, 
        subtotal: subtotal,
        tax_amount: taxAmount,
        total_amount: total,
        status: 'new' as const,
        payment_status: 'pending' as const,
        payment_method: 'none' as const,
        special_instructions: specialInstructions || null,
        customer_name: name || null,
        customer_phone: phone || null
      };
      const { data: order, error: orderError } = await supabase.from('orders').insert(orderData as any).select().single();
      
      if (orderError) { 
        toast({ title: 'Order Failed', description: `Could not place order: ${orderError.message}`, variant: 'destructive' }); 
        setOrdering(false); 
        return; 
      }
      
      if (!order) {
        toast({ title: 'Error', description: 'No order returned from creation', variant: 'destructive' });
        setOrdering(false);
        return;
      }
      
      if (voiceBlob) {
        const voicePath = await uploadVoiceNote(order.id);
        if (voicePath) {
          await supabase.from('orders').update({ voice_note_url: voicePath }).eq('id', order.id);
        }
      }
      
      const orderItems = cart.map(c => ({ 
        order_id: order.id, 
        menu_item_id: c.menuItem.id, 
        item_name: c.menuItem.name, 
        item_price: c.menuItem.price, 
        quantity: c.quantity 
      }));
      
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      
      if (itemsError) {
        toast({ title: 'Partial Success', description: 'Order created but some items may not have saved correctly', variant: 'default' });
      }
      
      await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', table.id);
      
      const newTotal = (currentSession.total_amount || 0) + total;
      await supabase.from('table_sessions').update({ total_amount: newTotal }).eq('id', currentSession.id);
      
      if (name || phone) {
        await supabase.rpc('upsert_customer_contact', {
          p_restaurant_id: restaurant.id,
          p_order_id: order.id,
          p_name: name || null,
          p_phone: phone || null,
          p_email: email || null,
          p_consent_given: true,
          p_total_spend: total
        });
      }
      
      setCart([]);
      setVoiceBlob(null);
      setShowVoiceRecorder(false);
      setSpecialInstructions('');
      setCustomizationOpen(true);
      setOrderPlaced(true); 
      setLastOrderId(order.id);
      
      toast({ title: 'Success', description: 'Your order has been placed!' });
      await loadSessionOrders(currentSession.id);
    } catch (err) {
      console.error('Order placement exception:', err);
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Something went wrong placing your order', variant: 'destructive' });
    }
    setOrdering(false);
  };

  const goToOrderTracker = () => {
    setOrderPlaced(false);
    setDrawerOpen(true);
  };

  const goToSessionSummary = () => {
    if (activeOrders.length > 0) {
      setDrawerOpen(true);
    }
  };

  const handleImageError = (itemId: string) => {
    setImageErrors(prev => new Set(prev).add(itemId));
  };

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    const el = categoryRefs.current[catId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Exclude cancelled orders from session calculations
  const nonCancelledOrders = activeOrders.filter(o => o.status !== 'cancelled');
  const sessionSubtotal = nonCancelledOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const sessionTax = nonCancelledOrders.reduce((sum, o) => sum + o.tax_amount, 0);
  const sessionTotal = nonCancelledOrders.reduce((sum, o) => sum + o.total_amount, 0);

  const logoUrl = getImageUrl(restaurant?.logo_url || null, 'restaurant-logos');

  if (loading) return <HotogramLoader text="Loading delicious menu..." />;

  if (!restaurant || !table) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full text-center shadow-card border border-border/80">
        <CardContent className="py-12 space-y-5">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
            <UtensilsCrossed className="h-8 w-8 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Table No Longer Active</h1>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              This QR code is no longer linked to an active table. If you are seated at a table, please scan the current QR code on your table or ask restaurant staff for assistance.
            </p>
          </div>
          <Button variant="outline" className="w-full max-w-xs mx-auto text-xs" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </CardContent>
      </Card>
    </div>
  );
  
  if (tableClosed) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-sm w-full text-center shadow-card">
        <CardContent className="py-12 space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Table Closed</h1>
          <p className="text-muted-foreground">This table session has ended. Please scan the QR code again to start a new session.</p>
        </CardContent>
      </Card>
    </div>
  );
  


  const cartItemCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground relative overflow-hidden font-sans">
      {/* Background glow layers */}
      <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* ===== HEADER ===== */}
      <header className="sticky top-0 bg-white/80 dark:bg-[#0a0a0a]/60 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800/80 z-30">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={restaurant.name} 
                className="h-10 w-10 rounded-lg object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={!logoUrl ? '' : 'hidden'}>
              <img src="/hotogram-logo.svg" alt="Hotogram Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-zinc-900 dark:text-white">{restaurant.name}</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{table.table_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              onClick={() => setShowHelpDialog(true)}
            >
              <Bell className="h-4 w-4 text-orange-500 animate-pulse" />
            </Button>
            {/* View mode toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
            >
              {viewMode === 'list' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </Button>
            {activeOrders.length > 0 && (
              <Button variant="outline" size="sm" onClick={goToSessionSummary} className="gap-1 text-xs border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
                <ListOrdered className="h-3.5 w-3.5 text-orange-500" />
                {activeOrders.length}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ===== SEARCH BAR ===== */}
      <div className="p-3 bg-white/80 dark:bg-[#0a0a0a]/40 border-b border-zinc-200 dark:border-zinc-800/80 z-10 relative">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search delicious food..."
            className="w-full pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-orange-500 rounded-xl outline-none text-sm"
          />
        </div>
      </div>

      {/* ===== CATEGORY NAVIGATION BAR ===== */}
      <div className="sticky top-[57px] z-20 bg-background/80 backdrop-blur-xl border-b border-border/80">
        <ScrollArea className="w-full">
          <div className="flex gap-1 p-2">
            <button
              onClick={() => setActiveCategory('All')}
              className={cn(
                "flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-colors border",
                activeCategory === 'All'
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background/50 text-muted-foreground border-border hover:bg-background"
              )}
            >
              All
            </button>
            {categories.map(cat => {
              const catItems = items.filter(i => i.category_id === cat.id);
              if (catItems.length === 0) return null;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-colors border",
                    activeCategory === cat.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background/50 text-muted-foreground border-border hover:bg-background"
                  )}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>



      {/* ===== MENU CONTAINER (scrollable) ===== */}
      <div ref={menuContainerRef} className="flex-1 overflow-y-auto pb-48 z-10 relative">
        <main className="p-3 space-y-5">
          {(() => {
            const displayItems = items.filter(i => 
              (activeCategory === 'All' || i.category_id === activeCategory) && 
              (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
               (i.description || '').toLowerCase().includes(searchQuery.toLowerCase()))
            );
            
            if (displayItems.length === 0) return (
              <div className="text-center py-10 text-muted-foreground">
                No items found.
              </div>
            );

            return (
              <div>
                {/* LIST VIEW */}
                {viewMode === 'list' && (
                  <div className="space-y-3">
                    {displayItems.map((item, index) => {
                      const itemImageUrl = getImageUrl(item.image_url, 'menu-images');
                      const showImage = itemImageUrl && !imageErrors.has(item.id);
                      
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
                        >
                          <Card className="shadow-sm overflow-hidden bg-white dark:bg-zinc-900 border border-border/50 rounded-2xl hover:border-border transition group relative p-3 flex gap-3 cursor-pointer">
                            {/* Text on Left - Clickable */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center" onClick={() => openDishModal(item)}>
                              <h3 className="font-bold text-base text-foreground mb-1 leading-tight group-hover:text-accent transition-colors">{item.name}</h3>
                              {item.description && <p className="text-xs text-muted-foreground mb-1 line-clamp-2 leading-relaxed">{item.description}</p>}
                              <div className="font-extrabold text-accent text-sm flex items-center gap-2">
                                <span>{restaurant.currency} {item.price}</span>
                                <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                  ⏱️ ~{item.preparation_time_minutes || 15}m
                                </span>
                              </div>
                            </div>
                            
                            {/* Image on Right - Clickable */}
                            <div className="flex flex-col items-center justify-between flex-shrink-0">
                              <div onClick={() => openDishModal(item)} className="cursor-pointer">
                                {showImage ? (
                                  <div className="relative w-28 h-28 rounded-xl overflow-hidden shadow-sm">
                                    <img 
                                      src={itemImageUrl} 
                                      alt={item.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                      loading="lazy"
                                      decoding="async"
                                      onError={() => handleImageError(item.id)}
                                    />
                                  </div>
                                ) : item.image_url ? (
                                  <div className="relative w-28 h-28 rounded-xl bg-muted border border-border flex items-center justify-center">
                                    <ImageOff className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                ) : (
                                  <div className="relative w-28 h-28 rounded-xl bg-muted/50 border border-border flex items-center justify-center">
                                    <UtensilsCrossed className="h-6 w-6 text-muted-foreground/50" />
                                  </div>
                                )}
                              </div>
                              
                              {/* Overlapping Add Button */}
                              <div className="mt-[-16px] z-10 w-full flex justify-center">
                                {getQty(item.id) > 0 ? (
                                  <div className="flex items-center bg-background shadow-md border border-border rounded-full overflow-hidden">
                                    <button 
                                      className="p-1.5 px-3 text-accent hover:bg-muted transition" 
                                      onClick={() => updateCart(item, -1)}
                                    >
                                      <Minus className="h-4 w-4" />
                                    </button>
                                    <span className="w-6 text-center text-sm font-bold text-foreground">
                                      {getQty(item.id)}
                                    </span>
                                    <button 
                                      className="p-1.5 px-3 text-accent hover:bg-muted transition" 
                                      onClick={() => updateCart(item, 1)}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    className="bg-background text-accent font-bold px-6 py-1.5 rounded-full shadow-md border border-border text-xs uppercase tracking-wider hover:bg-muted transition" 
                                    onClick={() => updateCart(item, 1)}
                                  >
                                    ADD
                                  </button>
                                )}
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* GRID VIEW */}
                {viewMode === 'grid' && (
                  <div className="grid grid-cols-2 gap-3">
                    {displayItems.map((item, index) => {
                      const itemImageUrl = getImageUrl(item.image_url, 'menu-images');
                      const showImage = itemImageUrl && !imageErrors.has(item.id);
                      
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
                        >
                          <Card className="shadow-sm overflow-hidden bg-white dark:bg-zinc-900 border border-border/50 rounded-2xl hover:border-border transition group relative p-2.5 flex flex-col gap-2 h-full cursor-pointer">
                            {/* Image Container with floating Add Button underneath */}
                            <div className="flex flex-col items-center">
                              <div className="w-full cursor-pointer" onClick={() => openDishModal(item)}>
                                {showImage ? (
                                  <div className="relative w-full h-32 rounded-xl overflow-hidden shadow-sm">
                                    <img 
                                      src={itemImageUrl} 
                                      alt={item.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                      loading="lazy"
                                      decoding="async"
                                      onError={() => handleImageError(item.id)}
                                    />
                                  </div>
                                ) : item.image_url ? (
                                  <div className="relative w-full h-32 rounded-xl bg-muted border border-border flex items-center justify-center">
                                    <ImageOff className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                ) : (
                                  <div className="relative w-full h-32 rounded-xl bg-muted/50 border border-border flex items-center justify-center">
                                    <UtensilsCrossed className="h-6 w-6 text-muted-foreground/50" />
                                  </div>
                                )}
                              </div>
                              
                              {/* Overlapping Add Button */}
                              <div className="mt-[-16px] z-10 w-full flex justify-center">
                                {getQty(item.id) > 0 ? (
                                  <div className="flex items-center bg-background shadow-md border border-border rounded-full overflow-hidden">
                                    <button 
                                      className="p-1 px-2 text-accent hover:bg-muted transition" 
                                      onClick={(e) => { e.stopPropagation(); updateCart(item, -1); }}
                                    >
                                      <Minus className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="w-6 text-center text-xs font-bold text-foreground">
                                      {getQty(item.id)}
                                    </span>
                                    <button 
                                      className="p-1 px-2 text-accent hover:bg-muted transition" 
                                      onClick={(e) => { e.stopPropagation(); updateCart(item, 1); }}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    className="bg-background text-accent font-bold px-6 py-1 rounded-full shadow-md border border-border text-[10px] uppercase tracking-wider hover:bg-muted transition" 
                                    onClick={(e) => { e.stopPropagation(); updateCart(item, 1); }}
                                  >
                                    ADD
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {/* Text Container */}
                            <div className="flex flex-col flex-1 mt-1 justify-center cursor-pointer" onClick={() => openDishModal(item)}>
                              <p className="font-bold text-sm text-foreground truncate group-hover:text-accent transition-colors">{item.name}</p>
                              {item.description && <p className="text-[10px] text-muted-foreground mt-1 mb-1 line-clamp-1">{item.description}</p>}
                              <div className="font-extrabold text-accent text-sm flex items-center justify-between">
                                <span>{restaurant.currency} {item.price}</span>
                                <span className="text-[10px] text-muted-foreground font-normal">⏱️~{item.preparation_time_minutes || 15}m</span>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </main>
      </div>



      {/* Floating Basket Button */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-between shadow-xl transition pressable"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>View Basket</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs">{cart.reduce((a,c) => a + c.quantity, 0)} items</span>
              <span className="font-extrabold">{restaurant.currency} {total.toFixed(2)}</span>
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && cart.length > 0 && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            {/* Drawer Body */}
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white dark:bg-[#0a0a0a] border-t border-zinc-200 dark:border-zinc-800 rounded-t-[2.5rem] max-h-[85vh] flex flex-col z-50 overflow-hidden text-zinc-900 dark:text-white"
            >
              {/* Header with Cancel/Close button */}
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800/80 flex justify-between items-center bg-zinc-50 dark:bg-[#0c0c0c]">
                <div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-white">Your Basket</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 text-xs">Review items before ordering</p>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)} 
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Cart Items List */}
                <div className="space-y-4">
                  {cart.map(c => (
                    <div key={c.menuItem.id} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-900/50">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{c.menuItem.name}</p>
                        <p className="text-xs text-orange-500 font-extrabold">{restaurant.currency} {c.menuItem.price}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button variant="outline" size="icon" className="h-6 w-6 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white" onClick={() => updateCart(c.menuItem, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-4 text-center text-xs font-bold text-zinc-900 dark:text-white">{c.quantity}</span>
                        <Button variant="accent" size="icon" className="h-6 w-6 bg-orange-500 hover:bg-orange-600 text-white shadow-lg" onClick={() => updateCart(c.menuItem, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Customization Details */}
                <div className="space-y-4 bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Instructions & Notes</span>
                  
                  {/* Special Instructions */}
                  <Textarea
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="E.g., Less spicy, no onions, extra butter..."
                    className="resize-none h-20 text-sm bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-orange-500 rounded-xl"
                    maxLength={500}
                  />
                  
                  {/* Voice Note */}
                  {restaurant.feature_voice_notes && (
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/50">
                      {showVoiceRecorder ? (
                        <VoiceRecorder
                          onRecordingComplete={(blob) => setVoiceBlob(blob)}
                          maxDuration={30}
                        />
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full gap-2 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white text-xs bg-zinc-100 dark:bg-zinc-900/40 rounded-xl py-4"
                          onClick={() => setShowVoiceRecorder(true)}
                        >
                          <Mic className="h-3.5 w-3.5 text-orange-500" />
                          {voiceBlob ? '🎤 Voice note attached' : 'Add voice instruction'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Pricing Summary */}
                <div className="bg-zinc-50 dark:bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    <span>Subtotal</span>
                    <span>{restaurant.currency} {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    <span>Platform Fee / Tax</span>
                    <span>{restaurant.currency} {taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-zinc-900 dark:text-white pt-2 border-t border-zinc-200 dark:border-zinc-800/40">
                    <span>Total Amount</span>
                    <span className="text-orange-500">{restaurant.currency} {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Actions footer */}
              <div className="p-6 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#0c0c0c]">
                <Button 
                  variant="accent" 
                  size="lg" 
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-black py-6 rounded-2xl transition pressable shadow-xl" 
                  onClick={() => {
                    handlePlaceOrderClick();
                    setIsCartOpen(false);
                  }} 
                  disabled={ordering}
                >
                  {ordering ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Placing Order...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Confirm & Place Order • {restaurant.currency} {total.toFixed(2)}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Help Dialog Modal */}
      <AnimatePresence>
        {showHelpDialog && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowHelpDialog(false)} 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99]" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="fixed w-[90%] max-w-sm bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 z-[100] shadow-2xl"
              style={{ top: "50%", left: "50%", x: "-50%", y: "-50%" }}
            >
              <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><Bell className="w-5 h-5 text-orange-500 animate-pulse" /> Need Assistance?</h3>
              <div className="space-y-3">
                {[
                  { type: 'call_waiter', label: 'Call Waiter', icon: User },
                  { type: 'request_water', label: 'Request Water', icon: Droplets },
                ].map(req => (
                  <button 
                    key={req.type} 
                    disabled={!!helpLoading} 
                    onClick={async () => {
                      setHelpLoading(req.type);
                      await supabase.from('customer_requests').insert({ 
                        restaurant_id: restaurant.id, 
                        table_id: table.id, 
                        table_number: table.table_number, 
                        request_type: req.type as any 
                      });
                      toast({ title: 'Request Placed', description: `✅ ${req.label} requested!` });
                      setHelpLoading(null);
                      setShowHelpDialog(false);
                    }} 
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/30 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900/60 disabled:opacity-50 pressable text-zinc-800 dark:text-white transition text-sm"
                  >
                    <req.icon className="w-4 h-4 text-orange-500" /> {req.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Order Success Dialog Modal */}
      <AnimatePresence>
        {orderPlaced && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99]" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="fixed w-[90%] max-w-sm bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 z-[100] shadow-2xl text-center"
              style={{ top: "50%", left: "50%", x: "-50%", y: "-50%" }}
            >
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-success" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Order Placed!</h1>
              <p className="text-muted-foreground text-sm mb-6">Your order has been sent to the kitchen. Please wait at {table.table_number}.</p>
              {voiceBlob && (
                <p className="text-sm text-accent mb-6 font-medium">🎤 Voice instruction attached</p>
              )}
              <div className="flex flex-col gap-3">
                <Button variant="accent" size="lg" className="rounded-xl w-full" onClick={() => {
                  setOrderPlaced(false);
                  goToOrderTracker();
                }}>
                  Track Order
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="outline" size="lg" className="rounded-xl w-full" onClick={() => setOrderPlaced(false)}>
                  Order More
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Customer Identity Dialog */}
      <CustomerIdentityDialog
        open={showIdentityDialog}
        onClose={() => setShowIdentityDialog(false)}
        onSubmit={handleIdentitySubmit}
        loading={ordering}
      />

      {/* Order Tracker Drawer */}
      <OrderTrackerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        orders={activeOrders}
        restaurant={restaurant}
        table={table}
        sessionId={session?.id || null}
      />

      {/* Dish Detail Dialog */}
      <DishDetailDialog
        item={selectedDishItem}
        open={showDishModal}
        onOpenChange={setShowDishModal}
        quantity={selectedDishItem ? getQty(selectedDishItem.id) : 0}
        onUpdateQuantity={(delta) => {
          if (selectedDishItem) updateCart(selectedDishItem, delta);
        }}
        restaurant={restaurant}
        estimatedPrepTime={dishPrepTime}
      />
    </div>
  );
}
