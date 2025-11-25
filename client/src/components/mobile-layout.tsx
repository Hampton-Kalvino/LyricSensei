import { useState, useEffect, useRef } from "react";
import { Music2, Menu, Info, Music, Heart, Share2, Globe, Search, Mic } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecognitionButton } from "@/components/recognition-button";
import { LanguageSelector } from "@/components/language-selector";
import { SongMetadata } from "@/components/song-metadata";
import { LyricDisplay } from "@/components/lyric-display";
import { RecognitionHistory } from "@/components/recognition-history";
import { SongSearch } from "@/components/song-search";
import { useSwipeable } from "react-swipeable";
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
  isProcessing?: boolean;
  recognitionProgress?: number;
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
  isProcessing = false,
  recognitionProgress = 0,
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
  const [isLandscape, setIsLandscape] = useState(window.innerHeight < window.innerWidth);

  useEffect(() => {
    const handleOrientationChange = () => {
      setIsLandscape(window.innerHeight < window.innerWidth);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

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

  // Swipe handlers with react-swipeable
  const handleSwipeLeft = () => {
    if (activePanel === 'menu') setActivePanel('lyrics');
    else if (activePanel === 'lyrics') setActivePanel('info');
  };

  const handleSwipeRight = () => {
    if (activePanel === 'info') setActivePanel('lyrics');
    else if (activePanel === 'lyrics') setActivePanel('menu');
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: handleSwipeLeft,
    onSwipedRight: handleSwipeRight,
    trackMouse: true,
  });

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
  const activeTabIndex = {
    'menu': 0,
    'lyrics': 1,
    'info': 2
  }[activePanel];

  return (
    <div className={cn("flex overflow-hidden bg-background w-full", isLandscape ? "flex-row h-screen" : "flex-col h-screen overflow-x-hidden")}>
      {/* LANDSCAPE MODE: Left Sidebar with Tabs */}
      {isLandscape && (
        <div className="w-20 flex-shrink-0 bg-card border-r border-border/50 flex flex-col items-center py-2 gap-1">
          <button
            onClick={() => setActivePanel('menu')}
            className={cn(
              "p-2 rounded-lg transition-colors",
              activePanel === 'menu' 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:bg-muted"
            )}
            data-testid="button-panel-menu"
            title={t('mobile.menu')}
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActivePanel('lyrics')}
            className={cn(
              "p-2 rounded-lg transition-colors",
              activePanel === 'lyrics' 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:bg-muted"
            )}
            data-testid="button-panel-lyrics"
            title={t('mobile.lyrics')}
          >
            <Music className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActivePanel('info')}
            className={cn(
              "p-2 rounded-lg transition-colors",
              activePanel === 'info' 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:bg-muted"
            )}
            data-testid="button-panel-info"
            title={t('mobile.albumInfo')}
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main Content Container */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* FIXED HEADER - Sticky at top */}
        <header className="flex-shrink-0 bg-background border-b sticky top-0 z-50 w-full">
          {isLandscape ? (
            // LANDSCAPE HEADER: Compact horizontal layout
            <>
              {/* Landscape Row 1: Language, Song Info, Search, Mic in one row */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLanguageSheet(true)}
                      className="h-8 text-xs px-2 flex-shrink-0"
                      data-testid="button-language-selector"
                    >
                      <Globe className="h-3.5 w-3.5 mr-1" />
                      <span className="truncate max-w-12">{selectedLanguage.toUpperCase()}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('settings.targetLanguage')}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Song Info - Compact */}
                <div className="flex items-center gap-2 flex-1 min-w-0 pl-2">
                  {currentSong.albumArt && (
                    <img
                      src={currentSong.albumArt}
                      alt={`${currentSong.album} cover`}
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                      data-testid="img-album-art-header"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold truncate leading-tight" data-testid="text-song-title-header">
                      {currentSong.title}
                    </h2>
                    <p className="text-xs text-muted-foreground truncate" data-testid="text-artist-header">
                      {currentSong.artist}
                    </p>
                  </div>
                </div>

                {/* Search & Mic - Compact */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="relative w-32 flex-shrink-0">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input 
                      placeholder="Search..."
                      className="w-full pl-7 h-8 text-xs"
                      data-testid="input-search"
                    />
                  </div>
                  <RecognitionButton
                    isListening={isListening}
                    isProcessing={isProcessing}
                    progress={recognitionProgress}
                    onStart={onStartListening}
                    onStop={onStopListening}
                    size="sm"
                    data-testid="button-recognize-header"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleShare}
                    className="h-8 w-8 flex-shrink-0"
                    data-testid="button-share-mobile"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  {onToggleFavorite && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleFavoriteToggle}
                      className="h-8 w-8 flex-shrink-0"
                      data-testid="button-favorite-mobile"
                    >
                      <Heart 
                        className={cn(
                          "h-4 w-4",
                          isFavorite ? "fill-red-500 text-red-500" : ""
                        )}
                      />
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            // PORTRAIT HEADER: 4-row layout
            <>
              {/* ROW 1: Language Selector (Compact) */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-muted/10">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLanguageSheet(true)}
                      className="h-7 text-xs px-2"
                      data-testid="button-language-selector"
                    >
                      <Globe className="h-3.5 w-3.5 mr-1.5" />
                      <span className="truncate max-w-16">{selectedLanguage.toUpperCase()}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('settings.targetLanguage')}</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* ROW 2: Song Info (Prominent) */}
              <div className="flex items-center gap-3 px-3 py-3 border-b border-border/20">
                {currentSong.albumArt && (
                  <img
                    src={currentSong.albumArt}
                    alt={`${currentSong.album} cover`}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0 shadow-sm"
                    data-testid="img-album-art-header"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold truncate leading-tight" data-testid="text-song-title-header">
                    {currentSong.title}
                  </h2>
                  <p className="text-sm text-muted-foreground truncate" data-testid="text-artist-header">
                    {currentSong.artist}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleShare}
                    className="h-9 w-9"
                    data-testid="button-share-mobile"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  {onToggleFavorite && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleFavoriteToggle}
                      className="h-9 w-9"
                      data-testid="button-favorite-mobile"
                    >
                      <Heart 
                        className={cn(
                          "h-4 w-4",
                          isFavorite ? "fill-red-500 text-red-500" : ""
                        )}
                      />
                    </Button>
                  )}
                </div>
              </div>

              {/* ROW 3: Search & Recognition */}
              <div className="px-3 pb-3 pt-2 flex gap-2 w-full border-b border-border/20">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input 
                    placeholder="Search songs..."
                    className="w-full pl-9 h-9 text-sm"
                    data-testid="input-search"
                  />
                </div>
                <RecognitionButton
                  isListening={isListening}
                  isProcessing={isProcessing}
                  progress={recognitionProgress}
                  onStart={onStartListening}
                  onStop={onStopListening}
                  size="sm"
                  data-testid="button-recognize-header"
                />
              </div>

              {/* ROW 4: Tab Bar */}
              <div className="flex w-full border-t border-border/50">
                <button
                  onClick={() => setActivePanel('menu')}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors",
                    "flex items-center justify-center gap-1.5",
                    activePanel === 'menu' 
                      ? "border-primary text-primary bg-primary/5" 
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  data-testid="button-panel-menu"
                >
                  <Menu className="w-4 h-4" />
                  <span>{t('mobile.menu')}</span>
                </button>
                <button
                  onClick={() => setActivePanel('lyrics')}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors",
                    "flex items-center justify-center gap-1.5",
                    activePanel === 'lyrics' 
                      ? "border-primary text-primary bg-primary/5" 
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  data-testid="button-panel-lyrics"
                >
                  <Music className="w-4 h-4" />
                  <span>{t('mobile.lyrics')}</span>
                </button>
                <button
                  onClick={() => setActivePanel('info')}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors",
                    "flex items-center justify-center gap-1.5",
                    activePanel === 'info' 
                      ? "border-primary text-primary bg-primary/5" 
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  data-testid="button-panel-info"
                >
                  <Info className="w-4 h-4" />
                  <span>{t('mobile.albumInfo')}</span>
                </button>
              </div>
            </>
          )}
        </header>

      {/* SWIPEABLE CONTENT AREA - Full Width */}
      <main 
        {...swipeHandlers}
        className="flex-1 overflow-hidden relative w-full"
      >
        <div 
          className="flex h-full transition-transform duration-300 ease-out w-full"
          style={{ transform: `translateX(-${activeTabIndex * 100}%)` }}
        >
          {/* Menu Tab - Full Width */}
          <div className="w-full h-full flex-shrink-0 overflow-y-auto scrollbar-hide">
            <div className="w-full p-4">
              <h3 className="text-sm font-semibold mb-3">{t('history.recentSongs')}</h3>
              <RecognitionHistory
                history={recognitionHistory}
                onSelectSong={onSelectSong}
                currentSongId={currentSong?.id}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
          </div>

          {/* Lyrics Tab - Full Width with Auto-Scroll Highlighting */}
          <div className="w-full h-full flex-shrink-0 overflow-y-auto scrollbar-hide">
            <LyricDisplay
              lyrics={lyrics}
              translations={translations}
              currentTime={currentTime}
              onLineClick={onTimeSeek}
              hasSyncedLyrics={currentSong.hasSyncedLyrics ?? false}
            />
          </div>

          {/* Album Info Tab - Full Width */}
          <div className="w-full h-full flex-shrink-0 overflow-y-auto scrollbar-hide">
            <div className="w-full p-4">
              <SongMetadata song={currentSong} />
            </div>
          </div>
        </div>
      </main>

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
    </div>
  );
}
