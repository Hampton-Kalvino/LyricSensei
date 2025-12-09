import { useState } from "react";
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
import { Loader2 } from "lucide-react";

interface NativeMobileShellProps {
  children: React.ReactNode;
}

export function NativeMobileShell({ children }: NativeMobileShellProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

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
    <div className="flex flex-col h-screen bg-background" style={{ 
      paddingTop: 'var(--safe-area-inset-top)', 
      paddingLeft: 'var(--safe-area-inset-left)', 
      paddingRight: 'var(--safe-area-inset-right)' 
    }}>
      <header className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur z-40">
        <button
          onClick={() => setDrawerOpen(true)}
          className="focus:outline-none"
          data-testid="button-open-profile-drawer"
        >
          <Avatar className="h-8 w-8 border border-border">
            <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.username || 'User'} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {user ? getInitials() : 'G'}
            </AvatarFallback>
          </Avatar>
        </button>

        <ThemeToggle />
      </header>

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
