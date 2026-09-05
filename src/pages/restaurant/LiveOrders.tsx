import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Restaurant, RestaurantTable, Order, OrderItem, TableSession, MenuItem } from '@/types/database';
import { Receipt, CreditCard, Check, Clock, XCircle, Volume2, Mic, Play, Pause, Bell, User, MessageSquare, LayoutGrid, ListTodo, CheckCircle2, Plus, Minus, Search, X } from 'lucide-react';
import { cn, generateUUID } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
import { useNotifications, playChimeSound } from '@/hooks/useNotifications';

interface CancelledItemRecord {
  item_name: string;
  item_price: number;
  quantity: number;
  cancelled_at: string;
  cancelled_by: 'customer' | 'kitchen';
}

type OrderWithItems = Order & { items: OrderItem[]; cancelled_items_list: CancelledItemRecord[] };

interface TableWithSession extends RestaurantTable {
  currentSession?: TableSession & { orders: OrderWithItems[] };
  requests?: any[];
}

let liveOrdersCache: {
  restaurant: Restaurant | null;
  tables: TableWithSession[];
  activeOrders: OrderWithItems[];
} | null = null;

export default function LiveOrders() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(liveOrdersCache?.restaurant || null);
  const [tables, setTables] = useState<TableWithSession[]>(liveOrdersCache?.tables || []);
  const [activeOrders, setActiveOrders] = useState<OrderWithItems[]>(liveOrdersCache?.activeOrders || []);
  const [verifyingTxns, setVerifyingTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(!liveOrdersCache);
  
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const selectedTable = tables.find(t => t.id === selectedTableId) || null;
  
  const [viewMode, setViewMode] = useState<'tables' | 'tickets'>('tables');
  
  const [playingOrderId, setPlayingOrderId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [waterReq, setWaterReq] = useState<any>(null);
  const [waterPrice, setWaterPrice] = useState('20');
  const [waterQty, setWaterQty] = useState('1');

  // Mark Vacant Consent State
  const [vacantConsentTable, setVacantConsentTable] = useState<TableWithSession | null>(null);

  // Punch Order State
  const [punchOrderTable, setPunchOrderTable] = useState<TableWithSession | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [punchCart, setPunchCart] = useState<Record<string, number>>({});
  const [punchLoading, setPunchLoading] = useState(false);
  const [punchSearchQuery, setPunchSearchQuery] = useState('');
  
  const { 
    notifications, 
    addNotification,
    markRead, 
    clearAll, 
    processOrderChange, 
    processRequestChange,
    previousOrdersRef 
  } = useNotifications();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth/restaurant');
  }, [user, authLoading, navigate]);

  useEffect(() => { if (user) loadData(); }, [user]);

  useEffect(() => {
    if (!restaurant) return;
    const channel = supabase
      .channel('live-orders-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          processOrderChange(payload.new as any, payload.eventType, payload.old as any);
        }
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables', filter: `restaurant_id=eq.${restaurant.id}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_transactions', filter: `restaurant_id=eq.${restaurant.id}` }, (payload) => {
        const txn = payload.new as any;
        if (payload.eventType === 'UPDATE' && txn.status === 'verifying' && txn.confirmed_by === 'customer') {
          addNotification('Payment Awaiting Verification', `Customer marked payment of ₹${txn.amount} as completed`, 'payment_pending');
        }
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions', filter: `restaurant_id=eq.${restaurant.id}` }, () => loadData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customer_requests', filter: `restaurant_id=eq.${restaurant.id}` }, (payload) => {
        processRequestChange(payload.new as any);
        loadData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_requests', filter: `restaurant_id=eq.${restaurant.id}` }, (payload) => {
        if (payload.new.status === 'handled') {
          setTables(prev => prev.map(t => ({ ...t, requests: t.requests?.filter(r => r.id !== payload.new.id) })));
        } else {
          loadData();
        }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [restaurant, processOrderChange, processRequestChange]);

  const loadData = async () => {
    const { data: restaurants } = await supabase.from('restaurants').select('*').eq('owner_id', user!.id).limit(1);
    if (restaurants?.[0]) {
      const rest = restaurants[0] as unknown as Restaurant;
      setRestaurant(rest);

      const { data: tablesData } = await supabase.from('restaurant_tables').select('*').eq('restaurant_id', rest.id).order('table_number');
      const tablesWithSessions: TableWithSession[] = [];
      const allActiveOrders: OrderWithItems[] = [];
      
      const { data: allRequests } = await supabase.from('customer_requests').select('*').eq('restaurant_id', rest.id).eq('status', 'pending');
      
      const { data: allActiveSessions } = await supabase.from('table_sessions')
        .select(`
          *,
          orders (
            *,
            order_items (
              *,
              menu_items (
                preparation_time_minutes
              )
            )
          )
        `)
        .eq('restaurant_id', rest.id)
        .eq('status', 'active');
        
      for (const table of (tablesData || []) as unknown as RestaurantTable[]) {
        const sessionData = allActiveSessions?.find(s => s.table_id === table.id);
        const rawRequests = allRequests?.filter(r => r.table_id === table.id) || [];
        // If table has no active session and is vacant, ignore orphaned ghost requests
        const tableRequests = (table.status === 'vacant' && !sessionData) ? [] : rawRequests;
        
        if (sessionData) {
          const session = sessionData as unknown as TableSession;
          
          const ordersData = ((sessionData as any).orders || []) as any[];
          ordersData.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          
          const ordersWithItems: OrderWithItems[] = [];
          for (const order of ordersData) {
            const itemsData = order.order_items || [];
            const cancelledItemsList = (order.cancelled_items as CancelledItemRecord[]) || [];
            const fullOrder = { ...order, items: itemsData as unknown as OrderItem[], cancelled_items_list: cancelledItemsList };
            ordersWithItems.push(fullOrder);
            
            if (['new', 'preparing', 'ready'].includes(order.status || '')) {
              allActiveOrders.push(fullOrder);
            }
          }
          
          tablesWithSessions.push({ ...table, currentSession: { ...session, orders: ordersWithItems }, requests: tableRequests });
        } else {
          tablesWithSessions.push({ ...table, requests: tableRequests });
        }
      }
      
      allActiveOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      const { data: txns } = await supabase.from('payment_transactions').select('*').eq('restaurant_id', rest.id).eq('status', 'verifying');
      
      setTables(tablesWithSessions);
      setActiveOrders(allActiveOrders);
      setVerifyingTxns(txns || []);

      liveOrdersCache = {
        restaurant: rest,
        tables: tablesWithSessions,
        activeOrders: allActiveOrders,
      };
    }
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { status, updated_at: now };
    if (status === 'preparing') updateData.preparing_at = now;
    if (status === 'ready') updateData.ready_at = now;
    if (status === 'served') updateData.served_at = now;
    
    // Optimistic UI for activeOrders (Kanban)
    setActiveOrders(prev => {
      if (status === 'served' || status === 'cancelled') {
        return prev.filter(o => o.id !== orderId);
      }
      return prev.map(o => o.id === orderId ? { ...o, status } : o);
    });

    // Optimistic UI for tables
    setTables(prev => prev.map(t => {
      if (!t.currentSession) return t;
      return {
        ...t,
        currentSession: {
          ...t.currentSession,
          orders: t.currentSession.orders.map(o => o.id === orderId ? { ...o, ...updateData } : o)
        }
      };
    }));
    
    await supabase.from('orders').update(updateData).eq('id', orderId);
  };

  const markOrderAsPaid = async (orderId: string) => {
    // Optimistic update
    setTables(prev => prev.map(t => {
      if (!t.currentSession) return t;
      return {
        ...t,
        currentSession: {
          ...t.currentSession,
          orders: t.currentSession.orders.map(o =>
            o.id === orderId ? { ...o, payment_status: 'paid' as const, payment_method: 'counter' } : o
          )
        }
      };
    }));

    const now = new Date().toISOString();
    const { error } = await supabase.from('orders').update({ payment_status: 'paid', payment_method: 'counter', paid_at: now }).eq('id', orderId);
    
    if (error) { 
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      loadData(); 
    } else {
      toast({ title: 'Success', description: 'Payment marked as received' });
    }
  };

  const markAllPaid = async (session: TableSession & { orders: OrderWithItems[] }) => {
    const pendingOrders = session.orders.filter(o => o.payment_status === 'pending' && o.status !== 'cancelled');
    if (pendingOrders.length === 0) return;

    const pendingIds = new Set(pendingOrders.map(o => o.id));
    setTables(prev => prev.map(t => {
      if (!t.currentSession || t.currentSession.id !== session.id) return t;
      return {
        ...t,
        currentSession: {
          ...t.currentSession,
          orders: t.currentSession.orders.map(o =>
            pendingIds.has(o.id) ? { ...o, payment_status: 'paid' as const, payment_method: 'counter' } : o
          )
        }
      };
    }));

    const now = new Date().toISOString();
    for (const order of pendingOrders) {
      await supabase.from('orders').update({ payment_status: 'paid', payment_method: 'counter', paid_at: now }).eq('id', order.id);
    }
    toast({ title: 'Success', description: 'All orders marked as paid' });
  };

  const cancelOrder = async (order: OrderWithItems) => {
    if (!order.session_id) {
      const now = new Date().toISOString();
      await supabase.from('orders').update({ status: 'cancelled', updated_at: now }).eq('id', order.id);
      loadData();
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('cancel-order', {
        body: { orderId: order.id, sessionId: order.session_id, cancelledBy: 'kitchen', reason: 'Cancelled by staff' }
      });
      if (error || data?.error) toast({ title: 'Cancel Failed', description: data?.error || 'Failed to cancel order', variant: 'destructive' });
      else toast({ title: 'Order Cancelled', description: 'Order cancelled successfully.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to cancel order', variant: 'destructive' });
    }
    loadData();
  };

  const closeTable = async (tableId: string, sessionId: string) => {
    const now = new Date().toISOString();
    
    // Voice notes cleanup
    const { data: sessionOrders } = await supabase.from('orders').select('voice_note_url').eq('session_id', sessionId).not('voice_note_url', 'is', null);
    if (sessionOrders && sessionOrders.length > 0) {
      const voicePaths = sessionOrders.map(o => o.voice_note_url).filter(Boolean) as string[];
      if (voicePaths.length > 0) await supabase.storage.from('voice-notes').remove(voicePaths);
      await supabase.from('orders').update({ voice_note_url: null }).eq('session_id', sessionId).not('voice_note_url', 'is', null);
    }
    
    // Cancel any unserved orders in this session
    await supabase.from('orders').update({ status: 'cancelled', updated_at: now }).eq('session_id', sessionId).neq('status', 'served');

    // Clear any pending customer requests for this vacant table
    await supabase.from('customer_requests').update({ status: 'handled' }).eq('table_id', tableId).eq('status', 'pending');

    await supabase.from('table_sessions').update({ status: 'closed', closed_at: now }).eq('id', sessionId);
    await supabase.from('restaurant_tables').update({ status: 'vacant' }).eq('id', tableId);
    
    toast({ title: 'Table Marked Vacant', description: 'Session closed and unserved orders cancelled.' });
    setVacantConsentTable(null);
    setSelectedTableId(null);
    loadData();
  };

  const proceedResolveRequest = async (requestId: string) => {
    // Optimistic update
    setTables(prev => prev.map(t => ({ ...t, requests: t.requests?.filter(r => r.id !== requestId) })));
    
    const { error } = await supabase.from('customer_requests').update({ status: 'handled' }).eq('id', requestId);
    if (error) {
      toast({ title: 'Error', description: `Failed to resolve request: ${error.message}`, variant: 'destructive' });
      loadData(); // Revert on error
    }
  };

  const resolveRequest = async (req: any) => {
    if (req.request_type === 'request_water') {
      setWaterReq(req);
    } else {
      await proceedResolveRequest(req.id);
    }
  };

  const handleResolveWater = async (addCharge: boolean) => {
    if (!waterReq) return;
    
    if (addCharge) {
      const price = parseFloat(waterPrice) || 20;
      const qty = parseInt(waterQty) || 1;
      const table = tables.find(t => t.id === waterReq.table_id);
      
      if (table?.currentSession) {
        const { data: orderData } = await supabase.from('orders').insert({
          restaurant_id: restaurant!.id,
          session_id: table.currentSession.id,
          table_number: table.table_number,
          status: 'served',
          subtotal: price * qty,
          tax_amount: 0,
          total_amount: price * qty,
          payment_status: 'pending'
        }).select().single();
        
        if (orderData) {
          await supabase.from('order_items').insert({
            order_id: orderData.id,
            item_name: 'Bottled Water',
            quantity: qty,
            item_price: price
          });
        }
      } else {
        toast({ title: 'Error', description: 'Table has no active session. Cannot add to bill.', variant: 'destructive' });
        return;
      }
    }
    
    await proceedResolveRequest(waterReq.id);
    setWaterReq(null);
    toast({ title: 'Success', description: 'Water request resolved.' });
    if (addCharge) loadData(); 
  };

  const openPunchOrder = async (table: TableWithSession) => {
    setPunchOrderTable(table);
    setPunchCart({});
    setPunchSearchQuery('');
    if (menuItems.length === 0) {
      const { data } = await supabase.from('menu_items').select('*').eq('restaurant_id', restaurant!.id).eq('is_available', true);
      setMenuItems(data || []);
    }
  };

  const submitPunchOrder = async () => {
    setPunchLoading(true);
    
    const itemsToOrder = Object.entries(punchCart).filter(([_, qty]) => qty > 0);
    if (itemsToOrder.length === 0) {
       setPunchLoading(false);
       return;
    }
    
    let sessionId = punchOrderTable?.currentSession?.id;
    
    if (!sessionId) {
      // Create session for vacant table
      const { data: newSession, error: sessionErr } = await supabase.from('table_sessions').insert({
        restaurant_id: restaurant!.id,
        table_id: punchOrderTable!.id,
        session_token: generateUUID()
      }).select().single();
      
      if (newSession) {
        sessionId = newSession.id;
        // Mark table as occupied
        await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', punchOrderTable!.id);
      } else {
        toast({ title: 'Error', description: 'Could not create session for table', variant: 'destructive' });
        setPunchLoading(false);
        return;
      }
    }
    
    let total = 0;
    const orderItemsPayload = [];
    for (const [id, qty] of itemsToOrder) {
       const item = menuItems.find(m => m.id === id);
       if (item) {
          total += item.price * qty;
          orderItemsPayload.push({
             item_name: item.name,
             quantity: qty,
             item_price: item.price,
             menu_item_id: item.id
          });
       }
    }
    
    const { data: orderData } = await supabase.from('orders').insert({
       restaurant_id: restaurant!.id,
       session_id: sessionId,
       table_number: punchOrderTable.table_number,
       status: 'new',
       subtotal: total,
       tax_amount: 0,
       total_amount: total,
       payment_status: 'pending',
       customer_name: 'Staff (Manual)'
    }).select().single();
    
    if (orderData) {
       await supabase.from('order_items').insert(
         orderItemsPayload.map(i => ({ ...i, order_id: orderData.id }))
       );
       toast({ title: 'Order Punched', description: 'Manual order added successfully' });
       setPunchOrderTable(null);
       loadData();
    }
    setPunchLoading(false);
  };

  const playVoiceNote = async (order: Order) => {
    if (!order.voice_note_url) return;
    if (playingOrderId === order.id) {
      audioRef.current?.pause();
      setPlayingOrderId(null);
      return;
    }
    const { data } = await supabase.storage.from('voice-notes').createSignedUrl(order.voice_note_url, 300);
    if (data?.signedUrl) {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(data.signedUrl);
      audioRef.current.onended = () => setPlayingOrderId(null);
      audioRef.current.play();
      setPlayingOrderId(order.id);
      if (!order.voice_note_listened) await supabase.from('orders').update({ voice_note_listened: true }).eq('id', order.id);
    }
  };

  const orderStatusColors: Record<string, string> = { 
    new: 'bg-info/15 text-info border border-info/30', 
    preparing: 'bg-warning/15 text-warning border border-warning/30', 
    ready: 'bg-accent/15 text-accent border border-accent/30', 
    served: 'bg-success/15 text-success border border-success/30',
    cancelled: 'bg-destructive/15 text-destructive border border-destructive/30'
  };

  const paymentStatusColors: Record<string, string> = {
    pending: 'bg-warning/15 text-warning border border-warning/30',
    paid: 'bg-success/15 text-success border border-success/30',
  };

  const renderOrderTicket = (order: OrderWithItems, showActions = true) => (
    <Card key={order.id} className="shadow-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Table {order.table_number}</CardTitle>
          <Badge className={`${orderStatusColors[order.status || 'new']} capitalize`}>{order.status}</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(order.created_at).toLocaleTimeString()}
          {order.voice_note_url && (
            <Badge variant="outline" className="ml-2 gap-1">
              <Mic className="h-3 w-3" />
              Voice
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.special_instructions && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-warning mb-1">
              <MessageSquare className="h-4 w-4" />
              Special Instructions
            </div>
            <p className="text-sm">{order.special_instructions}</p>
          </div>
        )}
        
        <ul className="space-y-2">
          {order.items.map((item) => {
            const prepTime = (item as any).menu_items?.preparation_time_minutes;
            return (
              <li key={item.id} className="flex justify-between text-sm items-center">
                <span>{item.quantity}x {item.item_name}</span>
                {prepTime && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded font-medium">
                    <Clock className="h-2.5 w-2.5" /> {prepTime}m
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {order.voice_note_url && (
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => playVoiceNote(order)}>
            {playingOrderId === order.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playingOrderId === order.id ? 'Pause Voice Note' : 'Play Voice Note'}
          </Button>
        )}
        
        {showActions && order.status !== 'cancelled' && (
          <div className="flex gap-2 pt-2 border-t">
            {order.status === 'new' && (
              <Button variant="accent" size="sm" className="flex-1" onClick={() => updateOrderStatus(order.id, 'preparing')}>Start Preparing</Button>
            )}
            {order.status === 'preparing' && (
              <Button variant="default" size="sm" className="flex-1 bg-success hover:bg-success/90" onClick={() => updateOrderStatus(order.id, 'ready')}>Mark Ready</Button>
            )}
            {order.status === 'ready' && (
              <Button variant="default" size="sm" className="flex-1" onClick={() => updateOrderStatus(order.id, 'served')}>Mark Served</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (authLoading || loading) {
    return <DashboardLayout type="restaurant"><div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading Operations...</div></div></DashboardLayout>;
  }

  return (
    <DashboardLayout type="restaurant">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Live Orders</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
              Paperless Digital Management
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-muted p-1 rounded-lg flex items-center">
              <Button 
                variant={viewMode === 'tables' ? 'default' : 'ghost'} 
                size="sm" 
                className={cn("h-8 rounded-md", viewMode === 'tables' && "shadow-sm")}
                onClick={() => setViewMode('tables')}
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Tables View
              </Button>
              <Button 
                variant={viewMode === 'tickets' ? 'default' : 'ghost'} 
                size="sm" 
                className={cn("h-8 rounded-md", viewMode === 'tickets' && "shadow-sm bg-accent text-accent-foreground")}
                onClick={() => setViewMode('tickets')}
              >
                <ListTodo className="w-4 h-4 mr-2" />
                Kitchen View
              </Button>
            </div>
            <NotificationBell notifications={notifications} onMarkRead={markRead} onClearAll={clearAll} />
          </div>
        </div>

        {viewMode === 'tables' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {tables.filter(t => t.currentSession || (t.requests && t.requests.length > 0)).map(table => {
              const session = table.currentSession;
              const activeOrders = session ? session.orders.filter(o => o.status !== 'cancelled') : [];
              const unpaidTotal = activeOrders.filter(o => o.payment_status === 'pending').reduce((sum, o) => sum + o.total_amount, 0);
              const prepCount = activeOrders.filter(o => o.status === 'preparing' || o.status === 'new').length;
              const readyCount = activeOrders.filter(o => o.status === 'ready').length;
              const requestCount = table.requests?.length || 0;
              
              return (
                <Card 
                  key={table.id} 
                  className="shadow-card cursor-pointer hover:shadow-card-hover transition-all ring-2 ring-transparent hover:ring-accent/50 relative overflow-hidden"
                  onClick={() => setSelectedTableId(table.id)}
                >
                  {requestCount > 0 && (
                    <div className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                      {requestCount} Request{requestCount > 1 ? 's' : ''}
                    </div>
                  )}
                  <CardContent className="p-4 text-center">
                    <p className="font-bold text-2xl">{table.table_number}</p>
                    <div className="mt-3 text-sm space-y-1.5">
                      {prepCount > 0 && <Badge variant="outline" className="w-full justify-center text-warning border-warning/30 bg-warning/5">{prepCount} Preparing</Badge>}
                      {readyCount > 0 && <Badge variant="outline" className="w-full justify-center text-accent border-accent/30 bg-accent/5">{readyCount} Ready</Badge>}
                      {unpaidTotal > 0 && <div className="text-destructive font-medium pt-1 text-xs">Unpaid: {restaurant?.currency} {unpaidTotal.toFixed(2)}</div>}
                      {activeOrders.length === 0 && requestCount === 0 && <div className="text-muted-foreground text-xs pt-2">No active orders</div>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {tables.filter(t => t.currentSession || (t.requests && t.requests.length > 0)).length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                No active tables right now.
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeOrders.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                No orders need preparation.
              </div>
            ) : (
              activeOrders.map(order => renderOrderTicket(order))
            )}
          </div>
        )}
      </div>

      {/* Table Detail Drawer/Modal */}
      <Dialog open={!!selectedTableId} onOpenChange={(open) => !open && setSelectedTableId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">
          {selectedTable && (
            <>
              <DialogHeader className="p-4 border-b bg-muted/20 sticky top-0 z-10 backdrop-blur-md">
                <DialogTitle className="flex items-center justify-between">
                  <span>Table {selectedTable.table_number}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openPunchOrder(selectedTable)}>
                      <Plus className="h-4 w-4 mr-1" /> Punch Order
                    </Button>
                    {selectedTable.currentSession && (
                      <Button variant="outline" size="sm" onClick={() => setVacantConsentTable(selectedTable)} className="text-destructive hover:bg-destructive/10 border-destructive/30">
                        Mark Vacant
                      </Button>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              <div className="p-4 space-y-6">
                {/* Requests Section */}
                {selectedTable.requests && selectedTable.requests.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                      <Bell className="w-4 h-4 text-destructive" /> Active Requests
                    </h3>
                    <div className="grid gap-2">
                      {selectedTable.requests.map(req => (
                        <div key={req.id} className="flex items-center justify-between bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                          <span className="font-medium text-destructive capitalize">{(req.request_type || '').replace('_', ' ')}</span>
                          <Button size="sm" variant="outline" className="bg-background hover:bg-destructive hover:text-white" onClick={() => resolveRequest(req)}>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Resolved
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Orders Section */}
                {selectedTable.currentSession ? (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Orders & Billing</h3>
                    {selectedTable.currentSession.orders.map((order, idx) => (
                      <Card key={order.id} className="shadow-sm">
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Order #{idx + 1}</span>
                            <div className="flex gap-2">
                              <Badge className={cn("capitalize text-xs", orderStatusColors[order.status || 'new'])}>{order.status}</Badge>
                              {order.status !== 'cancelled' && (
                                <Badge className={cn("text-xs", paymentStatusColors[order.payment_status])}>{order.payment_status === 'pending' ? 'Unpaid' : 'Paid'}</Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-xs text-muted-foreground space-y-1">
                            {order.items.map(item => (
                              <div key={item.id} className="flex justify-between">
                                <span>{item.quantity}x {item.item_name}</span>
                                <span>{restaurant?.currency} {(item.item_price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t">
                            <span className="font-bold">{restaurant?.currency} {order.total_amount.toFixed(2)}</span>
                            <div className="flex flex-wrap gap-2 justify-end">
                              {/* Payment Actions */}
                              {order.payment_status === 'pending' && order.status !== 'cancelled' && (
                                <>
                                  {order.payment_method === 'upi' ? (
                                    <Button size="sm" variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10 bg-blue-500/5" onClick={() => markOrderAsPaid(order.id)}>
                                      <Check className="h-3 w-3 mr-1" /> Confirm UPI
                                    </Button>
                                  ) : order.payment_method === 'counter' ? (
                                    <Button size="sm" variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500/10 bg-orange-500/5" onClick={() => markOrderAsPaid(order.id)}>
                                      <Check className="h-3 w-3 mr-1" /> Confirm Cash
                                    </Button>
                                  ) : (
                                    <Button size="sm" variant="default" onClick={() => markOrderAsPaid(order.id)}>
                                      <Check className="h-3 w-3 mr-1" /> Pay
                                    </Button>
                                  )}
                                </>
                              )}
                              
                              {/* Cancel Action */}
                              {['new', 'preparing'].includes(order.status || '') && (
                                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => cancelOrder(order)}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {/* Bottom Actions for Table */}
                    {(() => {
                      const activeOrders = selectedTable.currentSession!.orders.filter(o => o.status !== 'cancelled');
                      const pendingOrders = activeOrders.filter(o => o.payment_status === 'pending');
                      const sessionTotal = activeOrders.reduce((sum, o) => sum + o.total_amount, 0);
                      const unpaidTotal = pendingOrders.reduce((sum, o) => sum + o.total_amount, 0);
                      
                      return (
                        <div className="mt-4 p-4 bg-muted/30 rounded-xl space-y-4 border border-border">
                          <div className="flex justify-between items-center text-sm font-medium">
                            <span>Total Bill: {restaurant?.currency} {sessionTotal.toFixed(2)}</span>
                            {unpaidTotal > 0 && <span className="text-destructive">Due: {restaurant?.currency} {unpaidTotal.toFixed(2)}</span>}
                          </div>
                          <div className="flex gap-2">
                            {pendingOrders.length > 0 && (
                              <Button variant="accent" className="flex-1" onClick={() => markAllPaid(selectedTable.currentSession!)}>
                                <CreditCard className="h-4 w-4 mr-2" /> Mark All Paid
                              </Button>
                            )}
                            <Button variant="outline" className="flex-1 border-dashed pointer-events-none opacity-80">
                              Digital Bill Auto-Sent
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No active session on this table.</div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Water Request Modal */}
      <Dialog open={!!waterReq} onOpenChange={(open) => !open && setWaterReq(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Water Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Did you serve a paid water bottle or regular free water?</p>
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-medium">Price (₹)</label>
                <input type="number" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={waterPrice} onChange={(e) => setWaterPrice(e.target.value)} />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-xs font-medium">Quantity</label>
                <input type="number" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={waterQty} onChange={(e) => setWaterQty(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => handleResolveWater(true)} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                <Check className="w-4 h-4 mr-2" /> Yes, Add to Bill
              </Button>
              <Button variant="outline" onClick={() => handleResolveWater(false)} className="w-full text-muted-foreground">
                No, Regular Water (Free)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Punch Order Modal */}
      <Dialog open={!!punchOrderTable} onOpenChange={(open) => !open && setPunchOrderTable(null)}>
        <DialogContent className="sm:max-w-xl h-[85vh] flex flex-col p-0 bg-background overflow-hidden">
          <DialogHeader className="p-4 border-b bg-background z-10 shrink-0 space-y-3">
            <DialogTitle>Punch Order - Table {punchOrderTable?.table_number}</DialogTitle>
            {/* Real-time Search Item Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={punchSearchQuery}
                onChange={(e) => setPunchSearchQuery(e.target.value)}
                placeholder="Search menu items..."
                className="pl-9 pr-9 text-sm"
              />
              {punchSearchQuery && (
                <button
                  onClick={() => setPunchSearchQuery('')}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {(() => {
              const filteredItems = menuItems.filter(item =>
                item.name.toLowerCase().includes(punchSearchQuery.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(punchSearchQuery.toLowerCase()))
              );

              if (menuItems.length === 0) {
                return <div className="text-center text-muted-foreground py-8">Loading menu items...</div>;
              }

              if (filteredItems.length === 0) {
                return (
                  <div className="text-center text-muted-foreground py-8 space-y-2">
                    <p className="font-medium">No items found matching "{punchSearchQuery}"</p>
                    <Button variant="ghost" size="sm" onClick={() => setPunchSearchQuery('')}>
                      Clear Search
                    </Button>
                  </div>
                );
              }

              return filteredItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border border-border/50 rounded-lg hover:border-accent/50 transition-colors">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{restaurant?.currency} {item.price}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setPunchCart(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] || 0) - 1) }))}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-4 text-center font-medium">{punchCart[item.id] || 0}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-accent text-accent hover:bg-accent/10" onClick={() => setPunchCart(p => ({ ...p, [item.id]: (p[item.id] || 0) + 1 }))}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ));
            })()}
          </div>
          <div className="p-4 border-t bg-muted/20 shrink-0 mt-auto">
            <Button 
              className="w-full text-base h-12" 
              disabled={punchLoading || Object.values(punchCart).reduce((a, b) => a + b, 0) === 0} 
              onClick={submitPunchOrder}
            >
              {punchLoading ? 'Sending...' : 'Send Order to Kitchen'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark Vacant Consent Modal */}
      <AlertDialog open={!!vacantConsentTable} onOpenChange={(open) => !open && setVacantConsentTable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Mark Table {vacantConsentTable?.table_number} as Vacant?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark Table {vacantConsentTable?.table_number} as vacant? 
              This will close the active table session, cancel any unserved orders, and clear all customer requests for this table.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVacantConsentTable(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (vacantConsentTable?.currentSession) {
                  closeTable(vacantConsentTable.id, vacantConsentTable.currentSession.id);
                }
              }} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm & Mark Vacant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
