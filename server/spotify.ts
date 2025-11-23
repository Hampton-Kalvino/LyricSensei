/**
 * Spotify API client using Replit connector
 * For fetching album artwork and track metadata
 */

import { SpotifyApi } from "@spotify/web-api-ts-sdk";

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=spotify',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);
   const refreshToken =
    connectionSettings?.settings?.oauth?.credentials?.refresh_token;
  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
const clientId = connectionSettings?.settings?.oauth?.credentials?.client_id;
  const expiresIn = connectionSettings.settings?.oauth?.credentials?.expires_in;
  if (!connectionSettings || (!accessToken || !clientId || !refreshToken)) {
    throw new Error('Spotify not connected');
  }
  return {accessToken, clientId, refreshToken, expiresIn};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
async function getUncachableSpotifyClient() {
  const {accessToken, clientId, refreshToken, expiresIn} = await getAccessToken();

  const spotify = SpotifyApi.withAccessToken(clientId, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn || 3600,
    refresh_token: refreshToken,
  });

  return spotify;
}

/**
 * Fetch track details including album artwork and preview URL
 */
export async function getTrackDetails(spotifyTrackId: string): Promise<{ albumArt: string | null; previewUrl: string | null }> {
  try {
    console.log('[Spotify] Fetching track details for:', spotifyTrackId);
    
    const spotify = await getUncachableSpotifyClient();
    const track = await spotify.tracks.get(spotifyTrackId);
    
    let albumArt: string | null = null;
    if (track.album.images && track.album.images.length > 0) {
      // Get the highest quality image (first in the array)
      albumArt = track.album.images[0].url;
      console.log('[Spotify] Album art found');
    }
    
    // Check for preview URL (may be null for most tracks as of Nov 2024)
    const previewUrl = track.preview_url || null;
    if (previewUrl) {
      console.log('[Spotify] Preview URL found:', previewUrl);
    } else {
      console.log('[Spotify] No preview URL available (deprecated feature)');
    }
    
    return { albumArt, previewUrl };
  } catch (error) {
    console.error('[Spotify] Error fetching track details:', error);
    return { albumArt: null, previewUrl: null };
  }
}

/**
 * Fetch album artwork URL for a Spotify track
 * @deprecated Use getTrackDetails instead to get both artwork and preview URL
 */
export async function getAlbumArtwork(spotifyTrackId: string): Promise<string | null> {
  const { albumArt } = await getTrackDetails(spotifyTrackId);
  return albumArt;
}
