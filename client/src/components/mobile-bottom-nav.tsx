import { useLocation, Link } from "wouter";
import { Home, Search, Library, Gamepad2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface MobileBottomNavProps {
  onCreatePlaylist?: () => void;
}

export function MobileBottomNav({ onCreatePlaylist }: MobileBottomNavProps) {
  const { t } = useTranslation();
  const [location] = useLocation();

  const navItems = [
    { 
      icon: Home, 
      label: t('nav.home', 'Home'), 
      path: '/',
      testId: 'nav-home'
    },
    { 
      icon: Search, 
      label: t('nav.search', 'Search'), 
      path: '/search',
      testId: 'nav-search'
    },
    { 
      icon: Library, 
      label: t('nav.library', 'Library'), 
      path: '/library',
      testId: 'nav-library'
    },
    { 
      icon: Gamepad2, 
      label: t('nav.games', 'Games'), 
      path: '/games',
      testId: 'nav-games'
    },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border/50 z-50"
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: 'calc(56px + env(safe-area-inset-bottom, 0px))'
      }}
    >
      <div className="flex items-center h-14 px-2 gap-1">
        {navItems.map((item) => {
          const isActive = location === item.path || 
            (item.path === '/search' && location.startsWith('/search')) ||
            (item.path === '/library' && (location.startsWith('/library') || location.startsWith('/playlists'))) ||
            (item.path === '/games' && location.startsWith('/games'));
          
          return (
            <Link key={item.path} href={item.path} className="flex-1 min-w-0">
              <button
                className={cn(
                  "flex flex-col items-center justify-center w-full h-12 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid={`button-${item.testId}`}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span className="text-[10px] mt-0.5 font-medium truncate">{item.label}</span>
              </button>
            </Link>
          );
        })}
        
        <button
          onClick={onCreatePlaylist}
          className="flex-1 min-w-0 flex flex-col items-center justify-center h-12 text-muted-foreground transition-colors hover:text-primary"
          data-testid="button-nav-create"
        >
          <Plus className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium truncate">{t('nav.create', 'Create')}</span>
        </button>
      </div>
    </nav>
  );
}
