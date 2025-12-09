import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { User, Trophy, ListMusic, BarChart3, Settings, ChevronRight, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileProfileDrawer({ open, onOpenChange }: MobileProfileDrawerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Check if user is a guest - use isGuest flag from backend with fallbacks
  const isGuest = user?.isGuest === true || 
                  user?.username?.startsWith('Guest_') || 
                  user?.email?.endsWith('@lyricsensei.local') ||
                  user?.email?.endsWith('@guest.local');

  // User is truly authenticated if they have a user object and are NOT a guest
  const isAuthenticated = !!user && !isGuest;

  const menuItems = [
    {
      icon: User,
      label: t('nav.viewProfile', 'View Profile'),
      path: '/profile',
      testId: 'menu-profile',
    },
    {
      icon: Trophy,
      label: t('nav.leaderboards', 'Leaderboards'),
      path: '/games',
      testId: 'menu-leaderboards',
    },
    {
      icon: ListMusic,
      label: t('nav.playlists', 'Playlists'),
      path: '/playlists',
      testId: 'menu-playlists',
    },
    {
      icon: BarChart3,
      label: t('nav.practiceStats', 'Practice Stats'),
      path: '/practice-stats',
      testId: 'menu-practice-stats',
    },
    {
      icon: Settings,
      label: t('nav.settingsPrivacy', 'Settings and Privacy'),
      path: '/settings',
      testId: 'menu-settings',
    },
  ];

  const handleItemClick = () => {
    onOpenChange(false);
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 p-0 bg-background">
        <div 
          className="flex flex-col h-full"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 24px) + 0.5rem)' }}
        >
          {isAuthenticated ? (
            <Link href="/profile" onClick={handleItemClick}>
              <div 
                className="flex items-center gap-3 p-4 border-b hover-elevate cursor-pointer"
                data-testid="drawer-profile-header"
              >
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.username || 'User'} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg truncate" data-testid="text-drawer-username">
                    {user?.username || user?.firstName || 'User'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('nav.viewProfile', 'View Profile')}
                  </p>
                </div>
              </div>
            </Link>
          ) : (
            <div className="p-4 border-b">
              {/* Show guest avatar header */}
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-12 w-12 border-2 border-muted">
                  <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg truncate">
                    {user?.username || t('auth.guest', 'Guest')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('auth.guestAccount', 'Guest Account')}
                  </p>
                </div>
              </div>
              {/* Sign In button for guests */}
              <Link href="/auth/login" onClick={handleItemClick}>
                <div 
                  className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary hover-elevate cursor-pointer"
                  data-testid="drawer-signin"
                >
                  <LogIn className="h-5 w-5 text-primary-foreground" />
                  <span className="font-medium text-primary-foreground">{t('auth.signIn', 'Sign In')}</span>
                </div>
              </Link>
            </div>
          )}

          <nav className="flex-1 py-2">
            {menuItems.map((item) => (
              <Link key={item.path} href={item.path} onClick={handleItemClick}>
                <div 
                  className="flex items-center gap-4 px-4 py-3.5 hover-elevate active-elevate-2 cursor-pointer"
                  data-testid={`button-${item.testId}`}
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="flex-1 font-medium">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </Link>
            ))}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
