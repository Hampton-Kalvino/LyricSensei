import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Music, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface SearchResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl: string;
  duration: number; // Duration in seconds (converted from trackTimeMillis)
}

interface SongSearchProps {
  onSelectSong: (artist: string, title: string, album: string, albumArt?: string, duration?: number) => void;
}

export function SongSearch({ onSelectSong }: SongSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search query - uses default fetcher with credentials
  const searchQueryKey = debouncedQuery.trim().length >= 2 
    ? `/api/songs/search?q=${encodeURIComponent(debouncedQuery)}`
    : null;
    
  const { data: searchResults, isLoading } = useQuery<{ results: SearchResult[] }>({
    queryKey: [searchQueryKey],
    enabled: searchQueryKey !== null,
  });

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSong = (result: SearchResult) => {
    onSelectSong(
      result.artistName, 
      result.trackName, 
      result.collectionName,
      result.artworkUrl,
      result.duration
    );
    setSearchQuery("");
    setDebouncedQuery("");
    setShowResults(false);
  };

  const handleClear = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setShowResults(false);
  };

  const results = searchResults?.results || [];
  const hasResults = results.length > 0;

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search for songs or artists..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="pl-9 pr-9"
          data-testid="input-search-songs"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={handleClear}
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && debouncedQuery.trim().length >= 2 && (
        <Card className="absolute top-full mt-2 w-full z-50 max-h-[400px] overflow-hidden">
          <ScrollArea className="h-full max-h-[400px]">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : hasResults ? (
              <div className="p-2">
                {results.map((result) => (
                  <button
                    key={result.trackId}
                    onClick={() => handleSelectSong(result)}
                    className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate active-elevate-2 text-left"
                    data-testid={`result-track-${result.trackId}`}
                  >
                    {result.artworkUrl ? (
                      <img
                        src={result.artworkUrl}
                        alt={result.trackName}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                        <Music className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" data-testid={`text-track-name-${result.trackId}`}>
                        {result.trackName}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {result.artistName} • {result.collectionName}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No songs found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            )}
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
