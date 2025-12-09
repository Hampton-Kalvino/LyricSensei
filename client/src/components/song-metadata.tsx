import { Music2, Heart, Share2 } from "lucide-react";
import { SiSpotify, SiApplemusic, SiTidal, SiYoutubemusic } from "react-icons/si";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { generateStoryImage } from "@/lib/story-generator";
import type { Song } from "@shared/schema";

interface SongMetadataProps {
  song: Song;
}

function getLanguageName(code: string): string {
  const languageNames: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'pt': 'Portuguese',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh-Hans': 'Chinese (Simplified)',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'tr': 'Turkish',
  };
  
  return languageNames[code] || code.toUpperCase();
}

function generatePlatformLinks(song: Song) {
  const query = encodeURIComponent(`${song.title} ${song.artist}`);
  
  return {
    spotify: `https://open.spotify.com/search/${query}`,
    appleMusic: `https://music.apple.com/search?term=${query}`,
    tidal: `https://tidal.com/search?q=${query}`,
    youtubeMusic: `https://music.youtube.com/search?q=${query}`,
  };
}

export function SongMetadata({ song }: SongMetadataProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const links = generatePlatformLinks(song);
  
  // Check if song is favorited
  const { data: favoriteData } = useQuery<{ isFavorite: boolean }>({
    queryKey: ["/api/favorites", song.id, "check"],
    queryFn: async () => {
      const response = await fetch(`/api/favorites/${song.id}/check`);
      if (!response.ok) throw new Error("Failed to check favorite status");
      return response.json();
    },
    enabled: !!user,
  });
  
  const isFavorite = Boolean(favoriteData?.isFavorite);
  
  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (isFavorite) {
        return apiRequest("DELETE", `/api/favorites/${song.id}`);
      } else {
        return apiRequest("POST", `/api/favorites/${song.id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recognition-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites", song.id, "check"] });
      
      toast({
        title: isFavorite ? "Removed from favorites" : "Added to favorites",
        description: isFavorite ? "Song removed from your library" : "Song saved to your library",
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
  
  const handleShare = async () => {
    try {
      console.log('[Share] Starting story image generation...');
      const storyBlob = await generateStoryImage({
        song,
        albumArtUrl: song.albumArt || undefined,
      });
      console.log('[Share] Story image generated, size:', storyBlob.size, 'bytes');

      const file = new File([storyBlob], `lyric-sensei-${song.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`, {
        type: "image/png",
      });

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Try Web Share API first (works better on mobile, especially non-incognito)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          console.log('[Share] Using Web Share API with file...');
          await navigator.share({
            files: [file],
            title: `${song.title} - Lyric Sensei`,
            text: `Check out "${song.title}" by ${song.artist}!`,
          });
          console.log('[Share] Share successful via Web Share API');
          
          // On mobile, try to open Instagram after successful share
          if (isMobile) {
            setTimeout(() => {
              window.location.href = 'instagram://story-camera';
            }, 500);
          }
          return;
        } catch (error) {
          // User cancelled or share failed
          if ((error as Error).name === 'AbortError') {
            console.log('[Share] User cancelled share');
            return;
          }
          console.error('[Share] Web Share API failed, falling back to download:', error);
        }
      }

      // Fallback: Download approach
      console.log('[Share] Using download fallback');
      
      // For mobile browsers, especially incognito mode
      if (isMobile) {
        // Create object URL
        const url = URL.createObjectURL(storyBlob);
        
        // Open in new window (works better in incognito mode than direct download)
        const newWindow = window.open(url, '_blank');
        
        if (newWindow) {
          toast({
            title: "Story Ready!",
            description: "Tap and hold the image to save it, then upload to Instagram Stories",
            duration: 6000,
          });
          
          // Try to open Instagram after a delay
          setTimeout(() => {
            window.location.href = 'instagram://story-camera';
          }, 2000);
        } else {
          // If popup blocked, try direct download
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          a.click();
          
          toast({
            title: "Story Saved!",
            description: "Opening Instagram... Select the image from your gallery",
            duration: 5000,
          });
          
          setTimeout(() => {
            window.location.href = 'instagram://story-camera';
          }, 1000);
        }
        
        // Clean up after delay
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        // Desktop: standard download
        const url = URL.createObjectURL(storyBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Story Image Downloaded!",
          description: "Upload it to your Instagram or Facebook Stories from your device",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error("Failed to generate story image:", error);
      toast({
        title: "Error",
        description: "Failed to generate story image",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="relative w-48 h-48 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
          {song.albumArt ? (
            <img
              src={song.albumArt}
              alt={`${song.album} cover`}
              className="w-full h-full object-cover"
            />
          ) : (
            <Music2 className="w-16 h-16 text-muted-foreground" />
          )}
        </div>
        <div className="w-full">
          <h2 className="text-2xl font-semibold" data-testid="text-song-title">
            {song.title}
          </h2>
          <p className="text-lg text-muted-foreground mt-1" data-testid="text-song-artist">
            {song.artist}
          </p>
          {song.album && (
            <p className="text-sm text-muted-foreground mt-2" data-testid="text-song-album">
              {song.album}
            </p>
          )}
          {song.detectedLanguage && song.detectedLanguage !== 'unknown' && (
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-song-language">
              Language: {getLanguageName(song.detectedLanguage)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{`${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}`}</span>
        </div>
        
        {!!user && (
          <div className="flex gap-2 w-full max-w-xs">
            <Button
              variant={isFavorite ? "default" : "outline"}
              size="sm"
              className="flex-1 gap-2"
              onClick={() => toggleFavoriteMutation.mutate()}
              disabled={toggleFavoriteMutation.isPending}
              data-testid="button-favorite"
            >
              <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
              {isFavorite ? "Favorited" : "Favorite"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={handleShare}
              data-testid="button-share"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        )}

        <Separator className="my-2" />

        <div className="w-full space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Listen on</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => window.open(links.spotify, '_blank')}
              data-testid="button-spotify-link"
            >
              <SiSpotify className="h-4 w-4" style={{ color: '#1DB954' }} />
              <span>Spotify</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => window.open(links.appleMusic, '_blank')}
              data-testid="button-apple-music-link"
            >
              <SiApplemusic className="h-4 w-4" style={{ color: '#FA243C' }} />
              <span>Apple Music</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => window.open(links.tidal, '_blank')}
              data-testid="button-tidal-link"
            >
              <SiTidal className="h-4 w-4" />
              <span>Tidal</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => window.open(links.youtubeMusic, '_blank')}
              data-testid="button-youtube-music-link"
            >
              <SiYoutubemusic className="h-4 w-4" style={{ color: '#FF0000' }} />
              <span>YouTube Music</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
