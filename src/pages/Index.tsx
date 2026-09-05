import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UtensilsCrossed, Building2, Users, QrCode, ChefHat, Smartphone } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero" />
        <div className="relative container mx-auto px-4 py-16 lg:py-24">
          <nav className="flex items-center justify-between mb-16">
            <Logo />
            <div className="flex items-center gap-4">
              <Link to="/auth/restaurant">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link to="/auth/admin">
                <Button variant="outline">Admin</Button>
              </Link>
            </div>
          </nav>

          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 tracking-tight">
              QR-Based Digital
              <span className="block text-accent">Ordering Made Simple</span>
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Streamline your restaurant, cafe, or hotel operations with Hotogram's modern ordering system. 
              Customers scan, order, and you deliver — all in real-time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth/restaurant?mode=signup">
                <Button size="xl" variant="accent" className="w-full sm:w-auto">
                  Get Started — It's Free
                </Button>
              </Link>
              <Link to="/auth/restaurant">
                <Button size="xl" variant="outline" className="w-full sm:w-auto">
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to transform your ordering experience
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="animate-slide-up border-0 shadow-card hover:shadow-card-hover transition-shadow" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <QrCode className="h-8 w-8 text-accent" />
                </div>
                <CardTitle className="text-xl">Scan QR Code</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-base">
                  Customers scan the unique QR code on their table to instantly access your digital menu
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="animate-slide-up border-0 shadow-card hover:shadow-card-hover transition-shadow" style={{ animationDelay: '0.2s' }}>
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="h-8 w-8 text-accent" />
                </div>
                <CardTitle className="text-xl">Browse & Order</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-base">
                  Browse the menu, customize orders, and submit — no app download required
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="animate-slide-up border-0 shadow-card hover:shadow-card-hover transition-shadow" style={{ animationDelay: '0.3s' }}>
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <ChefHat className="h-8 w-8 text-accent" />
                </div>
                <CardTitle className="text-xl">Kitchen Receives</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-base">
                  Orders appear instantly in your kitchen dashboard for quick preparation
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Access Points Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Access Points</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Different portals for different roles in your ecosystem
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="group hover:shadow-card-hover transition-all duration-300 border-2 border-transparent hover:border-accent/20">
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <UtensilsCrossed className="h-7 w-7 text-accent" />
                </div>
                <CardTitle className="text-2xl">Business Portal</CardTitle>
                <CardDescription className="text-base">
                  Manage your menu, tables, and view incoming orders in real-time
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Menu & category management
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Table setup with QR generation
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Real-time kitchen dashboard
                  </li>
                </ul>
                <Link to="/auth/restaurant" className="block">
                  <Button variant="accent" className="w-full">
                    Login
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-card-hover transition-all duration-300 border-2 border-transparent hover:border-primary/20">
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">Platform Admin</CardTitle>
                <CardDescription className="text-base">
                  Oversee all businesses, manage platform settings and access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    View all registered businesses
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Enable/disable access
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Platform-wide metrics
                  </li>
                </ul>
                <Link to="/auth/admin" className="block">
                  <Button variant="default" className="w-full">
                    Admin Login
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <Logo className="justify-center" />
          <p className="text-sm">QR-Based Digital Ordering for Restaurants, Cafes & Hotels</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;