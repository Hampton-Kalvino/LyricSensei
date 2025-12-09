import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { Plus, Music, Users, Copy, UserPlus, List, ArrowLeft } from "lucide-react";
import type { PlaylistWithDetails } from "@shared/schema";

export default function PlaylistsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const { data: playlists, isLoading } = useQuery<PlaylistWithDetails[]>({
    queryKey: ['/api/playlists'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      return apiRequest('POST', '/api/playlists', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      setCreateOpen(false);
      setNewPlaylistName("");
      setNewPlaylistDescription("");
      toast({ title: t('playlists.created', 'Playlist created!') });
    },
    onError: (error: any) => {
      toast({ title: t('playlists.createError', 'Failed to create playlist'), variant: 'destructive' });
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (code: string) => {
      return apiRequest('POST', '/api/playlists/join', { inviteCode: code });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      setJoinOpen(false);
      setInviteCode("");
      toast({ title: t('playlists.joined', 'Joined playlist!') });
    },
    onError: (error: any) => {
      toast({ title: error.message || t('playlists.joinError', 'Failed to join playlist'), variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    if (!newPlaylistName.trim()) return;
    createMutation.mutate({ 
      name: newPlaylistName.trim(), 
      description: newPlaylistDescription.trim() || undefined 
    });
  };

  const handleJoin = () => {
    if (!inviteCode.trim()) return;
    joinMutation.mutate(inviteCode.trim());
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              {t('playlists.title', 'Playlists')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('playlists.subtitle', 'Create and share playlists with friends')}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-playlist">
                <Plus className="h-4 w-4 mr-2" />
                {t('playlists.create', 'Create Playlist')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('playlists.createNew', 'Create New Playlist')}</DialogTitle>
                <DialogDescription>
                  {t('playlists.createDescription', 'Give your playlist a name and description')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('playlists.name', 'Name')}</Label>
                  <Input
                    id="name"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder={t('playlists.namePlaceholder', 'My Awesome Playlist')}
                    data-testid="input-playlist-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t('playlists.description', 'Description (optional)')}</Label>
                  <Input
                    id="description"
                    value={newPlaylistDescription}
                    onChange={(e) => setNewPlaylistDescription(e.target.value)}
                    placeholder={t('playlists.descriptionPlaceholder', 'Songs for learning...')}
                    data-testid="input-playlist-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button 
                  onClick={handleCreate} 
                  disabled={!newPlaylistName.trim() || createMutation.isPending}
                  data-testid="button-confirm-create"
                >
                  {createMutation.isPending ? t('common.creating', 'Creating...') : t('common.create', 'Create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-join-playlist">
                <UserPlus className="h-4 w-4 mr-2" />
                {t('playlists.join', 'Join with Code')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('playlists.joinPlaylist', 'Join a Playlist')}</DialogTitle>
                <DialogDescription>
                  {t('playlists.joinDescription', 'Enter the invite code shared with you')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">{t('playlists.inviteCode', 'Invite Code')}</Label>
                  <Input
                    id="inviteCode"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="ABCD1234"
                    className="uppercase"
                    data-testid="input-invite-code"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setJoinOpen(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button 
                  onClick={handleJoin} 
                  disabled={!inviteCode.trim() || joinMutation.isPending}
                  data-testid="button-confirm-join"
                >
                  {joinMutation.isPending ? t('common.joining', 'Joining...') : t('common.join', 'Join')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : playlists?.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <List className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {t('playlists.noPlaylists', 'No playlists yet')}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t('playlists.getStarted', 'Create your first playlist or join one with an invite code')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {playlists?.map((playlist) => (
              <Link key={playlist.id} href={`/playlists/${playlist.id}`}>
                <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-playlist-${playlist.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                        <Music className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{playlist.name}</CardTitle>
                        {playlist.description && (
                          <CardDescription className="line-clamp-1">{playlist.description}</CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Music className="h-3.5 w-3.5" />
                          {playlist.songCount} {t('playlists.songs', 'songs')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {playlist.collaboratorCount + 1}
                        </span>
                      </div>
                      <Badge variant={playlist.role === 'owner' ? 'default' : 'secondary'}>
                        {playlist.role === 'owner' ? t('playlists.owner', 'Owner') : t('playlists.editor', 'Editor')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
