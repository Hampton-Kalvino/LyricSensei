import crypto from "crypto";
import { FormData } from "undici";

interface ACRCloudConfig {
  accessKey: string;
  accessSecret: string;
  host: string;
}

interface ACRCloudResponse {
  status: {
    msg: string;
    code: number;
  };
  metadata?: {
    music?: Array<{
      title: string;
      artists?: Array<{
        name: string;
      }>;
      album?: {
        name: string;
      };
      release_date?: string;
      play_offset_ms?: number;
      duration_ms?: number;
      external_metadata?: {
        youtube?: {
          vid: string;
        };
        spotify?: {
          track?: {
            id: string;
            name: string;
          };
          album?: {
            id: string;
            name: string;
          };
          artists?: Array<{
            id: string;
            name: string;
          }>;
        };
        deezer?: {
          track?: {
            id: string;
            name: string;
          };
          album?: {
            id: string;
            name: string;
          };
          artists?: Array<{
            id: string;
            name: string;
          }>;
        };
      };
      external_ids?: {
        isrc?: string;
        upc?: string;
      };
      score?: number;
    }>;
  };
}

export interface RecognizedSong {
  title: string;
  artist: string;
  album?: string;
  albumArtUrl?: string;
  releaseDate?: string;
  confidence: number;
  isrc?: string;
  spotifyTrackId?: string;
  playOffsetMs?: number;
  durationMs?: number;
  externalLinks?: {
    youtube?: string;
    spotify?: string;
    deezer?: string;
    appleMusic?: string;
  };
}

export class ACRCloudClient {
  private config: ACRCloudConfig;

  constructor(config: ACRCloudConfig) {
    this.config = config;
  }

  /**
   * Recognize song from audio buffer (base64 encoded)
   */
  async recognizeSong(audioBase64: string): Promise<RecognizedSong | null> {
    const timestamp = Math.floor(new Date().getTime() / 1000);
    const stringToSign = [
      "POST",
      "/v1/identify",
      this.config.accessKey,
      "audio",
      "1",
      timestamp.toString(),
    ].join("\n");

    const signature = crypto
      .createHmac("sha1", this.config.accessSecret)
      .update(Buffer.from(stringToSign, "utf-8"))
      .digest()
      .toString("base64");

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Use undici's FormData to properly construct multipart request
    const formData = new FormData();
    // Create a Blob from the audio buffer for proper multipart upload
    const audioBlob = new globalThis.Blob([audioBuffer], { type: "audio/wav" });
    formData.append("sample", audioBlob, "sample.wav");
    formData.append("access_key", this.config.accessKey);
    formData.append("data_type", "audio");
    formData.append("signature_version", "1");
    formData.append("signature", signature);
    formData.append("sample_bytes", audioBuffer.length.toString());
    formData.append("timestamp", timestamp.toString());

    try {
      console.log('[ACRCloud] Sending recognition request to:', this.config.host);
      console.log('[ACRCloud] Audio buffer size:', audioBuffer.length, 'bytes');
      
      const response = await fetch(`https://${this.config.host}/v1/identify`, {
        method: "POST",
        body: formData as any, // Type assertion needed for undici FormData
      });

      if (!response.ok) {
        console.error('[ACRCloud] HTTP Error:', response.status, response.statusText);
        throw new Error(`ACRCloud API returned ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as ACRCloudResponse;
      console.log('[ACRCloud] Response:', JSON.stringify(data, null, 2));

      // Handle ACRCloud error codes
      if (data.status.code !== 0) {
        console.error("[ACRCloud] Error code:", data.status.code, "Message:", data.status.msg);
        
        // Code 1001: No result found (song not recognized)
        if (data.status.code === 1001) {
          console.log("[ACRCloud] No match found - song not in database");
          return null; // Song not found - this is expected and not an error
        }
        
        // Code 2000: Invalid access key
        // Code 3000: Limit exceeded
        // Code 3001: Invalid signature
        // Code 3100: Host/fingerprint infrastructure failure
        throw new Error(`ACRCloud API error (${data.status.code}): ${data.status.msg}`);
      }

      const music = data.metadata?.music?.[0];
      if (!music) {
        console.log("[ACRCloud] Success response but no music metadata");
        return null;
      }
      
      console.log('[ACRCloud] Successfully recognized:', music.title, 'by', music.artists?.[0]?.name);

      // Extract artist name (primary artist)
      const artist = music.artists?.[0]?.name || "Unknown Artist";

      // Build external links
      const externalLinks: RecognizedSong["externalLinks"] = {};
      
      if (music.external_metadata?.youtube?.vid) {
        externalLinks.youtube = `https://www.youtube.com/watch?v=${music.external_metadata.youtube.vid}`;
      }
      
      if (music.external_metadata?.spotify?.track?.id) {
        externalLinks.spotify = `https://open.spotify.com/track/${music.external_metadata.spotify.track.id}`;
      }
      
      if (music.external_metadata?.deezer?.track?.id) {
        externalLinks.deezer = `https://www.deezer.com/track/${music.external_metadata.deezer.track.id}`;
      }

      // Calculate confidence (ACRCloud score is 0-100)
      const confidence = (music.score || 0) / 100;

      // Note: Album art would require Spotify API authentication
      // For now, we'll leave it as null and show a placeholder icon
      let albumArtUrl: string | undefined;
      
      const spotifyTrackId = music.external_metadata?.spotify?.track?.id;
      if (spotifyTrackId) {
        console.log('[ACRCloud] Spotify track ID available:', spotifyTrackId);
      }

      // Log play offset for debugging lyric sync
      if (music.play_offset_ms !== undefined) {
        console.log('[ACRCloud] Play offset:', music.play_offset_ms, 'ms (', music.play_offset_ms / 1000, 'seconds)');
      }

      return {
        title: music.title,
        artist,
        album: music.album?.name,
        albumArtUrl,
        releaseDate: music.release_date,
        confidence,
        isrc: music.external_ids?.isrc,
        spotifyTrackId,
        playOffsetMs: music.play_offset_ms,
        durationMs: music.duration_ms,
        externalLinks: Object.keys(externalLinks).length > 0 ? externalLinks : undefined,
      };
    } catch (error) {
      console.error("ACRCloud API error:", error);
      // Re-throw the original error to preserve error codes/messages for route-level handling
      throw error;
    }
  }
}

// Export singleton instance
let acrcloudClient: ACRCloudClient | null = null;

export function getACRCloudClient(): ACRCloudClient {
  if (!acrcloudClient) {
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET;
    const host = process.env.ACRCLOUD_HOST;

    if (!accessKey || !accessSecret || !host) {
      throw new Error(
        "ACRCloud credentials not configured. Please set ACRCLOUD_ACCESS_KEY, ACRCLOUD_ACCESS_SECRET, and ACRCLOUD_HOST environment variables."
      );
    }

    acrcloudClient = new ACRCloudClient({
      accessKey,
      accessSecret,
      host,
    });
  }

  return acrcloudClient;
}
