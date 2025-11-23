import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { RecognitionButton } from "@/components/recognition-button";
import { LanguageSelector } from "@/components/language-selector";
import { SongMetadata } from "@/components/song-metadata";
import { LyricDisplay } from "@/components/lyric-display";
import { RecognitionHistory } from "@/components/recognition-history";
import { MobileLayout } from "@/components/mobile-layout";
import { AdBanner } from "@/components/ad-banner";
import { PremiumBanner } from "@/components/premium-banner";
import { VideoAdModal } from "@/components/video-ad-modal";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { SongSearch } from "@/components/song-search";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Song, LyricLine, Translation, RecognitionResult, LanguageCode } from "@shared/schema";
import { convertToWav } from "@/utils/audioConverter";

export default function Home() {
  const { toast } = useToast();
  const { user } = useAuth();
  const searchParams = useSearch();
  const songIdFromUrl = new URLSearchParams(searchParams).get('song');
  const isPremium = (user as any)?.isPremium ?? false;
  const [isListening, setIsListening] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>("en");
  const [currentSongId, setCurrentSongId] = useState<string | null>(songIdFromUrl);
  const [currentTime, setCurrentTime] = useState(0);
  const [translationRequestCount, setTranslationRequestCount] = useState(0);
  const [showVideoAd, setShowVideoAd] = useState(false);
  const [pwaPromptTrigger, setPwaPromptTrigger] = useState<'login' | 'recognition' | null>(null);
  const [isPlayingRecognizedSong, setIsPlayingRecognizedSong] = useState(false);
  const pendingTranslationRef = useRef<{ songId: string; language: string } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lyricsPollingStartRef = useRef<{ songId: string; startTime: number } | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const justRecognizedRef = useRef<boolean>(false);
  const hasShownLoginPWAPrompt = useRef<boolean>(false);
  
  // Set current song from URL parameter
  useEffect(() => {
    if (songIdFromUrl && songIdFromUrl !== currentSongId) {
      setCurrentSongId(songIdFromUrl);
      setCurrentTime(0);
      setIsPlayingRecognizedSong(false); // Don't auto-scroll for URL selections
    }
  }, [songIdFromUrl]);

  // Show PWA prompt after login (once per session)
  useEffect(() => {
    if (user && !hasShownLoginPWAPrompt.current) {
      hasShownLoginPWAPrompt.current = true;
      setPwaPromptTrigger('login');
    }
  }, [user]);

  // Fetch recognition history from database
  const { data: recognitionHistory = [] } = useQuery<RecognitionResult[]>({
    queryKey: ["/api/recognition-history?limit=50"],
    enabled: !!user,
  });

  // Fetch top researched songs (public endpoint)
  const { data: topResearchedSongs = [] } = useQuery<Array<Song & { recognitionCount: number }>>({
    queryKey: ["/api/songs/top-researched"],
  });

  // Fetch current song
  const { data: currentSong, isLoading: isSongLoading, isError: isSongError } = useQuery<Song>({
    queryKey: ["/api/songs", currentSongId],
    enabled: !!currentSongId,
  });

  // Fetch lyrics for current song
  const { data: lyrics = [], isLoading: isLyricsLoading, isError: isLyricsError } = useQuery<LyricLine[]>({
    queryKey: ["/api/lyrics", currentSongId],
    enabled: !!currentSongId,
    // Poll for lyrics every 2 seconds until they're found (lyrics load async after recognition)
    refetchInterval: (query) => {
      const data = query.state.data as LyricLine[] | undefined;
      
      // Initialize polling start time for new songs
      if (!lyricsPollingStartRef.current || lyricsPollingStartRef.current.songId !== currentSongId) {
        lyricsPollingStartRef.current = { songId: currentSongId!, startTime: Date.now() };
      }
      
      const elapsedSeconds = (Date.now() - lyricsPollingStartRef.current.startTime) / 1000;
      
      // Stop polling if we have lyrics or after 30 seconds
      if (data && data.length > 0) {
        console.log('[Lyrics] Found lyrics, stopping poll');
        lyricsPollingStartRef.current = null;
        return false;
      }
      if (elapsedSeconds > 30) {
        console.log('[Lyrics] Polling timeout after 30 seconds');
        lyricsPollingStartRef.current = null;
        return false;
      }
      
      return 2000;
    },
    // Always refetch when song changes to catch async-loaded lyrics
    staleTime: 0,
  });

  // Fetch translations
  const { data: translations = [], isLoading: isTranslationsLoading, isError: isTranslationsError, refetch: refetchTranslations } = useQuery<Translation[]>({
    queryKey: ["/api/translations", currentSongId, selectedLanguage],
    queryFn: async () => {
      const response = await fetch(`/api/translations/${currentSongId}/${selectedLanguage}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        
        // Check for daily limit error
        if (error.dailyLimitReached) {
          toast({
            title: "Daily Limit Reached",
            description: error.error,
            variant: "destructive",
          });
        }
        
        throw new Error(error.error || "Failed to fetch translations");
      }
      
      // Track translation requests for free users to show video ad
      if (!isPremium) {
        setTranslationRequestCount(prev => {
          const newCount = prev + 1;
          
          // Show video ad after 2nd translation
          if (newCount === 2) {
            setShowVideoAd(true);
          }
          
          return newCount;
        });
      }
      
      const data = await response.json();
      
      // DEBUG: Log received translation data
      console.log('🔍 TRANSLATION DATA RECEIVED:');
      console.log('  Total translations:', data.length);
      if (data.length > 0) {
        console.log('  First translation object:', JSON.stringify(data[0], null, 2));
        console.log('  phoneticGuide field:', data[0].phoneticGuide);
        console.log('  translatedText field:', data[0].translatedText);
      }
      
      return data;
    },
    enabled: !!currentSongId && lyrics.length > 0 && !showVideoAd,
  });

  // Song recognition mutation
  const recognizeMutation = useMutation({
    mutationFn: async (audioData: { audioData: string; duration: number }) => {
      return apiRequest<RecognitionResult>("POST", "/api/recognize", audioData);
    },
    onSuccess: (result) => {
      justRecognizedRef.current = true;
      setCurrentSongId(result.songId);
      setIsPlayingRecognizedSong(true); // Start auto-scroll for recognized songs
      
      // Invalidate history query to refetch from database
      queryClient.invalidateQueries({ queryKey: ["/api/recognition-history"] });
      
      // Start lyric sync from the recognized offset
      if (result.previewOffsetSeconds !== undefined) {
        setCurrentTime(result.previewOffsetSeconds);
      }
      
      // Show PWA install prompt after song recognition
      setPwaPromptTrigger('recognition');
      
      toast({
        title: "Song Recognized!",
        description: `${result.title} by ${result.artist}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Recognition Failed",
        description: error.message || "Could not identify the song",
        variant: "destructive",
      });
    },
  });

  // Manual song selection mutation (from search results)
  const manualSelectMutation = useMutation({
    mutationFn: async (data: { artist: string; title: string; album: string; albumArt?: string; duration?: number }) => {
      return apiRequest<RecognitionResult>("POST", "/api/songs/manual-select", data);
    },
    onSuccess: (result) => {
      justRecognizedRef.current = true;
      setCurrentSongId(result.songId);
      setIsPlayingRecognizedSong(false); // Don't auto-scroll for manually selected songs
      
      // Invalidate history query to refetch from database
      queryClient.invalidateQueries({ queryKey: ["/api/recognition-history"] });
      
      // Start from beginning for manual selections
      setCurrentTime(0);
      
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
  
  // Auto-increment timer for lyric sync - only runs for recognized songs
  useEffect(() => {
    if (currentSong && isPlayingRecognizedSong) {
      playbackTimerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 1;
          // Stop at song duration
          if (next >= currentSong.duration) {
            return currentSong.duration;
          }
          return next;
        });
      }, 1000);
      
      return () => {
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current);
        }
      };
    }
  }, [currentSong, isPlayingRecognizedSong]);
  
  // Reset timer when song changes (but not when just recognized)
  useEffect(() => {
    if (justRecognizedRef.current) {
      // Don't reset - we just set the offset in recognition handler
      justRecognizedRef.current = false;
      return;
    }
    
    // Reset for manual song selection from history
    setCurrentTime(0);
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
    }
  }, [currentSongId]);

  const handleStartListening = async () => {
    console.log('[Recognition] handleStartListening called');
    console.log('[Recognition] User logged in:', !!user);
    console.log('[Recognition] Navigator.mediaDevices available:', !!navigator.mediaDevices);
    console.log('[Recognition] MediaRecorder available:', !!window.MediaRecorder);
    
    // Show a toast to confirm the button was clicked
    toast({
      title: "Starting Recognition",
      description: "Requesting microphone access...",
    });
    
    try {
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('[Recognition] MediaDevices not supported');
        toast({
          title: "Microphone Not Supported",
          description: "Your browser doesn't support microphone access. Please use Chrome, Safari, or Firefox.",
          variant: "destructive",
        });
        return;
      }

      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        console.error('[Recognition] MediaRecorder not supported');
        toast({
          title: "Recording Not Supported",
          description: "Your browser doesn't support audio recording. Please update your browser.",
          variant: "destructive",
        });
        return;
      }

      console.log('[Recognition] All checks passed, requesting microphone access...');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 44100,
        } 
      });
      
      console.log('[Recognition] Microphone access granted!');
      console.log('[Recognition] Stream tracks:', stream.getTracks().length);
      
      // Now set listening state after permission granted
      setIsListening(true);
      
      audioChunksRef.current = [];
      
      // Determine supported MIME type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Use default
          }
        }
      }
      
      console.log('[Recognition] Using MIME type:', mimeType || 'default');
      
      // Create MediaRecorder
      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Collect audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = async () => {
        console.log('[Recognition] Recording stopped');
        console.log('[Recognition] Audio chunks collected:', audioChunksRef.current.length);
        
        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Check if we have any audio data
        if (audioChunksRef.current.length === 0) {
          console.error('[Recognition] No audio data collected!');
          toast({
            title: "No Audio Recorded",
            description: "No audio data was captured. Please try again and make sure to allow microphone access.",
            variant: "destructive",
          });
          setIsListening(false);
          return;
        }
        
        try {
          // Use the actual MIME type from MediaRecorder (important for mobile Safari/iOS)
          const actualMimeType = mediaRecorderRef.current?.mimeType || audioChunksRef.current[0]?.type || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
          console.log('[Recognition] Audio blob size:', audioBlob.size, 'bytes');
          console.log('[Recognition] Audio MIME type:', actualMimeType);
          
          // Check blob size
          if (audioBlob.size < 1000) {
            console.error('[Recognition] Audio blob too small:', audioBlob.size);
            toast({
              title: "Recording Too Short",
              description: "Not enough audio was recorded. Please try again and record for at least 5 seconds.",
              variant: "destructive",
            });
            setIsListening(false);
            return;
          }
          
          // Convert to WAV format for ACRCloud
          console.log('[Recognition] Converting to WAV format...');
          const wavBlob = await convertToWav(audioBlob);
          console.log('[Recognition] WAV blob size:', wavBlob.size, 'bytes');
          
          // Convert to base64
          const reader = new FileReader();
          reader.readAsDataURL(wavBlob);
          reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1];
            console.log('[Recognition] Base64 audio length:', base64Audio.length, 'characters');
            
            // Send to recognition API
            recognizeMutation.mutate({
              audioData: base64Audio,
              duration: 10,
            });
          };
        } catch (conversionError) {
          console.error('Audio conversion error:', conversionError);
          toast({
            title: "Audio Processing Error",
            description: "Failed to process audio. Please try again.",
            variant: "destructive",
          });
          setIsListening(false);
        }
      };
      
      // Start recording
      setIsListening(true);
      mediaRecorder.start();
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsListening(false);
        }
      }, 10000);
      
    } catch (error: any) {
      console.error('Microphone access error:', error);
      
      let errorMessage = "Please allow microphone access to recognize songs.";
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = "Microphone access was denied. Please check your browser settings and allow microphone access.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No microphone found. Please connect a microphone and try again.";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "Your browser doesn't support audio recording. Please use a different browser.";
      }
      
      toast({
        title: "Microphone Access Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setIsListening(false);
    }
  };

  const handleStopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  };

  const handleSelectSong = (songId: string) => {
    setCurrentSongId(songId);
    setCurrentTime(0);
    setIsPlayingRecognizedSong(false); // Don't auto-scroll when selecting from history
  };

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

  const handleToggleFavorite = (songId: string, isFavorite: boolean) => {
    toggleFavoriteMutation.mutate({ songId, isFavorite });
  };

  // Show error states with useEffect to prevent infinite loops
  useEffect(() => {
    if (isSongError) {
      toast({
        title: "Error Loading Song",
        description: "Could not load song details. Please try again.",
        variant: "destructive",
      });
    }
  }, [isSongError, toast]);

  useEffect(() => {
    if (isLyricsError) {
      toast({
        title: "Error Loading Lyrics",
        description: "Could not load lyrics for this song.",
        variant: "destructive",
      });
    }
  }, [isLyricsError, toast]);

  useEffect(() => {
    if (isTranslationsError) {
      toast({
        title: "Translation Error",
        description: "Could not translate lyrics. Please try a different language.",
        variant: "destructive",
      });
    }
  }, [isTranslationsError, toast]);

  const handleLineClick = (time: number) => {
    setCurrentTime(time);
  };

  // Handle song selection from search results
  const handleSearchSelect = (artist: string, title: string, album: string, albumArt?: string, duration?: number) => {
    manualSelectMutation.mutate({
      artist,
      title,
      album,
      albumArt,
      duration,
    });
  };

  return (
    <>
      {/* Mobile Layout (< lg breakpoint: 1024px) */}
      <div className="lg:hidden">
        <MobileLayout
          currentSong={currentSong}
          lyrics={lyrics}
          translations={translations}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          currentTime={currentTime}
          onTimeSeek={handleLineClick}
          isListening={isListening}
          onStartListening={handleStartListening}
          onStopListening={handleStopListening}
          recognitionHistory={recognitionHistory}
          topResearchedSongs={topResearchedSongs}
          onSelectSong={handleSelectSong}
          onSearchSelect={handleSearchSelect}
          isPremium={isPremium}
          onToggleFavorite={handleToggleFavorite}
        />
      </div>

      {/* Desktop Layout (>= lg breakpoint: 1024px) */}
      <div className="hidden lg:block space-y-6 p-6 max-w-[1800px] mx-auto">
        {/* Premium Banner for Free Users */}
        {!isPremium && <PremiumBanner />}

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-6">
        {/* Left Sidebar - Recognition & Language */}
        <div className="space-y-6">
        {/* Search & Language Selector */}
        <div className="p-4 bg-card rounded-lg border space-y-4">
          <div>
            <label className="text-sm font-medium">Search for Songs</label>
            <div className="mt-2">
              <SongSearch onSelectSong={handleSearchSelect} />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium">Target Language</label>
            <div className="mt-2">
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center p-6 bg-card rounded-lg border">
          <RecognitionButton
            isListening={isListening}
            isProcessing={recognizeMutation.isPending}
            onStartListening={handleStartListening}
            onStopListening={handleStopListening}
          />
        </div>

        <RecognitionHistory
          history={recognitionHistory}
          onSelectSong={handleSelectSong}
          currentSongId={currentSongId || undefined}
          onToggleFavorite={handleToggleFavorite}
        />

        {topResearchedSongs.length > 0 && (
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-lg font-semibold mb-3">Top Researched Songs</h3>
            <div className="space-y-2">
              {topResearchedSongs.map((song, index) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover-elevate active-elevate-2 cursor-pointer"
                  onClick={() => handleSelectSong(song.id)}
                  data-testid={`top-song-${index}`}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
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
                      <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
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

        {!isPremium && (
          <AdBanner format="vertical" slot="sidebar-left" />
        )}
      </div>

      {/* Center - Player & Lyrics */}
      <div className="space-y-6">
        {currentSong ? (
          <>
            <LyricDisplay
              lyrics={lyrics}
              translations={translations}
              currentTime={currentTime}
              songId={currentSongId || undefined}
              previewOffsetSeconds={currentSong.previewOffsetSeconds ?? 0}
              isLoading={isLyricsLoading || isTranslationsLoading}
              hasSyncedLyrics={currentSong.hasSyncedLyrics ?? true}
              isActivePlayback={isPlayingRecognizedSong}
              onLineClick={handleLineClick}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-[600px] bg-card rounded-lg border">
            <div className="text-center space-y-4 max-w-md px-6">
              <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">No Song Selected</h2>
                <p className="text-muted-foreground">
                  Tap the recognition button to identify a song playing nearby, or select from your recent history
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Song Info */}
      <div className="space-y-6">
        {currentSong ? (
          <>
            <SongMetadata song={currentSong} />
            <div className="p-6 bg-card rounded-lg border space-y-4">
              <h3 className="text-sm font-semibold">Learning Tips</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  • Click any lyric line to jump to that part of the song
                </p>
                <p>
                  • Use the phonetic guide to practice pronunciation
                </p>
                <p>
                  • Change languages to compare translations
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 bg-card rounded-lg border">
            <h3 className="text-sm font-semibold mb-3">How It Works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
              <li>Play music from any source nearby</li>
              <li>Tap the microphone button to recognize</li>
              <li>Select your target language</li>
              <li>Follow along with real-time translations</li>
              <li>Learn pronunciation with phonetic guides</li>
            </ol>
          </div>
        )}

        {!isPremium && (
          <AdBanner format="rectangle" slot="sidebar-right" />
        )}
      </div>
      </div>

      {/* Video Ad Modal (after 2nd translation for free users) */}
      <VideoAdModal 
        isOpen={showVideoAd && !isPremium} 
        onClose={() => {
          setShowVideoAd(false);
          // Resume translation loading after ad is closed
          if (currentSongId && lyrics.length > 0) {
            refetchTranslations();
          }
        }} 
      />

      {/* PWA Install Prompt (after login and after each song recognition) */}
      <PWAInstallPrompt 
        trigger={pwaPromptTrigger}
        onClose={() => setPwaPromptTrigger(null)}
      />
    </div>
    </>
  );
}
