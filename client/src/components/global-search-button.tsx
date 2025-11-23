import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SongSearch } from "@/components/song-search";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RecognitionResult } from "@shared/schema";

export function GlobalSearchButton() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [showSearchSheet, setShowSearchSheet] = useState(false);
  const { toast } = useToast();

  // Manual song selection mutation - MUST be called before any conditional returns
  const manualSelectMutation = useMutation({
    mutationFn: async (data: { artist: string; title: string; album: string; albumArt?: string; duration?: number }) => {
      return apiRequest<RecognitionResult>("POST", "/api/songs/manual-select", data);
    },
    onSuccess: (result) => {
      // Close the sheet
      setShowSearchSheet(false);
      
      // Invalidate history query to refetch from database
      queryClient.invalidateQueries({ queryKey: ["/api/recognition-history"] });
      
      // Navigate to home with the song ID
      setLocation(`/?song=${result.songId}`);
      
      toast({
        title: "Song Selected!",
        description: `${result.title} by ${result.artist}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Selection Failed",
        description: error.message || "Could not select the song",
        variant: "destructive",
      });
    },
  });

  const handleSearchSelect = (artist: string, title: string, album: string, albumArt?: string, duration?: number) => {
    manualSelectMutation.mutate({ artist, title, album, albumArt, duration });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowSearchSheet(true)}
        data-testid="button-global-search"
      >
        <Search className="h-5 w-5" />
      </Button>

      <Sheet open={showSearchSheet} onOpenChange={setShowSearchSheet}>
        <SheetContent side="top" className="h-auto">
          <SheetHeader>
            <SheetTitle>{t('mobile.searchSongs')}</SheetTitle>
            <SheetDescription>
              Search for any song by title, artist, or album
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <SongSearch onSelectSong={handleSearchSelect} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
