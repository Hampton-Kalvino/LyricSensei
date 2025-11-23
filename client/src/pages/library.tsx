import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Music, Clock, Heart, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RecognitionResult, LyricLine, Translation, Song } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { LyricDisplay } from "@/components/lyric-display";

type ViewMode = "all" | "favorites";

export default function Library() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);
  const isPremium = (user as any)?.isPremium ?? false;

  // Toggle favorite mutation
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
        title: variables.isFavorite ? "Removed from favorites" : "Added to favorites",
        description: variables.isFavorite ? "Song removed from your library" : "Song saved to your library",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
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
    const shareText = `Check out "${song.title}" by ${song.artist} on LyricSync!`;
    
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
          title: "Link copied!",
          description: "Share link copied to clipboard",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to copy link",
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

  const { data: history = [], isLoading: isHistoryLoading, isError: isHistoryError } = useQuery<RecognitionResult[]>({
    queryKey: ["/api/recognition-history"],
    queryFn: async () => {
      const response = await fetch("/api/recognition-history?limit=100");
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: favorites = [], isLoading: isFavoritesLoading, isError: isFavoritesError } = useQuery<RecognitionResult[]>({
    queryKey: ["/api/favorites"],
    queryFn: async () => {
      const response = await fetch("/api/favorites");
      if (!response.ok) throw new Error("Failed to fetch favorites");
      return response.json();
    },
    enabled: !!user,
  });

  const isLoading = viewMode === "all" ? isHistoryLoading : isFavoritesLoading;
  const isError = viewMode === "all" ? isHistoryError : isFavoritesError;
  
  // Deduplicate songs in "All Songs" view - show each unique song once with most recent timestamp
  const deduplicatedHistory = viewMode === "all" 
    ? Object.values(
        history.reduce((acc, song) => {
          if (!acc[song.songId] || song.timestamp > acc[song.songId].timestamp) {
            acc[song.songId] = song;
          }
          return acc;
        }, {} as Record<string, RecognitionResult>)
      ).sort((a, b) => b.timestamp - a.timestamp)
    : history;
  
  const displayedSongs = viewMode === "all" ? deduplicatedHistory : favorites;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading your library...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Music className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold">Failed to Load Library</h2>
            <p className="text-muted-foreground">Please try again later</p>
          </div>
        </div>
      </div>
    );
  }

  if (displayedSongs.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <h1 className="text-3xl font-bold mb-4" data-testid="text-library-title">Your Library</h1>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all">
                <Music className="h-4 w-4 mr-2" />
                All Songs
              </TabsTrigger>
              <TabsTrigger value="favorites" data-testid="tab-favorites">
                <Heart className="h-4 w-4 mr-2" />
                Favorites
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            {viewMode === "all" ? (
              <>
                <Music className="h-16 w-16 mx-auto text-muted-foreground" />
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Your Library is Empty</h2>
                  <p className="text-muted-foreground mb-4">
                    Start recognizing songs to build your music library. Your recognized songs will appear here.
                  </p>
                  <Link href="/" className="text-primary hover:underline" data-testid="link-home">
                    Go to Home
                  </Link>
                </div>
              </>
            ) : (
              <>
                <Heart className="h-16 w-16 mx-auto text-muted-foreground" />
                <div>
                  <h2 className="text-2xl font-semibold mb-2">No Favorites Yet</h2>
                  <p className="text-muted-foreground mb-4">
                    Mark songs as favorites to see them here. Your favorite songs will be saved to your library.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h1 className="text-3xl font-bold mb-4" data-testid="text-library-title">Your Library</h1>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">
              <Music className="h-4 w-4 mr-2" />
              All Songs ({deduplicatedHistory.length})
            </TabsTrigger>
            <TabsTrigger value="favorites" data-testid="tab-favorites">
              <Heart className="h-4 w-4 mr-2" />
              Favorites ({favorites.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedSongs.map((entry) => (
            <Card
              key={entry.songId}
              className="hover-elevate active-elevate-2 cursor-pointer overflow-visible"
              onClick={() => handleCardClick(entry.songId)}
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
                          onClick={(e) => handleShare(e, entry)}
                          data-testid={`button-share-${entry.songId}`}
                        >
                          <Share2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => handleToggleFavorite(e, entry.songId, Boolean(entry.isFavorite))}
                          disabled={toggleFavoriteMutation.isPending}
                          data-testid={`icon-favorite-${entry.songId}`}
                        >
                          <Heart className={`h-4 w-4 ${entry.isFavorite ? 'fill-current text-primary' : 'text-muted-foreground'}`} />
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
                          onClick={(e) => handleToggleExpand(e, entry.songId)}
                          data-testid={`button-expand-lyrics-${entry.songId}`}
                        >
                          {expandedSongId === entry.songId ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Hide Lyrics
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              Show Lyrics
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
          ))}
        </div>
      </div>
    </div>
  );
}

function SongLyricsSection({ songId }: { songId: string }) {
  const { toast } = useToast();
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
      const response = await fetch(`/api/translations/${songId}/${targetLanguage}`);
      if (!response.ok) throw new Error("Failed to fetch translations");
      return response.json();
    },
    enabled: lyrics.length > 0,
  });

  const supportedLanguages = [
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "ja", label: "Japanese" },
    { value: "ko", label: "Korean" },
    { value: "zh", label: "Chinese" },
  ];

  return (
    <div className="mt-4 pt-4 border-t">
      {lyrics.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-medium">Translate to:</span>
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
