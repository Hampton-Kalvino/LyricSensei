import jwt from 'jsonwebtoken';

interface AppleMusicPlaylist {
  id: string;
  name: string;
  description: string;
  artworkUrl: string;
  trackCount: number;
}

interface AppleMusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  previewUrl?: string;
  isrc?: string;
  durationMs?: number;
}

export function generateAppleMusicToken(): string | null {
  const privateKey = process.env.APPLE_MUSIC_PRIVATE_KEY;
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;

  if (!privateKey || !teamId || !keyId) {
    console.warn('[Apple Music] Missing credentials - APPLE_MUSIC_PRIVATE_KEY, APPLE_TEAM_ID, or APPLE_KEY_ID');
    return null;
  }

  try {
    const token = jwt.sign({}, privateKey.replace(/\\n/g, '\n'), {
      algorithm: 'ES256',
      expiresIn: '180d',
      issuer: teamId,
      header: {
        alg: 'ES256',
        kid: keyId
      }
    });
    
    return token;
  } catch (error) {
    console.error('[Apple Music] Error generating token:', error);
    return null;
  }
}

export class AppleMusicService {
  private developerToken: string;
  private baseUrl = 'https://api.music.apple.com/v1';

  constructor(developerToken: string) {
    this.developerToken = developerToken;
  }

  private getLanguageSearchTerms(language: string): string[] {
    const searchTerms: Record<string, string[]> = {
      spanish: [
        'Spanish Hits',
        'Latin Pop',
        'Reggaeton',
        'Spanish Ballads',
        'Top Latino'
      ],
      french: [
        'French Pop',
        'Chanson Française',
        'French Hits',
        'French Classics'
      ],
      german: [
        'German Pop',
        'Deutsche Hits',
        'German Music'
      ],
      italian: [
        'Italian Pop',
        'Italian Hits',
        'Musica Italiana'
      ],
      japanese: [
        'J-Pop',
        'Japanese Hits',
        'Japanese Rock',
        'City Pop Japan'
      ],
      korean: [
        'K-Pop',
        'Korean Hits',
        'K-Hip Hop'
      ],
      portuguese: [
        'Portuguese Pop',
        'Brazilian Music',
        'MPB'
      ],
      chinese: [
        'C-Pop',
        'Mandopop',
        'Chinese Hits'
      ],
      russian: [
        'Russian Pop',
        'Russian Hits'
      ]
    };

    return searchTerms[language.toLowerCase()] || [`${language} Music`];
  }

  async getLanguagePlaylists(language: string, countryCode: string = 'us'): Promise<AppleMusicPlaylist[]> {
    const searchQueries = this.getLanguageSearchTerms(language);
    const playlists: AppleMusicPlaylist[] = [];
    const seenIds = new Set<string>();

    for (const query of searchQueries) {
      try {
        const response = await fetch(
          `${this.baseUrl}/catalog/${countryCode}/search?types=playlists&term=${encodeURIComponent(query)}&limit=10`,
          {
            headers: {
              'Authorization': `Bearer ${this.developerToken}`,
            }
          }
        );

        if (!response.ok) {
          console.error(`[Apple Music] Search failed for "${query}": ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        if (data.results?.playlists?.data) {
          for (const p of data.results.playlists.data) {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              playlists.push({
                id: p.id,
                name: p.attributes.name,
                description: p.attributes.description?.standard || '',
                artworkUrl: p.attributes.artwork?.url?.replace('{w}', '500').replace('{h}', '500') || '',
                trackCount: p.attributes.trackCount || 0
              });
            }
          }
        }
      } catch (error) {
        console.error(`[Apple Music] Error fetching "${query}":`, error);
      }
    }

    return playlists;
  }

  async getPlaylistTracks(playlistId: string, countryCode: string = 'us'): Promise<AppleMusicTrack[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/catalog/${countryCode}/playlists/${playlistId}/tracks?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${this.developerToken}`
          }
        }
      );

      if (!response.ok) {
        console.error(`[Apple Music] Failed to fetch playlist tracks: ${response.status}`);
        return [];
      }

      const data = await response.json();

      if (data.data) {
        return data.data.map((track: any) => ({
          id: track.id,
          title: track.attributes.name,
          artist: track.attributes.artistName,
          album: track.attributes.albumName,
          artworkUrl: track.attributes.artwork?.url?.replace('{w}', '300').replace('{h}', '300') || '',
          previewUrl: track.attributes.previews?.[0]?.url,
          isrc: track.attributes.isrc,
          durationMs: track.attributes.durationInMillis
        }));
      }

      return [];
    } catch (error) {
      console.error('[Apple Music] Error fetching playlist tracks:', error);
      return [];
    }
  }

  async getCharts(countryCode: string = 'us'): Promise<AppleMusicTrack[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/catalog/${countryCode}/charts?types=songs&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${this.developerToken}`
          }
        }
      );

      if (!response.ok) {
        console.error(`[Apple Music] Failed to fetch charts: ${response.status}`);
        return [];
      }

      const data = await response.json();

      if (data.results?.songs?.[0]?.data) {
        return data.results.songs[0].data.map((track: any) => ({
          id: track.id,
          title: track.attributes.name,
          artist: track.attributes.artistName,
          album: track.attributes.albumName,
          artworkUrl: track.attributes.artwork?.url?.replace('{w}', '300').replace('{h}', '300') || '',
          previewUrl: track.attributes.previews?.[0]?.url,
          isrc: track.attributes.isrc,
          durationMs: track.attributes.durationInMillis
        }));
      }

      return [];
    } catch (error) {
      console.error('[Apple Music] Error fetching charts:', error);
      return [];
    }
  }
}

let appleMusicServiceInstance: AppleMusicService | null = null;

export function getAppleMusicService(): AppleMusicService | null {
  if (appleMusicServiceInstance) {
    return appleMusicServiceInstance;
  }

  const token = generateAppleMusicToken();
  if (!token) {
    return null;
  }

  appleMusicServiceInstance = new AppleMusicService(token);
  return appleMusicServiceInstance;
}
