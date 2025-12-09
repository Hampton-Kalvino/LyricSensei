import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Copy, Music, Play, Trash2, Users, Settings, Share2, UserMinus } from "lucide-react";
import type { Playlist, PlaylistSongWithDetails, PlaylistCollaborator } from "@shared/schema";

interface PlaylistDetailResponse extends Playlist {
  songs: PlaylistSongWithDetails[];
  collaborators: Array<PlaylistCollaborator & { user: { id: string; username: string | null; profileImageUrl: string | null } }>;
  userRole?: string;
}

export default function PlaylistDetailPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [shareOpen, setShareOpen] = useState(false);

  const { data: playlist, isLoading } = useQuery<PlaylistDetailResponse>({
    queryKey: ['/api/playlists', id],
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/playlists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      setLocation('/playlists');
      toast({ title: t('playlists.deleted', 'Playlist deleted') });
    },
    onError: () => {
      toast({ title: t('playlists.deleteError', 'Failed to delete playlist'), variant: 'destructive' });
    },
  });

  const removeSongMutation = useMutation({
    mutationFn: async (songId: string) => {
      return apiRequest('DELETE', `/api/playlists/${id}/songs/${songId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists', id] });
      toast({ title: t('playlists.songRemoved', 'Song removed') });
    },
    onError: () => {
      toast({ title: t('playlists.removeSongError', 'Failed to remove song'), variant: 'destructive' });
    },
  });

  const removeCollaboratorMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('DELETE', `/api/playlists/${id}/collaborators/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists', id] });
      toast({ title: t('playlists.collaboratorRemoved', 'Collaborator removed') });
    },
    onError: () => {
      toast({ title: t('playlists.removeCollaboratorError', 'Failed to remove collaborator'), variant: 'destructive' });
    },
  });

  const copyInviteCode = () => {
    if (playlist?.inviteCode) {
      navigator.clipboard.writeText(playlist.inviteCode);
      toast({ title: t('playlists.codeCopied', 'Invite code copied!') });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-10 w-10" />
            <div className="flex-1">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32 mt-2" />
            </div>
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="text-center p-8">
          <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium">{t('playlists.notFound', 'Playlist not found')}</h2>
          <Link href="/playlists">
            <Button className="mt-4">{t('playlists.backToPlaylists', 'Back to Playlists')}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isOwner = playlist.userRole === 'owner';
  const canEdit = playlist.userRole === 'owner' || playlist.userRole === 'editor';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/playlists">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-playlist-name">{playlist.name}</h1>
            {playlist.description && (
              <p className="text-muted-foreground text-sm">{playlist.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={shareOpen} onOpenChange={setShareOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" data-testid="button-share">
                  <Share2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('playlists.sharePlaylist', 'Share Playlist')}</DialogTitle>
                  <DialogDescription>
                    {t('playlists.shareDescription', 'Share this code with friends to let them join')}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-6">
                  <div className="flex items-center gap-3">
                    <Input
                      value={playlist.inviteCode || ''}
                      readOnly
                      className="font-mono text-lg text-center uppercase"
                      data-testid="text-invite-code"
                    />
                    <Button onClick={copyInviteCode} variant="outline" data-testid="button-copy-code">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="text-destructive" data-testid="button-delete-playlist">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('playlists.deleteConfirm', 'Delete Playlist?')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('playlists.deleteWarning', 'This action cannot be undone. All songs and collaborators will be removed.')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground"
                    >
                      {t('common.delete', 'Delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5" />
                  {t('playlists.songs', 'Songs')} ({playlist.songs?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {playlist.songs?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>{t('playlists.noSongs', 'No songs yet')}</p>
                    <p className="text-sm">{t('playlists.addFromFavorites', 'Add songs from your favorites or history')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {playlist.songs?.map((item, index) => (
                      <div 
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover-elevate"
                        data-testid={`song-item-${item.songId}`}
                      >
                        <span className="text-sm text-muted-foreground w-6 text-center">{index + 1}</span>
                        {item.song.albumArt ? (
                          <img 
                            src={item.song.albumArt} 
                            alt={item.song.title}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Music className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.song.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{item.song.artist}</p>
                        </div>
                        <Link href={`/song/${item.songId}`}>
                          <Button variant="ghost" size="icon" data-testid={`button-play-${item.songId}`}>
                            <Play className="h-4 w-4" />
                          </Button>
                        </Link>
                        {canEdit && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => removeSongMutation.mutate(item.songId)}
                            disabled={removeSongMutation.isPending}
                            data-testid={`button-remove-song-${item.songId}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('playlists.collaborators', 'Collaborators')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {playlist.collaborators?.map((collab) => (
                    <div 
                      key={collab.id}
                      className="flex items-center gap-3"
                      data-testid={`collaborator-${collab.userId}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={collab.user.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {collab.user.username?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {collab.user.username || t('common.anonymous', 'Anonymous')}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">{collab.role}</p>
                      </div>
                      {isOwner && collab.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCollaboratorMutation.mutate(collab.userId)}
                          disabled={removeCollaboratorMutation.isPending}
                          data-testid={`button-remove-collaborator-${collab.userId}`}
                        >
                          <UserMinus className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('playlists.inviteCode', 'Invite Code')}</CardTitle>
                <CardDescription>
                  {t('playlists.inviteCodeDescription', 'Share this code to invite collaborators')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-muted rounded-lg font-mono text-center text-lg">
                    {playlist.inviteCode}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyInviteCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
