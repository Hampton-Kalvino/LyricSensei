import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient, setGuestUserId } from "./lib/queryClient"; // Import setGuestUserId
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { UILanguageSelector } from "@/components/ui-language-selector";
import { GlobalSearchButton } from "@/components/global-search-button";
import { useAuth } from "@/hooks/useAuth";
import Home from "@/pages/home";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Profile from "@/pages/profile";
import Pricing from "@/pages/pricing";
import Account from "@/pages/account";
import Checkout from "@/pages/checkout";
import CheckoutReturn from "@/pages/checkout-return";
import Library from "@/pages/library";
import PracticeStats from "@/pages/practice-stats";
import Terms from "@/pages/terms";
import NotFound from "@/pages/not-found";
import { Footer } from "@/components/footer";
import "@/i18n/config";

// --- Guest User Initialization ---
// On app startup, check for stored guest ID
function initAuth() {
  const storedGuestId = localStorage.getItem('guestUserId');
  if (storedGuestId) {
    setGuestUserId(storedGuestId);
  }
}
initAuth(); // Run this logic once on app load
// --- End Guest User Initialization ---

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // For unauthenticated users, show only public routes
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen" style={{ paddingTop: 'var(--safe-area-inset-top)', paddingBottom: 'var(--safe-area-inset-bottom)', paddingLeft: 'var(--safe-area-inset-left)', paddingRight: 'var(--safe-area-inset-right)' }}>
        <div className="flex-1">
          <Switch>
            <Route path="/pricing" component={Pricing} />
            <Route path="/terms" component={Terms} />
            <Route path="/auth/login" component={Login} />
            <Route path="/" component={Landing} />
            <Route component={NotFound} />
          </Switch>
        </div>
        <Footer />
      </div>
    );
  }

  // For authenticated users, show all routes
  return (
    <Switch>
      <Route path="/pricing" component={Pricing} />
      <Route path="/terms" component={Terms} />
      <Route path="/auth/login" component={Login} />
      <Route path="/" component={Home} />
      <Route path="/library" component={Library} />
      <Route path="/practice-stats" component={PracticeStats} />
      <Route path="/account" component={Account} />
      <Route path="/profile" component={Profile} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/checkout/return" component={CheckoutReturn} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <WouterRouter hook={useHashLocation}>
            <AuthenticatedApp style={style} />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AuthenticatedApp({ style }: { style: Record<string, string> }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const isHomePage = location === "/";

  if (isLoading || !isAuthenticated) {
    return <Router />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full" style={{ paddingTop: 'var(--safe-area-inset-top)', paddingBottom: 'var(--safe-area-inset-bottom)', paddingLeft: 'var(--safe-area-inset-left)', paddingRight: 'var(--safe-area-inset-right)' }}>
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" style={{ paddingTop: `calc(0.75rem + var(--safe-area-inset-top))`, paddingLeft: `calc(1rem + var(--safe-area-inset-left))`, paddingRight: `calc(1rem + var(--safe-area-inset-right))` }}>
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              {!isHomePage && <GlobalSearchButton />}
            </div>
            <div className="flex items-center gap-2">
              <UILanguageSelector />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto flex flex-col">
            <div className="flex-1">
              <Router />
            </div>
            <Footer />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default App;
