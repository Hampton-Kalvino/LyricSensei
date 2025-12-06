import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Music, Languages, Volume2, AlertCircle, Speaker, Mic, Check, X, GraduationCap, SkipForward, Flag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { LyricLine, Translation } from "@shared/schema";
import { 
  tokenizePhoneticWords, 
  calculateAccuracy, 
  getAccuracyTier, 
  getAccuracyFeedback,
  type WordPracticeState 
} from "@/lib/pronunciation-utils";
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { SpeechRecognition as CapacitorSpeechRecognition } from '@capacitor-community/speech-recognition';

type EmphasisMode = 'original' | 'translation' | 'phonetic';

interface LyricDisplayProps {
  lyrics: LyricLine[];
  translations: Translation[];
  currentTime: number;
  songId?: string;
  previewOffsetSeconds?: number;
  isLoading?: boolean;
  hasSyncedLyrics?: boolean;
  isActivePlayback?: boolean;
  onLineClick?: (time: number) => void;
}

export function LyricDisplay({
  lyrics,
  translations,
  currentTime,
  songId,
  previewOffsetSeconds = 0,
  isLoading = false,
  hasSyncedLyrics = true,
  isActivePlayback = false,
  onLineClick,
}: LyricDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const [emphasisMode, setEmphasisMode] = useState<EmphasisMode>('original');
  const [manualScrollLineIndex, setManualScrollLineIndex] = useState<number>(-1);
  const [clickedLineIndex, setClickedLineIndex] = useState<number>(-1); // Track explicitly clicked lines
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lineRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());
  const [selectedPhoneticIndex, setSelectedPhoneticIndex] = useState<number>(-1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const practiceRecognitionRef = useRef<any>(null); // Separate ref for practice mode
  const { toast } = useToast();
  
  // Practice mode state
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceLineIndex, setPracticeLineIndex] = useState<number>(-1);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [wordStates, setWordStates] = useState<WordPracticeState[]>([]);
  const [isPracticeListening, _setIsPracticeListening] = useState(false); // Separate state for practice mode
  const practiceSessionRef = useRef<number>(0); // Track active session to prevent stale callbacks
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track auto-advance timeout
  const practiceListeningRef = useRef(false); // Mirror state for use in guards
  const listeningResetTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track banner reset timeout
  const recognitionHandledRef = useRef(false); // Track if onresult or onerror has fired
  const maxListeningTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track maximum listening duration timeout
  
  // Wrapper to log all state changes and sync ref immediately
  const setIsPracticeListening = useCallback((value: boolean) => {
    const caller = new Error().stack?.split('\n')[2]?.trim();
    console.log(`[STATE CHANGE] setIsPracticeListening(${value}) called from:`, caller);
    practiceListeningRef.current = value; // Update ref immediately to prevent race conditions
    _setIsPracticeListening(value);
  }, []);
  
  // New state for score feedback
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [showScoreBanner, setShowScoreBanner] = useState(false);
  const scoreBannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Practice stats mutation
  const savePracticeStatsMutation = useMutation({
    mutationFn: async ({ songId, totalAttempts, successfulAttempts }: { songId: string; totalAttempts: number; successfulAttempts: number }) => {
      return apiRequest("POST", "/api/practice-stats", { songId, totalAttempts, successfulAttempts });
    },
  });

  // Feedback dialog state
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackLineIndex, setFeedbackLineIndex] = useState<number>(-1);
  const [feedbackType, setFeedbackType] = useState<'translation' | 'phonetic'>('translation');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Feedback mutation
  const sendFeedbackMutation = useMutation({
    mutationFn: async (data: {
      songId: string;
      lineIndex: number;
      originalLyric: string;
      translation: string;
      phoneticGuide: string;
      feedbackType: 'translation' | 'phonetic';
      message: string;
    }) => {
      return apiRequest('POST', '/api/feedback/lyric', data);
    },
    onSuccess: () => {
      toast({
        title: "Feedback sent",
        description: "Thank you for helping improve our translations!",
      });
      setFeedbackDialogOpen(false);
      setFeedbackMessage('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send feedback",
        variant: "destructive",
      });
    },
  });

  const openFeedbackDialog = (lineIndex: number) => {
    setFeedbackLineIndex(lineIndex);
    setFeedbackDialogOpen(true);
  };

  const handleSubmitFeedback = () => {
    console.log('[Feedback] handleSubmitFeedback called', { songId, feedbackLineIndex });
    
    if (!songId) {
      console.error('[Feedback] No songId available');
      toast({
        title: "Error",
        description: "Unable to submit feedback - song not identified",
        variant: "destructive",
      });
      return;
    }
    
    if (feedbackLineIndex < 0) {
      console.error('[Feedback] Invalid line index:', feedbackLineIndex);
      toast({
        title: "Error", 
        description: "Unable to submit feedback - no line selected",
        variant: "destructive",
      });
      return;
    }
    
    const lyric = lyrics[feedbackLineIndex];
    const translation = translations.find(t => t.originalText === lyric.text);
    
    console.log('[Feedback] Submitting feedback:', {
      songId,
      lineIndex: feedbackLineIndex,
      originalLyric: lyric?.text,
      translation: translation?.translatedText,
      phoneticGuide: translation?.phoneticGuide,
      feedbackType,
      message: feedbackMessage,
    });
    
    sendFeedbackMutation.mutate({
      songId,
      lineIndex: feedbackLineIndex,
      originalLyric: lyric?.text || '',
      translation: translation?.translatedText || '',
      phoneticGuide: translation?.phoneticGuide || '',
      feedbackType,
      message: feedbackMessage,
    });
  };

  // currentTime is already the absolute position in the song (set from previewOffsetSeconds on recognition)
  // No need to add offset again - just use currentTime directly
  const currentLineIndex = lyrics.findIndex(
    (line) => currentTime >= line.startTime && currentTime < line.endTime
  );

  // Determine which index to use for highlighting (priority order):
  // 1. Clicked line (highest priority - user explicitly selected it)
  // 2. Time-based index (when actively playing)
  // 3. Scroll-based index (when user is scrolling/browsing)
  const activeIndex = clickedLineIndex >= 0
    ? clickedLineIndex
    : isActivePlayback && currentLineIndex >= 0 
      ? currentLineIndex 
      : manualScrollLineIndex;

  // Handle user scroll detection (wheel, touch, programmatic)
  const handleUserScroll = useCallback(() => {
    setIsUserScrolling(true);
    setClickedLineIndex(-1); // Clear clicked line when user scrolls
    
    // Clear existing timeout
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    
    // Resume auto-scrolling after 300ms of no user interaction
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 300);
  }, []);

  // Setup scroll listeners for user interaction detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleUserScroll, { passive: true });
    container.addEventListener('touchstart', handleUserScroll, { passive: true });
    container.addEventListener('scroll', handleUserScroll, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleUserScroll);
      container.removeEventListener('touchstart', handleUserScroll);
      container.removeEventListener('scroll', handleUserScroll);
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, [handleUserScroll, lyrics.length]); // Re-attach after lyrics load to ensure ref is available

  // Reset and initialize manual scroll index when lyrics change  
  useEffect(() => {
    if (!isActivePlayback && lyrics.length > 0) {
      // Initialize to first visible line (around index 2-3 for better centering)
      setManualScrollLineIndex(Math.min(2, lyrics.length - 1));
      setClickedLineIndex(-1); // Clear clicked line on lyrics change
    } else if (isActivePlayback) {
      setManualScrollLineIndex(-1);
      setClickedLineIndex(-1); // Clear clicked line when playback starts
    }
  }, [lyrics, isActivePlayback]);

  // Setup IntersectionObserver for scroll-based highlighting
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // CRITICAL: Only create observer for VISIBLE containers (clientHeight > 0)
    // This prevents observing hidden duplicate containers on mobile/desktop
    if (container.clientHeight === 0) return;

    // Disconnect existing observer before creating new one
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create observer with center bias - stable callback
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the most centered visible line from ALL intersecting entries
        let mostCenteredIndex = -1;
        let minDistanceFromCenter = Infinity;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target instanceof HTMLElement) {
            const index = parseInt(entry.target.dataset.index || '-1');
            if (index >= 0) {
              const rect = entry.target.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              const containerCenter = containerRect.top + containerRect.height / 2;
              const elementCenter = rect.top + rect.height / 2;
              const distanceFromCenter = Math.abs(elementCenter - containerCenter);

              if (distanceFromCenter < minDistanceFromCenter) {
                minDistanceFromCenter = distanceFromCenter;
                mostCenteredIndex = index;
              }
            }
          }
        });

        if (mostCenteredIndex >= 0) {
          setManualScrollLineIndex(mostCenteredIndex);
        }
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1.0], // More thresholds for better tracking
        rootMargin: '-40% 0px -40% 0px', // Focus on center 20% of container
      }
    );

    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [lyrics.length]); // Re-run when lyrics load to ensure container ref is populated

  // Update activeLineRef based on activeIndex
  useEffect(() => {
    if (activeIndex >= 0) {
      const element = lineRefsMap.current.get(activeIndex);
      if (element) {
        activeLineRef.current = element;
      }
    }
  }, [activeIndex]);

  // Auto-scroll ONLY during active playback (not during manual scrolling)
  useEffect(() => {
    // Auto-scroll ONLY when:
    // 1. Active playback is happening (time-based highlighting)
    // 2. User is not actively scrolling
    // 
    // During manual scroll: IntersectionObserver handles highlighting passively
    // NO auto-scroll should occur - user controls scroll position
    const shouldAutoScroll = isActivePlayback && activeLineRef.current && containerRef.current && !isUserScrolling;
    
    if (shouldAutoScroll) {
      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      requestAnimationFrame(() => {
        if (activeLineRef.current && containerRef.current) {
          // Calculate scroll position to center active line within container
          const container = containerRef.current;
          const activeElement = activeLineRef.current;
          
          const containerHeight = container.clientHeight;
          const elementTop = activeElement.offsetTop;
          const elementHeight = activeElement.offsetHeight;
          
          // Center the element in the container
          const scrollTo = elementTop - (containerHeight / 2) + (elementHeight / 2);
          
          // Smooth scroll within container only (doesn't affect page scroll)
          container.scrollTo({
            top: scrollTo,
            behavior: "smooth",
          });
        }
      });
    }
  }, [isActivePlayback, currentLineIndex, isUserScrolling]); // Only trigger on playback changes, NOT manual scroll

  // Text-to-Speech function - Hybrid: Capacitor for native, Web Speech for web
  const speakPhonetic = useCallback(async (phoneticText: string, index: number) => {
    const isNative = Capacitor.isNativePlatform();
    console.log(`▶️ SPEECH (${isNative ? 'Native' : 'Web'}): Called with phoneticText:`, phoneticText);
    
    // Validate input
    if (!phoneticText || phoneticText.trim() === '' || phoneticText === '—') {
      toast({
        title: "No Phonetics",
        description: "Phonetic guide is not available for this line.",
        variant: "destructive",
      });
      return;
    }

    // PRONUNCIATION IMPROVEMENT: Clean phonetic text for TTS
    const cleanText = phoneticText
      .replace(/-([a-z])/gi, '$1')      // Remove hyphens within syllables
      .replace(/\b([a-z])\1+\b/gi, '$1') // Remove repeated letters
      .replace(/,\s*/g, ', ')           // Normalize commas with spaces
      .replace(/\s+/g, ' ')             // Normalize multiple spaces
      .trim();

    console.log('🧹 SPEECH: Cleaned text:', cleanText);

    if (!cleanText) {
      toast({
        title: "Invalid Text",
        description: "Could not process phonetic text.",
        variant: "destructive",
      });
      return;
    }

    // Use native Capacitor TTS on native platforms
    if (isNative) {
      // Toggle logic: if clicking same button while speaking, stop
      if (selectedPhoneticIndex === index && isSpeaking) {
        try {
          await TextToSpeech.stop();
        } catch (error) {
          console.error('Error stopping speech:', error);
        }
        setIsSpeaking(false);
        setSelectedPhoneticIndex(-1);
        console.log('⏹️ SPEECH (Native): Stopped');
        return;
      }

      setSelectedPhoneticIndex(index);
      setIsSpeaking(true);

      try {
        await TextToSpeech.stop();
        await TextToSpeech.speak({
          text: cleanText,
          lang: 'en-US',
          rate: 0.65,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
        });

        console.log('✅ SPEECH (Native): Completed');
        setIsSpeaking(false);
        setSelectedPhoneticIndex(-1);
      } catch (error) {
        console.error('❌ SPEECH (Native): Error -', error);
        setIsSpeaking(false);
        setSelectedPhoneticIndex(-1);
        
        toast({
          title: "Speech Error",
          description: "Could not speak the phonetic text. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // Use Web Speech API on web platforms
      if (!('speechSynthesis' in window)) {
        toast({
          title: "Not Supported",
          description: "Your browser doesn't support text-to-speech.",
          variant: "destructive",
        });
        return;
      }

      // Stop any current speech
      window.speechSynthesis.cancel();
      
      // Toggle logic: if clicking same button while speaking, stop
      if (selectedPhoneticIndex === index && isSpeaking) {
        setIsSpeaking(false);
        setSelectedPhoneticIndex(-1);
        console.log('⏹️ SPEECH (Web): Stopped');
        return;
      }

      setSelectedPhoneticIndex(index);
      setIsSpeaking(true);

      // Load voices
      let voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        await new Promise<void>((resolve) => {
          const handleVoicesChanged = () => {
            voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
              window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
              resolve();
            }
          };
          window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
          setTimeout(() => {
            window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
            resolve();
          }, 1000);
        });
        voices = window.speechSynthesis.getVoices();
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      utterance.rate = 0.65;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const englishVoice = voices.find(v => 
        v.lang.startsWith('en') && (
          v.name.includes('Google') || 
          v.name.includes('Natural') ||
          v.name.includes('US') ||
          v.name.includes('Female')
        )
      ) || voices.find(v => v.lang.startsWith('en'));
      
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onend = () => {
        setIsSpeaking(false);
        setSelectedPhoneticIndex(-1);
      };

      utterance.onerror = (event) => {
        setIsSpeaking(false);
        setSelectedPhoneticIndex(-1);
        
        if (event.error === 'interrupted' || event.error === 'canceled') {
          return;
        }
        
        let message = "Speech failed. Please try again.";
        if (event.error === 'not-allowed') {
          message = "Speech blocked. Please allow audio in your browser.";
        } else if (event.error === 'network') {
          message = "Network error. Check your connection.";
        }
        
        toast({
          title: "Speech Error",
          description: message,
          variant: "destructive",
        });
      };

      window.speechSynthesis.speak(utterance);
    }
    
  }, [selectedPhoneticIndex, isSpeaking, toast]);

  // Helper to save practice stats
  const savePracticeStats = useCallback(() => {
    if (isPracticeMode && songId && wordStates.length > 0) {
      const totalAttempts = wordStates.reduce((sum, w) => sum + w.attempts, 0);
      const successfulAttempts = wordStates.filter(w => w.status === 'success').length;
      
      if (totalAttempts > 0) {
        savePracticeStatsMutation.mutate(
          { songId, totalAttempts, successfulAttempts },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ['/api/practice-stats'] });
            },
            onError: (error) => {
              console.error("Failed to save practice stats:", error);
              toast({
                title: "Stats Not Saved",
                description: "Failed to save your practice statistics.",
                variant: "destructive",
              });
            },
          }
        );
      }
    }
  }, [isPracticeMode, songId, wordStates, savePracticeStatsMutation, toast, queryClient]);
  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log('[Cleanup] Component unmounting, resetting practice state');

      // Cancel text-to-speech
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      // Reset all refs
      practiceListeningRef.current = false;
      recognitionHandledRef.current = false;

      // Stop recognition if active
      if (practiceRecognitionRef.current) {
        try {
          practiceRecognitionRef.current.stop();
        } catch (e) {
          // Already stopped
        }
        practiceRecognitionRef.current = null;
      }

      // Clear all timeouts
      if (listeningResetTimeoutRef.current) {
        clearTimeout(listeningResetTimeoutRef.current);
        listeningResetTimeoutRef.current = null;
      }
      if (maxListeningTimeoutRef.current) {
        clearTimeout(maxListeningTimeoutRef.current);
        maxListeningTimeoutRef.current = null;
      }
      if (scoreBannerTimeoutRef.current) {
        clearTimeout(scoreBannerTimeoutRef.current);
        scoreBannerTimeoutRef.current = null;
      }
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    };
  }, []);
  // Centralized cleanup for practice mode
  const cleanupPracticeMode = useCallback(() => {
    const caller = new Error().stack?.split('\n')[2]?.trim();
    console.log('[CLEANUP] cleanupPracticeMode called from:', caller);
    practiceRecognitionRef.current?.stop();
    practiceRecognitionRef.current = null;
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    if (scoreBannerTimeoutRef.current) {
      clearTimeout(scoreBannerTimeoutRef.current);
      scoreBannerTimeoutRef.current = null;
    }
    if (listeningResetTimeoutRef.current) {
      clearTimeout(listeningResetTimeoutRef.current);
      listeningResetTimeoutRef.current = null;
    }
    if (maxListeningTimeoutRef.current) {
      clearTimeout(maxListeningTimeoutRef.current);
      maxListeningTimeoutRef.current = null;
    }
    setIsPracticeListening(false);
    setShowScoreBanner(false);
    setLastScore(null);
    practiceSessionRef.current++; // Invalidate any pending callbacks
  }, []);

  // Stop practice listening - for the Stop button on mobile
  const stopPracticeListening = useCallback(() => {
    console.log('[STOP] stopPracticeListening called');
    if (practiceRecognitionRef.current) {
      try {
        practiceRecognitionRef.current.stop();
        console.log('[STOP] Recognition stopped successfully');
      } catch (e) {
        console.log('[STOP] Recognition already stopped:', e);
      }
      practiceRecognitionRef.current = null;
    }
    practiceListeningRef.current = false;
    setIsPracticeListening(false);
  }, []);

  // Toggle Practice Mode
  const togglePracticeMode = useCallback((index: number, phoneticGuide: string) => {
    // ALWAYS save stats when exiting/switching practice mode
    savePracticeStats();
    
    if (isPracticeMode && practiceLineIndex === index) {
      // Exit practice mode completely
      cleanupPracticeMode(); // Stats already saved above
      setIsPracticeMode(false);
      setPracticeLineIndex(-1);
      setCurrentWordIndex(0);
      setWordStates([]);
    } else {
      // Validate phonetic guide exists
      if (!phoneticGuide || phoneticGuide === "—") {
        toast({
          title: "No Phonetics Available",
          description: "This line doesn't have phonetic pronunciation guides.",
          variant: "destructive",
        });
        return;
      }
      
      // Enter practice mode (or switch to different line)
      const words = tokenizePhoneticWords(phoneticGuide);
      
      // Ensure we have words to practice
      if (words.length === 0) {
        toast({
          title: "No Words Found",
          description: "Unable to split phonetics into words for practice.",
          variant: "destructive",
        });
        return;
      }
      
      // Cleanup previous session (stats already saved above)
      cleanupPracticeMode();
      
      setIsPracticeMode(true);
      setPracticeLineIndex(index);
      setCurrentWordIndex(0);
      setWordStates(words.map(word => ({
        word,
        status: 'pending',
        attempts: 0,
        bestScore: 0
      })));
      setSelectedPhoneticIndex(index);
    }
  }, [isPracticeMode, practiceLineIndex, toast, cleanupPracticeMode, savePracticeStats]);

  // Word-level speech recognition for practice mode
      const practiceWord = useCallback(async (wordIndex: number) => {
        console.log('[Practice Word] Called with index:', wordIndex, 'wordStates length:', wordStates.length);

        // ===== FIX #1: Better Guard - Check if ACTUALLY listening, not just ref =====
        // Only block if there's an active recognition session
        if (practiceRecognitionRef.current) {
          console.log('[Practice Word] Active recognition in progress, ignoring');
          return;
        }

        // Reset the ref just in case it's stuck
        practiceListeningRef.current = false;

        // Validate bounds
        if (wordIndex < 0 || wordIndex >= wordStates.length) {
          console.log('[Practice Word] Invalid word index:', wordIndex, 'out of bounds');
          toast({
            title: "Invalid Word",
            description: "Word index out of range.",
            variant: "destructive",
          });
          return;
        }

        // Capture current session and values
        const sessionId = practiceSessionRef.current;
        const expectedWord = wordStates[wordIndex].word;
        const totalWords = wordStates.length;

        console.log('[Practice Word] Starting recognition for word:', expectedWord);
        console.log('[Practice Word] Setting isPracticeListening to TRUE');

        // ===== FIX #2: Set state AND ref together =====
        practiceListeningRef.current = true;  // Set ref AFTER guard check
        setIsPracticeListening(true);
        recognitionHandledRef.current = false;

        console.log('[Practice Word] isPracticeListening state update called');

        const bannerStartTime = Date.now();

        // Platform detection: native (Android/iOS) vs web
        const isNative = Capacitor.isNativePlatform();
        console.log('[Practice Word] Platform:', isNative ? 'Native' : 'Web');

        if (isNative) {
          // Use Capacitor for mobile
          await handleCapacitorSpeech(expectedWord, wordIndex, sessionId, bannerStartTime, totalWords);
        } else {
          // Use Web Speech API for web
          handleWebSpeech(expectedWord, wordIndex, sessionId, bannerStartTime, totalWords);
        }
      }, [wordStates, toast]);

  // Web Speech API handler for web browsers
  const handleWebSpeech = useCallback((
    expectedWord: string,
    wordIndex: number,
    sessionId: number,
    bannerStartTime: number,
    totalWords: number
  ) => {
    let speechDetected = false;

    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
          console.log('[Practice Word] Browser does not support speech recognition');

          // ===== FIX #3: Reset ref on error =====
          practiceListeningRef.current = false;

          toast({
            title: "Not Supported",
            description: "Your browser doesn't support speech recognition. Try Chrome or Edge.",
            variant: "destructive",
          });

          if (listeningResetTimeoutRef.current) {
            clearTimeout(listeningResetTimeoutRef.current);
          }

          listeningResetTimeoutRef.current = setTimeout(() => {
            if (sessionId === practiceSessionRef.current) {
              setIsPracticeListening(false);
              listeningResetTimeoutRef.current = null;
            }
          }, 2000);
          return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          console.log('[Practice Word] ✅ Recognition ACTUALLY STARTED - microphone is now active');
        };

        recognition.onspeechstart = () => {
          console.log('[Practice Word] 🎤 User started speaking');
          speechDetected = true;  // ===== NEW: Mark that speech was detected ====
        };

        recognition.onspeechend = () => {
          console.log('[Practice Word] 🎤 User stopped speaking - will process results');
        };

        recognition.onresult = (event: any) => {
          if (sessionId !== practiceSessionRef.current) return;

          recognitionHandledRef.current = true;

          if (maxListeningTimeoutRef.current) {
            clearTimeout(maxListeningTimeoutRef.current);
            maxListeningTimeoutRef.current = null;
          }

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript.toLowerCase().trim();

            if (result.isFinal) {
              console.log('[Practice Word] 📝 Final transcript:', transcript);

              const accuracy = calculateAccuracy(expectedWord, transcript);
              const tier = getAccuracyTier(accuracy);
              const accuracyPercentage = Math.round(accuracy * 100);

              console.log(`[Practice Word] 🎯 Accuracy: ${accuracyPercentage}% (${tier})`);

              setWordStates(prev => {
                if (wordIndex >= prev.length) return prev;
                const updated = [...prev];
                const status = tier === 'close' ? 'retry' : tier;
                updated[wordIndex] = {
                  ...updated[wordIndex],
                  status,
                  attempts: updated[wordIndex].attempts + 1,
                  bestScore: Math.max(updated[wordIndex].bestScore, accuracy)
                };
                return updated;
              });

              setLastScore(accuracyPercentage);
              setShowScoreBanner(true);

              if (scoreBannerTimeoutRef.current) {
                clearTimeout(scoreBannerTimeoutRef.current);
              }
              scoreBannerTimeoutRef.current = setTimeout(() => {
                setShowScoreBanner(false);
                setLastScore(null);
              }, 3000);

              if (tier === 'success' && wordIndex < totalWords - 1) {
                setTimeout(() => {
                  if (sessionId === practiceSessionRef.current) {
                    setCurrentWordIndex(wordIndex + 1);
                  }
                }, 1000);
              }

              const elapsed = Date.now() - bannerStartTime;
              const remainingTime = Math.max(0, 2000 - elapsed);

              if (listeningResetTimeoutRef.current) {
                clearTimeout(listeningResetTimeoutRef.current);
              }

              listeningResetTimeoutRef.current = setTimeout(() => {
                if (sessionId === practiceSessionRef.current) {
                  // ===== FIX #4: Reset ref when done =====
                  practiceListeningRef.current = false;
                  setIsPracticeListening(false);
                  listeningResetTimeoutRef.current = null;
                }
              }, remainingTime);

              recognition.stop();
              break;
            }
          }
        };

        recognition.onerror = (event: any) => {
          if (sessionId !== practiceSessionRef.current) return;

          recognitionHandledRef.current = true;

          // ===== FIX #5: Reset ref on error =====
          practiceListeningRef.current = false;

          if (maxListeningTimeoutRef.current) {
            clearTimeout(maxListeningTimeoutRef.current);
            maxListeningTimeoutRef.current = null;
          }

          console.log('[Practice Word] Recognition error:', event.error);

          let errorMessage = "Recognition failed. Please try again.";

          if (event.error === 'not-allowed') {
            errorMessage = "Microphone access denied. Please allow microphone access in your browser settings.";
          } else if (event.error === 'no-speech') {
            errorMessage = "No speech detected. Please speak clearly into your microphone.";
          } else if (event.error === 'audio-capture') {
            errorMessage = "No microphone found. Please connect a microphone and try again.";
          } else if (event.error === 'aborted') {
            errorMessage = "Recognition was aborted. Please try again.";
          }

          const elapsed = Date.now() - bannerStartTime;
          const remainingTime = Math.max(0, 2000 - elapsed);

          setTimeout(() => {
            if (sessionId === practiceSessionRef.current && recognitionHandledRef.current) {
              toast({
                title: "Recognition Error",
                description: errorMessage,
                variant: "destructive",
              });
            }
          }, remainingTime);

          if (listeningResetTimeoutRef.current) {
            clearTimeout(listeningResetTimeoutRef.current);
          }

          listeningResetTimeoutRef.current = setTimeout(() => {
            if (sessionId === practiceSessionRef.current) {
              setIsPracticeListening(false);
              listeningResetTimeoutRef.current = null;
            }
          }, remainingTime);
        };

        recognition.onend = () => {
          console.log('[Practice Word] ⚠️ Recognition.onend fired! Session match:', sessionId === practiceSessionRef.current);
          
          if (sessionId !== practiceSessionRef.current) {
            console.log('[Practice Word] Session mismatch, ignoring onend');
            return;
          }

          // ===== IMPROVED FIX: Give onresult time to fire if speech was detected =====
          if (speechDetected) {
            console.log('[Practice Word] Speech was detected, giving onresult 500ms grace period to fire');
            
            // Wait 500ms for onresult to fire
            setTimeout(() => {
              if (sessionId !== practiceSessionRef.current) {
                console.log('[Practice Word] Session ended during grace period');
                return;
              }
              
              if (!recognitionHandledRef.current) {
                console.log('[Practice Word] Grace period expired, onresult never fired - treating as no result');
                handleNoResult();
              } else {
                console.log('[Practice Word] onresult fired during grace period, cleanup already done');
              }
            }, 500);
            
            return; // Don't immediately cleanup
          }

          // No speech detected at all
          console.log('[Practice Word] No speech detected, processing immediately');
          practiceListeningRef.current = false;
          
          if (recognitionHandledRef.current) {
            console.log('[Practice Word] Already handled by onresult/onerror');
            return;
          }
          
          handleNoResult();
        };

        // Helper function for no-result cleanup
        const handleNoResult = () => {
          console.log('[Practice Word] Recognition ended without result');
          
          const elapsed = Date.now() - bannerStartTime;
          const remainingTime = Math.max(0, 2000 - elapsed);

          if (listeningResetTimeoutRef.current) {
            clearTimeout(listeningResetTimeoutRef.current);
          }

          listeningResetTimeoutRef.current = setTimeout(() => {
            if (sessionId === practiceSessionRef.current && !recognitionHandledRef.current) {
              console.log('[Practice Word] Fallback timeout: resetting listening state');
              practiceListeningRef.current = false;
              setIsPracticeListening(false);
              listeningResetTimeoutRef.current = null;

              setLastScore(0);
              setShowScoreBanner(true);

              setWordStates(prev => {
                if (wordIndex >= prev.length) return prev;
                const updated = [...prev];
                updated[wordIndex] = {
                  ...updated[wordIndex],
                  status: 'retry',
                  attempts: updated[wordIndex].attempts + 1
                };
                return updated;
              });

              if (scoreBannerTimeoutRef.current) {
                clearTimeout(scoreBannerTimeoutRef.current);
              }
              scoreBannerTimeoutRef.current = setTimeout(() => {
                setShowScoreBanner(false);
                setLastScore(null);
              }, 3000);
            }
          }, remainingTime);
        };

        practiceRecognitionRef.current = recognition;
        console.log('[Practice Word] Calling recognition.start()...');

        try {
          recognition.start();
          console.log('[Practice Word] recognition.start() called successfully');

          if (maxListeningTimeoutRef.current) {
            clearTimeout(maxListeningTimeoutRef.current);
          }

          maxListeningTimeoutRef.current = setTimeout(() => {
            if (sessionId === practiceSessionRef.current && !recognitionHandledRef.current) {
              console.log('[Practice Word] Maximum listening timeout reached (10s)');
              // ===== FIX #7: Reset ref on timeout =====
              practiceListeningRef.current = false;
              recognition.stop();
            }
          }, 10000);

        } catch (error) {
          console.error('[Practice Word] Failed to start recognition:', error);

          // ===== FIX #8: Reset ref on start failure =====
          practiceListeningRef.current = false;
          setIsPracticeListening(false);

          toast({
            title: "Failed to Start",
            description: "Could not start speech recognition. Please try again.",
            variant: "destructive",
          });
        }
      }, [wordStates, toast, calculateAccuracy, getAccuracyTier, setWordStates, setLastScore, setShowScoreBanner, setCurrentWordIndex, setIsPracticeListening]);

  // Capacitor speech recognition handler for mobile platforms
  const handleCapacitorSpeech = useCallback(async (
    expectedWord: string,
    wordIndex: number,
    sessionId: number,
    bannerStartTime: number,
    totalWords: number
  ) => {
    try {
      // Check permission
      const hasPermission = await CapacitorSpeechRecognition.checkPermissions();
      
      if (hasPermission.speechRecognition !== 'granted') {
        const result = await CapacitorSpeechRecognition.requestPermissions();
        if (result.speechRecognition !== 'granted') {
          practiceListeningRef.current = false;
          setIsPracticeListening(false);
          toast({ title: "Permission Denied", description: "Microphone access required", variant: "destructive" });
          return;
        }
      }

      // Check availability
      const available = await CapacitorSpeechRecognition.available();
      if (!available.available) {
        practiceListeningRef.current = false;
        setIsPracticeListening(false);
        toast({ title: "Not Available", description: "Speech recognition unavailable on this device", variant: "destructive" });
        return;
      }

      let finalTranscript = '';
      let speechProcessed = false;
      let listenerCleanup: (() => void) | null = null;
      
      // Process recognition result
      const processResult = (transcript: string) => {
        if (speechProcessed || sessionId !== practiceSessionRef.current) return;
        speechProcessed = true;
        
        console.log('[Capacitor Speech] Processing result:', transcript);
        
        if (transcript) {
          const cleanTranscript = transcript.toLowerCase().trim();
          const accuracy = calculateAccuracy(expectedWord, cleanTranscript);
          const accuracyPercentage = Math.round(accuracy * 100);
          const tier = getAccuracyTier(accuracy);

          console.log(`[Capacitor Speech] 🎯 Accuracy: ${accuracyPercentage}% (${tier})`);

          setWordStates(prev => {
            if (wordIndex >= prev.length) return prev;
            const updated = [...prev];
            const status = tier === 'close' ? 'retry' : tier;
            updated[wordIndex] = {
              ...updated[wordIndex],
              status,
              attempts: updated[wordIndex].attempts + 1,
              bestScore: Math.max(updated[wordIndex].bestScore, accuracy)
            };
            return updated;
          });

          setLastScore(accuracyPercentage);
          setShowScoreBanner(true);

          if (scoreBannerTimeoutRef.current) clearTimeout(scoreBannerTimeoutRef.current);
          scoreBannerTimeoutRef.current = setTimeout(() => {
            setShowScoreBanner(false);
            setLastScore(null);
          }, 3000);

          if (tier === 'success' && wordIndex < totalWords - 1) {
            setTimeout(() => {
              if (sessionId === practiceSessionRef.current) {
                setCurrentWordIndex(wordIndex + 1);
              }
            }, 1000);
          }
        } else {
          console.log('[Capacitor Speech] No speech detected');
          setLastScore(0);
          setShowScoreBanner(true);
          setWordStates(prev => {
            if (wordIndex >= prev.length) return prev;
            const updated = [...prev];
            updated[wordIndex] = {
              ...updated[wordIndex],
              status: 'retry',
              attempts: updated[wordIndex].attempts + 1
            };
            return updated;
          });
          
          if (scoreBannerTimeoutRef.current) clearTimeout(scoreBannerTimeoutRef.current);
          scoreBannerTimeoutRef.current = setTimeout(() => {
            setShowScoreBanner(false);
            setLastScore(null);
          }, 3000);
        }

        // Reset listening state
        const elapsed = Date.now() - bannerStartTime;
        const remainingTime = Math.max(0, 2000 - elapsed);
        
        if (listeningResetTimeoutRef.current) clearTimeout(listeningResetTimeoutRef.current);
        listeningResetTimeoutRef.current = setTimeout(() => {
          if (sessionId === practiceSessionRef.current) {
            practiceListeningRef.current = false;
            setIsPracticeListening(false);
            practiceRecognitionRef.current = null;
            listeningResetTimeoutRef.current = null;
          }
        }, remainingTime);
      };
      
      // Listen for partial results - accumulate them
      const listener = await CapacitorSpeechRecognition.addListener('partialResults', (data: any) => {
        console.log('[Capacitor Speech] partialResults event:', JSON.stringify(data));
        if (data.matches && data.matches.length > 0) {
          finalTranscript = data.matches[0];
          console.log('[Capacitor Speech] 🎤 Heard:', finalTranscript);
        }
      });
      
      listenerCleanup = () => listener.remove();

      // Store a cleanup function in the ref so Stop button can call it
      practiceRecognitionRef.current = {
        stop: async () => {
          console.log('[Capacitor Speech] Manual stop triggered');
          try {
            await CapacitorSpeechRecognition.stop();
          } catch (e) {
            console.log('[Capacitor Speech] Stop error:', e);
          }
          if (listenerCleanup) listenerCleanup();
          processResult(finalTranscript);
        }
      };

      // Start listening
      await CapacitorSpeechRecognition.start({
        language: 'en-US',
        maxResults: 5,
        prompt: '',
        partialResults: true,
        popup: false,
      });

      console.log('[Capacitor Speech] ✅ Started listening - speak now!');

      // Wait for speech with shorter intervals, checking for early completion
      let elapsed = 0;
      const maxWait = 5000; // 5 seconds max
      const checkInterval = 500;
      
      while (elapsed < maxWait && !speechProcessed) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsed += checkInterval;
        
        // If we got a substantial transcript, process it early
        if (finalTranscript && finalTranscript.length > 2) {
          console.log('[Capacitor Speech] Got transcript, processing early:', finalTranscript);
          break;
        }
      }

      // Stop recognition if not already stopped
      if (!speechProcessed) {
        try {
          await CapacitorSpeechRecognition.stop();
        } catch (e) {
          console.log('[Capacitor Speech] Stop error (may already be stopped):', e);
        }
        if (listenerCleanup) listenerCleanup();
        
        console.log('[Capacitor Speech] Final transcript after wait:', finalTranscript);
        processResult(finalTranscript);
      }

    } catch (error: any) {
      console.error('[Capacitor Speech] Error:', error);
      practiceListeningRef.current = false;
      practiceRecognitionRef.current = null;
      setIsPracticeListening(false);
      toast({ title: "Recognition Failed", description: error?.message || "Unknown error", variant: "destructive" });
    }
  }, [calculateAccuracy, getAccuracyTier, setWordStates, setLastScore, setShowScoreBanner, setCurrentWordIndex, setIsPracticeListening, toast]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center space-y-3 py-4">
              <Skeleton className="h-10 w-3/4 max-w-2xl" />
              <Skeleton className="h-6 w-2/3 max-w-xl" />
              <Skeleton className="h-5 w-1/2 max-w-md" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (lyrics.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2">Lyrics Not Available</h3>
            <p className="text-muted-foreground text-sm">
              Lyrics for this song are not available in our database yet.
            </p>
            <p className="text-muted-foreground text-xs mt-3">
              You can listen to the full song on your favorite streaming platform using the links above.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Calculate overall practice stats
  const totalPracticeWords = wordStates.length;
  const successfulWords = wordStates.filter(w => w.status === 'success').length;
  const completionPercentage = totalPracticeWords > 0 ? Math.round((successfulWords / totalPracticeWords) * 100) : 0;

  return (
    <Card className="p-6 h-[600px] overflow-hidden flex flex-col">
      {/* Listening Banner */}
      {isPracticeMode && isPracticeListening && (
        <div className="mb-3 p-3 bg-primary/15 border-2 border-primary/50 rounded-md flex items-center justify-center gap-2 animate-pulse" data-testid="banner-listening">
          <Mic className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold text-primary">
            Speak now...
          </p>
        </div>
      )}

      {/* Score Banner */}
      {isPracticeMode && showScoreBanner && lastScore !== null && (
        <div className={cn(
          "mb-3 p-4 rounded-md border-2 flex items-center justify-center gap-3 transition-all",
          lastScore >= 80 
            ? "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300" 
            : lastScore >= 60
            ? "bg-yellow-500/20 border-yellow-500 text-yellow-700 dark:text-yellow-300"
            : "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300"
        )} data-testid="banner-score">
          {lastScore >= 80 ? (
            <>
              <Check className="h-6 w-6" />
              <div className="text-center">
                <p className="text-lg font-bold">Great Job! {lastScore}% Accurate</p>
                <p className="text-sm">Keep it up!</p>
              </div>
            </>
          ) : lastScore >= 60 ? (
            <>
              <AlertCircle className="h-6 w-6" />
              <div className="text-center">
                <p className="text-lg font-bold">Almost there! {lastScore}% Accurate</p>
                <p className="text-sm">Try again for better accuracy</p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-6 w-6" />
              <div className="text-center">
                <p className="text-lg font-bold">{lastScore}% - Keep Practicing</p>
                <p className="text-sm">Listen carefully and try again</p>
              </div>
            </>
          )}
        </div>
      )}

      {!hasSyncedLyrics && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Lyric sync is not available for this song. Timestamps are estimated and may not match the music.
          </p>
        </div>
      )}
      <div className="flex justify-center mb-4 pb-4 border-b">
        <ToggleGroup 
          type="single" 
          value={emphasisMode} 
          onValueChange={(value) => value && setEmphasisMode(value as EmphasisMode)}
          className="gap-1"
        >
          <ToggleGroupItem 
            value="original" 
            aria-label="Emphasize original lyrics"
            data-testid="toggle-emphasis-original"
            className="min-w-[44px] min-h-[44px]"
          >
            <Music className="h-4 w-4 mr-2" />
            Original
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="translation" 
            aria-label="Emphasize translation"
            data-testid="toggle-emphasis-translation"
            className="min-w-[44px] min-h-[44px]"
          >
            <Languages className="h-4 w-4 mr-2" />
            Translation
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="phonetic" 
            aria-label="Emphasize phonetic guide"
            data-testid="toggle-emphasis-phonetic"
            className="min-w-[44px] min-h-[44px]"
          >
            <Volume2 className="h-4 w-4 mr-2" />
            Phonetic
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4"
        data-testid="container-lyrics"
      >
        {lyrics.map((line, index) => {
          const isActive = index === activeIndex;
          const translation = translations[index];
          const hasTranslation = translation && (
            translation.translatedText !== line.text ||
            (translation.sourceLanguage && translation.sourceLanguage !== translation.targetLanguage)
          );

          return (
            <div
              key={line.id}
              ref={(el) => {
                if (el) {
                  lineRefsMap.current.set(index, el);
                  // Observe new element if observer exists
                  if (observerRef.current) {
                    observerRef.current.observe(el);
                  }
                } else {
                  // Unobserve and remove from map when element unmounts
                  const existingEl = lineRefsMap.current.get(index);
                  if (existingEl && observerRef.current) {
                    observerRef.current.unobserve(existingEl);
                  }
                  lineRefsMap.current.delete(index);
                }
              }}
              onClick={() => {
                setClickedLineIndex(index); // Track clicked line for highlighting
                onLineClick?.(line.startTime);
              }}
              className={cn(
                "py-6 px-4 transition-all duration-300 cursor-pointer text-center rounded-lg",
                "hover-elevate active-elevate-2",
                isActive
                  ? "scale-105 bg-primary/15 backdrop-blur-sm"
                  : "opacity-50"
              )}
              data-testid={`lyric-line-${index}`}
              data-index={index}
            >
              <p 
                className={cn(
                  "leading-relaxed transition-all duration-300",
                  isActive 
                    ? "text-3xl md:text-4xl mb-3" 
                    : "text-xl md:text-2xl",
                  emphasisMode === 'original'
                    ? "font-bold text-foreground"
                    : "font-medium text-muted-foreground"
                )}
              >
                {line.text}
              </p>
              
              {hasTranslation && (
                <>
                  <p 
                    className={cn(
                      "leading-relaxed transition-all duration-300 mt-2",
                      isActive 
                        ? "text-lg md:text-xl" 
                        : "text-base",
                      emphasisMode === 'translation'
                        ? "font-bold text-foreground"
                        : "font-normal text-muted-foreground"
                    )}
                  >
                    {translation.translatedText}
                  </p>
                  
                  {translation.phoneticGuide && translation.phoneticGuide !== "—" && (
                    <div className="mt-2 space-y-3">
                      {/* Normal Mode: Full line phonetics with controls */}
                      {(!isPracticeMode || practiceLineIndex !== index) && (
                        <div className="flex items-center justify-center gap-2">
                          <p 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPhoneticIndex(index === selectedPhoneticIndex ? -1 : index);
                            }}
                            className={cn(
                              "font-mono leading-relaxed transition-all duration-300 cursor-pointer px-3 py-2 rounded-md",
                              isActive 
                                ? "text-sm md:text-base" 
                                : "text-xs",
                              emphasisMode === 'phonetic'
                                ? "font-bold text-foreground"
                                : "font-normal text-muted-foreground",
                              selectedPhoneticIndex === index
                                ? "bg-primary/20 ring-2 ring-primary/50"
                                : "hover-elevate"
                            )}
                            data-testid={`phonetic-text-${index}`}
                          >
                            {translation.phoneticGuide}
                          </p>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                speakPhonetic(translation.phoneticGuide, index);
                              }}
                              className={cn(
                                "h-8 w-8 transition-all",
                                selectedPhoneticIndex === index && isSpeaking && "text-primary animate-pulse"
                              )}
                              data-testid={`button-speak-${index}`}
                              title="Listen to pronunciation"
                            >
                              <Speaker className="h-4 w-4" />
                            </Button>
                            {translation.phoneticGuide && translation.phoneticGuide !== "—" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePracticeMode(index, translation.phoneticGuide);
                                }}
                                className="h-8 w-8"
                                data-testid={`button-practice-mode-${index}`}
                                title="Word-by-word practice"
                                aria-label="Start word-by-word practice mode"
                              >
                                <GraduationCap className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                openFeedbackDialog(index);
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-orange-500"
                              data-testid={`button-feedback-${index}`}
                              title="Report incorrect translation or phonetic"
                              aria-label="Report feedback"
                            >
                              <Flag className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Practice Mode: Word-by-word panel */}
                      {isPracticeMode && practiceLineIndex === index && wordStates.length > 0 && (
                        <div className="p-4 rounded-lg bg-card/50 backdrop-blur-sm border border-primary/20 space-y-3">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium" data-testid="practice-mode-header">Word Practice</span>
                              <Badge variant="outline" className="text-xs" data-testid="practice-progress-indicator">
                                {currentWordIndex + 1} of {wordStates.length}
                              </Badge>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePracticeMode(index, translation.phoneticGuide);
                              }}
                              className="h-6 w-6"
                              data-testid="button-exit-practice"
                              aria-label="Exit practice mode"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Progress Bar */}
                          <Progress 
                            value={(wordStates.filter(w => w.status === 'success').length / wordStates.length) * 100} 
                            className="h-1.5"
                            data-testid="practice-progress-bar"
                            aria-label={`Progress: ${wordStates.filter(w => w.status === 'success').length} of ${wordStates.length} words completed`}
                          />

                          {/* Word Chips */}
                          <div className="flex flex-wrap gap-2 justify-center">
                            {wordStates.map((wordState, wordIdx) => (
                              <Badge
                                key={wordIdx}
                                variant={wordIdx === currentWordIndex ? 'default' : 'outline'}
                                className={cn(
                                  "font-mono px-3 py-1.5 cursor-pointer transition-all",
                                  wordState.status === 'success' && "bg-green-500/20 border-green-500 text-green-600 dark:text-green-400",
                                  wordState.status === 'retry' && "bg-red-500/20 border-red-500 text-red-600 dark:text-red-400",
                                  wordIdx === currentWordIndex && "ring-2 ring-primary scale-110"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentWordIndex(wordIdx);
                                }}
                                data-testid={`word-chip-${wordIdx}`}
                              >
                                {wordState.word}
                                {wordState.status === 'success' && <Check className="inline h-3 w-3 ml-1" />}
                              </Badge>
                            ))}
                          </div>

                          {/* Current Word Controls */}
                          <div className="flex items-center justify-center gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                speakPhonetic(wordStates[currentWordIndex].word, index);
                              }}
                              data-testid="button-practice-listen"
                              aria-label={`Listen to pronunciation of ${wordStates[currentWordIndex].word}`}
                            >
                              <Speaker className="h-4 w-4 mr-1" />
                              Listen
                            </Button>
                            <Button
                              size="sm"
                              variant={isPracticeListening ? "destructive" : "default"}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isPracticeListening) {
                                  console.log('[BUTTON CLICK] Stop button clicked - stopping recording');
                                  stopPracticeListening();
                                } else {
                                  console.log('[BUTTON CLICK] Speak button clicked! currentWordIndex:', currentWordIndex, 'wordStates:', wordStates);
                                  practiceWord(currentWordIndex);
                                }
                              }}
                              data-testid="button-practice-record"
                              aria-label={isPracticeListening ? "Stop recording" : `Record pronunciation of ${wordStates[currentWordIndex].word}`}
                              className={cn(isPracticeListening && "animate-pulse")}
                            >
                              <Mic className="h-4 w-4 mr-1" />
                              {isPracticeListening ? "Stop" : "Speak"}
                            </Button>
                            {currentWordIndex < wordStates.length - 1 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentWordIndex(currentWordIndex + 1);
                                }}
                                data-testid="button-practice-skip"
                                aria-label="Skip to next word"
                              >
                                <SkipForward className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          {/* Circular Completion Badge */}
                          {wordStates.some(w => w.attempts > 0) && (
                            <div className="pt-4 border-t flex flex-col items-center gap-3" data-testid="practice-completion-section">
                              <div className="relative w-32 h-32">
                                {/* Circular badge */}
                                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-900 to-purple-700 flex items-center justify-center border-4 border-yellow-500 shadow-lg" data-testid="badge-completion-circle">
                                  <div className="text-center">
                                    <div className="text-xs font-medium text-yellow-200 uppercase tracking-wide">
                                      Level
                                    </div>
                                    <div className="text-4xl font-bold text-yellow-300">
                                      {completionPercentage}
                                    </div>
                                    <div className="text-xs text-yellow-200">
                                      % Complete
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-center text-muted-foreground" data-testid="practice-statistics">
                                Success: {wordStates.filter(w => w.status === 'success').length}/{wordStates.length} words
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        <div className="h-80" />
      </div>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-orange-500" />
              Report Incorrect Content
            </DialogTitle>
            <DialogDescription>
              Help us improve by reporting errors in translations or pronunciation guides.
            </DialogDescription>
          </DialogHeader>
          
          {feedbackLineIndex >= 0 && lyrics[feedbackLineIndex] && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p className="font-medium">{lyrics[feedbackLineIndex]?.text}</p>
                {translations.find(t => t.originalText === lyrics[feedbackLineIndex]?.text)?.translatedText && (
                  <p className="text-muted-foreground">
                    {translations.find(t => t.originalText === lyrics[feedbackLineIndex]?.text)?.translatedText}
                  </p>
                )}
                {translations.find(t => t.originalText === lyrics[feedbackLineIndex]?.text)?.phoneticGuide && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {translations.find(t => t.originalText === lyrics[feedbackLineIndex]?.text)?.phoneticGuide}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>What's incorrect?</Label>
                <RadioGroup 
                  value={feedbackType} 
                  onValueChange={(v) => setFeedbackType(v as 'translation' | 'phonetic')}
                  className="flex gap-4"
                  data-testid="radio-group-feedback-type"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="translation" id="translation" data-testid="radio-feedback-translation" />
                    <Label htmlFor="translation" className="font-normal cursor-pointer">Translation</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="phonetic" id="phonetic" data-testid="radio-feedback-phonetic" />
                    <Label htmlFor="phonetic" className="font-normal cursor-pointer">Phonetic guide</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-message">Details (optional)</Label>
                <Textarea
                  id="feedback-message"
                  placeholder="Describe the issue or provide the correct version..."
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="textarea-feedback-message"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setFeedbackDialogOpen(false)}
              data-testid="button-cancel-feedback"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={sendFeedbackMutation.isPending}
              data-testid="button-submit-feedback"
            >
              {sendFeedbackMutation.isPending ? "Sending..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
