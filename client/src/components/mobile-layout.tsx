import { useState, useEffect, useRef, type TouchEvent } from "react";
import { Music2, Menu, Info, Music, Heart, Share2, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecognitionButton } from "@/components/recognition-button";
import { LanguageSelector } from "@/components/language-selector";
import { SongMetadata } from "@/components/song-metadata";
import { LyricDisplay } from "@/components/lyric-display";
import { RecognitionHistory } from "@/components/recognition-history";
import { SongSearch } from "@/components/song-search";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Song, LyricLine, Translation, LanguageCode, RecognitionResult } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/ChatGPT Image Nov 5, 2025, 05_37_31 PM_1762887933822.png";

interface MobileLayoutProps {
  currentSong: Song | undefined;
  lyrics: LyricLine[];
  translations: Translation[];
  selectedLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  currentTime: number;
  onTimeSeek: (time: number) => void;
  isListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  recognitionHistory: RecognitionResult[];
  topResearchedSongs: Array<Song & { recognitionCount: number }>;
  onSelectSong: (songId: string) => void;
  onSearchSelect: (artist: string, title: string, album: string, albumArt?: string, duration?: number) => void;
  isPremium: boolean;
  onToggleFavorite?: (songId: string, isFavorite: boolean) => void;
}

type ActivePanel = 'menu' | 'lyrics' | 'info';

