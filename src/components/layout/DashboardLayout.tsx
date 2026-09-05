import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarBadges } from '@/hooks/useSidebarBadges';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Table,
  ChefHat,
  LogOut,
  Menu,
  X,
  Receipt,
  Users,
  Package,
  DollarSign,
  Crown,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  type: 'restaurant' | 'platform';
}

export function DashboardLayout({ children, type }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const [restaurantId, setRestaurantId] = useState<string | null>(() => {
    return localStorage.getItem('cached_restaurant_id');
  });
  
  const { badges, formatBadge } = useSidebarBadges(type === 'restaurant' ? restaurantId : null);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  // Load restaurant ID for badge queries
  useEffect(() => {
    if (type === 'restaurant' && user) {
      supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]) {
            setRestaurantId(data[0].id);
            localStorage.setItem('cached_restaurant_id', data[0].id);
          }
        });
    }
  }, [type, user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const restaurantLinks: { href: string; label: string; icon: any; badgeKey?: 'kitchen' | 'requests' | 'tables' | 'billing' }[] = [
    { href: '/restaurant/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/restaurant/orders', label: 'Live Orders', icon: ClipboardList, badgeKey: 'kitchen' },
    { href: '/restaurant/menu', label: 'Menu', icon: UtensilsCrossed },
    { href: '/restaurant/tables', label: 'Tables', icon: Table, badgeKey: 'tables' },
    { href: '/restaurant/settings', label: 'Settings', icon: Settings },
  ];

  const platformLinks = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/orders', label: 'Orders', icon: Package },
    { href: '/admin/revenue', label: 'Revenue', icon: DollarSign },
    { href: '/admin/subscribers', label: 'Subscribers', icon: Crown },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const links = type === 'restaurant' ? restaurantLinks : platformLinks;
  const title = type === 'restaurant' ? 'Hotogram' : 'Hotogram Admin';

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-50">
        <Logo text={title} className="scale-75 origin-left" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      <div className="flex">
        {/* Sticky Sidebar */}
        <aside
          className={cn(
            'fixed lg:sticky top-0 inset-y-0 left-0 z-50 h-screen bg-card border-r transition-all duration-300 ease-in-out flex flex-col justify-between w-64',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            isCollapsed ? 'lg:w-20' : 'lg:w-64'
          )}
        >
          <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
            {/* Header with Logo */}
            <div className="p-4 border-b flex items-center justify-between min-h-[65px]">
              <div className="lg:hidden">
                <Logo text={title} />
              </div>
              <div className="hidden lg:block">
                {!isCollapsed ? (
                  <Logo text={title} />
                ) : (
                  <Logo iconOnly className="mx-auto" />
                )}
              </div>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 p-3 space-y-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.href;
                const badgeKey = 'badgeKey' in link ? (link as { badgeKey?: 'kitchen' | 'requests' | 'tables' | 'billing' }).badgeKey : undefined;
                const badgeValue = badgeKey ? formatBadge(badges[badgeKey]) : null;
                
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setSidebarOpen(false)}
                    title={isCollapsed ? link.label : undefined}
                    className={cn(
                      'flex items-center relative rounded-lg text-sm font-medium transition-colors justify-between px-3.5 py-2.5',
                      isCollapsed && 'lg:justify-center lg:p-3',
                      isActive
                        ? 'bg-accent text-accent-foreground font-semibold shadow-sm'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span className={cn('inline', isCollapsed && 'lg:hidden')}>{link.label}</span>
                    </span>
                    {badgeValue && (
                      <Badge 
                        variant="destructive" 
                        className={cn(
                          'h-5 min-w-5 px-1.5 text-[11px] font-bold flex items-center justify-center ml-auto',
                          isCollapsed && 'lg:ml-0 lg:absolute lg:-top-1 lg:-right-1 lg:scale-90'
                        )}
                      >
                        {badgeValue}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Footer with Sign Out */}
            <div className="p-3 border-t space-y-2">
              <Button
                variant="ghost"
                className={cn(
                  'w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 justify-start gap-3',
                  isCollapsed && 'lg:justify-center lg:px-0'
                )}
                onClick={handleSignOut}
                title={isCollapsed ? 'Sign Out' : undefined}
              >
                <LogOut className="h-5 w-5 flex-shrink-0" />
                <span className={cn('inline', isCollapsed && 'lg:hidden')}>Sign Out</span>
              </Button>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-foreground/20 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 min-h-screen bg-background">
          {/* Top Desktop Bar */}
          <div className="hidden lg:flex items-center justify-between px-6 py-3 border-b bg-card/60 backdrop-blur sticky top-0 z-30 min-h-[65px]">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapse}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {links.find(l => l.href === location.pathname)?.label || 'Dashboard'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 px-2.5 py-1 rounded-full border">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
              <span className="font-medium text-foreground">Kitchen Panel Online</span>
            </div>
          </div>

          <div className="p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
