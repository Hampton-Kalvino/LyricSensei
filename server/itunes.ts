/**
 * iTunes Search API client
 * Free, no authentication required
 * For fetching album artwork and accurate metadata
 */

interface ITunesSearchResponse {
  resultCount: number;
  results: Array<{
    artistName: string;
    collectionName: string;
    trackName?: string;
    artworkUrl100: string;
    artworkUrl60: string;
    releaseDate: string;
    trackTimeMillis?: number;
    collectionId: number;
    trackId?: number;
  }>;
}

export interface ITunesTrackResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl: string;
  duration: number;
  releaseDate: string;
}

/**
 * Search iTunes for album artwork and metadata
 * @param artist Artist name
 * @param album Album name (optional)
 * @param track Track name (optional, helps narrow results)
 * @returns Album artwork URL (high-res) and metadata, or null if not found
 */
export async function searchITunes(
  artist: string,
  album?: string,
  track?: string
): Promise<{ artworkUrl: string; duration?: number } | null> {
  try {
    // Build search query - prioritize album + artist for best artwork
    const searchTerms = album 
      ? `${artist} ${album}`
      : track 
        ? `${artist} ${track}`
        : artist;
    
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerms)}&entity=album&limit=5`;
    
    console.log('[iTunes] Searching for:', searchTerms);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LyricSync/1.0',
      },
    });

    if (!response.ok) {
      console.error('[iTunes] API error:', response.status, response.statusText);
      return null;
    }

    const data: ITunesSearchResponse = await response.json();
    
    if (data.resultCount === 0 || data.results.length === 0) {
      console.log('[iTunes] No results found');
      return null;
    }

    // Get the first result (best match)
    const result = data.results[0];
    
    // Convert 100x100 artwork to high-res (1200x1200)
    let artworkUrl = result.artworkUrl100;
    artworkUrl = artworkUrl.replace('100x100bb', '1200x1200bb');
    
    console.log('[iTunes] Found artwork:', result.collectionName, 'by', result.artistName);
    console.log('[iTunes] Artwork URL:', artworkUrl);
    
    // Get duration if available (in milliseconds)
    const duration = result.trackTimeMillis ? Math.floor(result.trackTimeMillis / 1000) : undefined;
    
    return {
      artworkUrl,
      duration,
    };
  } catch (error) {
    console.error('[iTunes] Search error:', error);
    return null;
  }
}

/**
 * Search iTunes for tracks by name, artist, or both
 * @param query Search query (song name, artist, or both)
 * @param limit Maximum number of results (default: 20)
 * @returns Array of matching tracks with metadata
 */
export async function searchITunesTracks(
  query: string,
  limit: number = 20
): Promise<ITunesTrackResult[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`;
    
    console.log('[iTunes] Searching tracks for:', query);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LyricSensei/1.0',
      },
    });

    if (!response.ok) {
      console.error('[iTunes] API error:', response.status, response.statusText);
      return [];
    }

    const data: ITunesSearchResponse = await response.json();
    
    if (data.resultCount === 0 || data.results.length === 0) {
      console.log('[iTunes] No tracks found');
      return [];
    }

    // Map results to our format
    const tracks: ITunesTrackResult[] = data.results
      .filter(result => result.trackName && result.trackId) // Only include actual tracks
      .map(result => {
        // Convert 100x100 artwork to high-res (600x600 for list view)
        let artworkUrl = result.artworkUrl100;
        artworkUrl = artworkUrl.replace('100x100bb', '600x600bb');
        
        return {
          trackId: result.trackId!,
          trackName: result.trackName!,
          artistName: result.artistName,
          collectionName: result.collectionName,
          artworkUrl,
          duration: result.trackTimeMillis ? Math.floor(result.trackTimeMillis / 1000) : 0,
          releaseDate: result.releaseDate,
        };
      });

    console.log(`[iTunes] Found ${tracks.length} tracks`);
    
    return tracks;
  } catch (error) {
    console.error('[iTunes] Track search error:', error);
    return [];
  }
}
