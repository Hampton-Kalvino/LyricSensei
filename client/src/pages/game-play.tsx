import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Zap, Flame, Shuffle, Play, Pause, RotateCcw, Trophy, Clock, Target, Check, X, Volume2 } from "lucide-react";
import { playSuccessChime, playErrorBuzzer } from "@/lib/audio-sfx";
import type { GameType, GameSession } from "@shared/schema";

const GAME_DURATION = 60000; // 60 seconds for speed round
const WORDS_PER_GAME = 10;

const SAMPLE_WORDS = [
  { original: "Hello", phonetic: "heh-LOH", language: "en" },
  { original: "Bonjour", phonetic: "bohn-ZHOOR", language: "fr" },
  { original: "Hola", phonetic: "OH-lah", language: "es" },
  { original: "Guten Tag", phonetic: "GOO-ten tahk", language: "de" },
  { original: "Ciao", phonetic: "CHOW", language: "it" },
  { original: "Konnichiwa", phonetic: "kohn-nee-chee-WAH", language: "ja" },
  { original: "Annyeong", phonetic: "ahn-NYUHNG", language: "ko" },
  { original: "Ni hao", phonetic: "nee HOW", language: "zh" },
  { original: "Obrigado", phonetic: "oh-bree-GAH-doo", language: "pt" },
  { original: "Spasibo", phonetic: "spah-SEE-bah", language: "ru" },
  { original: "Gracias", phonetic: "GRAH-see-ahs", language: "es" },
  { original: "Merci", phonetic: "mehr-SEE", language: "fr" },
  { original: "Danke", phonetic: "DAHN-keh", language: "de" },
  { original: "Arigato", phonetic: "ah-ree-GAH-toh", language: "ja" },
  { original: "Xie xie", phonetic: "syeh-SYEH", language: "zh" },
];

interface GameState {
  status: 'idle' | 'playing' | 'paused' | 'finished';
  score: number;
  streak: number;
  bestStreak: number;
  timeRemaining: number;
  currentWordIndex: number;
  words: typeof SAMPLE_WORDS;
  attempts: Array<{ word: string; correct: boolean; accuracy?: number }>;
  startTime?: number;
}

