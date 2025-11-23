import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Music, Share2 } from "lucide-react";
import type { PracticeStatsWithSong } from "@shared/schema";
import { cn } from "@/lib/utils";
import { generateAchievementImage } from "@/lib/achievement-generator";

export default function PracticeStats() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: stats = [], isLoading } = useQuery<PracticeStatsWithSong[]>({
    queryKey: ["/api/practice-stats"],
    enabled: !!user,
  });

  // Function to get medal based on accuracy
  const getMedal = (accuracy: number) => {
    if (accuracy > 89) {
      return { color: "text-yellow-500 dark:text-yellow-400", bgColor: "bg-yellow-500/10", label: "Gold" as const };
    } else if (accuracy >= 60) {
      return { color: "text-gray-500 dark:text-gray-300", bgColor: "bg-gray-500/10", label: "Silver" as const };
    } else {
      return { color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-600/10", label: "Bronze" as const };
    }
  };

  const handleShare = async (stat: PracticeStatsWithSong) => {
    try {
      const medal = getMedal(stat.accuracyPercentage);
      const achievementBlob = await generateAchievementImage({
        songTitle: stat.song.title,
        artist: stat.song.artist,
        accuracyPercentage: stat.accuracyPercentage,
        medalTier: medal.label,
        albumArtUrl: stat.song.albumArt,
      });

      const file = new File(
        [achievementBlob],
        `lyric-sensei-achievement-${stat.song.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        { type: "image/png" }
      );

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      // Try Web Share API first (works better on mobile)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `${medal.label} Medal Achievement`,
            text: `I achieved ${stat.accuracyPercentage}% accuracy on "${stat.song.title}" in Lyric Sensei!`,
          });
          
          // Open Instagram after sharing on mobile
          if (isMobile) {
            setTimeout(() => {
              window.open('instagram://app', '_blank');
            }, 500);
          }
          return;
        } catch (shareError: any) {
          if (shareError.name !== 'AbortError') {
            console.error('[Share] Web Share API error:', shareError);
          }
        }
      }

      // Fallback: Download on desktop or open in new tab on mobile
      const url = URL.createObjectURL(achievementBlob);
      
      if (isMobile) {
        const newTab = window.open(url, '_blank');
        if (newTab) {
          toast({
            title: "Achievement Image Ready",
            description: "Tap and hold the image to save or share it. If you're in incognito mode, you may need to save it first.",
          });
        }
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `lyric-sensei-achievement-${stat.song.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        a.click();
        URL.revokeObjectURL(url);
        
        toast({
          title: "Achievement Saved",
          description: "Your achievement image has been downloaded.",
        });
      }
    } catch (error) {
      console.error("Share error:", error);
      toast({
        title: "Share Failed",
        description: "Failed to generate achievement image. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Practice Statistics</h1>
        </div>
        <p className="text-muted-foreground">
          Track your pronunciation practice progress and accuracy across all songs
        </p>
      </div>

      {stats.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Music className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Practice Stats Yet</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Start practicing pronunciation using the word-by-word practice mode on any song to see your stats here!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {stats.map((stat) => {
            const medal = getMedal(stat.accuracyPercentage);
            
            return (
              <Card
                key={stat.id}
                className="hover-elevate transition-all"
                data-testid={`practice-stat-card-${stat.songId}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    {/* Album Art */}
                    <div className="flex-shrink-0">
                      {stat.song.albumArt ? (
                        <img
                          src={stat.song.albumArt}
                          alt={stat.song.title}
                          className="w-20 h-20 rounded-md object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center">
                          <Music className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Song Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{stat.song.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{stat.song.artist}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>
                          {stat.successfulAttempts}/{stat.totalAttempts} words correct
                        </span>
                        <span className="text-xs">
                          Last practiced: {new Date(stat.lastPracticedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Accuracy & Medal */}
                    <div className="flex items-center gap-6 flex-shrink-0">
                      {/* Accuracy Percentage */}
                      <div className="text-center">
                        <div className="text-3xl font-bold" data-testid={`accuracy-${stat.songId}`}>
                          {stat.accuracyPercentage}%
                        </div>
                        <div className="text-xs text-muted-foreground">Accuracy</div>
                      </div>

                      {/* Medal */}
                      <div className="text-center">
                        <div
                          className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center",
                            medal.bgColor
                          )}
                          data-testid={`medal-${stat.songId}`}
                          title={`${medal.label} Medal`}
                        >
                          <Trophy className={cn("w-8 h-8", medal.color)} />
                        </div>
                        <div className={cn("text-xs font-medium mt-1", medal.color)}>{medal.label}</div>
                      </div>

                      {/* Share Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleShare(stat)}
                        data-testid={`button-share-${stat.songId}`}
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
