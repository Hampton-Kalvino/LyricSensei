import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Music, Globe, Mic, TrendingUp, Clock, Star, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Song, RecognitionResult } from "@shared/schema";

interface SearchResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl: string;
  duration: number;
}

interface BrowseCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

export default function SearchPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchQueryKey = debouncedQuery.trim().length >= 2 
    ? `/api/songs/search?q=${encodeURIComponent(debouncedQuery)}`
    : null;
    
  const { data: searchResults, isLoading: isSearching } = useQuery<{ results: SearchResult[] }>({
    queryKey: [searchQueryKey],
    enabled: searchQueryKey !== null,
  });

  const { data: topSongs = [] } = useQuery<Array<Song & { recognitionCount: number }>>({
    queryKey: ["/api/songs/top-researched"],
  });

  const { data: recentHistory = [] } = useQuery<RecognitionResult[]>({
    queryKey: ["/api/recognition-history?limit=10"],
  });

  const manualSelectMutation = useMutation({
    mutationFn: async (data: { artist: string; title: string; album: string; albumArt?: string; duration?: number }) => {
      return apiRequest<RecognitionResult>("POST", "/api/songs/manual-select", data);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recognition-history"] });
      
      toast({
        title: t('search.songSelected', 'Song Selected!'),
        description: `${result.title} by ${result.artist}`,
      });
      
      setLocation(`/?song=${result.songId}`);
    },
    onError: (error: Error) => {
      toast({
        title: t('search.selectionFailed', 'Selection Failed'),
        description: error.message || t('search.couldNotSelect', 'Could not select the song'),
        variant: "destructive",
      });
    },
  });

  const browseCategories: BrowseCategory[] = [
    {
      id: "trending",
      title: t('search.trending', 'Trending'),
      icon: <TrendingUp className="h-6 w-6" />,
      color: "bg-gradient-to-br from-orange-500 to-red-600",
      description: t('search.trendingDesc', 'Popular songs this week'),
    },
    {
      id: "languages",
      title: t('search.languages', 'By Language'),
      icon: <Globe className="h-6 w-6" />,
      color: "bg-gradient-to-br from-blue-500 to-cyan-500",
      description: t('search.languagesDesc', 'Browse by language'),
    },
    {
      id: "practice",
      title: t('search.practice', 'Practice'),
      icon: <Mic className="h-6 w-6" />,
      color: "bg-gradient-to-br from-green-500 to-emerald-600",
      description: t('search.practiceDesc', 'Songs great for learning'),
    },
    {
      id: "new",
      title: t('search.new', 'New Releases'),
      icon: <Sparkles className="h-6 w-6" />,
      color: "bg-gradient-to-br from-purple-500 to-pink-500",
      description: t('search.newDesc', 'Recently added songs'),
    },
  ];

  const handleSelectSearchResult = (result: SearchResult) => {
    manualSelectMutation.mutate({
      artist: result.artistName,
      title: result.trackName,
      album: result.collectionName,
      albumArt: result.artworkUrl,
      duration: result.duration,
    });
  };

  const handleSelectExistingSong = (songId: string) => {
    setLocation(`/?song=${songId}`);
  };

  const handleCategoryClick = (categoryId: string) => {
    switch (categoryId) {
      case "trending":
        break;
      case "languages":
        setLocation("/library");
        break;
      case "practice":
        setLocation("/games");
        break;
      case "new":
        break;
    }
  };

  const handleClear = () => {
    setSearchQuery("");
    setDebouncedQuery("");
  };

  const results = searchResults?.results || [];
  const hasResults = results.length > 0;
  const showSearchResults = debouncedQuery.trim().length >= 2;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold" data-testid="text-search-title">
          {t('search.title', 'Search')}
        </h1>
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={t('search.placeholder', 'What do you want to learn?')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-12 h-12 text-base rounded-full bg-card"
            data-testid="input-search"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={handleClear}
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {showSearchResults ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t('search.results', 'Search Results')}</h2>
              
              {isSearching ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-14 w-14 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : hasResults ? (
                <div className="space-y-2">
                  {results.map((result) => (
                    <Card
                      key={result.trackId}
                      className="hover-elevate active-elevate-2 cursor-pointer"
                      onClick={() => handleSelectSearchResult(result)}
                      data-testid={`card-search-result-${result.trackId}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          {result.artworkUrl ? (
                            <img
                              src={result.artworkUrl}
                              alt={result.trackName}
                              className="h-14 w-14 rounded object-cover"
                            />
                          ) : (
                            <div className="h-14 w-14 rounded bg-muted flex items-center justify-center">
                              <Music className="h-7 w-7 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{result.trackName}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {result.artistName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {result.collectionName}
                            </p>
                          </div>
                          {manualSelectMutation.isPending && (
                            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">{t('search.noResults', 'No songs found')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('search.tryDifferent', 'Try a different search term')}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold mb-4">{t('search.browse', 'Browse All')}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {browseCategories.map((category) => (
                    <Card
                      key={category.id}
                      className={`${category.color} border-0 cursor-pointer hover-elevate active-elevate-2 overflow-hidden`}
                      onClick={() => handleCategoryClick(category.id)}
                      data-testid={`card-category-${category.id}`}
                    >
                      <CardContent className="p-4 text-white">
                        <div className="flex items-center justify-between mb-2">
                          {category.icon}
                        </div>
                        <h3 className="font-bold text-lg">{category.title}</h3>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {topSongs.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {t('search.topSongs', 'Popular Songs')}
                  </h2>
                  <div className="space-y-2">
                    {topSongs.slice(0, 5).map((song, index) => (
                      <Card
                        key={song.id}
                        className="hover-elevate active-elevate-2 cursor-pointer"
                        onClick={() => handleSelectExistingSong(song.id)}
                        data-testid={`card-top-song-${song.id}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 flex items-center justify-center text-lg font-bold text-muted-foreground">
                              {index + 1}
                            </div>
                            {song.albumArt ? (
                              <img
                                src={song.albumArt}
                                alt={song.title}
                                className="h-12 w-12 rounded object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                                <Music className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{song.title}</p>
                              <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              {song.recognitionCount}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {recentHistory.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    {t('search.recent', 'Recently Played')}
                  </h2>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {recentHistory.slice(0, 6).map((item) => (
                      <Card
                        key={item.songId}
                        className="hover-elevate active-elevate-2 cursor-pointer flex-shrink-0 w-32"
                        onClick={() => handleSelectExistingSong(item.songId)}
                        data-testid={`card-recent-song-${item.songId}`}
                      >
                        <CardContent className="p-2">
                          {item.albumArt ? (
                            <img
                              src={item.albumArt}
                              alt={item.title}
                              className="w-full aspect-square rounded object-cover mb-2"
                            />
                          ) : (
                            <div className="w-full aspect-square rounded bg-muted flex items-center justify-center mb-2">
                              <Music className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <p className="font-medium text-sm truncate" data-testid={`text-recent-title-${item.songId}`}>
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate" data-testid={`text-recent-artist-${item.songId}`}>
                            {item.artist}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
