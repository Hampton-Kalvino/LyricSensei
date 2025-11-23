import { Music2, Clock, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { RecognitionResult } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface RecognitionHistoryProps {
  history: RecognitionResult[];
  onSelectSong: (songId: string) => void;
  currentSongId?: string;
  onToggleFavorite?: (songId: string, isFavorite: boolean) => void;
}

export function RecognitionHistory({
  history,
  onSelectSong,
  currentSongId,
  onToggleFavorite,
}: RecognitionHistoryProps) {
  const { t } = useTranslation();

  if (history.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <Music2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No songs recognized yet</p>
          <p className="text-xs mt-1">Use the recognition button to identify songs</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3 px-2">{t('history.recentSongs')}</h3>
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {history.map((item, index) => {
            const isActive = item.songId === currentSongId;
            const date = new Date(item.timestamp);
            
            const handleFavoriteClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (onToggleFavorite) {
                onToggleFavorite(item.songId, item.isFavorite ?? false);
              }
            };

            return (
              <div
                key={`${item.songId}-${item.timestamp}-${index}`}
                className={cn(
                  "w-full text-left p-3 rounded-md transition-all relative group",
                  "hover-elevate active-elevate-2 cursor-pointer",
                  isActive && "bg-accent border-l-2 border-primary"
                )}
                onClick={() => onSelectSong(item.songId)}
                data-testid={`history-item-${item.songId}`}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded bg-muted flex items-center justify-center">
                    {item.albumArt ? (
                      <img
                        src={item.albumArt}
                        alt=""
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <Music2 className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.artist}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  {onToggleFavorite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleFavoriteClick}
                      className="flex-shrink-0"
                      data-testid={`button-favorite-${item.songId}`}
                    >
                      <Heart 
                        className={cn(
                          "h-4 w-4",
                          item.isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
                        )}
                      />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
