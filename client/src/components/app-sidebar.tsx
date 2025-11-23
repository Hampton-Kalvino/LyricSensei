import { Music, Library, Settings, Crown, DollarSign, User, Download, Trophy } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useToast } from "@/hooks/use-toast";
import { PWAInstallModal } from "@/components/pwa-install-modal";
import { useState } from "react";
import { useLocation } from "wouter";
import logoImage from "@assets/ChatGPT Image Nov 5, 2025, 05_37_31 PM_1762887933822.png";

export function AppSidebar() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isInstalled, showInstallPrompt, hasPrompt } = usePWAInstall();
  const [showManualInstructions, setShowManualInstructions] = useState(false);

  const handleAuthButton = async () => {
    if (user) {
      // User is logged in, so log them out
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
        setLocation("#/auth/login");
        toast({
          title: "Logged Out",
          description: "You have been successfully logged out.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to logout",
          variant: "destructive",
        });
      }
    } else {
      // User is not logged in, redirect to login
      setLocation("#/auth/login");
    }
  };
  const isPremium = (user as any)?.isPremium ?? false;
  const username = (user as any)?.username;
  const firstName = (user as any)?.firstName;
  const lastName = (user as any)?.lastName;
  const profileImageUrl = (user as any)?.profileImageUrl;

  const displayName = username || (firstName && lastName ? `${firstName} ${lastName}` : firstName || "User");
  
  const menuItems = [
    {
      title: t('nav.home'),
      url: "/",
      icon: Music,
      testId: "home",
    },
    {
      title: t('nav.library'),
      url: "/library",
      icon: Library,
      testId: "library",
    },
    {
      title: "Practice Stats",
      url: "/practice-stats",
      icon: Trophy,
      testId: "practice-stats",
    },
    {
      title: t('nav.pricing'),
      url: "/pricing",
      icon: DollarSign,
      testId: "pricing",
    },
    {
      title: t('nav.account'),
      url: "/account",
      icon: User,
      testId: "account",
    },
  ];
  return (
    <Sidebar>
      <SidebarHeader className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <img 
            src={logoImage} 
            alt="LyricSync Logo" 
            className="h-20 md:h-24 w-auto object-contain flex-shrink-0"
            data-testid="img-sidebar-logo"
          />
        </div>
        
        {user ? (
          <button
            onClick={() => setLocation("#/account")}
            className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent hover-elevate active-elevate-2 w-full text-left transition-colors"
            data-testid="button-profile-box"
          >
            <Avatar className="h-10 w-10" data-testid="avatar-user-sidebar">
              <AvatarImage src={profileImageUrl || undefined} />
              <AvatarFallback className="text-sm">
                {String(username || firstName || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid="text-sidebar-username">
                {String(displayName)}
              </p>
              {isPremium && (
                <Badge variant="default" className="gap-1 text-xs h-5 mt-1" data-testid="badge-premium">
                  <Crown className="h-2.5 w-2.5" />
                  Pro
                </Badge>
              )}
            </div>
          </button>
        ) : null}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.menu') || 'Menu'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.testId}>
                  <SidebarMenuButton asChild>
                    <a href={`#${item.url}`} data-testid={`link-${item.testId}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        {!isInstalled && (
          <Button
            onClick={async () => {
              console.log('[PWA] Install button clicked, hasPrompt:', hasPrompt);
              
              if (hasPrompt) {
                // Browser has the install prompt ready - use it
                const accepted = await showInstallPrompt();
                if (accepted) {
                  toast({
                    title: "App Installing",
                    description: "Lyric Sensei is being added to your home screen.",
                  });
                } else {
                  toast({
                    title: "Installation Cancelled",
                    description: "You can install the app later from the menu.",
                  });
                }
              } else {
                // No prompt available - show manual instructions
                console.log('[PWA] No prompt available, showing manual instructions');
                toast({
                  title: "Manual Installation",
                  description: "Follow the instructions below to install the app on your device.",
                });
                setShowManualInstructions(true);
              }
            }}
            className="w-full gap-2"
            variant="default"
            data-testid="button-install-pwa"
          >
            <Download className="h-4 w-4" />
            {t('pwa.installApp') || 'Install App'}
          </Button>
        )}
        <Button
          onClick={handleAuthButton}
          variant={user ? "destructive" : "default"}
          className="w-full"
          data-testid={user ? "button-logout-menu" : "button-login-menu"}
        >
          {user ? "Logout" : "Login / Sign Up"}
        </Button>
      </SidebarFooter>
      <PWAInstallModal 
        open={showManualInstructions} 
        onOpenChange={setShowManualInstructions}
      />
    </Sidebar>
  );
}
