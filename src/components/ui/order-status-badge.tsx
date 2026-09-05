import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, Bell, Check, XCircle } from 'lucide-react';

interface OrderStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const statusConfig = {
  new: {
    label: 'Order Received',
    icon: Clock,
    bgClass: 'bg-info/15',
    textClass: 'text-info',
    borderClass: 'border-info/30',
  },
  preparing: {
    label: 'Preparing',
    icon: ChefHat,
    bgClass: 'bg-warning/15',
    textClass: 'text-warning',
    borderClass: 'border-warning/30',
  },
  ready: {
    label: 'Ready',
    icon: Bell,
    bgClass: 'bg-accent/15',
    textClass: 'text-accent',
    borderClass: 'border-accent/30',
  },
  served: {
    label: 'Served',
    icon: Check,
    bgClass: 'bg-success/15',
    textClass: 'text-success',
    borderClass: 'border-success/30',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    bgClass: 'bg-destructive/15',
    textClass: 'text-destructive',
    borderClass: 'border-destructive/30',
  },
} as const;

export function OrderStatusBadge({ status, size = 'md', showIcon = true }: OrderStatusBadgeProps) {
  const validStatus = status in statusConfig ? status as keyof typeof statusConfig : 'new';
  const config = statusConfig[validStatus];
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };
  
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };
  
  return (
    <Badge 
      variant="outline"
      className={cn(
        'font-semibold border',
        config.bgClass,
        config.textClass,
        config.borderClass,
        sizeClasses[size]
      )}
    >
      {showIcon && <Icon className={cn(iconSizes[size], 'mr-1.5')} />}
      {config.label}
    </Badge>
  );
}

interface PaymentStatusProps {
  status: string;
  paymentMethod?: string;
}

export function PaymentStatusIndicator({ status, paymentMethod }: PaymentStatusProps) {
  const isPaid = status === 'paid';
  
  // Show "Awaiting Verification" if payment method is UPI and status is pending
  const isAwaitingVerification = !isPaid && paymentMethod === 'upi';
  const isCounter = !isPaid && paymentMethod === 'counter';
  
  return (
    <span className={cn(
      'text-xs inline-flex items-center gap-1 font-medium',
      isPaid ? 'text-success' : isAwaitingVerification ? 'text-warning' : 'text-muted-foreground'
    )}>
      {isPaid ? (
        <>
          <Check className="h-3 w-3" />
          Paid
        </>
      ) : isAwaitingVerification ? (
        <>
          <Clock className="h-3 w-3" />
          Awaiting Verification
        </>
      ) : isCounter ? (
        <>
          <Clock className="h-3 w-3" />
          Pay at Counter
        </>
      ) : (
        <>Unpaid</>
      )}
    </span>
  );
}