export default function GamePlayPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { gameType } = useParams<{ gameType: string }>();
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    status: 'idle',
    score: 0,
    streak: 0,
    bestStreak: 0,
    timeRemaining: GAME_DURATION,
    currentWordIndex: 0,
    words: [],
    attempts: [],
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

  const shuffleWords = useCallback(() => {
    const shuffled = [...SAMPLE_WORDS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, WORDS_PER_GAME);
  }, []);

  const startGame = useCallback(() => {
    createSessionMutation.mutate();
    setGameState({
      status: 'playing',
      score: 0,
      streak: 0,
      bestStreak: 0,
      timeRemaining: GAME_DURATION,
      currentWordIndex: 0,
      words: shuffleWords(),
      attempts: [],
      startTime: Date.now(),
    });
  }, [shuffleWords, createSessionMutation]);

  const endGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setGameState(prev => {
      const totalCorrect = prev.attempts.filter(a => a.correct).length;
      const accuracyPct = prev.attempts.length > 0 
        ? (totalCorrect / prev.attempts.length) * 100 
        : 0;
      const durationMs = prev.startTime ? Date.now() - prev.startTime : 0;

      completeSessionMutation.mutate({
        score: prev.score,
        accuracyPct,
        bestStreak: prev.bestStreak,
        wordsCompleted: prev.attempts.length,
        durationMs,
      });

      return { ...prev, status: 'finished' };
    });
  }, [completeSessionMutation]);

  const handleAnswer = useCallback((correct: boolean) => {
    if (gameState.status !== 'playing') return;

    const currentWord = gameState.words[gameState.currentWordIndex];
    
    if (correct) {
      playSuccessChime();
    } else {
      playErrorBuzzer();
    }

    setGameState(prev => {
      const newStreak = correct ? prev.streak + 1 : 0;
      const newBestStreak = Math.max(prev.bestStreak, newStreak);
      const scoreIncrease = correct ? (10 + prev.streak * 2) : 0; // Bonus for streak
      
      const newAttempts = [...prev.attempts, { 
        word: currentWord.original, 
        correct,
        accuracy: correct ? 100 : 0,
      }];

      const nextIndex = prev.currentWordIndex + 1;
      
      // Check if game should end
      if (nextIndex >= prev.words.length) {
        setTimeout(() => endGame(), 500);
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
  }, [gameState.status, gameState.words, gameState.currentWordIndex, endGame]);

  // Timer effect for speed round
  useEffect(() => {
    if (gameState.status === 'playing' && gameType === 'speed_round') {
      timerRef.current = setInterval(() => {
        setGameState(prev => {
          const newTime = prev.timeRemaining - 100;
          if (newTime <= 0) {
            setTimeout(() => endGame(), 0);
            return { ...prev, timeRemaining: 0 };
          }
          return { ...prev, timeRemaining: newTime };
        });
      }, 100);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [gameState.status, gameType, endGame]);

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

  const currentWord = gameState.words[gameState.currentWordIndex];
  const progress = gameState.words.length > 0 
    ? (gameState.currentWordIndex / gameState.words.length) * 100 
    : 0;

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

        {gameState.status === 'idle' && (
          <Card className="text-center py-12">
            <CardContent>
              <div className="w-24 h-24 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
                {getGameIcon()}
              </div>
              <h2 className="text-2xl font-bold mb-2">{getGameTitle()}</h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                {gameType === 'speed_round' && t('games.speedRoundInstructions', 'Pronounce each word correctly as fast as you can. You have 60 seconds!')}
                {gameType === 'streak_challenge' && t('games.streakInstructions', 'Keep your streak alive! One wrong answer ends your streak.')}
                {gameType === 'word_match' && t('games.matchInstructions', 'Match the phonetic pronunciation to the correct word.')}
              </p>
              <Button size="lg" onClick={startGame} data-testid="button-start-game">
                <Play className="h-5 w-5 mr-2" />
                {t('games.startGame', 'Start Game')}
              </Button>
            </CardContent>
          </Card>
        )}

        {gameState.status === 'playing' && currentWord && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="font-bold text-lg">{gameState.score}</span>
              </div>
              
              {gameType === 'speed_round' && (
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="font-mono font-bold">
                    {Math.ceil(gameState.timeRemaining / 1000)}s
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <span className="font-bold">{gameState.streak}</span>
              </div>
            </div>

            <Progress value={progress} className="h-2" />

            <Card className="text-center py-8">
              <CardContent>
                <Badge variant="outline" className="mb-4">
                  {t('games.wordNumber', 'Word')} {gameState.currentWordIndex + 1}/{gameState.words.length}
                </Badge>
                
                <div className="mb-6">
                  <p className="text-3xl font-bold mb-2" data-testid="text-current-word">
                    {currentWord.original}
                  </p>
                  <p className="text-xl text-primary font-mono" data-testid="text-phonetic">
                    {currentWord.phonetic}
                  </p>
                </div>

                <div className="flex justify-center gap-4">
                  <Button 
                    size="lg"
                    variant="outline"
                    onClick={() => handleAnswer(false)}
                    className="w-32"
                    data-testid="button-incorrect"
                  >
                    <X className="h-5 w-5 mr-2 text-red-500" />
                    {t('games.tryAgain', 'Wrong')}
                  </Button>
                  <Button 
                    size="lg"
                    onClick={() => handleAnswer(true)}
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

        {gameState.status === 'finished' && (
          <Card className="text-center py-12">
            <CardContent>
              <Trophy className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
              <h2 className="text-3xl font-bold mb-2">{t('games.gameOver', 'Game Over!')}</h2>
              
              <div className="grid grid-cols-3 gap-4 my-8 max-w-sm mx-auto">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">{gameState.score}</p>
                  <p className="text-sm text-muted-foreground">{t('games.score', 'Score')}</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-500">{gameState.bestStreak}</p>
                  <p className="text-sm text-muted-foreground">{t('games.bestStreak', 'Best Streak')}</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">
                    {gameState.attempts.filter(a => a.correct).length}/{gameState.attempts.length}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('games.accuracy', 'Correct')}</p>
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
