import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Zap, Target, Shuffle, Trophy, Clock, Flame, Star, Play, Medal } from "lucide-react";
import type { LeaderboardEntryWithUser, GameSessionWithDetails, GameType } from "@shared/schema";

const GAME_MODES: { id: GameType; icon: typeof Zap; color: string }[] = [
  { id: 'speed_round', icon: Zap, color: 'text-yellow-500' },
  { id: 'streak_challenge', icon: Flame, color: 'text-orange-500' },
  { id: 'word_match', icon: Shuffle, color: 'text-blue-500' },
];

export default function GamesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedGame, setSelectedGame] = useState<GameType>('speed_round');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'daily' | 'weekly' | 'all_time'>('weekly');

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<LeaderboardEntryWithUser[]>({
    queryKey: ['/api/games/leaderboard', selectedGame, leaderboardPeriod],
    queryFn: () => apiRequest<LeaderboardEntryWithUser[]>('GET', `/api/games/leaderboard?gameType=${selectedGame}&period=${leaderboardPeriod}`),
  });

  const { data: history, isLoading: historyLoading } = useQuery<GameSessionWithDetails[]>({
    queryKey: ['/api/games/history'],
  });

  const getGameTitle = (gameType: GameType) => {
    switch (gameType) {
      case 'speed_round': return t('games.speedRound', 'Speed Round');
      case 'streak_challenge': return t('games.streakChallenge', 'Streak Challenge');
      case 'word_match': return t('games.wordMatch', 'Word Match');
      default: return gameType;
    }
  };

  const getGameDescription = (gameType: GameType) => {
    switch (gameType) {
      case 'speed_round': return t('games.speedRoundDesc', 'Pronounce as many words correctly as possible in 60 seconds');
      case 'streak_challenge': return t('games.streakChallengeDesc', 'Keep your streak alive with consecutive correct pronunciations');
      case 'word_match': return t('games.wordMatchDesc', 'Match the phonetic guide to the original lyrics');
      default: return '';
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Medal className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-medium text-muted-foreground">#{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              {t('games.title', 'Mini Games')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('games.subtitle', 'Practice pronunciation through fun challenges')}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {GAME_MODES.map((game) => {
            const Icon = game.icon;
            const isSelected = selectedGame === game.id;
            return (
              <Card 
                key={game.id}
                className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover-elevate'}`}
                onClick={() => setSelectedGame(game.id)}
                data-testid={`card-game-${game.id}`}
              >
                <CardHeader className="text-center pb-2">
                  <div className={`w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-2`}>
                    <Icon className={`h-8 w-8 ${game.color}`} />
                  </div>
                  <CardTitle className="text-lg">{getGameTitle(game.id)}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {getGameDescription(game.id)}
                  </p>
                </CardContent>
                <CardFooter className="justify-center pt-0">
                  <Link href={`/games/play/${game.id}`}>
                    <Button 
                      variant={isSelected ? 'default' : 'outline'}
                      className="w-full"
                      data-testid={`button-play-${game.id}`}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {t('games.play', 'Play')}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  {t('games.leaderboard', 'Leaderboard')}
                </CardTitle>
                <Tabs value={leaderboardPeriod} onValueChange={(v) => setLeaderboardPeriod(v as typeof leaderboardPeriod)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="daily" className="text-xs px-2">{t('games.daily', 'Daily')}</TabsTrigger>
                    <TabsTrigger value="weekly" className="text-xs px-2">{t('games.weekly', 'Weekly')}</TabsTrigger>
                    <TabsTrigger value="all_time" className="text-xs px-2">{t('games.allTime', 'All Time')}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <CardDescription>
                {getGameTitle(selectedGame)} - {t(`games.${leaderboardPeriod}`, leaderboardPeriod)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboardLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : leaderboard?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('games.noScores', 'No scores yet')}</p>
                  <p className="text-sm">{t('games.beFirst', 'Be the first to set a record!')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard?.map((entry) => (
                    <div 
                      key={entry.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                      data-testid={`leaderboard-entry-${entry.userId}`}
                    >
                      <div className="w-8 flex justify-center">
                        {getRankBadge(entry.rank)}
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={entry.user.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {entry.user.username?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {entry.user.username || t('common.anonymous', 'Anonymous')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{entry.bestScore}</p>
                        {entry.bestAccuracy && (
                          <p className="text-xs text-muted-foreground">{entry.bestAccuracy.toFixed(0)}%</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t('games.recentGames', 'Recent Games')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : history?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('games.noHistory', 'No games played yet')}</p>
                  <p className="text-sm">{t('games.startPlaying', 'Start playing to track your progress!')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history?.slice(0, 5).map((session) => (
                    <div 
                      key={session.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                      data-testid={`history-entry-${session.id}`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        {session.gameType === 'speed_round' && <Zap className="h-5 w-5 text-yellow-500" />}
                        {session.gameType === 'streak_challenge' && <Flame className="h-5 w-5 text-orange-500" />}
                        {session.gameType === 'word_match' && <Shuffle className="h-5 w-5 text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{getGameTitle(session.gameType as GameType)}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.completedAt 
                            ? new Date(session.completedAt).toLocaleDateString()
                            : t('games.inProgress', 'In Progress')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{session.score}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {session.bestStreak && (
                            <>
                              <Flame className="h-3 w-3" />
                              {session.bestStreak}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
