import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Music, Clock, Heart, Share2, ChevronDown, ChevronUp, ListMusic, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RecognitionResult, LyricLine, Translation, Song, Playlist } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { LyricDisplay } from "@/components/lyric-display";
import { useTranslation } from "react-i18next";

type ViewMode = "all" | "favorites" | "playlists";

export default function Library() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("favorites");
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);
  const isPremium = (user as any)?.isPremium ?? false;

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ songId, isFavorite }: { songId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        return apiRequest("DELETE", `/api/favorites/${songId}`);
      } else {
        return apiRequest("POST", `/api/favorites/${songId}`);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recognition-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites", variables.songId, "check"] });
      
      toast({
        title: variables.isFavorite ? t('library.removedFromFavorites', 'Removed from favorites') : t('library.addedToFavorites', 'Added to favorites'),
        description: variables.isFavorite ? t('library.songRemoved', 'Song removed from your library') : t('library.songSaved', 'Song saved to your library'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error', 'Error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleFavorite = (e: React.MouseEvent, songId: string, isFavorite: boolean) => {
    e.stopPropagation();
    toggleFavoriteMutation.mutate({ songId, isFavorite });
  };

  const handleShare = async (e: React.MouseEvent, song: RecognitionResult) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/share/${song.songId}`;
    const shareText = `Check out "${song.title}" by ${song.artist} on Lyric Sensei!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${song.title} - ${song.artist}`,
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        console.log("Share cancelled");
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: t('common.linkCopied', 'Link copied!'),
          description: t('common.shareLinkCopied', 'Share link copied to clipboard'),
        });
      } catch (error) {
        toast({
          title: t('common.error', 'Error'),
          description: t('common.failedToCopyLink', 'Failed to copy link'),
          variant: "destructive",
        });
      }
    }
  };

  const handleToggleExpand = (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    setExpandedSongId(expandedSongId === songId ? null : songId);
  };

  const handleCardClick = (songId: string) => {
    setLocation(`/?song=${songId}`);
  };

  const { data: history = [], isLoading: isHistoryLoading } = useQuery<RecognitionResult[]>({
    queryKey: ["/api/recognition-history"],
    enabled: !!user,
  });

  const { data: favorites = [], isLoading: isFavoritesLoading } = useQuery<RecognitionResult[]>({
    queryKey: ["/api/favorites"],
    enabled: !!user,
  });

  const { data: playlists = [], isLoading: isPlaylistsLoading } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
    enabled: !!user,
  });

  // Deduplicate songs in "All Songs" view
  const deduplicatedHistory = Object.values(
    history.reduce((acc, song) => {
      if (!acc[song.songId] || song.timestamp > acc[song.songId].timestamp) {
        acc[song.songId] = song;
      }
      return acc;
    }, {} as Record<string, RecognitionResult>)
  ).sort((a, b) => b.timestamp - a.timestamp);

  const isLoading = viewMode === "all" ? isHistoryLoading : viewMode === "favorites" ? isFavoritesLoading : isPlaylistsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">{t('library.loading', 'Loading your library...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h1 className="text-2xl font-bold mb-3" data-testid="text-library-title">
          {t('library.title', 'Your Library')}
        </h1>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="favorites" className="flex-1" data-testid="tab-favorites">
              <Heart className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{t('library.favorites', 'Favorites')}</span>
              <span className="sm:hidden">Fav</span>
              <span className="ml-1">({favorites.length})</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1" data-testid="tab-all">
              <Music className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{t('library.allSongs', 'All Songs')}</span>
              <span className="sm:hidden">All</span>
              <span className="ml-1">({deduplicatedHistory.length})</span>
            </TabsTrigger>
            <TabsTrigger value="playlists" className="flex-1" data-testid="tab-playlists">
              <ListMusic className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{t('library.playlists', 'Playlists')}</span>
              <span className="sm:hidden">Lists</span>
              <span className="ml-1">({playlists.length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto">
        {viewMode === "favorites" ? (
          <SongsTab 
            songs={favorites}
            emptyIcon={<Heart className="h-16 w-16 mx-auto text-muted-foreground" />}
            emptyTitle={t('library.noFavorites', 'No Favorite Songs Yet')}
            emptyDescription={t('library.noFavoritesDesc', 'Mark songs as favorites to see them here.')}
            isPremium={isPremium}
            expandedSongId={expandedSongId}
            onCardClick={handleCardClick}
            onToggleFavorite={handleToggleFavorite}
            onShare={handleShare}
            onToggleExpand={handleToggleExpand}
            toggleFavoriteMutation={toggleFavoriteMutation}
            showFavoriteStatus
          />
        ) : viewMode === "all" ? (
          <SongsTab 
            songs={deduplicatedHistory}
            emptyIcon={<Music className="h-16 w-16 mx-auto text-muted-foreground" />}
            emptyTitle={t('library.noSongs', 'No Songs Yet')}
            emptyDescription={t('library.noSongsDesc', 'Start recognizing songs to build your library.')}
            isPremium={isPremium}
            expandedSongId={expandedSongId}
            onCardClick={handleCardClick}
            onToggleFavorite={handleToggleFavorite}
            onShare={handleShare}
            onToggleExpand={handleToggleExpand}
            toggleFavoriteMutation={toggleFavoriteMutation}
            favorites={favorites}
          />
        ) : (
          <PlaylistsTab playlists={playlists} />
        )}
      </div>
    </div>
  );
}

interface SongsTabProps {
  songs: RecognitionResult[];
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  isPremium: boolean;
  expandedSongId: string | null;
  onCardClick: (songId: string) => void;
  onToggleFavorite: (e: React.MouseEvent, songId: string, isFavorite: boolean) => void;
  onShare: (e: React.MouseEvent, song: RecognitionResult) => void;
  onToggleExpand: (e: React.MouseEvent, songId: string) => void;
  toggleFavoriteMutation: any;
  showFavoriteStatus?: boolean;
  favorites?: RecognitionResult[];
}

function SongsTab({ 
  songs,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  isPremium, 
  expandedSongId, 
  onCardClick, 
  onToggleFavorite, 
  onShare, 
  onToggleExpand,
  toggleFavoriteMutation,
  showFavoriteStatus,
  favorites = []
}: SongsTabProps) {
  const { t } = useTranslation();

  // Create a set of favorite song IDs for quick lookup
  const favoriteIds = new Set(favorites.map(f => f.songId));

  if (songs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          {emptyIcon}
          <div>
            <h2 className="text-xl font-semibold mb-2">{emptyTitle}</h2>
            <p className="text-muted-foreground mb-4">{emptyDescription}</p>
            <Link href="/" className="text-primary hover:underline" data-testid="link-home">
              {t('library.goHome', 'Go to Home')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {songs.map((entry) => {
          const isFavorite = showFavoriteStatus ? true : favoriteIds.has(entry.songId);
          
          return (
            <Card
              key={entry.songId}
              className="hover-elevate active-elevate-2 cursor-pointer overflow-visible"
              onClick={() => onCardClick(entry.songId)}
              data-testid={`card-song-${entry.songId}`}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {entry.albumArt ? (
                    <img
                      src={entry.albumArt}
                      alt={entry.title}
                      className="w-16 h-16 rounded object-cover"
                      data-testid={`img-album-${entry.songId}`}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                      <Music className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate" data-testid={`text-song-title-${entry.songId}`}>
                          {entry.title}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate" data-testid={`text-artist-${entry.songId}`}>
                          {entry.artist}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => onShare(e, entry)}
                          data-testid={`button-share-${entry.songId}`}
                        >
                          <Share2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => onToggleFavorite(e, entry.songId, isFavorite)}
                          disabled={toggleFavoriteMutation.isPending}
                          data-testid={`icon-favorite-${entry.songId}`}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current text-primary' : 'text-muted-foreground'}`} />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(entry.confidence * 100)}% match
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </div>
                    </div>

                    {isPremium && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={(e) => onToggleExpand(e, entry.songId)}
                          data-testid={`button-expand-lyrics-${entry.songId}`}
                        >
                          {expandedSongId === entry.songId ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              {t('library.hideLyrics', 'Hide Lyrics')}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              {t('library.showLyrics', 'Show Lyrics')}
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {isPremium && expandedSongId === entry.songId && (
                  <SongLyricsSection songId={entry.songId} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PlaylistsTab({ playlists }: { playlists: Playlist[] }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Separate owned playlists and followed/collaborated playlists
  const ownedPlaylists = playlists.filter(p => p.ownerId === user?.id);
  const followedPlaylists = playlists.filter(p => p.ownerId !== user?.id);

  if (playlists.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <ListMusic className="h-16 w-16 mx-auto text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold mb-2">{t('library.noPlaylists', 'No Playlists Yet')}</h2>
            <p className="text-muted-foreground mb-4">
              {t('library.noPlaylistsDesc', 'Create your own playlists or join others using invite codes.')}
            </p>
            <Link href="/playlists">
              <Button data-testid="button-go-playlists">
                {t('library.goToPlaylists', 'Go to Playlists')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {ownedPlaylists.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <ListMusic className="h-5 w-5" />
            {t('library.myPlaylists', 'My Playlists')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownedPlaylists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} onClick={() => setLocation(`/playlists/${playlist.id}`)} />
            ))}
          </div>
        </div>
      )}

      {followedPlaylists.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('library.followedPlaylists', 'Joined Playlists')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {followedPlaylists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} onClick={() => setLocation(`/playlists/${playlist.id}`)} isFollowed />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlaylistCard({ playlist, onClick, isFollowed }: { playlist: Playlist; onClick: () => void; isFollowed?: boolean }) {
  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer"
      onClick={onClick}
      data-testid={`card-playlist-${playlist.id}`}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          {playlist.coverImage ? (
            <img
              src={playlist.coverImage}
              alt={playlist.name}
              className="w-14 h-14 rounded object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded bg-primary/10 flex items-center justify-center">
              <ListMusic className="h-6 w-6 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold truncate">{playlist.name}</h4>
            {playlist.description && (
              <p className="text-sm text-muted-foreground truncate">{playlist.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {isFollowed && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  Joined
                </Badge>
              )}
              {playlist.isPublic && (
                <Badge variant="outline" className="text-xs">Public</Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SongLyricsSection({ songId }: { songId: string }) {
  const { t } = useTranslation();
  const [targetLanguage, setTargetLanguage] = useState("es");

  const { data: songData } = useQuery<Song>({
    queryKey: [`/api/songs/${songId}`],
    queryFn: async () => {
      const response = await fetch(`/api/songs/${songId}`);
      if (!response.ok) throw new Error("Failed to fetch song");
      return response.json();
    },
  });

  const { data: lyrics = [], isLoading: isLoadingLyrics } = useQuery<LyricLine[]>({
    queryKey: [`/api/lyrics/${songId}`],
    queryFn: async () => {
      const response = await fetch(`/api/lyrics/${songId}`);
      if (!response.ok) throw new Error("Failed to fetch lyrics");
      return response.json();
    },
  });

  const { data: translations = [], isLoading: isLoadingTranslations } = useQuery<Translation[]>({
    queryKey: [`/api/translations/${songId}`, targetLanguage],
    queryFn: async () => {
      const { getGuestUserId } = await import('@/lib/queryClient');
      const guestUserId = getGuestUserId();
      
      const isCapacitor = !!(window as any).Capacitor;
      
      const getBackendUrl = () => {
        if (isCapacitor) {
          return "https://lyricsensei.com";
        }
        return window.location.origin;
      };
      
      const backendUrl = getBackendUrl();
      const url = `${backendUrl}/api/translations/${songId}/${targetLanguage}`;
      
      const headers: Record<string, string> = {
        "Accept": "application/json",
      };
      
      if (guestUserId) {
        headers['X-Guest-Id'] = guestUserId;
      }
      
      const response = await fetch(url, {
        headers,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch translations");
      return response.json();
    },
    enabled: lyrics.length > 0,
  });

  const supportedLanguages = [
    { value: "es", label: t('languages.spanish', 'Spanish') },
    { value: "fr", label: t('languages.french', 'French') },
    { value: "de", label: t('languages.german', 'German') },
    { value: "ja", label: t('languages.japanese', 'Japanese') },
    { value: "ko", label: t('languages.korean', 'Korean') },
    { value: "zh", label: t('languages.chinese', 'Chinese') },
  ];

  return (
    <div className="mt-4 pt-4 border-t">
      {lyrics.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-medium">{t('library.translateTo', 'Translate to:')}</span>
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger className="w-40" data-testid="select-target-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedLanguages.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      <LyricDisplay
        lyrics={lyrics}
        translations={translations}
        currentTime={0}
        songId={songId}
        isLoading={isLoadingLyrics || isLoadingTranslations}
        hasSyncedLyrics={songData?.hasSyncedLyrics ?? undefined}
        isActivePlayback={false}
      />
    </div>
  );
}
