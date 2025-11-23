/**
 * LrcLib API client for fetching synchronized lyrics
 * https://lrclib.net/api
 * No authentication required, completely free
 */

interface LrcLibResponse {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

interface ParsedLyric {
  startTime: number;
  text: string;
}

interface LyricsResult {
  lyrics: ParsedLyric[];
  isSynced: boolean; // Whether timestamps are accurate or estimated
}

/**
 * Parse LRC format lyrics into structured data
 * LRC format: [mm:ss.xx] lyric text
 */
function parseLrcLyrics(lrcContent: string): ParsedLyric[] {
  if (!lrcContent) return [];
  
  const lines = lrcContent.split('\n');
  const parsed: ParsedLyric[] = [];
  
  for (const line of lines) {
    // Match timestamp pattern [mm:ss.xx]
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const centiseconds = parseInt(match[3]);
      const text = match[4].trim();
      
      // Convert to total seconds
      const startTime = minutes * 60 + seconds + centiseconds / 100;
      
      if (text) {
        parsed.push({ startTime, text });
      }
    }
  }
  
  return parsed;
}

/**
 * Clean song/artist names by removing metadata codes and extra info
 * Examples:
 *   "Lo Dudo (MXF019000715)" -> "Lo Dudo"
 *   "Song Title [Remastered]" -> "Song Title"
 *   "Artist feat. Other Artist" -> "Artist"
 */
function cleanMetadata(name: string): string {
  if (!name) return name;
  
  return name
    // Remove content in parentheses (often metadata codes or remix info)
    .replace(/\([^)]*\)/g, '')
    // Remove content in square brackets (often remaster info)
    .replace(/\[[^\]]*\]/g, '')
    // Remove featuring artists (but NOT "with" which is often part of song titles)
    .replace(/\s+(feat\.|featuring|ft\.)\s+.*/i, '')
    // Remove leading/trailing whitespace
    .trim()
    // Normalize multiple spaces
    .replace(/\s+/g, ' ');
}

/**
 * Fetch lyrics from LrcLib API
 */
export async function fetchLyricsFromLrcLib(
  trackName: string,
  artistName: string,
  albumName?: string,
  duration?: number
): Promise<LyricsResult | null> {
  try {
    // Clean track and artist names for better matching
    const cleanTrack = cleanMetadata(trackName);
    const cleanArtist = cleanMetadata(artistName);
    
    console.log('[LrcLib] Fetching lyrics for:', cleanTrack, 'by', cleanArtist);
    if (cleanTrack !== trackName || cleanArtist !== artistName) {
      console.log('[LrcLib] Cleaned from:', trackName, 'by', artistName);
    }
    
    // Try search API first (more forgiving with special characters)
    const searchParams = new URLSearchParams({
      track_name: cleanTrack,
      artist_name: cleanArtist,
    });
    
    const searchResponse = await fetch(`https://lrclib.net/api/search?${searchParams}`, {
      headers: {
        'User-Agent': 'LyricSync/1.0.0 (https://lyricsync.app)',
      },
    });
    
    if (searchResponse.ok) {
      const searchResults: LrcLibResponse[] = await searchResponse.json();
      
      if (searchResults.length > 0) {
        // Use the first result (best match)
        const data = searchResults[0];
        console.log('[LrcLib] Found via search:', data.trackName, 'by', data.artistName);
        
        // If instrumental track, return empty array
        if (data.instrumental) {
          console.log('[LrcLib] Track is instrumental');
          return { lyrics: [], isSynced: true };
        }
        
        // Prefer synced lyrics over plain lyrics
        if (data.syncedLyrics) {
          console.log('[LrcLib] Using synced lyrics');
          const parsed = parseLrcLyrics(data.syncedLyrics);
          console.log('[LrcLib] Parsed', parsed.length, 'lyric lines');
          return { lyrics: parsed, isSynced: true };
        }
        
        // Fall back to plain lyrics with estimated timestamps
        if (data.plainLyrics) {
          console.log('[LrcLib] Using plain lyrics (no timestamps - sync unavailable)');
          const lines = data.plainLyrics.split('\n').filter(l => l.trim());
          const estimatedDuration = data.duration || 180;
          const timePerLine = estimatedDuration / lines.length;
          
          return {
            lyrics: lines.map((text, index) => ({
              startTime: index * timePerLine,
              text: text.trim(),
            })),
            isSynced: false, // Estimated timestamps, not accurate
          };
        }
      }
    }
    
    // Fallback: try exact match API
    const params = new URLSearchParams({
      track_name: cleanTrack,
      artist_name: cleanArtist,
    });
    
    if (albumName) {
      params.append('album_name', cleanMetadata(albumName));
    }
    
    if (duration) {
      params.append('duration', Math.round(duration).toString());
    }
    
    const response = await fetch(`https://lrclib.net/api/get?${params}`, {
      headers: {
        'User-Agent': 'LyricSync/1.0.0 (https://lyricsync.app)',
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('[LrcLib] No lyrics found for this song');
        return null;
      }
      console.error('[LrcLib] API error:', response.status, response.statusText);
      return null;
    }
    
    const data: LrcLibResponse = await response.json();
    console.log('[LrcLib] Response received:', {
      trackName: data.trackName,
      instrumental: data.instrumental,
      hasSyncedLyrics: !!data.syncedLyrics,
      hasPlainLyrics: !!data.plainLyrics,
    });
    
    // If instrumental track, return empty array
    if (data.instrumental) {
      console.log('[LrcLib] Track is instrumental');
      return { lyrics: [], isSynced: true };
    }
    
    // Prefer synced lyrics over plain lyrics
    if (data.syncedLyrics) {
      console.log('[LrcLib] Using synced lyrics');
      const parsed = parseLrcLyrics(data.syncedLyrics);
      console.log('[LrcLib] Parsed', parsed.length, 'lyric lines');
      return { lyrics: parsed, isSynced: true };
    }
    
    // Fall back to plain lyrics with estimated timestamps
    if (data.plainLyrics) {
      console.log('[LrcLib] Using plain lyrics (no timestamps - sync unavailable)');
      const lines = data.plainLyrics.split('\n').filter(l => l.trim());
      const estimatedDuration = data.duration || 180;
      const timePerLine = estimatedDuration / lines.length;
      
      return {
        lyrics: lines.map((text, index) => ({
          startTime: index * timePerLine,
          text: text.trim(),
        })),
        isSynced: false, // Estimated timestamps, not accurate
      };
    }
    
    console.log('[LrcLib] No lyrics available');
    return null;
  } catch (error) {
    console.error('[LrcLib] Error fetching lyrics:', error);
    return null;
  }
}
