export type AppRole = 'platform_admin' | 'restaurant_admin' | 'kitchen_staff' | 'waiter' | 'cashier';
export type RestaurantStatus = 'pending' | 'active' | 'disabled';
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type TableStatus = 'vacant' | 'occupied' | 'billing' | 'closed';
export type PaymentStatus = 'pending' | 'paid';
export type PaymentMethod = 'upi' | 'counter' | 'none';
export type SubscriptionPlan = 'free' | 'basic' | 'pro';
export type RequestType = 'call_waiter' | 'request_water' | 'request_bill';
export type RequestStatus = 'pending' | 'handled';
export type SessionStatus = 'active' | 'closed';

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  cuisine_type: string | null;
  currency: string;
  status: RestaurantStatus;
  tax_percentage: number;
  subscription_plan: SubscriptionPlan;
  feature_voice_notes: boolean;
  feature_analytics: boolean;
  feature_customer_export: boolean;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  sort_order: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  preparation_time_minutes?: number;
}

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  table_number: string;
  qr_code_token: string;
  status: TableStatus;
  created_at: string;
}

export interface TableSession {
  id: string;
  restaurant_id: string;
  table_id: string;
  session_token: string;
  status: SessionStatus;
  opened_at: string;
  closed_at: string | null;
  total_amount: number;
  payment_status: PaymentStatus;
  created_at: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  session_id: string | null;
  table_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  special_instructions: string | null;
  voice_note_url: string | null;
  voice_note_listened: boolean;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  updated_at: string;
  placed_at: string | null;
  accepted_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  paid_at: string | null;
  closed_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  item_price: number;
  quantity: number;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  restaurant_id: string | null;
  created_at: string;
}

export interface CustomerContact {
  id: string;
  restaurant_id: string;
  order_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  consent_given: boolean;
  consent_timestamp: string | null;
  visit_count: number;
  total_spend: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  order_id: string;
  restaurant_id: string;
  invoice_number: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  sent_via: string | null;
  sent_to: string | null;
  created_at: string;
}

export interface CustomerRequest {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  table_number: string;
  request_type: RequestType;
  status: RequestStatus;
  handled_by: string | null;
  created_at: string;
  handled_at: string | null;
}

export interface CustomerTag {
  id: string;
  restaurant_id: string;
  contact_id: string;
  tag: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  restaurant_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface PaymentTransaction {
  id: string;
  restaurant_id: string;
  order_id: string | null;
  session_id: string | null;
  transaction_id: string;
  amount: number;
  payment_method: string;
  status: string;
  upi_reference: string | null;
  customer_vpa: string | null;
  confirmed_by: string | null;
  notes: string | null;
  initiated_at: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}
