import { useState, useEffect } from 'react';
import { Bell, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { isSoundEnabled, setSoundEnabled, playChimeSound } from '@/hooks/useNotifications';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'ready' | 'payment' | 'request' | 'cancelled' | 'payment_pending';
  tableNumber?: string;
  customerName?: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationBellProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
}

export function NotificationBell({ notifications, onMarkRead, onClearAll }: NotificationBellProps) {
  const unreadCount = notifications.filter(n => !n.read).length;
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  useEffect(() => {
    const syncSound = () => setSoundOn(isSoundEnabled());
    window.addEventListener('sound_preference_changed', syncSound);
    return () => window.removeEventListener('sound_preference_changed', syncSound);
  }, []);

  const toggleSoundPreference = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !soundOn;
    setSoundEnabled(nextState);
    setSoundOn(nextState);
    if (nextState) {
      playChimeSound(true); // Test chime sound when enabled
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'order': return 'bg-info/10 text-info';
      case 'ready': return 'bg-accent/10 text-accent';
      case 'payment': return 'bg-success/10 text-success';
      case 'payment_pending': return 'bg-warning/10 text-warning';
      case 'request': return 'bg-warning/10 text-warning';
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted';
    }
  };

  const getTypeLabel = (type: Notification['type']) => {
    switch (type) {
      case 'order': return 'New Order';
      case 'ready': return 'Ready';
      case 'payment': return 'Payment Confirmed';
      case 'payment_pending': return 'Payment Pending';
      case 'request': return 'Request';
      case 'cancelled': return 'Cancelled';
      default: return type;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className={cn("h-5 w-5", unreadCount > 0 && "animate-pulse")} />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggleSoundPreference}
              title={soundOn ? "Sound Notifications Enabled (Click to Mute)" : "Sound Notifications Muted (Click to Enable)"}
            >
              {soundOn ? (
                <Volume2 className="h-4 w-4 text-accent" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearAll} className="text-xs h-7">
                Clear All
              </Button>
            )}
          </div>
        </div>
        
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No notifications yet
          </div>
        ) : (
          notifications.slice(0, 10).map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              onClick={() => onMarkRead(notification.id)}
              className={cn(
                "flex flex-col items-start gap-1 p-3 cursor-pointer",
                !notification.read && "bg-accent/5"
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <Badge className={cn("text-xs", getNotificationColor(notification.type))}>
                  {getTypeLabel(notification.type)}
                </Badge>
                {notification.tableNumber && (
                  <span className="text-xs font-medium">Table {notification.tableNumber}</span>
                )}
                {!notification.read && (
                  <span className="w-2 h-2 rounded-full bg-accent ml-auto" />
                )}
              </div>
              <p className="text-sm font-medium">{notification.title}</p>
              {notification.customerName && (
                <p className="text-xs text-muted-foreground">Customer: {notification.customerName}</p>
              )}
              <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
              <span className="text-xs text-muted-foreground">
                {new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
