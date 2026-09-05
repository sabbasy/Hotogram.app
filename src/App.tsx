import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { RequirePlatformAdmin } from "@/components/auth/RequirePlatformAdmin";

const NotFound = lazy(() => import("./pages/NotFound"));
const RestaurantAuth = lazy(() => import("./pages/auth/RestaurantAuth"));
const AdminAuth = lazy(() => import("./pages/auth/AdminAuth"));
const AuthCallback = lazy(() => import("./pages/auth/AuthCallback"));

const RestaurantDashboard = lazy(() => import("./pages/restaurant/Dashboard"));
const MenuManagement = lazy(() => import("./pages/restaurant/MenuManagement"));
const TableManagement = lazy(() => import("./pages/restaurant/TableManagement"));
const LiveOrders = lazy(() => import("./pages/restaurant/LiveOrders"));
const ContactExport = lazy(() => import("./pages/restaurant/ContactExport"));
const StaffManagement = lazy(() => import("./pages/restaurant/StaffManagement"));
const Analytics = lazy(() => import("./pages/restaurant/Analytics"));
const RestaurantSettings = lazy(() => import("./pages/restaurant/Settings"));
const SubscriptionPlans = lazy(() => import("./pages/restaurant/SubscriptionPlans"));

const CustomerMenu = lazy(() => import("./pages/customer/Menu"));
const OrderTracker = lazy(() => import("./pages/customer/OrderTracker"));

const PlatformAdmin = lazy(() => import("./pages/admin/PlatformAdmin"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminRevenue = lazy(() => import("./pages/admin/AdminRevenue"));
const AdminSubscribers = lazy(() => import("./pages/admin/AdminSubscribers"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">Loading...</div>}>
            <Routes>
              <Route path="/" element={<RestaurantAuth />} />
              <Route path="/auth/restaurant" element={<RestaurantAuth />} />
              <Route path="/auth/admin" element={<AdminAuth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              <Route path="/restaurant/dashboard" element={<RestaurantDashboard />} />
              <Route path="/restaurant/menu" element={<MenuManagement />} />
              <Route path="/restaurant/tables" element={<TableManagement />} />
              <Route path="/restaurant/orders" element={<LiveOrders />} />
              <Route path="/restaurant/contacts" element={<ContactExport />} />
              <Route path="/restaurant/staff" element={<StaffManagement />} />
              <Route path="/restaurant/analytics" element={<Analytics />} />
              <Route path="/restaurant/settings" element={<RestaurantSettings />} />
              <Route path="/restaurant/subscription" element={<SubscriptionPlans />} />

              <Route path="/menu/:token" element={<CustomerMenu />} />
              <Route path="/order/:token" element={<OrderTracker />} />
              <Route path="/order/:token/:orderId" element={<OrderTracker />} />

              <Route
                path="/admin/dashboard"
                element={
                  <RequirePlatformAdmin>
                    <PlatformAdmin />
                  </RequirePlatformAdmin>
                }
              />
              <Route
                path="/admin/restaurants"
                element={
                  <RequirePlatformAdmin>
                    <PlatformAdmin />
                  </RequirePlatformAdmin>
                }
              />
              <Route
                path="/admin/orders"
                element={
                  <RequirePlatformAdmin>
                    <AdminOrders />
                  </RequirePlatformAdmin>
                }
              />
              <Route
                path="/admin/revenue"
                element={
                  <RequirePlatformAdmin>
                    <AdminRevenue />
                  </RequirePlatformAdmin>
                }
              />
              <Route
                path="/admin/subscribers"
                element={
                  <RequirePlatformAdmin>
                    <AdminSubscribers />
                  </RequirePlatformAdmin>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <RequirePlatformAdmin>
                    <AdminSettings />
                  </RequirePlatformAdmin>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

