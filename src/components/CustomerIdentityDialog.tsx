import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { User, Phone, Check, Mail } from 'lucide-react';
import { z } from 'zod';

const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  phone: z.string().trim().min(10, 'Phone must be at least 10 digits').max(15, 'Phone too long').regex(/^[\d+\-\s]+$/, 'Invalid phone number'),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
});

interface CustomerIdentityDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, phone: string, email?: string) => void;
  loading?: boolean;
}

export function CustomerIdentityDialog({ open, onClose, onSubmit, loading }: CustomerIdentityDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = customerSchema.safeParse({ name, phone, email: email || undefined });
    
    if (!result.success) {
      const fieldErrors: { name?: string; phone?: string; email?: string } = {};
      result.error.issues.forEach(issue => {
        if (issue.path[0] === 'name') fieldErrors.name = issue.message;
        if (issue.path[0] === 'phone') fieldErrors.phone = issue.message;
        if (issue.path[0] === 'email') fieldErrors.email = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    
    setErrors({});
    onSubmit(result.data.name, result.data.phone, email.trim() || undefined);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#0a0a0a] border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl gap-6">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-3 text-2xl font-black text-foreground">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            Almost there!
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Please share your details for better service and to receive your digital bill.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Name</Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="pl-11 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary/20 text-sm font-medium"
                disabled={loading}
              />
            </div>
            {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="pl-11 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary/20 text-sm font-medium"
                disabled={loading}
              />
            </div>
            {errors.phone && <p className="text-xs text-red-500 font-medium">{errors.phone}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Email <span className="font-medium normal-case bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[10px]">Optional</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="pl-11 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary/20 text-sm font-medium"
                disabled={loading}
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 font-medium">{errors.email}</p>}
            <p className="text-[11px] text-muted-foreground/80 font-medium pt-1">For receiving your digital bill</p>
          </div>
          
          <Button 
            type="submit" 
            variant="accent" 
            className="w-full h-14 rounded-xl text-base font-bold shadow-xl mt-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 transition pressable" 
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                Placing Order...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Continue to Place Order
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
