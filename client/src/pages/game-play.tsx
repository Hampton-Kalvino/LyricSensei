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
import { ArrowLeft, Zap, Flame, Shuffle, Play, RotateCcw, Trophy, Clock, Check, X } from "lucide-react";
import { playSuccessChime, playErrorBuzzer } from "@/lib/audio-sfx";
import type { GameType, GameSession } from "@shared/schema";

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

interface SpeedGameState {
  status: 'idle' | 'playing' | 'finished';
  score: number;
  streak: number;
  bestStreak: number;
  timeRemaining: number;
  currentWordIndex: number;
  words: Array<{ original: string; phonetic: string }>;
  attempts: Array<{ word: string; correct: boolean }>;
  startTime?: number;
}

const SAMPLE_WORDS = [
  { original: "Hello", phonetic: "heh-LOH" },
  { original: "Bonjour", phonetic: "bohn-ZHOOR" },
  { original: "Hola", phonetic: "OH-lah" },
  { original: "Guten Tag", phonetic: "GOO-ten tahk" },
  { original: "Ciao", phonetic: "CHOW" },
  { original: "Konnichiwa", phonetic: "kohn-nee-chee-WAH" },
  { original: "Annyeong", phonetic: "ahn-NYUHNG" },
  { original: "Ni hao", phonetic: "nee HOW" },
  { original: "Obrigado", phonetic: "oh-bree-GAH-doo" },
  { original: "Spasibo", phonetic: "spah-SEE-bah" },
];

