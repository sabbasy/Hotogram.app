import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { RestaurantTable, Restaurant, TableStatus } from '@/types/database';
import { Plus, Trash2, QrCode, Download, FileDown, MoreVertical, Users, UserX, Receipt, XCircle, AlertTriangle } from 'lucide-react';
import { cn, generateUUID } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

const TABLE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', 
  '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#0ea5e9'
];

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  vacant: { 
    label: 'Vacant', 
    icon: <UserX className="h-3 w-3" />, 
    className: 'bg-success/15 text-success border border-success/30' 
  },
  occupied: { 
    label: 'Occupied', 
    icon: <Users className="h-3 w-3" />, 
    className: 'bg-warning/15 text-warning border border-warning/30' 
  },
  billing: { 
    label: 'Billing', 
    icon: <Receipt className="h-3 w-3" />, 
    className: 'bg-accent/15 text-accent border border-accent/30' 
  },
};

let tableCache: {
  restaurant: Restaurant | null;
  tables: RestaurantTable[];
  unpaidOrdersMap: Record<string, number>;
} | null = null;

export default function TableManagement() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(tableCache?.restaurant || null);
  const [tables, setTables] = useState<RestaurantTable[]>(tableCache?.tables || []);
  const [unpaidOrdersMap, setUnpaidOrdersMap] = useState<Record<string, number>>(tableCache?.unpaidOrdersMap || {});
  const [loading, setLoading] = useState(!tableCache);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [batchPrefix, setBatchPrefix] = useState('Table ');
  const [batchStart, setBatchStart] = useState('1');
  const [batchCount, setBatchCount] = useState('10');
  const [batchCustomNames, setBatchCustomNames] = useState('');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [vacantWarningTable, setVacantWarningTable] = useState<RestaurantTable | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth/restaurant');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  // Real-time updates for tables
  useEffect(() => {
    if (!restaurant) return;
    
    const channel = supabase
      .channel('table-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables', filter: `restaurant_id=eq.${restaurant.id}` }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` }, () => {
        loadUnpaidOrders();
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [restaurant?.id]);

  const loadData = async () => {
    const { data: restaurants } = await supabase.from('restaurants').select('*').eq('owner_id', user!.id).limit(1);
    if (restaurants && restaurants.length > 0) {
      const rest = restaurants[0] as unknown as Restaurant;
      setRestaurant(rest);
      
      const { data: tablesData } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', rest.id)
        .order('created_at', { ascending: true });

      const tData = (tablesData || []) as unknown as RestaurantTable[];
      setTables(tData);
      const countMap = await loadUnpaidOrdersForRestaurant(rest.id);
      
      tableCache = {
        restaurant: rest,
        tables: tData,
        unpaidOrdersMap: countMap,
      };
    }
    setLoading(false);
  };

  const loadUnpaidOrders = async () => {
    if (!restaurant) return;
    await loadUnpaidOrdersForRestaurant(restaurant.id);
  };

  const loadUnpaidOrdersForRestaurant = async (restaurantId: string) => {
    const { data: orders } = await supabase
      .from('orders')
      .select('table_id')
      .eq('restaurant_id', restaurantId)
      .eq('payment_status', 'pending')
      .not('table_id', 'is', null);
    
    const countMap: Record<string, number> = {};
    (orders || []).forEach(order => {
      if (order.table_id) {
        countMap[order.table_id] = (countMap[order.table_id] || 0) + 1;
      }
    });
    setUnpaidOrdersMap(countMap);
    return countMap;
  };

  const handleAddTable = async () => {
    if (!restaurant || !tableNumber.trim()) return;

    const trimmedName = tableNumber.trim();

    // Check if table name already exists in this restaurant
    const isDuplicate = tables.some(t => t.table_number.trim().toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      toast({
        title: 'Duplicate Table Name',
        description: `A table named "${trimmedName}" already exists. Please choose a unique name.`,
        variant: 'destructive'
      });
      return;
    }
    
    const qrToken = generateUUID();
    
    const { error } = await supabase.from('restaurant_tables').insert({ 
      restaurant_id: restaurant.id, 
      table_number: trimmedName,
      qr_code_token: qrToken
    });
    
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Success', description: `Table "${trimmedName}" added successfully.` });
    setDialogOpen(false);
    setTableNumber('');
    loadData();
  };

  const handleBatchAddTables = async () => {
    if (!restaurant) return;
    let namesToAdd: string[] = [];

    if (batchCustomNames.trim()) {
      namesToAdd = batchCustomNames.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      const startNum = parseInt(batchStart) || 1;
      const count = parseInt(batchCount) || 1;
      for (let i = 0; i < count; i++) {
        namesToAdd.push(`${batchPrefix}${startNum + i}`);
      }
    }

    if (namesToAdd.length === 0) {
      toast({ title: 'Invalid Input', description: 'Please enter table parameters or custom names.', variant: 'destructive' });
      return;
    }

    // Deduplicate within the requested batch itself
    const uniqueBatchNames: string[] = [];
    const batchSeen = new Set<string>();
    for (const name of namesToAdd) {
      const lower = name.toLowerCase();
      if (!batchSeen.has(lower)) {
        batchSeen.add(lower);
        uniqueBatchNames.push(name);
      }
    }

    // Filter out existing table numbers in database
    const existingSet = new Set(tables.map(t => t.table_number.trim().toLowerCase()));
    const newNames = uniqueBatchNames.filter(name => !existingSet.has(name.toLowerCase()));
    const skippedCount = namesToAdd.length - newNames.length;

    if (newNames.length === 0) {
      toast({
        title: 'Duplicate Table Names',
        description: 'All requested table names already exist in your restaurant.',
        variant: 'destructive'
      });
      return;
    }

    const payload = newNames.map(name => ({
      restaurant_id: restaurant.id,
      table_number: name,
      qr_code_token: generateUUID(),
      status: 'vacant' as TableStatus
    }));

    // Single batch database insert
    const { error } = await supabase.from('restaurant_tables').insert(payload);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Tables Added! 🎉',
      description: skippedCount > 0 
        ? `Created ${newNames.length} unique tables. (${skippedCount} duplicate(s) skipped)`
        : `Successfully created ${newNames.length} tables in 1 batch.`
    });
    setDialogOpen(false);
    setTableNumber('');
    setBatchCustomNames('');
    loadData();
  };

  const handleDeleteTable = async (tableId: string) => {
    // Safely close active sessions before table deletion
    const { data: sessionData } = await supabase
      .from('table_sessions')
      .select('id')
      .eq('table_id', tableId)
      .eq('status', 'active')
      .maybeSingle();

    if (sessionData) {
      await supabase.from('table_sessions').update({ 
        status: 'closed', 
        closed_at: new Date().toISOString() 
      }).eq('id', sessionData.id);
    }

    const { error } = await supabase.from('restaurant_tables').delete().eq('id', tableId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Deleted', description: 'Table deleted' });
    loadData();
  };

  const updateTableStatus = async (table: RestaurantTable, newStatus: TableStatus) => {
    // Check for unpaid orders when marking vacant
    if (newStatus === 'vacant' && unpaidOrdersMap[table.id] > 0) {
      setVacantWarningTable(table);
      return;
    }
    
    await performStatusUpdate(table.id, newStatus);
  };

  const performStatusUpdate = async (tableId: string, newStatus: TableStatus) => {
    const { error } = await supabase
      .from('restaurant_tables')
      .update({ status: newStatus })
      .eq('id', tableId);
    
    if (error) { 
      toast({ title: 'Error', description: error.message, variant: 'destructive' }); 
      return; 
    }
    
    // If table is marked vacant, close active session and cleanup voice notes
    if (newStatus === 'vacant') {
      const now = new Date().toISOString();
      const { data: sessionData } = await supabase
        .from('table_sessions')
        .select('id')
        .eq('table_id', tableId)
        .eq('status', 'active')
        .maybeSingle();

      if (sessionData) {
        const sessionId = sessionData.id;
        
        const { data: sessionOrders } = await supabase
          .from('orders')
          .select('voice_note_url')
          .eq('session_id', sessionId)
          .not('voice_note_url', 'is', null);
        
        if (sessionOrders && sessionOrders.length > 0) {
          const voicePaths = sessionOrders
            .map(o => o.voice_note_url)
            .filter(Boolean) as string[];
          if (voicePaths.length > 0) {
            await supabase.storage.from('voice-notes').remove(voicePaths);
          }
          await supabase
            .from('orders')
            .update({ voice_note_url: null })
            .eq('session_id', sessionId)
            .not('voice_note_url', 'is', null);
        }

        // Cancel any unserved orders in this session
        await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('session_id', sessionId)
          .neq('status', 'served');

        await supabase.from('table_sessions').update({ 
          status: 'closed', 
          closed_at: now 
        }).eq('id', sessionId);
      }
    }
    
    // Update local state immediately
    setTables(prev => prev.map(t => 
      t.id === tableId ? { ...t, status: newStatus } : t
    ));
    
    toast({ 
      title: 'Status Updated', 
      description: `Table marked as ${newStatus}` 
    });
    
    setVacantWarningTable(null);
  };

  const forceMarkVacant = async () => {
    if (vacantWarningTable) {
      await performStatusUpdate(vacantWarningTable.id, 'vacant');
    }
  };

  const getQRUrl = (table: RestaurantTable) => `${window.location.origin}/menu/${table.qr_code_token}`;
  const getTableColor = (index: number) => TABLE_COLORS[index % TABLE_COLORS.length];

  const downloadQR = (table: RestaurantTable, index: number) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const size = 400;
    const padding = 40;
    const totalSize = size + padding * 2 + 60;
    
    canvas.width = totalSize;
    canvas.height = totalSize;
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalSize, totalSize);
    
    // Border
    const color = getTableColor(index);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, totalSize - 8, totalSize - 8);
    
    // Table name header
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, totalSize, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(table.table_number, totalSize / 2, 34);
    
    // QR Code
    const svg = document.getElementById(`qr-print-${table.id}`);
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, padding, 60 + padding / 2, size, size);
        
        // Restaurant name footer
        ctx.fillStyle = '#666666';
        ctx.font = '16px Arial';
        ctx.fillText(restaurant?.name || '', totalSize / 2, totalSize - 15);
        
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `table-${table.table_number}-qr.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
  };

  const downloadAllQRs = () => {
    tables.forEach((table, index) => {
      setTimeout(() => downloadQR(table, index), index * 500);
    });
    toast({ title: 'Downloading', description: `Downloading ${tables.length} QR codes...` });
  };

  if (authLoading || loading) {
    return <DashboardLayout type="restaurant"><div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading...</div></div></DashboardLayout>;
  }

  return (
    <DashboardLayout type="restaurant">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Table Management</h1>
            <p className="text-muted-foreground mt-1">Manage tables, status, and QR codes</p>
          </div>
          <div className="flex gap-2">
            {tables.length > 0 && (
              <Button variant="outline" onClick={downloadAllQRs}>
                <FileDown className="h-4 w-4 mr-2" />
                Download All
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="accent"><Plus className="h-4 w-4 mr-2" />Add Table</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Add Tables</DialogTitle></DialogHeader>
                <Tabs defaultValue="single" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="single">Single Table</TabsTrigger>
                    <TabsTrigger value="batch">Batch Add Multiple</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="single" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Table Name / Number</Label>
                      <Input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="e.g., Table 1, VIP Table, Window Seat" />
                    </div>
                    <Button onClick={handleAddTable} variant="accent" className="w-full">Add Single Table</Button>
                  </TabsContent>

                  <TabsContent value="batch" className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Prefix</Label>
                        <Input value={batchPrefix} onChange={(e) => setBatchPrefix(e.target.value)} placeholder="Table " />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Start #</Label>
                        <Input type="number" value={batchStart} onChange={(e) => setBatchStart(e.target.value)} placeholder="1" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Count</Label>
                        <Input type="number" value={batchCount} onChange={(e) => setBatchCount(e.target.value)} placeholder="10" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">OR Custom Comma-Separated Names</Label>
                      <Input value={batchCustomNames} onChange={(e) => setBatchCustomNames(e.target.value)} placeholder="e.g., T-1, T-2, Patio 1, VIP Lounge" />
                    </div>
                    <Button onClick={handleBatchAddTables} variant="accent" className="w-full">Generate Multiple Tables</Button>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Status Legend */}
        <Card className="shadow-card">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-muted-foreground font-medium">Status:</span>
              {(Object.keys(statusConfig)).map(status => (
                <div key={status} className="flex items-center gap-1.5">
                  <Badge className={cn("text-xs capitalize", statusConfig[status].className)}>
                    {statusConfig[status].icon}
                    <span className="ml-1">{statusConfig[status].label}</span>
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {tables.length === 0 ? (
          <Card className="shadow-card"><CardContent className="py-12 text-center"><p className="text-muted-foreground">No tables yet. Add your first table to generate QR codes.</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tables.map((table, index) => {
              const status = table.status || 'vacant';
              const config = statusConfig[status];
              const unpaidCount = unpaidOrdersMap[table.id] || 0;
              
              return (
                <Card key={table.id} className="shadow-card hover:shadow-card-hover transition-shadow" style={{ borderTopColor: getTableColor(index), borderTopWidth: '4px' }}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{table.table_number}</CardTitle>
                      <Badge className={cn("capitalize text-xs flex items-center gap-1", config.className)}>
                        {config.icon}
                        {config.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Status Control Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => updateTableStatus(table, 'vacant')}
                            className={cn(status === 'vacant' && "bg-muted")}
                          >
                            <UserX className="h-4 w-4 mr-2 text-success" />
                            Mark Vacant
                            {unpaidCount > 0 && <AlertTriangle className="h-3 w-3 ml-2 text-warning" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => updateTableStatus(table, 'occupied')}
                            className={cn(status === 'occupied' && "bg-muted")}
                          >
                            <Users className="h-4 w-4 mr-2 text-warning" />
                            Mark Occupied
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => updateTableStatus(table, 'billing')}
                            className={cn(status === 'billing' && "bg-muted")}
                          >
                            <Receipt className="h-4 w-4 mr-2 text-accent" />
                            Mark Billing
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTable(table.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Unpaid Orders Warning */}
                    {unpaidCount > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-warning/10 border border-warning/30 rounded-md text-sm">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <span className="text-warning">{unpaidCount} unpaid order{unpaidCount > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    
                    <div className="bg-secondary/50 p-4 rounded-lg flex flex-col items-center">
                      <div className="p-2 bg-white rounded-lg" style={{ border: `3px solid ${getTableColor(index)}` }}>
                        <QRCodeSVG id={`qr-print-${table.id}`} value={getQRUrl(table)} size={150} level="H" />
                      </div>
                      <p className="text-sm font-medium mt-2" style={{ color: getTableColor(index) }}>{table.table_number}</p>
                      <p className="text-xs text-muted-foreground">{restaurant?.name}</p>
                    </div>
                    
                    {/* Quick Status Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant={status === 'occupied' ? 'default' : 'outline'} 
                        size="sm" 
                        className="w-full"
                        onClick={() => updateTableStatus(table, 'occupied')}
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Occupied
                      </Button>
                      <Button 
                        variant={status === 'vacant' ? 'default' : 'outline'} 
                        size="sm" 
                        className="w-full"
                        onClick={() => updateTableStatus(table, 'vacant')}
                      >
                        <UserX className="h-4 w-4 mr-1" />
                        Vacant
                      </Button>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedTable(table); setQrDialogOpen(true); }}>
                        <QrCode className="h-4 w-4 mr-2" />View
                      </Button>
                      <Button variant="accent" size="sm" className="flex-1" onClick={() => downloadQR(table, index)}>
                        <Download className="h-4 w-4 mr-2" />Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* QR Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Table {selectedTable?.table_number} QR Code</DialogTitle></DialogHeader>
            {selectedTable && (
              <div className="space-y-4">
                <div className="bg-secondary/50 p-6 rounded-lg flex flex-col items-center">
                  <div className="p-3 bg-white rounded-lg" style={{ border: `4px solid ${getTableColor(tables.findIndex(t => t.id === selectedTable.id))}` }}>
                    <QRCodeSVG value={getQRUrl(selectedTable)} size={250} level="H" />
                  </div>
                  <p className="text-lg font-bold mt-3" style={{ color: getTableColor(tables.findIndex(t => t.id === selectedTable.id)) }}>Table {selectedTable.table_number}</p>
                  <p className="text-sm text-muted-foreground">{restaurant?.name}</p>
                </div>
                <p className="text-sm text-muted-foreground text-center break-all">{getQRUrl(selectedTable)}</p>
                <Button variant="accent" className="w-full" onClick={() => downloadQR(selectedTable, tables.findIndex(t => t.id === selectedTable.id))}>
                  <Download className="h-4 w-4 mr-2" />Download QR Code
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Vacant Warning Dialog */}
        <AlertDialog open={!!vacantWarningTable} onOpenChange={() => setVacantWarningTable(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Unpaid Orders Exist
              </AlertDialogTitle>
              <AlertDialogDescription>
                Table {vacantWarningTable?.table_number} has {unpaidOrdersMap[vacantWarningTable?.id || ''] || 0} unpaid order(s). 
                Are you sure you want to mark it as vacant?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={forceMarkVacant} className="bg-warning text-warning-foreground hover:bg-warning/90">
                Mark Vacant Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
