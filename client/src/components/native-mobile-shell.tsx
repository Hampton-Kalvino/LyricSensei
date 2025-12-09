import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobileProfileDrawer } from "./mobile-profile-drawer";
import { ThemeToggle } from "./theme-toggle";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Loader2, X, UserPlus, Crown } from "lucide-react";

interface NativeMobileShellProps {
  children: React.ReactNode;
}

export function NativeMobileShell({ children }: NativeMobileShellProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showGuestBanner, setShowGuestBanner] = useState(false);

  // Check if user is a guest - use the isGuest flag from backend, with fallbacks
  const isGuest = user?.isGuest === true || 
                  user?.username?.startsWith('Guest_') || 
                  user?.email?.endsWith('@lyricsensei.local') ||
                  user?.email?.endsWith('@guest.local');

  // Show guest banner after a short delay for new guests
  useEffect(() => {
    if (isGuest) {
      const dismissed = localStorage.getItem('guestBannerDismissed');
      if (!dismissed) {
        const timer = setTimeout(() => setShowGuestBanner(true), 2000);
        return () => clearTimeout(timer);
      }
    } else {
      setShowGuestBanner(false);
    }
  }, [isGuest]);

  const dismissGuestBanner = () => {
    setShowGuestBanner(false);
    localStorage.setItem('guestBannerDismissed', 'true');
  };

  const handleCreateAccount = () => {
    setShowGuestBanner(false);
    setLocation('/auth/login');
  };

  const createPlaylistMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/playlists", { name });
    },
    onSuccess: () => {
      toast({
        title: t('playlists.created', 'Playlist created'),
        description: t('playlists.createdDesc', 'Your new playlist is ready'),
      });
      setNewPlaylistName("");
      setShowCreatePlaylist(false);
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error', 'Error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) {
      toast({
        title: t('common.error', 'Error'),
        description: t('playlists.nameRequired', 'Please enter a playlist name'),
        variant: "destructive",
      });
      return;
    }
    createPlaylistMutation.mutate(newPlaylistName.trim());
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
    <div className="flex flex-col h-screen bg-background">
      {/* Header with safe area padding */}
      <header 
        className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur z-40"
        style={{ paddingTop: 'calc(var(--safe-area-inset-top) + 0.5rem)' }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="focus:outline-none"
          data-testid="button-open-profile-drawer"
        >
          <Avatar className="h-8 w-8 border border-border">
            <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.username || 'User'} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {isGuest ? 'GU' : getInitials()}
            </AvatarFallback>
          </Avatar>
        </button>

        <ThemeToggle />
      </header>

      {/* Guest Banner */}
      {showGuestBanner && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 flex items-center gap-3">
          <UserPlus className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t('guest.createAccountPrompt', 'Create an account to save your progress')}</p>
            <p className="text-xs text-muted-foreground">{t('guest.unlockFeatures', 'Unlock favorites, history, and more')}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" onClick={handleCreateAccount} data-testid="button-guest-signup">
              {t('auth.signUp', 'Sign Up')}
            </Button>
            <button 
              onClick={dismissGuestBanner} 
              className="p-1 text-muted-foreground hover:text-foreground"
              data-testid="button-dismiss-guest-banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto pb-16">
        {children}
      </main>

      <MobileBottomNav onCreatePlaylist={() => setShowCreatePlaylist(true)} />

      <MobileProfileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('playlists.createNew', 'Create New Playlist')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder={t('playlists.namePlaceholder', 'Enter playlist name...')}
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
              data-testid="input-create-playlist-name"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCreatePlaylist(false);
                  setNewPlaylistName("");
                }}
                data-testid="button-cancel-create"
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreatePlaylist}
                disabled={createPlaylistMutation.isPending}
                data-testid="button-confirm-create"
              >
                {createPlaylistMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('common.create', 'Create')
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
