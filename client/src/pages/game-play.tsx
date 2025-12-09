import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Zap, Flame, Shuffle, Play, RotateCcw, Trophy, Clock, Check, X, Mic, Volume2, Loader2 } from "lucide-react";
import { playSuccessChime, playErrorBuzzer } from "@/lib/audio-sfx";
import type { GameSession } from "@shared/schema";

const GAME_DURATION = 60000;
const LINES_PER_GAME = 10;
const MAX_SCORE = 100;
const POINTS_PER_LINE = MAX_SCORE / LINES_PER_GAME;

interface WordMatchLine {
  id: string;
  original: string;
  translation: string;
  songTitle: string;
  songArtist: string;
}

interface PronunciationWord {
  id: string;
  original: string;
  phonetic: string;
  language: string;
  songTitle: string;
  songArtist: string;
}

interface MatchGameState {
  status: 'idle' | 'loading' | 'playing' | 'finished';
  score: number;
  correctMatches: number;
  totalAttempts: number;
  lines: WordMatchLine[];
  shuffledTranslations: Array<{ id: string; translation: string; matched: boolean }>;
  currentOriginalIndex: number;
  selectedTranslationId: string | null;
  feedback: 'correct' | 'wrong' | null;
  startTime?: number;
}

interface SpeechGameState {
  status: 'idle' | 'loading' | 'playing' | 'listening' | 'finished';
  score: number;
  streak: number;
  bestStreak: number;
  timeRemaining: number;
  currentWordIndex: number;
  words: PronunciationWord[];
  attempts: Array<{ word: string; correct: boolean; transcript?: string }>;
  startTime?: number;
  lastTranscript: string;
  feedback: 'correct' | 'wrong' | null;
}

const FALLBACK_WORDS: PronunciationWord[] = [
  { id: "1", original: "Hello", phonetic: "heh-LOH", language: "en", songTitle: "Sample", songArtist: "Demo" },
  { id: "2", original: "Bonjour", phonetic: "bohn-ZHOOR", language: "fr", songTitle: "Sample", songArtist: "Demo" },
  { id: "3", original: "Hola", phonetic: "OH-lah", language: "es", songTitle: "Sample", songArtist: "Demo" },
  { id: "4", original: "Guten Tag", phonetic: "GOO-ten tahk", language: "de", songTitle: "Sample", songArtist: "Demo" },
  { id: "5", original: "Ciao", phonetic: "CHOW", language: "it", songTitle: "Sample", songArtist: "Demo" },
  { id: "6", original: "Konnichiwa", phonetic: "kohn-nee-chee-WAH", language: "ja", songTitle: "Sample", songArtist: "Demo" },
  { id: "7", original: "Annyeong", phonetic: "ahn-NYUHNG", language: "ko", songTitle: "Sample", songArtist: "Demo" },
  { id: "8", original: "Ni hao", phonetic: "nee HOW", language: "zh", songTitle: "Sample", songArtist: "Demo" },
  { id: "9", original: "Obrigado", phonetic: "oh-bree-GAH-doo", language: "pt", songTitle: "Sample", songArtist: "Demo" },
  { id: "10", original: "Spasibo", phonetic: "spah-SEE-bah", language: "ru", songTitle: "Sample", songArtist: "Demo" },
];

function getLanguageLocale(langCode: string): string {
  const localeMap: Record<string, string> = {
    'en': 'en-US',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-BR',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
    'zh-Hans': 'zh-CN',
    'ru': 'ru-RU',
  };
  return localeMap[langCode] || 'en-US';
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const s2 = str2.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  if (s1 === s2) return 100;
  
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  let matchCount = 0;
  for (const w1 of words1) {
    if (words2.some(w2 => w1 === w2 || (w1.length > 3 && w2.includes(w1)) || (w2.length > 3 && w1.includes(w2)))) {
      matchCount++;
    }
  }
  
  return Math.round((matchCount / Math.max(words1.length, 1)) * 100);
}

