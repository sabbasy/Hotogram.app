import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { MenuCategory, MenuItem, Restaurant } from '@/types/database';
import { Plus, Pencil, Trash2, FolderPlus, Upload, X, Image as ImageIcon, Sparkles, Loader2, FileImage, CheckCircle2, LayoutGrid, List, TableProperties, Clock } from 'lucide-react';
import { sanitizeError } from '@/lib/errorUtils';
import { menuItemSchema, menuCategorySchema, validateData } from '@/lib/validation';
import { extractMenuFromImage, ExtractedCategory } from '@/lib/aiMenuExtractor';
import { getUnsplashFoodImageUrl, getBulkFoodImages } from '@/lib/foodImageFinder';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getImageUrl = (path: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/menu-images/${path}`;
};

const checkRateLimit = (userId: string, cost: number = 1): boolean => {
  const key = `auto_image_requests_${userId}`;
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const raw = localStorage.getItem(key);
  const requests: number[] = raw ? JSON.parse(raw) : [];
  const activeRequests = requests.filter(time => now - time < oneHour);
  if (activeRequests.length + cost > 5) {
    return false;
  }
  for (let i = 0; i < cost; i++) {
    activeRequests.push(now);
  }
  localStorage.setItem(key, JSON.stringify(activeRequests));
  return true;
};

const getRateLimitResetMinutes = (userId: string): number => {
  const key = `auto_image_requests_${userId}`;
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const raw = localStorage.getItem(key);
  const requests: number[] = raw ? JSON.parse(raw) : [];
  const activeRequests = requests.filter(time => now - time < oneHour);
  if (activeRequests.length === 0) return 0;
  const oldest = Math.min(...activeRequests);
  const remainingMs = oneHour - (now - oldest);
  return Math.ceil(remainingMs / 60000);
};

const getActiveRequestCount = (userId: string): number => {
  const key = `auto_image_requests_${userId}`;
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const raw = localStorage.getItem(key);
  const requests: number[] = raw ? JSON.parse(raw) : [];
  return requests.filter(time => now - time < oneHour).length;
};

export default function MenuManagement() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Layout Density Toggle: Grid vs List vs Compact
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>(() => {
    return (localStorage.getItem('menu_view_mode') as 'grid' | 'list' | 'compact') || 'grid';
  });

  const handleViewModeChange = (mode: 'grid' | 'list' | 'compact') => {
    setViewMode(mode);
    localStorage.setItem('menu_view_mode', mode);
  };

  // Category dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');

  // Item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemPrepTime, setItemPrepTime] = useState('15');
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemImageUrl, setItemImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAutoFindImage = async () => {
    if (!user) return;
    if (!itemName.trim()) {
      toast({ title: 'Dish Name Required', description: 'Please type the dish name first so AI can find matching food photos.', variant: 'destructive' });
      return;
    }
    
    if (!checkRateLimit(user.id, 1)) {
      const resetMin = getRateLimitResetMinutes(user.id);
      toast({ 
        title: 'Rate Limit Reached', 
        description: `You have reached the limit of 5 auto image assignments per hour. Try again in ${resetMin} minutes.`, 
        variant: 'destructive' 
      });
      return;
    }
    
    toast({ title: 'Searching...', description: `Finding photo for "${itemName}"...` });
    const category = categories.find(c => c.id === selectedCategoryId);
    const autoUrl = await getUnsplashFoodImageUrl(itemName, category?.name || '');
    setItemImageUrl(autoUrl);
    
    if (autoUrl.includes('default-food-icon')) {
      toast({ title: 'No Photo Found', description: 'Could not find a match or missing API key.', variant: 'destructive' });
    } else {
      toast({ title: 'Food Photo Assigned! 📸', description: `Assigned high-res food photo for "${itemName}".` });
    }
  };

  // Single-Request Bulk Auto Image Assignment
  const [autoImageLoading, setAutoImageLoading] = useState(false);

  const handleBatchAutoImages = async () => {
    if (!user || !restaurant || items.length === 0) {
      toast({ title: 'No Menu Items', description: 'Add menu items first before generating images.', variant: 'destructive' });
      return;
    }

    const itemsToUpdate = items.filter(i => !i.image_url || i.image_url.trim() === '');
    const targetItems = itemsToUpdate.length > 0 ? itemsToUpdate : items;

    // Group categories to determine API request cost
    const categoriesMap: Record<string, any[]> = {};
    targetItems.forEach(item => {
      const cat = categories.find(c => c.id === item.category_id);
      const catName = (cat?.name || 'general').toLowerCase().trim();
      if (!categoriesMap[catName]) categoriesMap[catName] = [];
      categoriesMap[catName].push(item);
    });
    const cost = Object.keys(categoriesMap).length;

    if (!checkRateLimit(user.id, cost)) {
      const resetMin = getRateLimitResetMinutes(user.id);
      const activeCount = getActiveRequestCount(user.id);
      toast({ 
        title: 'Rate Limit Reached', 
        description: `This bulk action requires ${cost} requests, but you only have ${5 - activeCount} left this hour. Try again in ${resetMin} minutes or process items individually.`, 
        variant: 'destructive' 
      });
      return;
    }

    setAutoImageLoading(true);
    toast({ title: 'Assigning Food Photos...', description: `Processing ${targetItems.length} items grouped into ${cost} category requests...` });

    try {
      // Fetch relevant images grouped by category to save API rate limits and ensure relevance
      const imageMap = await getBulkFoodImages(
        targetItems.map(i => {
          const cat = categories.find(c => c.id === i.category_id);
          return {
            id: i.id,
            name: i.name,
            categoryName: cat?.name || ''
          };
        })
      );

      const updates = targetItems.map(item => ({
        id: item.id,
        restaurant_id: restaurant.id,
        category_id: item.category_id,
        name: item.name,
        description: item.description,
        price: item.price,
        is_available: item.is_available,
        sort_order: item.sort_order,
        image_url: imageMap[item.id] || item.image_url
      }));

      // 1 single database upsert request
      const { error } = await supabase.from('menu_items').upsert(updates as any);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Auto Images Assigned! 📸✨', description: `Successfully assigned photos to ${targetItems.length} menu items.` });
        loadData();
      }
    } catch (err) {
      toast({ title: 'Failed', description: 'Could not complete auto image assignment.', variant: 'destructive' });
    } finally {
      setAutoImageLoading(false);
    }
  };

  // AI Menu Scanner dialog
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiImageFile, setAiImageFile] = useState<File | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [extractedCategories, setExtractedCategories] = useState<ExtractedCategory[]>([]);
  const [importingAiItems, setImportingAiItems] = useState(false);

  const handleAiImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiImageFile(file);
    const url = URL.createObjectURL(file);
    setAiImagePreview(url);
  };

  const handleAiScan = async () => {
    if (!aiImageFile) {
      toast({ title: 'No image selected', description: 'Please upload a photo of your menu card', variant: 'destructive' });
      return;
    }
    setAiScanning(true);
    try {
      const results = await extractMenuFromImage(aiImageFile);
      if (results && results.length > 0) {
        setExtractedCategories(results);
        toast({ title: 'Menu Extracted! ✨', description: `Found ${results.length} categories. Review and click import below.` });
      } else {
        toast({ title: 'No items found', description: 'Could not extract items. Try a clearer photo.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Extraction Error', description: err instanceof Error ? err.message : 'Failed to analyze menu image', variant: 'destructive' });
    } finally {
      setAiScanning(false);
    }
  };

  const handleImportExtractedMenu = async () => {
    if (!restaurant || extractedCategories.length === 0) return;
    setImportingAiItems(true);

    try {
      for (const cat of extractedCategories) {
        if (!cat.categoryName || !cat.items || cat.items.length === 0) continue;

        // Find or create category
        let categoryId = categories.find(c => c.name.toLowerCase() === cat.categoryName.toLowerCase())?.id;
        if (!categoryId) {
          const { data: newCat, error: catErr } = await supabase
            .from('menu_categories')
            .insert({
              restaurant_id: restaurant.id,
              name: cat.categoryName,
              sort_order: categories.length,
            })
            .select()
            .single();

          if (catErr || !newCat) {
            console.error('Error creating category:', catErr);
            continue;
          }
          categoryId = newCat.id;
        }

        // Insert items under category
        const itemInserts = cat.items.map((item, idx) => ({
          restaurant_id: restaurant.id,
          category_id: categoryId,
          name: item.name,
          description: item.description || null,
          price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
          is_available: true,
          sort_order: idx,
        }));

        await supabase.from('menu_items').insert(itemInserts);
      }

      toast({ title: 'Import Complete! 🎉', description: 'All items imported to your menu successfully.' });
      setAiDialogOpen(false);
      setExtractedCategories([]);
      setAiImageFile(null);
      setAiImagePreview(null);
      loadData();
    } catch (err) {
      toast({ title: 'Import Failed', description: 'Failed to save extracted items', variant: 'destructive' });
    } finally {
      setImportingAiItems(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/restaurant');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('*')
      .eq('owner_id', user!.id)
      .limit(1);

    if (restaurants && restaurants.length > 0) {
      const rest = restaurants[0] as unknown as Restaurant;
      setRestaurant(rest);

      const [categoriesRes, itemsRes] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', rest.id).order('sort_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', rest.id).order('sort_order'),
      ]);

      setCategories((categoriesRes.data || []) as unknown as MenuCategory[]);
      setItems((itemsRes.data || []) as unknown as MenuItem[]);
    }
    setLoading(false);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !restaurant) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please upload JPG, PNG, or WEBP images only', variant: 'destructive' });
      return;
    }

    // Validate file size (2MB max per requirements)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 2MB', variant: 'destructive' });
      return;
    }

    setUploadingImage(true);

    try {
      const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
      if (!apiKey) {
        toast({ title: 'Configuration Error', description: 'ImgBB API Key is missing.', variant: 'destructive' });
        setUploadingImage(false);
        return;
      }

      // Convert file to base64 to ensure ImgBB always receives the content properly
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove the data:image/jpeg;base64, prefix
        };
        reader.onerror = error => reject(error);
      });

      const formData = new FormData();
      formData.append('image', base64Data);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'ImgBB upload failed');
      }

      setItemImageUrl(data.data.url);
      toast({ title: 'Image uploaded', description: 'Image uploaded successfully via ImgBB' });
    } catch (err) {
      console.error('Upload exception:', err);
      toast({ title: 'Upload failed', description: 'Image upload failed. You can still save the menu item without an image.', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = async () => {
    if (itemImageUrl && restaurant && !itemImageUrl.startsWith('http')) {
      // Try to delete from storage (ignore errors if file doesn't exist)
      await supabase.storage.from('menu-images').remove([itemImageUrl]);
    }
    setItemImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveCategory = async () => {
    if (!restaurant) return;

    // Validate category data
    const validation = validateData(menuCategorySchema, { name: categoryName });
    if (!validation.success) {
      toast({ title: 'Validation Error', description: validation.errors[0], variant: 'destructive' });
      return;
    }
    const validatedData = validation.data;

    if (editingCategory) {
      const { error } = await supabase
        .from('menu_categories')
        .update({ name: validatedData.name })
        .eq('id', editingCategory.id);

      if (error) {
        toast({ title: 'Error', description: sanitizeError(error), variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase
        .from('menu_categories')
        .insert({
          restaurant_id: restaurant.id,
          name: validatedData.name,
          sort_order: categories.length,
        });

      if (error) {
        toast({ title: 'Error', description: sanitizeError(error), variant: 'destructive' });
        return;
      }
    }

    toast({ title: 'Success', description: 'Category saved successfully' });
    setCategoryDialogOpen(false);
    setCategoryName('');
    setEditingCategory(null);
    loadData();
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const { error } = await supabase.from('menu_categories').delete().eq('id', categoryId);
    if (error) {
      toast({ title: 'Error', description: sanitizeError(error), variant: 'destructive' });
      return;
    }
    toast({ title: 'Deleted', description: 'Category deleted' });
    loadData();
  };

  const handleSaveItem = async () => {
    if (!restaurant) return;

    // Validate item data
    const validation = validateData(menuItemSchema, {
      name: itemName,
      description: itemDescription || null,
      price: parseFloat(itemPrice) || 0,
      category_id: selectedCategoryId,
      is_available: itemAvailable,
    });

    if (!validation.success) {
      toast({ title: 'Validation Error', description: validation.errors[0], variant: 'destructive' });
      return;
    }
    const validatedData = validation.data;

    const itemData = {
      restaurant_id: restaurant.id,
      category_id: validatedData.category_id,
      name: validatedData.name,
      description: validatedData.description,
      price: validatedData.price,
      is_available: validatedData.is_available ?? true,
      image_url: itemImageUrl,
      preparation_time_minutes: parseInt(itemPrepTime) || 15,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('menu_items')
        .update(itemData)
        .eq('id', editingItem.id);

      if (error) {
        toast({ title: 'Error', description: sanitizeError(error), variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase
        .from('menu_items')
        .insert({ ...itemData, sort_order: items.length });

      if (error) {
        toast({ title: 'Error', description: sanitizeError(error), variant: 'destructive' });
        return;
      }
    }

    toast({ title: 'Success', description: 'Item saved successfully' });
    resetItemForm();
    loadData();
  };

  const handleDeleteItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    
    // Delete image from storage if exists
    if (item?.image_url && !item.image_url.startsWith('http')) {
      await supabase.storage.from('menu-images').remove([item.image_url]);
    }
    
    const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
    if (error) {
      toast({ title: 'Error', description: sanitizeError(error), variant: 'destructive' });
      return;
    }
    toast({ title: 'Deleted', description: 'Item deleted' });
    loadData();
  };

  const toggleItemAvailability = async (item: MenuItem) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id);

    if (error) {
      toast({ title: 'Error', description: sanitizeError(error), variant: 'destructive' });
      return;
    }
    loadData();
  };

  const resetItemForm = () => {
    setItemDialogOpen(false);
    setEditingItem(null);
    setSelectedCategoryId('');
    setItemName('');
    setItemDescription('');
    setItemPrice('');
    setItemPrepTime('15');
    setItemAvailable(true);
    setItemImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setSelectedCategoryId(item.category_id);
    setItemName(item.name);
    setItemDescription(item.description || '');
    setItemPrice(item.price.toString());
    setItemPrepTime((item.preparation_time_minutes || 15).toString());
    setItemAvailable(item.is_available);
    setItemImageUrl(item.image_url || null);
    setItemDialogOpen(true);
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout type="restaurant">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout type="restaurant">
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Menu Management</h1>
            <p className="text-muted-foreground mt-1">Manage categories, dishes, prices, and availability</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle Controls */}
            <div className="flex items-center bg-muted/60 p-1 rounded-lg border">
              <Button
                variant={viewMode === 'grid' ? 'accent' : 'ghost'}
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5"
                onClick={() => handleViewModeChange('grid')}
                title="Grid View (Compact Cards)"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'accent' : 'ghost'}
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5"
                onClick={() => handleViewModeChange('list')}
                title="List View (Full Rows)"
              >
                <List className="h-3.5 w-3.5" />
                List
              </Button>
              <Button
                variant={viewMode === 'compact' ? 'accent' : 'ghost'}
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5"
                onClick={() => handleViewModeChange('compact')}
                title="Compact Table View (Maximum Products)"
              >
                <TableProperties className="h-3.5 w-3.5" />
                Compact
              </Button>
            </div>

            {/* Auto-Image All Items Button */}
            <Button
              variant="outline"
              onClick={handleBatchAutoImages}
              disabled={autoImageLoading}
              className="border-indigo-500 text-indigo-500 hover:bg-indigo-500/10 font-bold gap-2"
              title="Assign high-res food photos to all items in 1 request"
            >
              {autoImageLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                  Assigning Photos...
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 text-indigo-500" />
                  Auto-Image All Items
                </>
              )}
            </Button>

            {/* AI Menu Scanner Modal */}
            <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-accent text-accent hover:bg-accent/10 font-bold gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  AI Menu Scanner
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <Sparkles className="h-5 w-5 text-accent" />
                    AI Menu Card Scanner
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    Upload a photo of your physical menu card. AI will extract all categories, dish names, prices, and descriptions automatically.
                  </p>

                  {/* Upload Dropzone */}
                  <div className="border-2 border-dashed border-accent/40 rounded-xl p-4 text-center bg-accent/5 hover:bg-accent/10 transition cursor-pointer relative">
                    {aiImagePreview ? (
                      <div className="space-y-3">
                        <img src={aiImagePreview} alt="Menu Card" className="max-h-48 mx-auto rounded-lg object-contain shadow-md" />
                        <Button variant="ghost" size="sm" onClick={() => { setAiImageFile(null); setAiImagePreview(null); }}>
                          <X className="h-4 w-4 mr-1" /> Choose different photo
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block p-4">
                        <FileImage className="h-10 w-10 text-accent mx-auto mb-2" />
                        <span className="font-semibold text-foreground text-sm block">Upload Menu Card Photo</span>
                        <span className="text-xs text-muted-foreground block mt-1">Supports JPG, PNG, WEBP</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleAiImageSelect} />
                      </label>
                    )}
                  </div>

                  {/* Scan Button */}
                  <Button 
                    onClick={handleAiScan} 
                    disabled={!aiImageFile || aiScanning} 
                    variant="accent" 
                    className="w-full font-bold gap-2"
                  >
                    {aiScanning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing Menu with AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Extract Categories & Items
                      </>
                    )}
                  </Button>

                  {/* Extracted Preview List */}
                  {extractedCategories.length > 0 && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-success" />
                          Extracted Menu Items ({extractedCategories.reduce((sum, c) => sum + c.items.length, 0)})
                        </h3>
                      </div>

                      <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                        {extractedCategories.map((cat, catIdx) => (
                          <div key={catIdx} className="bg-secondary/40 p-3 rounded-lg space-y-2 border">
                            <Input
                              value={cat.categoryName}
                              onChange={(e) => {
                                const newCats = [...extractedCategories];
                                newCats[catIdx].categoryName = e.target.value;
                                setExtractedCategories(newCats);
                              }}
                              className="font-bold text-sm bg-background border-accent/30"
                            />
                            <div className="space-y-1.5 pl-2">
                              {cat.items.map((item, itemIdx) => (
                                <div key={itemIdx} className="flex gap-2 items-center">
                                  <Input
                                    value={item.name}
                                    onChange={(e) => {
                                      const newCats = [...extractedCategories];
                                      newCats[catIdx].items[itemIdx].name = e.target.value;
                                      setExtractedCategories(newCats);
                                    }}
                                    className="text-xs flex-1 bg-background"
                                    placeholder="Item name"
                                  />
                                  <Input
                                    type="number"
                                    value={item.price}
                                    onChange={(e) => {
                                      const newCats = [...extractedCategories];
                                      newCats[catIdx].items[itemIdx].price = parseFloat(e.target.value) || 0;
                                      setExtractedCategories(newCats);
                                    }}
                                    className="text-xs w-20 bg-background"
                                    placeholder="Price"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => {
                                      const newCats = [...extractedCategories];
                                      newCats[catIdx].items.splice(itemIdx, 1);
                                      setExtractedCategories(newCats);
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={handleImportExtractedMenu}
                        disabled={importingAiItems}
                        variant="default"
                        className="w-full bg-success hover:bg-success/90 font-bold gap-2"
                      >
                        {importingAiItems ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Importing to Database...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Import All Dishes to Menu
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => { setEditingCategory(null); setCategoryName(''); }}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Category Name</Label>
                    <Input
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="e.g., Starters, Main Course"
                    />
                  </div>
                  <Button onClick={handleSaveCategory} variant="accent" className="w-full">
                    Save Category
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={itemDialogOpen} onOpenChange={(open) => { if (!open) resetItemForm(); else setItemDialogOpen(true); }}>
              <DialogTrigger asChild>
                <Button variant="accent" disabled={categories.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  {/* Image Upload Section */}
                  <div className="space-y-2">
                    <Label>Item Image</Label>
                    <div className="border-2 border-dashed rounded-lg p-4">
                      {itemImageUrl ? (
                        <div className="relative">
                          <img 
                            src={getImageUrl(itemImageUrl) || ''} 
                            alt="Item preview" 
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6"
                            onClick={removeImage}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground mb-2">
                            JPG, PNG or WEBP (max 2MB)
                          </p>
                          <div className="flex gap-2 justify-center">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingImage}
                            >
                              {uploadingImage ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground mr-2"></div>
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload
                                </>
                              )}
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleAutoFindImage}
                              className="gap-1.5 text-xs border"
                              title="Automatically assign an open-source food photo matching dish name"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-accent" />
                              Auto Find Photo
                            </Button>
                          </div>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background"
                    >
                      <option value="">Select category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Item Name</Label>
                    <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g., Butter Chicken" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} placeholder="Short description" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Price ({restaurant?.currency || 'INR'})</Label>
                      <Input type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="299" />
                    </div>
                    <div className="space-y-2">
                      <Label>Prep Time (mins)</Label>
                      <Input type="number" value={itemPrepTime} onChange={(e) => setItemPrepTime(e.target.value)} placeholder="15" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Available</Label>
                    <Switch checked={itemAvailable} onCheckedChange={setItemAvailable} />
                  </div>
                  <Button onClick={handleSaveItem} variant="accent" className="w-full" disabled={!itemName.trim() || !itemPrice || !selectedCategoryId}>
                    {uploadingImage ? 'Uploading image...' : 'Save Item'}
                  </Button>
                  {uploadingImage && (
                    <p className="text-xs text-muted-foreground text-center">
                      Image is uploading. You can wait or save without the image.
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {categories.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No categories yet. Create your first category to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {categories.map((category) => (
              <Card key={category.id} className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-xl">{category.name}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingCategory(category); setCategoryName(category.name); setCategoryDialogOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {items.filter(i => i.category_id === category.id).length === 0 ? (
                    <p className="text-muted-foreground text-sm">No items in this category</p>
                  ) : viewMode === 'grid' ? (
                    /* GRID VIEW (Compact cards, 2-4 per row) */
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {items.filter(i => i.category_id === category.id).map((item) => {
                        const imageUrl = getImageUrl(item.image_url);
                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                              item.is_available ? 'bg-card hover:border-accent/50' : 'bg-muted/40 opacity-60'
                            }`}
                          >
                            <div className="flex gap-3 items-start mb-2">
                              {imageUrl ? (
                                <img src={imageUrl} alt={item.name} className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                              ) : (
                                <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm truncate" title={item.name}>{item.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="font-bold text-accent text-xs">
                                    {restaurant?.currency || 'INR'} {item.price}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded font-medium">
                                    <Clock className="h-2.5 w-2.5" /> {item.preparation_time_minutes || 15}m
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{item.description}</p>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t mt-auto">
                              <div className="flex items-center gap-1.5">
                                <Switch
                                  checked={item.is_available}
                                  onCheckedChange={() => toggleItemAvailability(item)}
                                  className="scale-75"
                                />
                                <span className="text-[11px] text-muted-foreground">
                                  {item.is_available ? 'In Stock' : 'Out'}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : viewMode === 'compact' ? (
                    /* COMPACT TABLE VIEW (Ultra dense, fits 20+ items) */
                    <div className="divide-y border rounded-lg overflow-hidden">
                      {items.filter(i => i.category_id === category.id).map((item) => {
                        const imageUrl = getImageUrl(item.image_url);
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-2 px-3 gap-3 text-sm hover:bg-muted/30 ${
                              item.is_available ? 'bg-card' : 'bg-muted/50 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {imageUrl ? (
                                <img src={imageUrl} alt={item.name} className="w-8 h-8 object-cover rounded flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                              )}
                              <span className="font-medium truncate">{item.name}</span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded font-medium">
                                <Clock className="h-2.5 w-2.5" /> {item.preparation_time_minutes || 15}m
                              </span>
                              {!item.is_available && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-destructive/10 text-destructive rounded">Out of stock</span>
                              )}
                            </div>

                            <div className="flex items-center gap-4 flex-shrink-0">
                              <span className="font-semibold text-xs min-w-[60px] text-right">{restaurant?.currency || 'INR'} {item.price}</span>
                              <div className="flex items-center gap-1">
                                <Switch
                                  checked={item.is_available}
                                  onCheckedChange={() => toggleItemAvailability(item)}
                                  className="scale-75"
                                />
                              </div>
                              <div className="flex gap-0.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* LIST VIEW (Original detailed rows) */
                    <div className="space-y-3">
                      {items.filter(i => i.category_id === category.id).map((item) => {
                        const imageUrl = getImageUrl(item.image_url);
                        
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center gap-4 p-4 rounded-lg border ${
                              item.is_available ? 'bg-card' : 'bg-muted/50 opacity-60'
                            }`}
                          >
                            {imageUrl ? (
                              <img 
                                src={imageUrl} 
                                alt={item.name} 
                                className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 object-cover rounded-lg flex-shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                                <ImageIcon className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                              </div>
                            )}
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{item.name}</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5 bg-muted px-2 py-0.5 rounded font-medium animate-fade-in">
                                  <Clock className="h-3 w-3" /> {item.preparation_time_minutes || 15}m
                                </span>
                                {!item.is_available && (
                                  <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded">Out of stock</span>
                                )}
                              </div>
                              {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-semibold">{restaurant?.currency} {item.price}</span>
                              <Switch
                                checked={item.is_available}
                                onCheckedChange={() => toggleItemAvailability(item)}
                              />
                              <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}