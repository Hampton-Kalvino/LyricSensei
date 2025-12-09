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
      path: '/library',
      testId: 'nav-search'
    },
    { 
      icon: Library, 
      label: t('nav.library', 'Library'), 
      path: '/playlists',
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
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border/50 z-50" style={{ paddingBottom: 'var(--safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = location === item.path || 
            (item.path === '/library' && location.startsWith('/library')) ||
            (item.path === '/playlists' && location.startsWith('/playlists')) ||
            (item.path === '/games' && location.startsWith('/games'));
          
          return (
            <Link key={item.path} href={item.path}>
              <button
                className={cn(
                  "flex flex-col items-center justify-center w-16 h-full transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid={`button-${item.testId}`}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
              </button>
            </Link>
          );
        })}
        
        <button
          onClick={onCreatePlaylist}
          className="flex flex-col items-center justify-center w-16 h-full text-muted-foreground transition-colors hover:text-primary"
          data-testid="button-nav-create"
        >
          <Plus className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium">{t('nav.create', 'Create')}</span>
        </button>
      </div>
    </nav>
  );
}