export function MobileLayout({
  currentSong,
  lyrics,
  translations,
  selectedLanguage,
  onLanguageChange,
  currentTime,
  onTimeSeek,
  isListening,
  onStartListening,
  onStopListening,
  recognitionHistory,
  topResearchedSongs,
  onSelectSong,
  onSearchSelect,
  isPremium,
  onToggleFavorite,
}: MobileLayoutProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activePanel, setActivePanel] = useState<ActivePanel>('lyrics');
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);
  
  // Swipe functionality state
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const MIN_SWIPE_DISTANCE = 50; // Minimum distance for a swipe

  const handleShare = async () => {
    if (!currentSong) return;
    
    const shareUrl = `${window.location.origin}/share/${currentSong.id}`;
    const shareText = `Check out "${currentSong.title}" by ${currentSong.artist} on LyricSync!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentSong.title} - ${currentSong.artist}`,
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

  const handleFavoriteToggle = () => {
    if (!currentSong || !onToggleFavorite) return;
    
    // Need to check if song is favorited - using isFavorite from recognitionHistory
    const historyItem = recognitionHistory.find(item => item.songId === currentSong.id);
    const isFavorite = historyItem?.isFavorite ?? false;
    
    onToggleFavorite(currentSong.id, isFavorite);
  };

  // Swipe handlers
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    touchEndX.current = e.changedTouches[0].clientX;
    handleSwipe();
  };

  const handleSwipe = () => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    const absDistance = Math.abs(swipeDistance);
    
    // Only process swipes that meet minimum distance
    if (absDistance < MIN_SWIPE_DISTANCE) return;
    
    // Swipe left (next panel)
    if (swipeDistance > 0) {
      if (activePanel === 'menu') setActivePanel('lyrics');
      else if (activePanel === 'lyrics') setActivePanel('info');
    }
    // Swipe right (previous panel)
    else {
      if (activePanel === 'info') setActivePanel('lyrics');
      else if (activePanel === 'lyrics') setActivePanel('menu');
    }
  };

  // Reset to lyrics panel when song changes
  useEffect(() => {
    if (currentSong) {
      setActivePanel('lyrics');
    }
  }, [currentSong?.id]);

  // Pre-recognition view
  if (!currentSong) {
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-x-hidden w-full">
        {/* Search Header */}
        <div className="bg-card border-b sticky top-0 z-10 w-full">
          {/* Search & Language Row */}
          <div className="p-3 flex items-center gap-2">
            <div className="flex-1">
              <SongSearch onSelectSong={onSearchSelect} />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowLanguageSheet(true)}
                  className="h-12 w-12 flex-shrink-0"
                  data-testid="button-language-selector-pre"
                >
                  <Globe className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('settings.targetLanguage')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full p-4 pb-8 space-y-6">
            {/* Recognition Button */}
            <div className="flex justify-center pt-4">
              <RecognitionButton
                isListening={isListening}
                onStart={onStartListening}
                onStop={onStopListening}
                size="lg"
                data-testid="button-recognize"
              />
            </div>

            {/* How It Works */}
            <Card className="p-5 bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
              <h2 className="text-base font-semibold mb-3 text-center">{t('home.howItWorks')}</h2>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">1.</span>
                  <span>{t('home.step1')}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">2.</span>
                  <span>{t('home.step2')}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">3.</span>
                  <span>{t('home.step3')}</span>
                </li>
              </ol>
            </Card>

            {/* Recent Songs */}
            {recognitionHistory.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">{t('history.recentSongs')}</h3>
                <RecognitionHistory
                  history={recognitionHistory}
                  onSelectSong={onSelectSong}
                  onToggleFavorite={onToggleFavorite}
                />
              </div>
            )}

            {/* Top Researched Songs */}
            {topResearchedSongs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Top Researched Songs</h3>
                <div className="space-y-2">
                  {topResearchedSongs.map((song, index) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover-elevate active-elevate-2 cursor-pointer bg-card border"
                      onClick={() => onSelectSong(song.id)}
                      data-testid={`top-song-${index}`}
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">#{index + 1}</span>
                      </div>
                      {song.albumArt ? (
                        <img
                          src={song.albumArt}
                          alt={song.title}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Music2 className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{song.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      <div className="flex-shrink-0 text-xs text-muted-foreground">
                        {song.recognitionCount} plays
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Language Selector Sheet */}
        <Sheet open={showLanguageSheet} onOpenChange={setShowLanguageSheet}>
          <SheetContent side="bottom" className="h-auto">
            <SheetHeader>
              <SheetTitle>{t('settings.targetLanguage')}</SheetTitle>
              <SheetDescription>
                Select your preferred translation language
              </SheetDescription>
            </SheetHeader>
            <div className="py-4">
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={(lang) => {
                  onLanguageChange(lang);
                  setShowLanguageSheet(false);
                }}
                data-testid="select-language-sheet-pre"
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Post-recognition view with navigation
  const historyItem = recognitionHistory.find(item => item.songId === currentSong.id);
  const isFavorite = historyItem?.isFavorite ?? false;

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden w-full">
      {/* Two-Row Header - Fixed at top */}
      <div className="bg-card border-b sticky top-0 z-10 w-full">
        {/* Row 1: Song Metadata & Actions */}
        <div className="p-3 flex items-center gap-2">
          {currentSong.albumArt && (
            <img
              src={currentSong.albumArt}
              alt={`${currentSong.album} cover`}
              className="w-12 h-12 rounded object-cover flex-shrink-0"
              data-testid="img-album-art-header"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base leading-tight truncate" data-testid="text-song-title-header">
              {currentSong.title}
            </h1>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-artist-header">
              {currentSong.artist}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              onClick={handleShare}
              className="min-h-12 min-w-12 h-12 w-12 p-0 flex items-center justify-center shrink-0"
              data-testid="button-share-mobile"
            >
              <Share2 className="h-5 w-5" />
            </Button>
            {onToggleFavorite && (
              <Button
                variant="ghost"
                onClick={handleFavoriteToggle}
                className="min-h-12 min-w-12 h-12 w-12 p-0 flex items-center justify-center shrink-0"
                data-testid="button-favorite-mobile"
              >
                <Heart 
                  className={cn(
                    "h-5 w-5",
                    isFavorite ? "fill-red-500 text-red-500" : ""
                  )}
                />
              </Button>
            )}
            <RecognitionButton
              isListening={isListening}
              onStart={onStartListening}
              onStop={onStopListening}
              size="sm"
              data-testid="button-recognize-header"
            />
          </div>
        </div>

        {/* Row 2: Search Bar & Language Selector */}
        <div className="px-3 pb-3 flex items-center gap-2">
          <div className="flex-1">
            <SongSearch onSelectSong={onSearchSelect} />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLanguageSheet(true)}
                className="h-12 w-12 flex-shrink-0"
                data-testid="button-language-selector"
              >
                <Globe className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('settings.targetLanguage')}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Horizontal Navigation Bar - 3 Buttons */}
      <div className="flex items-center gap-1 px-2 py-2 bg-muted/30 border-b">
        <Button
          variant={activePanel === 'menu' ? "default" : "ghost"}
          onClick={() => setActivePanel('menu')}
          className="flex-1"
          data-testid="button-panel-menu"
        >
          <Menu className="w-5 h-5 mr-2" />
          {t('mobile.menu')}
        </Button>
        <Button
          variant={activePanel === 'lyrics' ? "default" : "ghost"}
          onClick={() => setActivePanel('lyrics')}
          className="flex-1"
          data-testid="button-panel-lyrics"
        >
          <Music className="w-5 h-5 mr-2" />
          {t('mobile.lyrics')}
        </Button>
        <Button
          variant={activePanel === 'info' ? "default" : "ghost"}
          onClick={() => setActivePanel('info')}
          className="flex-1"
          data-testid="button-panel-info"
        >
          <Info className="w-5 h-5 mr-2" />
          {t('mobile.albumInfo')}
        </Button>
      </div>

      {/* Panel Content */}
      <div 
        className="flex-1 overflow-y-auto w-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activePanel === 'menu' && (
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-3">{t('history.recentSongs')}</h3>
            <RecognitionHistory
              history={recognitionHistory}
              onSelectSong={onSelectSong}
              currentSongId={currentSong?.id}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        )}

        {activePanel === 'lyrics' && (
          <LyricDisplay
            lyrics={lyrics}
            translations={translations}
            currentTime={currentTime}
            onLineClick={onTimeSeek}
            hasSyncedLyrics={currentSong.hasSyncedLyrics ?? false}
          />
        )}

        {activePanel === 'info' && (
          <div className="p-4">
            <SongMetadata song={currentSong} />
          </div>
        )}
      </div>

      {/* Language Selector Sheet */}
      <Sheet open={showLanguageSheet} onOpenChange={setShowLanguageSheet}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>{t('settings.targetLanguage')}</SheetTitle>
            <SheetDescription>
              Select your preferred translation language
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <LanguageSelector
              selectedLanguage={selectedLanguage}
              onLanguageChange={(lang) => {
                onLanguageChange(lang);
                setShowLanguageSheet(false);
              }}
              data-testid="select-language-sheet"
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