export default function GamePlayPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { gameType } = useParams<{ gameType: string }>();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  const [speedState, setSpeedState] = useState<SpeedGameState>({
    status: 'idle',
    score: 0,
    streak: 0,
    bestStreak: 0,
    timeRemaining: GAME_DURATION,
    currentWordIndex: 0,
    words: [],
    attempts: [],
  });

  const { data: wordMatchLines, refetch: refetchLines } = useQuery<WordMatchLine[]>({
    queryKey: ['/api/games/word-match-lines', 'en', LINES_PER_GAME],
    queryFn: () => apiRequest<WordMatchLine[]>('GET', `/api/games/word-match-lines?targetLanguage=en&count=${LINES_PER_GAME}`),
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

  const startSpeedGame = useCallback(() => {
    createSessionMutation.mutate();
    const shuffled = [...SAMPLE_WORDS].sort(() => Math.random() - 0.5).slice(0, LINES_PER_GAME);
    
    setSpeedState({
      status: 'playing',
      score: 0,
      streak: 0,
      bestStreak: 0,
      timeRemaining: GAME_DURATION,
      currentWordIndex: 0,
      words: shuffled,
      attempts: [],
      startTime: Date.now(),
    });
  }, [createSessionMutation]);

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

  const handleSpeedAnswer = useCallback((correct: boolean) => {
    if (speedState.status !== 'playing') return;

    const currentWord = speedState.words[speedState.currentWordIndex];
    
    if (correct) {
      playSuccessChime();
    } else {
      playErrorBuzzer();
    }

    setSpeedState(prev => {
      const newStreak = correct ? prev.streak + 1 : 0;
      const newBestStreak = Math.max(prev.bestStreak, newStreak);
      const scoreIncrease = correct ? POINTS_PER_LINE : 0;
      
      const newAttempts = [...prev.attempts, { word: currentWord.original, correct }];
      const nextIndex = prev.currentWordIndex + 1;
      
      if (nextIndex >= prev.words.length) {
        const durationMs = prev.startTime ? Date.now() - prev.startTime : 0;
        const totalCorrect = newAttempts.filter(a => a.correct).length;
        const accuracyPct = (totalCorrect / newAttempts.length) * 100;
        
        completeSessionMutation.mutate({
          score: Math.round(prev.score + scoreIncrease),
          accuracyPct,
          bestStreak: newBestStreak,
          wordsCompleted: newAttempts.length,
          durationMs,
        });
        
        return { ...prev, status: 'finished', score: prev.score + scoreIncrease, attempts: newAttempts, bestStreak: newBestStreak };
      }

      return {
        ...prev,
        score: prev.score + scoreIncrease,
        streak: newStreak,
        bestStreak: newBestStreak,
        currentWordIndex: nextIndex,
        attempts: newAttempts,
      };
    });
  }, [speedState.status, speedState.words, speedState.currentWordIndex, completeSessionMutation]);

  useEffect(() => {
    if (speedState.status === 'playing' && gameType === 'speed_round') {
      timerRef.current = setInterval(() => {
        setSpeedState(prev => {
          const newTime = prev.timeRemaining - 100;
          if (newTime <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            
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

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [speedState.status, gameType, completeSessionMutation]);

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

  const startGame = gameType === 'word_match' ? startWordMatchGame : startSpeedGame;
  const isIdle = gameType === 'word_match' 
    ? matchState.status === 'idle' || matchState.status === 'loading'
    : speedState.status === 'idle';
  const isPlaying = gameType === 'word_match' ? matchState.status === 'playing' : speedState.status === 'playing';
  const isFinished = gameType === 'word_match' ? matchState.status === 'finished' : speedState.status === 'finished';

  const finalScore = gameType === 'word_match' ? Math.round(matchState.score) : Math.round(speedState.score);
  const correctCount = gameType === 'word_match' ? matchState.correctMatches : speedState.attempts.filter(a => a.correct).length;
  const totalCount = gameType === 'word_match' ? matchState.lines.length : speedState.attempts.length;

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
                {gameType === 'word_match' && t('games.wordMatchInstructions', 'Match translations to their original lyrics. Drag the correct translation to score points!')}
                {gameType === 'speed_round' && t('games.speedRoundInstructions', 'Pronounce each word correctly as fast as you can. You have 60 seconds!')}
                {gameType === 'streak_challenge' && t('games.streakInstructions', 'Keep your streak alive! One wrong answer ends your streak.')}
              </p>
              <Button 
                size="lg" 
                onClick={startGame} 
                disabled={matchState.status === 'loading'}
                data-testid="button-start-game"
              >
                <Play className="h-5 w-5 mr-2" />
                {matchState.status === 'loading' ? t('common.loading', 'Loading...') : t('games.startGame', 'Start Game')}
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
                        className={`w-full justify-start text-left h-auto py-3 px-4 ${
                          showCorrect ? 'bg-green-500/20 border-green-500' : 
                          showWrong ? 'bg-red-500/20 border-red-500' : ''
                        }`}
                        onClick={() => handleTranslationSelect(item.id)}
                        disabled={!!matchState.feedback}
                        data-testid={`button-translation-${item.id}`}
                      >
                        <span className="flex-1 truncate">{item.translation}</span>
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
                <span className="font-bold text-lg">{Math.round(speedState.score)}</span>
              </div>
              
              {gameType === 'speed_round' && (
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="font-mono font-bold">
                    {Math.ceil(speedState.timeRemaining / 1000)}s
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <span className="font-bold">{speedState.streak}</span>
              </div>
            </div>

            <Progress value={(speedState.currentWordIndex / speedState.words.length) * 100} className="h-2" />

            <Card className="text-center py-8">
              <CardContent>
                <Badge variant="outline" className="mb-4">
                  {speedState.currentWordIndex + 1}/{speedState.words.length}
                </Badge>
                
                <div className="mb-6">
                  <p className="text-3xl font-bold mb-2" data-testid="text-current-word">
                    {speedState.words[speedState.currentWordIndex]?.original}
                  </p>
                  <p className="text-xl text-primary font-mono" data-testid="text-phonetic">
                    {speedState.words[speedState.currentWordIndex]?.phonetic}
                  </p>
                </div>

                <div className="flex justify-center gap-4">
                  <Button 
                    size="lg"
                    variant="outline"
                    onClick={() => handleSpeedAnswer(false)}
                    className="w-32"
                    data-testid="button-incorrect"
                  >
                    <X className="h-5 w-5 mr-2 text-red-500" />
                    {t('games.wrong', 'Wrong')}
                  </Button>
                  <Button 
                    size="lg"
                    onClick={() => handleSpeedAnswer(true)}
                    className="w-32"
                    data-testid="button-correct"
                  >
                    <Check className="h-5 w-5 mr-2" />
                    {t('games.correct', 'Correct')}
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground mt-4">
                  {t('games.selfJudge', 'Judge your own pronunciation!')}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {isFinished && (
          <Card className="text-center py-12">
            <CardContent>
              <Trophy className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
              <h2 className="text-3xl font-bold mb-2">{t('games.gameOver', 'Game Over!')}</h2>
              
              <div className="grid grid-cols-2 gap-4 my-8 max-w-xs mx-auto">
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
