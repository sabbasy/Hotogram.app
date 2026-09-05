import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MenuItem, Restaurant } from '@/types/database';
import { Plus, Minus, Clock, ShoppingBag, ImageIcon } from 'lucide-react';

interface DishDetailDialogProps {
  item: MenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quantity: number;
  onUpdateQuantity: (delta: number) => void;
  restaurant: Restaurant | null;
  estimatedPrepTime?: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getImageUrl = (path: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/menu-images/${path}`;
};

export const DishDetailDialog = ({
  item,
  open,
  onOpenChange,
  quantity,
  onUpdateQuantity,
  restaurant,
  estimatedPrepTime = 15,
}: DishDetailDialogProps) => {
  if (!item) return null;

  const imageUrl = getImageUrl(item.image_url);
  const totalPrice = item.price * Math.max(1, quantity);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-md p-0 overflow-hidden rounded-3xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        {/* Dish Image Banner */}
        <div className="relative w-full h-52 sm:h-56 bg-muted overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-muted flex flex-col items-center justify-center p-6 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-2" />
              <span className="text-sm text-muted-foreground font-medium">{item.name}</span>
            </div>
          )}

          {/* Single Close button is rendered automatically by Radix DialogContent */}

          {/* Estimated Prep Time Badge */}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-white/20">
            <Clock className="h-3.5 w-3.5 text-accent animate-pulse" />
            <span>Prep Time: ~{estimatedPrepTime} mins</span>
          </div>
        </div>

        {/* Content Body with Balanced Padding */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground leading-tight truncate">{item.name}</h2>
              <span className="text-xs font-medium text-muted-foreground mt-0.5 block">
                Freshly Prepared on Order
              </span>
            </div>
            <span className="text-base font-bold text-accent whitespace-nowrap bg-accent/10 px-3 py-1 rounded-xl flex-shrink-0">
              {restaurant?.currency || 'INR'} {item.price}
            </span>
          </div>

          {/* Full Description with Proper Margins */}
          {item.description ? (
            <div className="bg-secondary/40 p-3.5 rounded-2xl border border-border/60 space-y-1 max-h-36 overflow-y-auto">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Description & Details
              </span>
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-words">
                {item.description}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Delicious dish prepared with fresh ingredients.
            </p>
          )}

          {/* Quantity Controls & Add to Cart Footer */}
          <div className="pt-3 border-t flex items-center justify-between gap-3">
            {/* Quantity Selector */}
            <div className="flex items-center gap-1.5 bg-secondary/80 p-1 rounded-xl border border-border flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => onUpdateQuantity(-1)}
                disabled={quantity <= 0}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-6 text-center font-bold text-sm">{quantity > 0 ? quantity : 1}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => onUpdateQuantity(1)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Add to Order Button */}
            <Button
              variant="accent"
              className="flex-1 font-bold h-11 gap-1.5 shadow-lg min-w-0 text-xs sm:text-sm"
              onClick={() => {
                if (quantity === 0) onUpdateQuantity(1);
                onOpenChange(false);
              }}
            >
              <ShoppingBag className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{quantity > 0 ? 'Update' : 'Add to Order'} • {restaurant?.currency || 'INR'} {totalPrice}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
