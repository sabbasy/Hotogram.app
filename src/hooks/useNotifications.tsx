import { useState, useCallback, useRef } from 'react';
import { Notification } from '@/components/NotificationBell';
import { toast } from '@/hooks/use-toast';

// Persistent AudioContext — unlocked on first user gesture
let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (_audioCtx) return _audioCtx;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    _audioCtx = new AudioCtx();
  } catch { return null; }
  return _audioCtx;
}

// Unlock on first user tap/click (required by mobile browsers)
if (typeof window !== 'undefined') {
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx?.state === 'suspended') {
      ctx.resume().catch(console.error);
    }
  };
  window.addEventListener('click', unlock, true);
  window.addEventListener('touchstart', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

export const isSoundEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('sound_notifications_enabled') !== 'false';
};

export const setSoundEnabled = (enabled: boolean) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('sound_notifications_enabled', enabled ? 'true' : 'false');
    window.dispatchEvent(new Event('sound_preference_changed'));
  }
};

export const playChimeSound = (force = false) => {
  if (!force && !isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    
    // Tone 1 (A5 - 880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2 (D6 - 1174.66Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.15);
    gain2.gain.setValueAtTime(0.5, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.error('Audio chime error:', e);
  }
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => isSoundEnabled());
  const previousOrdersRef = useRef<Set<string>>(new Set());
  const previousRequestsRef = useRef<Set<string>>(new Set());

  const toggleSound = useCallback((enabled?: boolean) => {
    const nextVal = enabled !== undefined ? enabled : !isSoundEnabled();
    setSoundEnabled(nextVal);
    setSoundEnabledState(nextVal);
  }, []);

  const addNotification = useCallback((
    title: string, 
    message: string, 
    type: Notification['type'],
    options?: { tableNumber?: string; customerName?: string; transactionId?: string }
  ) => {
    const newNotification: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      message,
      type,
      tableNumber: options?.tableNumber,
      customerName: options?.customerName,
      timestamp: new Date(),
      read: false,
    };

    // Play audible pop-up chime sound
    playChimeSound();

    // Show visual pop-up toast notification
    toast({
      title: `${title}${options?.tableNumber ? ` (Table ${options.tableNumber})` : ''}`,
      description: message,
      variant: type === 'cancelled' ? 'destructive' : 'default',
    });
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 50));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Process order changes to generate notifications
  const processOrderChange = useCallback((
    order: { 
      id: string; 
      status: string; 
      table_number: string; 
      customer_name?: string;
      payment_status: string;
      payment_method?: string;
    },
    eventType: 'INSERT' | 'UPDATE',
    oldOrder?: any
  ) => {
    const tableNumber = order.table_number;
    const customerName = order.customer_name;

    if (eventType === 'INSERT') {
      // New order
      if (!previousOrdersRef.current.has(order.id)) {
        previousOrdersRef.current.add(order.id);
        addNotification(
          '🔔 New Order Received!',
          `Table ${tableNumber}${customerName ? ` (${customerName})` : ''} placed a new order`,
          'order',
          { tableNumber, customerName }
        );
      }
    } else if (eventType === 'UPDATE') {
      // Status changes
      if (order.status === 'cancelled' && oldOrder?.status !== 'cancelled') {
        addNotification(
          '❌ Order Cancelled',
          `Order for Table ${tableNumber} was cancelled${customerName ? ` by ${customerName}` : ''}`,
          'cancelled',
          { tableNumber, customerName }
        );
      }
      
      // Payment completed
      if (order.payment_status === 'paid' && oldOrder?.payment_status !== 'paid') {
        addNotification(
          '💰 Payment Received',
          `Payment received for Table ${tableNumber}${customerName ? ` (${customerName})` : ''}`,
          'payment',
          { tableNumber, customerName }
        );
      }

      // Payment pending verification (customer clicked 'I have paid')
      if (order.payment_status === 'pending' && oldOrder?.payment_status !== 'pending') {
        const method = order.payment_method === 'upi' ? 'UPI' : order.payment_method === 'counter' ? 'Cash' : 'Payment';
        addNotification(
          '⌛ Payment Verification',
          `Table ${tableNumber} marked ${method} payment as completed. Please confirm.`,
          'payment_pending' as any,
          { tableNumber, customerName }
        );
      }
    }
  }, [addNotification]);

  // Process customer request changes
  const processRequestChange = useCallback((
    request: { 
      id: string; 
      request_type: string; 
      table_number: string;
      status: string;
    }
  ) => {
    if (request.status !== 'pending') return;
    if (previousRequestsRef.current.has(request.id)) return;
    
    previousRequestsRef.current.add(request.id);
    
    const requestLabels: Record<string, string> = {
      'call_waiter': '🙋‍♂️ Waiter Requested',
      'request_water': '💧 Water Requested',
      'request_bill': '🧾 Bill Requested',
    };
    
    addNotification(
      '🛎️ Customer Request',
      `Table ${request.table_number}: ${requestLabels[request.request_type] || request.request_type}`,
      'request',
      { tableNumber: request.table_number }
    );
  }, [addNotification]);

  return {
    notifications,
    soundEnabled,
    toggleSound,
    addNotification,
    markRead,
    markAllRead,
    clearAll,
    processOrderChange,
    processRequestChange,
    previousOrdersRef,
    previousRequestsRef,
  };
}
