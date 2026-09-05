-- Create app_role enum for role-based access
CREATE TYPE public.app_role AS ENUM ('platform_admin', 'restaurant_admin', 'kitchen_staff');

-- Create restaurant status enum
CREATE TYPE public.restaurant_status AS ENUM ('pending', 'active', 'disabled');

-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('new', 'preparing', 'ready', 'served');

-- Create user_roles table for role management (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  restaurant_id UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, restaurant_id)
);

-- Create restaurants table
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  cuisine_type TEXT,
  currency TEXT DEFAULT 'INR',
  status restaurant_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create menu_categories table
CREATE TABLE public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create menu_items table
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE CASCADE NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tables (restaurant tables) table
CREATE TABLE public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  table_number TEXT NOT NULL,
  qr_code_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, table_number)
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  table_number TEXT NOT NULL,
  status order_status DEFAULT 'new',
  total_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check restaurant access
CREATE OR REPLACE FUNCTION public.has_restaurant_access(_user_id UUID, _restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants
    WHERE id = _restaurant_id
      AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND restaurant_id = _restaurant_id
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Platform admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'));

-- RLS Policies for restaurants
CREATE POLICY "Platform admins can view all restaurants"
  ON public.restaurants FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Restaurant owners can view their own restaurants"
  ON public.restaurants FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can update their own restaurants"
  ON public.restaurants FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create restaurants"
  ON public.restaurants FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Platform admins can update any restaurant"
  ON public.restaurants FOR UPDATE
  USING (public.has_role(auth.uid(), 'platform_admin'));

-- RLS Policies for menu_categories
CREATE POLICY "Anyone can view categories of active restaurants"
  ON public.menu_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id = restaurant_id AND status = 'active'
    )
  );

CREATE POLICY "Restaurant owners can manage categories"
  ON public.menu_categories FOR ALL
  USING (public.has_restaurant_access(auth.uid(), restaurant_id));

-- RLS Policies for menu_items
CREATE POLICY "Anyone can view items of active restaurants"
  ON public.menu_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id = restaurant_id AND status = 'active'
    )
  );

CREATE POLICY "Restaurant owners can manage items"
  ON public.menu_items FOR ALL
  USING (public.has_restaurant_access(auth.uid(), restaurant_id));

-- RLS Policies for restaurant_tables
CREATE POLICY "Anyone can view tables for QR access"
  ON public.restaurant_tables FOR SELECT
  USING (true);

CREATE POLICY "Restaurant owners can manage tables"
  ON public.restaurant_tables FOR ALL
  USING (public.has_restaurant_access(auth.uid(), restaurant_id));

-- RLS Policies for orders
CREATE POLICY "Restaurant staff can view their orders"
  ON public.orders FOR SELECT
  USING (public.has_restaurant_access(auth.uid(), restaurant_id));

CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Restaurant staff can update orders"
  ON public.orders FOR UPDATE
  USING (public.has_restaurant_access(auth.uid(), restaurant_id));

-- RLS Policies for order_items
CREATE POLICY "Restaurant staff can view their order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id
      AND public.has_restaurant_access(auth.uid(), restaurant_id)
    )
  );

CREATE POLICY "Anyone can create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for orders table (for kitchen updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;