export default function GamePlayPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { gameType } = useParams<{ gameType: string }>();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const [matchState, setMatchState] = useState<MatchGameState>({
    status: 'idle',
    score: 0,
    correctMatches: 0,
    totalAttempts: 0,
    lines: [],
    shuffledTranslations: [],
    currentOriginalIndex: 0,
    selectedTranslationId: null,
    feedback: null,
  });

  const [speechState, setSpeechState] = useState<SpeechGameState>({
    status: 'idle',
    score: 0,
    streak: 0,
    bestStreak: 0,
    timeRemaining: GAME_DURATION,
    currentWordIndex: 0,
    words: [],
    attempts: [],
    lastTranscript: '',
    feedback: null,
  });

  const { refetch: refetchLines } = useQuery<WordMatchLine[]>({
    queryKey: ['/api/games/word-match-lines', 'en', LINES_PER_GAME],
    queryFn: () => apiRequest<WordMatchLine[]>('GET', `/api/games/word-match-lines?targetLanguage=en&count=${LINES_PER_GAME}`),
    enabled: false,
  });

  const { refetch: refetchPronunciationWords } = useQuery<PronunciationWord[]>({
    queryKey: ['/api/games/pronunciation-words', LINES_PER_GAME],
    queryFn: () => apiRequest<PronunciationWord[]>('GET', `/api/games/pronunciation-words?count=${LINES_PER_GAME}`),
    enabled: false,
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<GameSession>('POST', '/api/games/sessions', { gameType });
    },
    onSuccess: (data) => {
      setSessionId(data.id);
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: async (data: { score: number; accuracyPct: number; bestStreak: number; wordsCompleted: number; durationMs: number }) => {
      if (!sessionId) return;
      return apiRequest('POST', `/api/games/sessions/${sessionId}/complete`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/games/leaderboard'] });
    },
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const speakWord = useCallback((text: string, lang: string) => {
    if (!synthRef.current) return;
    
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getLanguageLocale(lang);
    utterance.rate = 0.8;
    synthRef.current.speak(utterance);
  }, []);

  const [speechSupported, setSpeechSupported] = useState(true);

  const startListening = useCallback((expectedWord: string, lang: string, onResult: (transcript: string, isCorrect: boolean) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      toast({
        title: t('games.speechNotSupported', 'Speech Recognition Not Supported'),
        description: t('games.useManualMode', 'Using manual scoring mode instead.'),
      });
      setSpeechState(prev => ({ ...prev, status: 'playing' }));
      return false;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = getLanguageLocale(lang);
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;
      recognition.continuous = false;

      recognition.onresult = (event: any) => {
        let bestMatch = '';
        let bestSimilarity = 0;
        
        for (let i = 0; i < event.results[0].length; i++) {
          const transcript = event.results[0][i].transcript;
          const similarity = calculateSimilarity(transcript, expectedWord);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = transcript;
          }
        }
        
        const isCorrect = bestSimilarity >= 40;
        onResult(bestMatch, isCorrect);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setSpeechState(prev => ({ ...prev, status: 'playing' }));
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          setSpeechSupported(false);
        }
      };

      recognition.onend = () => {
        setSpeechState(prev => prev.status === 'listening' ? { ...prev, status: 'playing' } : prev);
      };

      recognitionRef.current = recognition;
      recognition.start();
      return true;
    } catch (error) {
      console.error('Speech recognition error:', error);
      setSpeechSupported(false);
      setSpeechState(prev => ({ ...prev, status: 'playing' }));
      return false;
    }
  }, [toast, t]);

  const startWordMatchGame = useCallback(async () => {
    setMatchState(prev => ({ ...prev, status: 'loading' }));
    createSessionMutation.mutate();
    
    const result = await refetchLines();
    const lines = result.data || [];
    
    if (lines.length === 0) {
      toast({ 
        title: t('games.noLinesAvailable', 'No lyrics available'),
        description: t('games.listenToSongsFirst', 'Listen to some songs first to play this game!'),
        variant: 'destructive'
      });
      setMatchState(prev => ({ ...prev, status: 'idle' }));
      return;
    }

    const shuffled = [...lines].map(l => ({ id: l.id, translation: l.translation, matched: false }))
      .sort(() => Math.random() - 0.5);

    setMatchState({
      status: 'playing',
      score: 0,
      correctMatches: 0,
      totalAttempts: 0,
      lines,
      shuffledTranslations: shuffled,
      currentOriginalIndex: 0,
      selectedTranslationId: null,
      feedback: null,
      startTime: Date.now(),
    });
  }, [refetchLines, createSessionMutation, toast, t]);

  const startSpeechGame = useCallback(async () => {
    setSpeechState(prev => ({ ...prev, status: 'loading' }));
    createSessionMutation.mutate();
    
    let words: PronunciationWord[] = [];
    
    try {
      const result = await refetchPronunciationWords();
      words = result.data || [];
    } catch (error) {
      console.error('Failed to fetch pronunciation words:', error);
    }
    
    if (words.length < LINES_PER_GAME) {
      const neededCount = LINES_PER_GAME - words.length;
      const fallbackShuffled = [...FALLBACK_WORDS].sort(() => Math.random() - 0.5);
      words = [...words, ...fallbackShuffled.slice(0, neededCount)];
    }

    const gameWords = words.sort(() => Math.random() - 0.5).slice(0, LINES_PER_GAME);

    setSpeechState({
      status: 'playing',
      score: 0,
      streak: 0,
      bestStreak: 0,
      timeRemaining: GAME_DURATION,
      currentWordIndex: 0,
      words: gameWords,
      attempts: [],
      startTime: Date.now(),
      lastTranscript: '',
      feedback: null,
    });
  }, [refetchPronunciationWords, createSessionMutation]);

  const handleTranslationSelect = useCallback((translationId: string) => {
    if (matchState.status !== 'playing' || matchState.feedback) return;
    
    const currentLine = matchState.lines[matchState.currentOriginalIndex];
    const isCorrect = currentLine.id === translationId;

    if (isCorrect) {
      playSuccessChime();
    } else {
      playErrorBuzzer();
    }

    setMatchState(prev => ({
      ...prev,
      selectedTranslationId: translationId,
      feedback: isCorrect ? 'correct' : 'wrong',
      score: isCorrect ? prev.score + POINTS_PER_LINE : prev.score,
      correctMatches: isCorrect ? prev.correctMatches + 1 : prev.correctMatches,
      totalAttempts: prev.totalAttempts + 1,
    }));

    setTimeout(() => {
      setMatchState(prev => {
        const newTranslations = prev.shuffledTranslations.map(t => 
          t.id === currentLine.id ? { ...t, matched: true } : t
        );
        const nextIndex = prev.currentOriginalIndex + 1;
        
        if (nextIndex >= prev.lines.length) {
          const durationMs = prev.startTime ? Date.now() - prev.startTime : 0;
          const accuracyPct = prev.totalAttempts > 0 ? (prev.correctMatches / prev.totalAttempts) * 100 : 0;
          
          completeSessionMutation.mutate({
            score: Math.round(prev.score),
            accuracyPct,
            bestStreak: prev.correctMatches,
            wordsCompleted: prev.lines.length,
            durationMs,
          });
          
          return { ...prev, status: 'finished', shuffledTranslations: newTranslations, feedback: null };
        }
        
        return {
          ...prev,
          currentOriginalIndex: nextIndex,
          selectedTranslationId: null,
          feedback: null,
          shuffledTranslations: newTranslations,
        };
      });
    }, 800);
  }, [matchState.status, matchState.feedback, matchState.lines, matchState.currentOriginalIndex, completeSessionMutation]);

  const handleManualAnswer = useCallback((isCorrect: boolean) => {
    if (speechState.status !== 'playing' && speechState.status !== 'listening') return;
    if (speechState.currentWordIndex >= speechState.words.length) return;
    
    const currentWord = speechState.words[speechState.currentWordIndex];
    if (!currentWord) return;

    if (isCorrect) {
      playSuccessChime();
    } else {
      playErrorBuzzer();
    }

    setSpeechState(prev => {
      const newStreak = isCorrect ? prev.streak + 1 : 0;
      const newBestStreak = Math.max(prev.bestStreak, newStreak);
      const scoreIncrease = isCorrect ? POINTS_PER_LINE : 0;
      
      const newAttempts = [...prev.attempts, { word: currentWord.original, correct: isCorrect, transcript: 'manual' }];
      const nextIndex = prev.currentWordIndex + 1;
      
      return {
        ...prev,
        score: prev.score + scoreIncrease,
        streak: newStreak,
        bestStreak: newBestStreak,
        currentWordIndex: nextIndex,
        attempts: newAttempts,
        feedback: isCorrect ? 'correct' : 'wrong',
      };
    });

    setTimeout(() => {
      setSpeechState(prev => {
        if (prev.currentWordIndex >= prev.words.length) {
          const durationMs = prev.startTime ? Date.now() - prev.startTime : 0;
          const totalCorrect = prev.attempts.filter(a => a.correct).length;
          const accuracyPct = prev.attempts.length > 0 ? (totalCorrect / prev.attempts.length) * 100 : 0;
          
          completeSessionMutation.mutate({
            score: Math.round(prev.score),
            accuracyPct,
            bestStreak: prev.bestStreak,
            wordsCompleted: prev.attempts.length,
            durationMs,
          });
          
          return { ...prev, status: 'finished', feedback: null };
        }
        return { ...prev, feedback: null };
      });
    }, 500);
  }, [speechState.status, speechState.words, speechState.currentWordIndex, completeSessionMutation]);

  const handleSpeakAndListen = useCallback(() => {
    if (speechState.status !== 'playing') return;
    if (speechState.currentWordIndex >= speechState.words.length) return;
    
    const currentWord = speechState.words[speechState.currentWordIndex];
    if (!currentWord) return;

    speakWord(currentWord.original, currentWord.language);
    
    if (!speechSupported) {
      return;
    }
    
    setTimeout(() => {
      setSpeechState(prev => ({ ...prev, status: 'listening', lastTranscript: '' }));
      
      const success = startListening(currentWord.original, currentWord.language, (transcript, isCorrect) => {
        if (isCorrect) {
          playSuccessChime();
        } else {
          playErrorBuzzer();
        }

        setSpeechState(prev => {
          const newStreak = isCorrect ? prev.streak + 1 : 0;
          const newBestStreak = Math.max(prev.bestStreak, newStreak);
          const scoreIncrease = isCorrect ? POINTS_PER_LINE : 0;
          
          const newAttempts = [...prev.attempts, { word: currentWord.original, correct: isCorrect, transcript }];
          const nextIndex = prev.currentWordIndex + 1;
          
          return {
            ...prev,
            status: 'playing',
            score: prev.score + scoreIncrease,
            streak: newStreak,
            bestStreak: newBestStreak,
            currentWordIndex: nextIndex <= prev.words.length ? nextIndex : prev.currentWordIndex,
            attempts: newAttempts,
            lastTranscript: transcript,
            feedback: isCorrect ? 'correct' : 'wrong',
          };
        });

        setTimeout(() => {
          setSpeechState(prev => {
            if (prev.currentWordIndex >= prev.words.length) {
              const durationMs = prev.startTime ? Date.now() - prev.startTime : 0;
              const totalCorrect = prev.attempts.filter(a => a.correct).length;
              const accuracyPct = prev.attempts.length > 0 ? (totalCorrect / prev.attempts.length) * 100 : 0;
              
              completeSessionMutation.mutate({
                score: Math.round(prev.score),
                accuracyPct,
                bestStreak: prev.bestStreak,
                wordsCompleted: prev.attempts.length,
                durationMs,
              });
              
              return { ...prev, status: 'finished', feedback: null };
            }
            return { ...prev, feedback: null };
          });
        }, 1000);
      });
      
      if (!success) {
        setSpeechState(prev => ({ ...prev, status: 'playing' }));
      }
    }, 1500);
  }, [speechState.status, speechState.words, speechState.currentWordIndex, speakWord, startListening, completeSessionMutation, speechSupported]);

  useEffect(() => {
    const shouldRunTimer = (speechState.status === 'playing' || speechState.status === 'listening') && gameType === 'speed_round';
    
    if (shouldRunTimer && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setSpeechState(prev => {
          if (prev.status === 'finished' || prev.status === 'idle' || prev.status === 'loading') {
            return prev;
          }
          
          const newTime = prev.timeRemaining - 100;
          if (newTime <= 0) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            
            const durationMs = prev.startTime ? Date.now() - prev.startTime : 0;
            const totalCorrect = prev.attempts.filter(a => a.correct).length;
            const accuracyPct = prev.attempts.length > 0 ? (totalCorrect / prev.attempts.length) * 100 : 0;
            
            completeSessionMutation.mutate({
              score: Math.round(prev.score),
              accuracyPct,
              bestStreak: prev.bestStreak,
              wordsCompleted: prev.attempts.length,
              durationMs,
            });
            
            return { ...prev, status: 'finished', timeRemaining: 0 };
          }
          return { ...prev, timeRemaining: newTime };
        });
      }, 100);
    }

    return () => {
      if (timerRef.current && !shouldRunTimer) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [speechState.status, gameType, completeSessionMutation]);

  const getGameTitle = () => {
    switch (gameType) {
      case 'speed_round': return t('games.speedRound', 'Speed Round');
      case 'streak_challenge': return t('games.streakChallenge', 'Streak Challenge');
      case 'word_match': return t('games.wordMatch', 'Word Match');
      default: return 'Game';
    }
  };

  const getGameIcon = () => {
    switch (gameType) {
      case 'speed_round': return <Zap className="h-6 w-6 text-yellow-500" />;
      case 'streak_challenge': return <Flame className="h-6 w-6 text-orange-500" />;
      case 'word_match': return <Shuffle className="h-6 w-6 text-blue-500" />;
      default: return <Play className="h-6 w-6" />;
    }
  };

  const startGame = gameType === 'word_match' ? startWordMatchGame : startSpeechGame;
  const isIdle = gameType === 'word_match' 
    ? matchState.status === 'idle' || matchState.status === 'loading'
    : speechState.status === 'idle' || speechState.status === 'loading';
  const isPlaying = gameType === 'word_match' 
    ? matchState.status === 'playing' 
    : speechState.status === 'playing' || speechState.status === 'listening';
  const isFinished = gameType === 'word_match' ? matchState.status === 'finished' : speechState.status === 'finished';
  const isLoading = gameType === 'word_match' ? matchState.status === 'loading' : speechState.status === 'loading';

  const finalScore = gameType === 'word_match' ? Math.round(matchState.score) : Math.round(speechState.score);
  const correctCount = gameType === 'word_match' ? matchState.correctMatches : speechState.attempts.filter(a => a.correct).length;
  const totalCount = gameType === 'word_match' ? matchState.lines.length : speechState.attempts.length;
  const bestStreak = gameType === 'word_match' ? matchState.correctMatches : speechState.bestStreak;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/games">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 flex items-center gap-2">
            {getGameIcon()}
            <h1 className="text-xl font-bold">{getGameTitle()}</h1>
          </div>
        </div>

        {isIdle && (
          <Card className="text-center py-12">
            <CardContent>
              <div className="w-24 h-24 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
                {getGameIcon()}
              </div>
              <h2 className="text-2xl font-bold mb-2">{getGameTitle()}</h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                {gameType === 'word_match' && t('games.wordMatchInstructions', 'Match translations to their original lyrics.')}
                {gameType === 'speed_round' && t('games.speedRoundInstructions', 'Listen to words and repeat them correctly. You have 60 seconds!')}
                {gameType === 'streak_challenge' && t('games.streakInstructions', 'Keep your streak alive! Listen and speak to match the pronunciation.')}
              </p>
              <Button 
                size="lg" 
                onClick={startGame} 
                disabled={isLoading}
                data-testid="button-start-game"
              >
                {isLoading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Play className="h-5 w-5 mr-2" />}
                {isLoading ? t('common.loading', 'Loading...') : t('games.startGame', 'Start Game')}
              </Button>
            </CardContent>
          </Card>
        )}

        {isPlaying && gameType === 'word_match' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="font-bold text-lg">{Math.round(matchState.score)}/{MAX_SCORE}</span>
              </div>
              <Badge variant="outline">
                {matchState.currentOriginalIndex + 1}/{matchState.lines.length}
              </Badge>
            </div>

            <Progress value={(matchState.currentOriginalIndex / matchState.lines.length) * 100} className="h-2" />

            <Card className="p-6">
              <CardContent className="p-0">
                <div className="text-center mb-6">
                  <p className="text-sm text-muted-foreground mb-2">{t('games.matchOriginal', 'Match the translation for:')}</p>
                  <p className="text-2xl font-bold" data-testid="text-original-lyric">
                    {matchState.lines[matchState.currentOriginalIndex]?.original}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {matchState.lines[matchState.currentOriginalIndex]?.songTitle} - {matchState.lines[matchState.currentOriginalIndex]?.songArtist}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center mb-4">{t('games.selectTranslation', 'Select the correct translation:')}</p>
                  {matchState.shuffledTranslations.filter(t => !t.matched).map((item) => {
                    const isSelected = matchState.selectedTranslationId === item.id;
                    const isCorrectAnswer = matchState.lines[matchState.currentOriginalIndex]?.id === item.id;
                    const showCorrect = matchState.feedback && isCorrectAnswer;
                    const showWrong = matchState.feedback === 'wrong' && isSelected && !isCorrectAnswer;
                    
                    return (
                      <Button
                        key={item.id}
                        variant="outline"
                        className={`w-full justify-between h-auto py-3 px-4 ${
                          showCorrect ? 'bg-green-500/20 border-green-500' : 
                          showWrong ? 'bg-red-500/20 border-red-500' : ''
                        }`}
                        onClick={() => handleTranslationSelect(item.id)}
                        disabled={!!matchState.feedback}
                        data-testid={`button-translation-${item.id}`}
                      >
                        <span className="flex-1 text-left truncate">{item.translation}</span>
                        {showCorrect && <Check className="h-5 w-5 text-green-500 shrink-0 ml-2" />}
                        {showWrong && <X className="h-5 w-5 text-red-500 shrink-0 ml-2" />}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isPlaying && gameType !== 'word_match' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="font-bold text-lg">{Math.round(speechState.score)}/{MAX_SCORE}</span>
              </div>
              
              {gameType === 'speed_round' && (
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="font-mono font-bold">
                    {Math.ceil(speechState.timeRemaining / 1000)}s
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <span className="font-bold">{speechState.streak}</span>
              </div>
            </div>

            <Progress value={(speechState.currentWordIndex / speechState.words.length) * 100} className="h-2" />

            <Card className="text-center py-8">
              <CardContent>
                <Badge variant="outline" className="mb-4">
                  {speechState.currentWordIndex + 1}/{speechState.words.length}
                </Badge>
                
                {speechState.currentWordIndex < speechState.words.length && (
                  <div className="mb-6">
                    <p className="text-3xl font-bold mb-2" data-testid="text-current-word">
                      {speechState.words[speechState.currentWordIndex]?.original}
                    </p>
                    <p className="text-xl text-primary font-mono mb-4" data-testid="text-phonetic">
                      {speechState.words[speechState.currentWordIndex]?.phonetic}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {speechState.words[speechState.currentWordIndex]?.songTitle} - {speechState.words[speechState.currentWordIndex]?.songArtist}
                    </p>
                  </div>
                )}

                {speechState.feedback && (
                  <div className={`mb-4 p-3 rounded-lg ${speechState.feedback === 'correct' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <p className="flex items-center justify-center gap-2">
                      {speechState.feedback === 'correct' ? (
                        <><Check className="h-5 w-5 text-green-500" /> {t('games.correct', 'Correct!')}</>
                      ) : (
                        <><X className="h-5 w-5 text-red-500" /> {t('games.tryAgain', 'Try Again')}</>
                      )}
                    </p>
                    {speechState.lastTranscript && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('games.youSaid', 'You said')}: "{speechState.lastTranscript}"
                      </p>
                    )}
                  </div>
                )}

                {speechSupported ? (
                  <>
                    <Button 
                      size="lg"
                      onClick={handleSpeakAndListen}
                      disabled={speechState.status === 'listening' || speechState.currentWordIndex >= speechState.words.length}
                      className="gap-2"
                      data-testid="button-speak-listen"
                    >
                      {speechState.status === 'listening' ? (
                        <><Loader2 className="h-5 w-5 animate-spin" /> {t('games.listening', 'Listening...')}</>
                      ) : (
                        <><Volume2 className="h-5 w-5" /> <Mic className="h-5 w-5" /> {t('games.speakAndListen', 'Listen & Speak')}</>
                      )}
                    </Button>
                    <p className="text-sm text-muted-foreground mt-4">
                      {t('games.listenThenRepeat', 'Tap to hear the word, then repeat it')}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex gap-4 justify-center mb-4">
                      <Button 
                        size="lg"
                        variant="outline"
                        onClick={handleSpeakAndListen}
                        disabled={speechState.currentWordIndex >= speechState.words.length}
                        className="gap-2"
                        data-testid="button-hear-word"
                      >
                        <Volume2 className="h-5 w-5" /> {t('games.hearWord', 'Hear Word')}
                      </Button>
                    </div>
                    <div className="flex gap-4 justify-center">
                      <Button 
                        size="lg"
                        variant="outline"
                        onClick={() => handleManualAnswer(false)}
                        disabled={speechState.currentWordIndex >= speechState.words.length}
                        className="w-28"
                        data-testid="button-incorrect"
                      >
                        <X className="h-5 w-5 mr-2 text-red-500" />
                        {t('games.wrong', 'Wrong')}
                      </Button>
                      <Button 
                        size="lg"
                        onClick={() => handleManualAnswer(true)}
                        disabled={speechState.currentWordIndex >= speechState.words.length}
                        className="w-28"
                        data-testid="button-correct"
                      >
                        <Check className="h-5 w-5 mr-2" />
                        {t('games.correct', 'Correct')}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      {t('games.selfJudge', 'Listen and judge your own pronunciation!')}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {isFinished && (
          <Card className="text-center py-12">
            <CardContent>
              <Trophy className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
              <h2 className="text-3xl font-bold mb-2">{t('games.gameOver', 'Game Over!')}</h2>
              
              <div className="grid grid-cols-3 gap-4 my-8 max-w-sm mx-auto">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">{finalScore}</p>
                  <p className="text-sm text-muted-foreground">{t('games.score', 'Score')}</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">
                    {correctCount}/{totalCount}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('games.correct', 'Correct')}</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-500">{bestStreak}</p>
                  <p className="text-sm text-muted-foreground">{t('games.bestStreak', 'Best Streak')}</p>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={startGame} data-testid="button-play-again">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('games.playAgain', 'Play Again')}
                </Button>
                <Link href="/games">
                  <Button data-testid="button-back-to-games">
                    {t('games.backToGames', 'Back to Games')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
