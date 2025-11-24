import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";
import Stripe from "stripe";
import passport from "passport";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { batchTranslateLyrics, detectLanguage } from "./azure-translator";
import { isAuthenticated } from "./auth";
import { getACRCloudClient } from "./acrcloud";
import { fetchLyricsFromLrcLib } from "./lrclib";
import { getTrackDetails } from "./spotify";
import { searchITunes, searchITunesTracks } from "./itunes";
import {
  translateLyricsRequestSchema,
  recognizeSongRequestSchema,
  updateUserProfileSchema,
  manualSelectSongSchema,
  updatePracticeStatsSchema,
  type RecognitionResult,
  type User,
} from "@shared/schema";
import { ZodError, z } from "zod";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
if (!process.env.STRIPE_PRICE_ID) {
  throw new Error('Missing required Stripe secret: STRIPE_PRICE_ID');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication - NEW MULTI-PROVIDER AUTH
  const { setupNewAuth } = await import("./auth");
  await setupNewAuth(app);

  // New auth endpoint - get current user (updated for new auth system)
  app.get("/api/auth/user", (req: any, res) => {
    // Check for guest ID in headers
    const guestId = req.headers['x-guest-id'];
    
    if (guestId && typeof guestId === 'string' && guestId.startsWith('guest-')) {
      // Return a guest user object
      return res.json({
        id: guestId,
        email: null,
        username: 'Guest',
        isGuest: true,
        isPremium: false,
        createdAt: new Date().toISOString(),
      });
    }
    
    // Check for authenticated user
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    res.json(req.user);
  });

  // OLD - Keep for backward compatibility but won't be used
  // Auth endpoint - get current user
  app.get("/api/auth/user-old", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile
  app.put('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const validated = updateUserProfileSchema.parse(req.body);
      
      const updatedUser = await storage.updateUserProfile(userId, validated);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: "Invalid profile data",
          details: error.errors 
        });
      }
      
      if (error instanceof Error) {
        const pgError = error as any;
        if (pgError.code === '23505' || error.message.includes('unique constraint')) {
          return res.status(409).json({ error: "Username already taken" });
        }
      }
      
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Reset daily translation count (for testing purposes)
  app.post('/api/user/reset-translations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Reset the translation count to 0
      await storage.updateUserTranslationCount(user.id, 0, new Date().toISOString());

      res.json({ success: true, message: "Translation count reset successfully" });
    } catch (error) {
      console.error("Error resetting translations:", error);
      res.status(500).json({ error: "Failed to reset translation count" });
    }
  });

  // Google OAuth routes
  // Initiate Google OAuth
  app.get('/auth/google', passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  }));

  // Google OAuth callback
  app.get('/api/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/#/auth/login' }),
    (req: any, res) => {
      // Redirect to home page after successful login
      res.redirect('/#/');
    }
  );

  // Apple OAuth routes
  app.get('/auth/apple', passport.authenticate('apple', {
    scope: ['name', 'email']
  }));

  app.get('/api/auth/apple/callback',
    passport.authenticate('apple', { failureRedirect: '/#/auth/login' }),
    (req: any, res) => {
      res.redirect('/#/');
    }
  );

  // Facebook OAuth routes
  app.get('/auth/facebook', passport.authenticate('facebook', {
    scope: ['email', 'public_profile']
  }));

  app.get('/api/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/#/auth/login' }),
    (req: any, res) => {
      res.redirect('/#/');
    }
  );

  // Twitter OAuth routes
  app.get('/auth/twitter', passport.authenticate('twitter'));

  app.get('/api/auth/twitter/callback',
    passport.authenticate('twitter', { failureRedirect: '/#/auth/login' }),
    (req: any, res) => {
      res.redirect('/#/');
    }
  );

  // Login route - password-based auth
  app.post('/api/auth/login', async (req: any, res, next) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: 'Authentication error' });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || 'Invalid credentials' });
      }
      req.logIn(user, (err: any) => {
        if (err) {
          return res.status(500).json({ error: 'Login failed' });
        }
        res.json({ user });
      });
    })(req, res, next);
  });

  // Signup route
  app.post('/api/auth/signup', async (req: any, res) => {
    try {
      const { email, password, username, firstName, lastName } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({ error: 'Email, password, and username are required' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        id: randomBytes(16).toString('hex'),
        email,
        passwordHash,
        username,
        firstName,
        lastName,
        authProvider: 'password',
        isGuest: false,
      });

      // Log in the user
      req.logIn(user, (err: any) => {
        if (err) {
          return res.status(500).json({ error: 'Signup failed' });
        }
        res.json({ user });
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Signup failed' });
    }
  });

  // Guest mode route
  app.post('/api/auth/guest', async (req: any, res) => {
    try {
      // Create a guest user
      const guestUser = await storage.createUser({
        id: randomBytes(16).toString('hex'),
        email: `guest-${Date.now()}@lyricsensei.local`,
        username: `Guest_${Math.random().toString(36).substring(7)}`,
        authProvider: 'guest',
        isGuest: true,
      });

      // Log in the guest user
      req.logIn(guestUser, (err: any) => {
        if (err) {
          return res.status(500).json({ error: 'Guest login failed' });
        }
        res.json({ user: guestUser });
      });
    } catch (error) {
      console.error('Guest login error:', error);
      res.status(500).json({ error: 'Guest login failed' });
    }
  });

  // Logout route
  app.post('/api/auth/logout', (req: any, res) => {
    req.logOut((err: any) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  // Search for songs using iTunes API (MUST come before :id route)
  app.get("/api/songs/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      if (query.trim().length < 2) {
        return res.status(400).json({ error: "Search query must be at least 2 characters" });
      }

      console.log('[API] Searching for tracks:', query);
      
      const results = await searchITunesTracks(query, 20);
      
      res.json({ results });
    } catch (error) {
      console.error("Error searching songs:", error);
      res.status(500).json({ error: "Failed to search songs" });
    }
  });

  // Get top researched songs (MUST come before :id route)
  app.get("/api/songs/top-researched", async (_req, res) => {
    try {
      const topSongs = await storage.getTopResearchedSongs(10);
      res.json(topSongs);
    } catch (error) {
      console.error("Error fetching top researched songs:", error);
      res.status(500).json({ error: "Failed to fetch top researched songs" });
    }
  });

  // Get all songs
  app.get("/api/songs", async (_req, res) => {
    try {
      const songs = await storage.getAllSongs();
      res.json(songs);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get song by ID (MUST come after /search and /top-researched routes)
  app.get("/api/songs/:id", async (req, res) => {
    try {
      const song = await storage.getSong(req.params.id);
      if (!song) {
        return res.status(404).json({ error: "Song not found" });
      }
      res.json(song);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Manually select a song from search results
  app.post("/api/songs/manual-select", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body with Zod schema
      const validatedData = manualSelectSongSchema.parse(req.body);
      const { artist, title, album, albumArt, duration } = validatedData;

      const userId = (req.user as any).id || (req.user as any).claims?.sub;

      console.log('[Manual Select] Creating song:', title, 'by', artist);

      // Find or create song in database
      const song = await storage.findOrCreateSongByMetadata(
        title,
        artist,
        album || title, // Use title as album if not provided
        albumArt,
        duration ?? 180 // Default duration if not provided (handles 0 correctly)
      );

      // Fetch and save lyrics from LrcLib (async)
      fetchLyricsFromLrcLib(
        title,
        artist,
        album || title,
        song.duration
      ).then(async (lyricsResult) => {
        if (lyricsResult && lyricsResult.lyrics.length > 0) {
          console.log('[Manual Select] Saving', lyricsResult.lyrics.length, 'lyrics lines for song:', song.id);
          
          const lyricLines = lyricsResult.lyrics.map((lyric, index) => ({
            id: `${song.id}-${index}`,
            startTime: lyric.startTime,
            endTime: lyricsResult.lyrics[index + 1]?.startTime || song.duration,
            text: lyric.text,
          }));
          
          await storage.saveLyrics(song.id, lyricLines);
          await storage.updateSong(song.id, { hasSyncedLyrics: lyricsResult.isSynced });
          
          // Detect language from lyrics (async, fire-and-forget)
          const sampleText = lyricLines.slice(0, 3).map(l => l.text).join(' ');
          detectLanguage(sampleText)
            .then(detectedLang => {
              return storage.updateSong(song.id, { detectedLanguage: detectedLang });
            })
            .then(() => {
              console.log('[Manual Select] Language detection completed');
            })
            .catch(langError => {
              console.error('[Manual Select] Language detection failed (background):', langError);
            });
        }
      }).catch((error) => {
        console.error('[Manual Select] Failed to fetch lyrics:', error);
      });

      // Save to recognition history and get the server-side timestamp
      const historyRecord = await storage.addRecognitionHistory({
        userId,
        songId: song.id,
        confidence: 1.0, // Manual selection is always 100% confident
      });

      // Return RecognitionResult format matching frontend expectations
      const result = {
        songId: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        confidence: 1.0,
        albumArt: song.albumArt,
        previewOffsetSeconds: 0, // Manual selection starts from beginning
        timestamp: new Date(historyRecord.recognizedAt).getTime(),
      };

      res.json(result);
    } catch (error) {
      // Handle validation errors
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      console.error("Error in manual song selection:", error);
      res.status(500).json({ error: "Failed to select song" });
    }
  });

  // Get lyrics for a song
  app.get("/api/lyrics/:songId", async (req, res) => {
    try {
      const lyrics = await storage.getLyrics(req.params.songId);
      res.json(lyrics);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get translations for a song
  app.get("/api/translations/:songId/:language", async (req, res) => {
    try {
      const { songId, language } = req.params;
      
      // Get current lyrics (now properly ordered)
      const lyrics = await storage.getLyrics(songId);
      if (lyrics.length === 0) {
        return res.status(404).json({ error: "Lyrics not found" });
      }
      
      // Check if we have cached translations
      let translations = await storage.getTranslations(songId, language);
      
      // Validate cached translations match current lyrics
      if (translations.length > 0) {
        console.log(`[Translation Cache] Found ${translations.length} cached translations for ${language}`);
        console.log(`[Translation Cache] Sample phonetic: "${translations[0]?.phoneticGuide}"`);
        
        const isValid = translations.length === lyrics.length &&
          translations.every((t, idx) => t.originalText === lyrics[idx].text);
        
        // Also check if phonetic guides are missing or same as original for languages that should have them
        // NOTE: Check SOURCE language (from cached translation), not target language parameter
        const sourceLanguage = translations[0]?.sourceLanguage;
        
        // Normalize language code to base language (e.g., "pt-BR" → "pt")
        const baseLang = sourceLanguage?.split('-')[0];
        
        // Languages requiring custom phonetic generation (Latin scripts with special rules)
        const phonetic_languages = ['es', 'fr', 'pt', 'de', 'pa', 'hi', 'zu', 'xh'];
        
        // Check if phonetics are needed AND missing/invalid
        const needsPhonetics = baseLang && phonetic_languages.includes(baseLang);
        const hasMissingPhonetics = translations.some(t => 
          !t.phoneticGuide || 
          t.phoneticGuide.trim() === '' ||
          t.phoneticGuide === t.originalText || // Phonetic same as original = not processed
          t.phoneticGuide === t.translatedText   // Phonetic same as translation = not processed
        );
        
        // Regenerate if source language needs phonetics OR if sourceLanguage is missing (legacy cache)
        const shouldRegenerate = (needsPhonetics && hasMissingPhonetics) || !sourceLanguage;
        
        if (!isValid || shouldRegenerate) {
          if (!isValid) {
            console.log(`[Translation Cache] Mismatch detected for song ${songId} (${language}). Purging cache.`);
            console.log(`  - Lyrics count: ${lyrics.length}, Translations count: ${translations.length}`);
          }
          if (shouldRegenerate) {
            if (!sourceLanguage) {
              console.log(`[Translation Cache] Legacy cache missing sourceLanguage. Regenerating.`);
            } else {
              console.log(`[Translation Cache] Missing/invalid phonetics for ${baseLang}. Regenerating with phonetic guides.`);
            }
          }
          
          // Purge stale cache
          await storage.saveTranslations(songId, language, []);
          translations = [];
        }
      }
      
      if (translations.length === 0) {
        // Check user authentication - guest and authenticated users both need to be tracked
        let userId: string | null = null;
        let isGuestUser = false;
        
        // Check for guest ID in headers
        const guestId = (req.headers as any)['x-guest-id'];
        if (guestId && typeof guestId === 'string' && guestId.startsWith('guest-')) {
          userId = guestId;
          isGuestUser = true;
        } else if (req.isAuthenticated()) {
          userId = (req.user as any).id || (req.user as any).claims?.sub;
          isGuestUser = false;
        }
        
        if (userId) {
          // Check daily translation limit for free users and ALL guests
          const limitCheck = await storage.checkAndUpdateTranslationLimit(userId!);
          
          if (!limitCheck.allowed) {
            if (isGuestUser) {
              return res.status(403).json({ 
                error: "Daily translation limit reached. Create an account to continue translating!",
                dailyLimitReached: true,
                remaining: 0,
                requiresUpgrade: true
              });
            } else {
              return res.status(429).json({ 
                error: "Daily translation limit reached. Upgrade to Premium for unlimited translations!",
                dailyLimitReached: true,
                remaining: 0
              });
            }
          }
        }

        // Generate new translations (lyrics already fetched above)
        const lyricTexts = lyrics.map((line) => line.text);
        
        // Get song's detected language to use as source (prevents per-line auto-detection issues)
        const song = await storage.getSong(songId);
        const songLanguage = song?.detectedLanguage;
        
        try {
          console.log(`[Translation] Starting translation for ${lyricTexts.length} lines to ${language}`);
          console.log(`[Translation] Song detected language: ${songLanguage}, First line: "${lyricTexts[0]}"`);
          
          // Pass song's language as source to prevent Azure from mis-detecting each line
          const translationResults = await batchTranslateLyrics(
            lyricTexts, 
            language, 
            songLanguage && songLanguage !== 'unknown' ? songLanguage : undefined
          );
          
          console.log(`[Translation] Got ${translationResults.length} results from Azure`);
          
          translations = translationResults.map((result) => ({
            ...result,
            targetLanguage: language,
          }));
          
          // Only persist detected language if song language is unknown (don't overwrite manually set languages)
          if (translationResults.length > 0 && translationResults[0].sourceLanguage) {
            const detectedLang = translationResults[0].sourceLanguage;
            if (detectedLang !== 'unknown' && (!songLanguage || songLanguage === 'unknown')) {
              await storage.updateSong(songId, { detectedLanguage: detectedLang });
              console.log(`[Translation] Persisted detected language: ${detectedLang} for song ${songId} (was: ${songLanguage || 'null'})`);
            }
          }
          
          // Cache translations
          await storage.saveTranslations(songId, language, translations);
          console.log(`[Translation] Successfully cached ${translations.length} translations`);
        } catch (translationError: any) {
          console.error("[Translation] Azure error:", translationError);
          console.error("[Translation] Error details:", {
            message: translationError?.message,
            status: translationError?.status,
            response: translationError?.response?.statusText,
          });
          
          return res.status(503).json({ 
            error: "Translation service is currently unavailable. Please try again later." 
          });
        }
      }
      
      // Debug: Log what we're returning
      if (translations.length > 0) {
        console.log(`[Translation API] Returning ${translations.length} translations`);
        console.log(`[Translation API] Sample: "${translations[0].originalText}" → "${translations[0].translatedText}"`);
        console.log(`[Translation API] Sample phonetic: "${translations[0].phoneticGuide}"`);
      }
      
      res.json(translations);
    } catch (error) {
      console.error("Translation error:", error);
      res.status(500).json({ error: "An unexpected error occurred while fetching translations." });
    }
  });

  // Translate lyrics (manual translation endpoint)
  app.post("/api/translate", async (req, res) => {
    try {
      const validated = translateLyricsRequestSchema.parse(req.body);
      const translations = await batchTranslateLyrics(
        validated.lyrics,
        validated.targetLanguage
      );
      res.json(translations);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Health check endpoint - verify environment configuration
  app.get("/api/health", async (req, res) => {
    const health = {
      status: "ok",
      environment: process.env.NODE_ENV || "unknown",
      acrcloud: {
        configured: !!(process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_ACCESS_SECRET && process.env.ACRCLOUD_HOST),
        accessKeySet: !!process.env.ACRCLOUD_ACCESS_KEY,
        secretSet: !!process.env.ACRCLOUD_ACCESS_SECRET,
        hostSet: !!process.env.ACRCLOUD_HOST,
      },
      azureTranslator: {
        configured: !!(process.env.AZURE_TRANSLATOR_KEY && process.env.AZURE_TRANSLATOR_REGION),
        keySet: !!process.env.AZURE_TRANSLATOR_KEY,
        regionSet: !!process.env.AZURE_TRANSLATOR_REGION,
      },
      database: {
        configured: !!process.env.DATABASE_URL,
      },
      session: {
        configured: !!process.env.SESSION_SECRET,
      },
    };
    
    res.json(health);
  });

  // Recognize song using ACRCloud
  app.post("/api/recognize", async (req, res) => {
    try {
      const validated = recognizeSongRequestSchema.parse(req.body);
      
      // Check for guest ID in headers (for mobile/header-based auth)
      const guestId = (req.headers as any)['x-guest-id'];
      if (!guestId && !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get user ID (works for both guest and authenticated users)
      const userId = guestId || (req.user as any).id || (req.user as any).claims?.sub;
      
      // Use ACRCloud for real song recognition
      try {
        const acrcloud = getACRCloudClient();
        const recognizedSong = await acrcloud.recognizeSong(validated.audioData);
        
        if (!recognizedSong) {
          return res.status(404).json({ 
            error: "Song not recognized. Please try recording a clearer sample or a different part of the song." 
          });
        }

        // Fetch album art and metadata from iTunes (free, no auth required)
        let albumArtUrl = recognizedSong.albumArtUrl;
        let actualDuration = recognizedSong.durationMs ? Math.round(recognizedSong.durationMs / 1000) : 180;
        
        try {
          const itunesData = await searchITunes(
            recognizedSong.artist,
            recognizedSong.album,
            recognizedSong.title
          );
          
          if (itunesData) {
            albumArtUrl = itunesData.artworkUrl;
            console.log('[Recognition] Fetched album art from iTunes');
            
            if (itunesData.duration) {
              actualDuration = itunesData.duration;
              console.log('[Recognition] Using iTunes duration:', actualDuration, 'seconds');
            }
          }
        } catch (err) {
          console.error('[Recognition] Failed to fetch from iTunes:', err);
        }
        
        // Fallback to Spotify if iTunes didn't work
        if (!albumArtUrl && recognizedSong.spotifyTrackId) {
          try {
            const { albumArt } = await getTrackDetails(recognizedSong.spotifyTrackId);
            if (albumArt) {
              albumArtUrl = albumArt;
              console.log('[Recognition] Fetched album art from Spotify (fallback)');
            }
          } catch (err) {
            console.error('[Recognition] Failed to fetch from Spotify:', err);
          }
        }
        
        // Find or create song in database with accurate duration
        const song = await storage.findOrCreateSongByMetadata(
          recognizedSong.title,
          recognizedSong.artist,
          recognizedSong.album,
          albumArtUrl,
          actualDuration
        );
        
        // Update song with preview offset if available
        const updates: any = {};
        if (recognizedSong.playOffsetMs !== undefined) {
          updates.previewOffsetSeconds = Math.round(recognizedSong.playOffsetMs / 1000);
          console.log('[Recognition] Updating song with preview offset:', updates.previewOffsetSeconds, 'seconds');
        }
        
        if (Object.keys(updates).length > 0) {
          await storage.updateSong(song.id, updates);
        }
        
        // Fetch and save lyrics from LrcLib (don't wait for it)
        fetchLyricsFromLrcLib(
          recognizedSong.title,
          recognizedSong.artist,
          recognizedSong.album,
          song.duration
        ).then(async (lyricsResult) => {
          if (lyricsResult && lyricsResult.lyrics.length > 0) {
            console.log('[Recognition] Saving', lyricsResult.lyrics.length, 'lyrics lines for song:', song.id);
            
            // Convert parsed lyrics to LyricLine format
            const lyricLines = lyricsResult.lyrics.map((lyric, index) => ({
              id: `${song.id}-${index}`,
              startTime: lyric.startTime,
              endTime: lyricsResult.lyrics[index + 1]?.startTime || song.duration,
              text: lyric.text,
            }));
            
            await storage.saveLyrics(song.id, lyricLines);
            await storage.updateSong(song.id, { hasSyncedLyrics: lyricsResult.isSynced });
            console.log('[Recognition] Lyrics saved successfully (synced:', lyricsResult.isSynced, ')');
            
            // Detect language from lyrics (async, fire-and-forget)
            if (lyricLines.length > 0) {
              const sampleText = lyricLines.slice(0, 3).map(l => l.text).join(' ');
              detectLanguage(sampleText)
                .then(detectedLang => {
                  return storage.updateSong(song.id, { detectedLanguage: detectedLang });
                })
                .then(() => {
                  console.log('[Recognition] Language detection completed');
                })
                .catch(langError => {
                  console.error('[Recognition] Language detection failed (background):', langError);
                });
            }
          } else {
            console.log('[Recognition] No lyrics available for this song');
          }
        }).catch(err => {
          console.error('[Recognition] Error saving lyrics:', err);
        });
        
        // Save to recognition history
        await storage.addRecognitionHistory({
          userId,
          songId: song.id,
          confidence: recognizedSong.confidence,
        });
        
        const result: RecognitionResult = {
          songId: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album ?? undefined,
          albumArt: song.albumArt ?? undefined,
          previewOffsetSeconds: updates.previewOffsetSeconds ?? undefined,
          confidence: recognizedSong.confidence,
          timestamp: Date.now(),
        };

        res.json(result);
      } catch (acrError: any) {
        console.error("ACRCloud recognition error:", acrError);
        
        // Check if it's a configuration error
        if (acrError.message?.includes("credentials not configured")) {
          return res.status(503).json({ 
            error: "Song recognition service is not configured. Please contact support." 
          });
        }
        
        // Check for specific ACRCloud error codes
        if (acrError.message?.includes("2000") || acrError.message?.includes("Invalid access")) {
          return res.status(503).json({ 
            error: "Invalid API credentials. Please contact support." 
          });
        }
        
        if (acrError.message?.includes("3000") || acrError.message?.includes("Limit exceeded")) {
          return res.status(429).json({ 
            error: "Daily recognition limit exceeded. Please try again tomorrow or upgrade to Premium." 
          });
        }
        
        if (acrError.message?.includes("3001") || acrError.message?.includes("Invalid signature")) {
          return res.status(503).json({ 
            error: "Authentication error. Please contact support." 
          });
        }
        
        if (acrError.message?.includes("3100")) {
          return res.status(503).json({ 
            error: "Music recognition service is temporarily unavailable. Please try again in a moment." 
          });
        }
        
        return res.status(500).json({ 
          error: "Failed to recognize song. Please try again." 
        });
      }
    } catch (error) {
      console.error("Recognition endpoint error:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Get user recognition history
  app.get("/api/recognition-history", async (req, res) => {
    try {
      // Check for guest ID in headers (for mobile/header-based auth)
      const guestId = (req.headers as any)['x-guest-id'];
      if (!guestId && !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get user ID (works for both guest and authenticated users)
      const userId = guestId || (req.user as any).id || (req.user as any).claims?.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const history = await storage.getUserRecognitionHistory(userId, limit);
      
      // Get user favorites to mark them in history
      const favorites = await storage.getUserFavorites(userId);
      const favoriteSongIds = new Set(favorites.map(f => f.songId));
      
      // Transform to RecognitionResult format for frontend
      const results: RecognitionResult[] = history.map(h => ({
        songId: h.song.id,
        title: h.song.title,
        artist: h.song.artist,
        album: h.song.album ?? undefined,
        albumArt: h.song.albumArt ?? undefined,
        previewOffsetSeconds: h.song.previewOffsetSeconds ?? undefined,
        confidence: h.confidence,
        timestamp: h.recognizedAt.getTime(),
        isFavorite: favoriteSongIds.has(h.song.id),
      }));
      
      res.json(results);
    } catch (error) {
      console.error("History fetch error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get user favorites
  app.get("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const favorites = await storage.getUserFavorites(userId);
      
      // Transform to RecognitionResult format for frontend
      const results: RecognitionResult[] = favorites.map(f => ({
        songId: f.song.id,
        title: f.song.title,
        artist: f.song.artist,
        album: f.song.album ?? undefined,
        albumArt: f.song.albumArt ?? undefined,
        previewOffsetSeconds: f.song.previewOffsetSeconds ?? undefined,
        confidence: 1.0,
        timestamp: f.createdAt.getTime(),
        isFavorite: true,
      }));
      
      res.json(results);
    } catch (error) {
      console.error("Favorites fetch error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Add song to favorites
  app.post("/api/favorites/:songId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const { songId } = req.params;
      
      // Check if song exists
      const song = await storage.getSong(songId);
      if (!song) {
        return res.status(404).json({ error: "Song not found" });
      }
      
      // Check if already favorited
      const isAlreadyFavorite = await storage.isFavorite(userId, songId);
      if (isAlreadyFavorite) {
        return res.json({ message: "Already favorited" });
      }
      
      await storage.addFavorite(userId, songId);
      res.json({ message: "Song added to favorites" });
    } catch (error) {
      console.error("Add favorite error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Remove song from favorites
  app.delete("/api/favorites/:songId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const { songId } = req.params;
      
      await storage.removeFavorite(userId, songId);
      res.json({ message: "Song removed from favorites" });
    } catch (error) {
      console.error("Remove favorite error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Check if song is favorited
  app.get("/api/favorites/:songId/check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const { songId } = req.params;
      
      const isFavorite = await storage.isFavorite(userId, songId);
      res.json({ isFavorite });
    } catch (error) {
      console.error("Check favorite error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Practice Stats Routes
  
  // Update practice stats for a song
  app.post("/api/practice-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      
      // Validate request body using shared schema
      const validationSchema = updatePracticeStatsSchema
        .extend({
          songId: z.string().min(1),
        })
        .refine(
          (data) => data.successfulAttempts <= data.totalAttempts,
          { message: "Successful attempts cannot exceed total attempts" }
        );
      
      const validated = validationSchema.parse(req.body);
      
      const stats = await storage.updatePracticeStats(
        userId,
        validated.songId,
        validated.totalAttempts,
        validated.successfulAttempts
      );
      res.json(stats);
    } catch (error) {
      console.error("Update practice stats error:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request body",
          details: error.errors 
        });
      }
      
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get all practice stats for current user
  app.get("/api/practice-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const stats = await storage.getUserPracticeStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Get practice stats error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get practice stats for a specific song
  app.get("/api/practice-stats/:songId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const { songId } = req.params;
      
      const stats = await storage.getSongPracticeStats(userId, songId);
      res.json(stats || null);
    } catch (error) {
      console.error("Get song practice stats error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Social media sharing endpoint - serves Open Graph meta tags
  app.get("/share/:songId", async (req, res) => {
    try {
      const { songId } = req.params;
      const song = await storage.getSong(songId);
      
      if (!song) {
        return res.redirect('/');
      }
      
      const title = `${song.title} by ${song.artist} - LyricSync`;
      const description = `Translate and learn the pronunciation of "${song.title}" in any language with LyricSync's AI-powered phonetic guides.`;
      const imageUrl = song.albumArt || 'https://lyricsync.repl.co/icon-512.png';
      
      // Serve HTML with Open Graph meta tags for social crawlers
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>${title}</title>
            <meta name="description" content="${description}" />
            
            <!-- Open Graph / Facebook -->
            <meta property="og:type" content="music.song" />
            <meta property="og:url" content="${req.protocol}://${req.get('host')}/share/${songId}" />
            <meta property="og:title" content="${title}" />
            <meta property="og:description" content="${description}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:site_name" content="LyricSync" />
            
            <!-- Twitter -->
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content="${req.protocol}://${req.get('host')}/share/${songId}" />
            <meta property="twitter:title" content="${title}" />
            <meta property="twitter:description" content="${description}" />
            <meta property="twitter:image" content="${imageUrl}" />
            
            <!-- Redirect for normal navigation -->
            <meta http-equiv="refresh" content="0; url=/" />
            <script>
              window.location.href = '/';
            </script>
          </head>
          <body>
            <p>Redirecting to LyricSync...</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Share route error:", error);
      res.redirect('/');
    }
  });

  // Stripe: Diagnostic endpoint to check price configuration
  app.get('/api/stripe-price-check', isAuthenticated, async (req: any, res) => {
    try {
      const monthlyPriceId = process.env.STRIPE_PRICE_ID;
      const yearlyPriceId = process.env.STRIPE_YEARLY_PRICE_ID;

      const diagnostics: any = {
        envVarsConfigured: {
          monthly: !!monthlyPriceId,
          yearly: !!yearlyPriceId,
        },
        prices: {},
      };

      if (monthlyPriceId) {
        try {
          const monthlyPrice = await stripe.prices.retrieve(monthlyPriceId, {
            expand: ['product'],
          });
          const productData = monthlyPrice.product as any;
          diagnostics.prices.monthly = {
            id: monthlyPrice.id,
            active: monthlyPrice.active,
            type: monthlyPrice.type,
            amount: monthlyPrice.unit_amount,
            currency: monthlyPrice.currency,
            recurring: monthlyPrice.recurring,
            product: {
              id: productData.id,
              name: productData.name,
              active: productData.active,
              default_price: productData.default_price,
            },
          };
        } catch (error: any) {
          diagnostics.prices.monthly = { error: error.message };
        }
      }

      if (yearlyPriceId) {
        try {
          const yearlyPrice = await stripe.prices.retrieve(yearlyPriceId, {
            expand: ['product'],
          });
          const productData = yearlyPrice.product as any;
          diagnostics.prices.yearly = {
            id: yearlyPrice.id,
            active: yearlyPrice.active,
            type: yearlyPrice.type,
            amount: yearlyPrice.unit_amount,
            currency: yearlyPrice.currency,
            recurring: yearlyPrice.recurring,
            product: {
              id: productData.id,
              name: productData.name,
              active: productData.active,
              default_price: productData.default_price,
            },
          };
        } catch (error: any) {
          diagnostics.prices.yearly = { error: error.message };
        }
      }

      res.json(diagnostics);
    } catch (error: any) {
      console.error("Price check error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe: Create Checkout Session for subscription (Stripe-recommended approach)
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      let user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // If user already has an active subscription, redirect to account page
      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          return res.json({
            subscriptionId: subscription.id,
            status: subscription.status,
            alreadySubscribed: true,
          });
        }
      }

      // Create a new customer if needed
      if (!user.stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
          metadata: {
            userId: user.id,
          },
        });

        await storage.updateUserStripeInfo(user.id, customer.id);
        user = await storage.getUser(userId);
        if (!user) {
          return res.status(500).json({ error: "Failed to update user" });
        }
      }

      // Determine which price to use based on interval
      const { interval = 'month' } = req.body; // 'month' or 'year'
      const priceId = interval === 'year' 
        ? (process.env.STRIPE_YEARLY_PRICE_ID || process.env.STRIPE_PRICE_ID) 
        : process.env.STRIPE_PRICE_ID;

      console.log(`[Stripe Checkout] Creating Checkout Session for user ${user.id}`);
      console.log(`[Stripe Checkout] Interval: ${interval}`);
      console.log(`[Stripe Checkout] Price ID: ${priceId ? priceId.substring(0, 15) + '...' : 'MISSING'}`);

      if (!priceId) {
        throw new Error("Stripe price ID is not configured. Please set STRIPE_PRICE_ID and STRIPE_YEARLY_PRICE_ID in environment variables.");
      }

      // Build return URL for embedded checkout (preserve interval in query params)
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const returnUrl = `${baseUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}&interval=${interval}`;

      // Create Checkout Session with embedded mode (keeps payment form in-app)
      const session = await stripe.checkout.sessions.create({
        customer: user.stripeCustomerId!,
        mode: 'subscription',
        ui_mode: 'embedded', // Enables embedded checkout
        redirect_on_completion: 'always', // Force redirect after successful payment
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        return_url: returnUrl,
        metadata: {
          userId: user.id,
          interval,
        },
      });

      console.log(`[Stripe Checkout] ✓ Embedded Checkout Session created: ${session.id}`);
      console.log(`[Stripe Checkout] Client secret available: ${!!session.client_secret}`);

      res.json({
        sessionId: session.id,
        clientSecret: session.client_secret,
      });
    } catch (error: any) {
      console.error("Stripe Checkout Session error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Stripe: Get subscription status (called after checkout redirect)
  app.get('/api/subscription-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const { session_id } = req.query;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // If a session_id is provided, retrieve the session and subscription
      if (session_id && typeof session_id === 'string') {
        console.log(`[Stripe] Retrieving checkout session: ${session_id}`);
        
        const session = await stripe.checkout.sessions.retrieve(session_id, {
          expand: ['subscription'],
        });

        if (session.payment_status === 'paid' && session.subscription) {
          const subscription = session.subscription as any;
          
          console.log(`[Stripe] Checkout successful for user ${userId}`);
          console.log(`[Stripe] Subscription ID: ${subscription.id}`);
          console.log(`[Stripe] Subscription status: ${subscription.status}`);

          // Update user with subscription info
          await storage.updateUserStripeInfo(user.id, user.stripeCustomerId || undefined, subscription.id);
          await storage.updateUserPremiumStatus(user.id, true);

          return res.json({
            subscriptionId: subscription.id,
            status: subscription.status,
            isPremium: true,
          });
        }
      }

      // Otherwise, check existing subscription status
      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        
        return res.json({
          subscriptionId: subscription.id,
          status: subscription.status,
          isPremium: user.isPremium || false,
        });
      }

      // No subscription found
      res.json({
        isPremium: user.isPremium || false,
      });
    } catch (error: any) {
      console.error("Subscription status error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Stripe: Create customer portal session
  app.post('/api/create-portal-session', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const user = await storage.getUser(userId);

      if (!user || !user.stripeCustomerId) {
        return res.status(404).json({ error: "No Stripe customer found" });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${req.protocol}://${req.get('host')}/account`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Portal session error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Stripe: Webhook handler
  app.post('/api/stripe-webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(400).send('Webhook signature missing');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const customerId = session.customer as string;
          
          console.log(`[Webhook] Checkout session completed: ${session.id}`);
          console.log(`[Webhook] Customer: ${customerId}`);
          console.log(`[Webhook] Payment status: ${session.payment_status}`);
          
          if (session.payment_status === 'paid' && session.subscription) {
            const subscriptionId = session.subscription as string;
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            
            // Find user by Stripe customer ID
            const users = await storage.getAllUsers();
            const user = users.find((u: User) => u.stripeCustomerId === customerId);
            
            if (user) {
              console.log(`[Webhook] Activating premium for user: ${user.id}`);
              await storage.updateUserStripeInfo(user.id, customerId, subscriptionId);
              await storage.updateUserPremiumStatus(user.id, true);
            } else {
              console.warn(`[Webhook] User not found for customer: ${customerId}`);
            }
          }
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          console.log(`[Webhook] Subscription ${event.type}: ${subscription.id}`);
          console.log(`[Webhook] Status: ${subscription.status}`);
          
          // Find user by Stripe customer ID
          const users = await storage.getAllUsers();
          const user = users.find((u: User) => u.stripeCustomerId === customerId);
          
          if (user) {
            const isActive = subscription.status === 'active' || subscription.status === 'trialing';
            await storage.updateUserPremiumStatus(user.id, isActive);
            await storage.updateUserStripeInfo(user.id, customerId, subscription.id);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          console.log(`[Webhook] Subscription deleted: ${subscription.id}`);
          
          const users = await storage.getAllUsers();
          const user = users.find((u: User) => u.stripeCustomerId === customerId);
          
          if (user) {
            await storage.updateUserPremiumStatus(user.id, false);
          }
          break;
        }

        default:
          console.log(`[Webhook] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook handler error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // PRONUNCIATION ASSESSMENT ROUTES
  // ============================================

  // POST /api/pronunciation/assess - Hybrid pronunciation assessment
  app.post("/api/pronunciation/assess", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { 
        songId, 
        lineId, 
        wordIndex, 
        locale, 
        referenceText, 
        audioBase64,
        requestAzure = false, // Explicit flag to request Azure assessment
      } = req.body;

      // Validate required fields
      if (!songId || !locale || !referenceText || !audioBase64) {
        return res.status(400).json({ 
          error: "Missing required fields: songId, locale, referenceText, audioBase64" 
        });
      }

      // Create assessment hash for caching
      const crypto = await import('crypto');
      const assessmentHash = crypto
        .createHash('sha256')
        .update(`${audioBase64}-${referenceText}-${locale}`)
        .digest('hex');

      // 1. CHECK CACHE FIRST (70% reduction)
      const cachedAssessment = await storage.getPronunciationAssessment(assessmentHash);
      if (cachedAssessment) {
        console.log('[Pronunciation] Cache hit for assessment:', assessmentHash.substring(0, 8));
        return res.json({
          source: cachedAssessment.source,
          cached: true,
          assessment: {
            accuracyScore: cachedAssessment.accuracyScore,
            fluencyScore: cachedAssessment.fluencyScore,
            completenessScore: cachedAssessment.completenessScore,
            prosodyScore: cachedAssessment.prosodyScore,
            pronunciationScore: cachedAssessment.pronunciationScore,
            miscueMetadata: cachedAssessment.miscueMetadata ? JSON.parse(cachedAssessment.miscueMetadata) : null,
          },
        });
      }

      // 2. DECIDE: BROWSER OR AZURE? (Hybrid Model with Server-Side Enforcement)
      
      // Free users: ALWAYS browser
      if (!user.isPremium) {
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        
        await storage.savePronunciationAssessment({
          userId,
          songId,
          lineId: lineId || null,
          wordIndex: wordIndex || null,
          locale,
          source: 'browser',
          assessmentHash,
          azurePayload: null,
          accuracyScore: null,
          fluencyScore: null,
          completenessScore: null,
          prosodyScore: null,
          pronunciationScore: null,
          miscueMetadata: null,
          expiresAt,
        });

        return res.json({
          source: 'browser',
          cached: false,
          message: 'Use browser Web Speech API for instant feedback. Upgrade to premium for detailed Azure scoring.',
        });
      }

      // Premium users: SERVER-SIDE 90/10 ENFORCEMENT
      // Strategy: Probabilistic gating (race-condition free)
      // - 10% of requests randomly get Azure (Math.random() < 0.10)
      // - Statistically guarantees 10% Azure usage over time
      // - No race conditions (no shared state to check)
      // - Client cannot bypass (server-side random decision)
      // This ensures costs stay at $0.075/month per user regardless of client behavior
      
      const billingWindowStart = new Date();
      billingWindowStart.setDate(1);
      billingWindowStart.setHours(0, 0, 0, 0);
      
      const usageStats = await storage.getUserUsageStats(userId, 'pronunciation_assessment');
      const currentAzureUsage = usageStats.currentPeriodUsage;
      
      const TARGET_AZURE_PROBABILITY = 0.10; // 10% chance of Azure
      const PREMIUM_MONTHLY_LIMIT = 10000;
      
      // Enforce 90/10 split with PROBABILISTIC GATING (race-condition free):
      // 1. If quota exceeded → force browser
      // 2. If client didn't request Azure → use browser
      // 3. If client requested Azure → 10% random chance of approval
      
      const quotaExceeded = currentAzureUsage >= PREMIUM_MONTHLY_LIMIT;
      const randomlySelected = Math.random() < TARGET_AZURE_PROBABILITY;
      
      // Server decides: Azure only if requested AND randomly selected AND quota ok
      const shouldUseAzure = requestAzure && randomlySelected && !quotaExceeded;

      if (!shouldUseAzure) {
        // Force browser to maintain 90/10 ratio
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        
        await storage.savePronunciationAssessment({
          userId,
          songId,
          lineId: lineId || null,
          wordIndex: wordIndex || null,
          locale,
          source: 'browser',
          assessmentHash,
          azurePayload: null,
          accuracyScore: null,
          fluencyScore: null,
          completenessScore: null,
          prosodyScore: null,
          pronunciationScore: null,
          miscueMetadata: null,
          expiresAt,
        });

        const reason = quotaExceeded 
          ? 'Monthly Azure quota reached. Using browser scoring.'
          : !requestAzure
          ? 'Using browser Web Speech API for instant feedback.'
          : 'Maintaining 90/10 browser/Azure ratio. Using browser scoring for cost efficiency.';

        console.log(`[Pronunciation] Using browser - ${reason}`, {
          userId,
          requestAzure,
          randomlySelected,
          quotaExceeded,
          currentAzureUsage,
        });

        return res.json({
          source: 'browser',
          cached: false,
          message: reason,
          stats: {
            azureUsage: currentAzureUsage,
            azureLimit: PREMIUM_MONTHLY_LIMIT,
            percentUsed: Math.round((currentAzureUsage / PREMIUM_MONTHLY_LIMIT) * 100),
          },
        });
      }

      // 3. AZURE ASSESSMENT (Premium + Explicit Request + Ratio Allows)
      // At this point, server has approved Azure usage based on:
      // - User is premium
      // - Client requested Azure
      // - Quota not exceeded
      // - 90/10 ratio maintained

      // Optimize audio (40-60% cost savings)
      const { optimizeForAzureSpeech } = await import('./audio-utils');
      const optimizationResult = optimizeForAzureSpeech(audioBase64);
      
      console.log(`[Pronunciation] Audio optimized - compression: ${optimizationResult.compressionRatio.toFixed(1)}%`);

      // Call Azure Speech Services
      const { assessPronunciation } = await import('./azure-speech');
      const azureResult = await assessPronunciation(
        optimizationResult.audioBuffer,
        {
          referenceText,
          granularity: 'Phoneme',
          enableMiscue: true,
        },
        locale
      );

      // Record Azure usage
      await storage.recordAzureUsage({
        userId,
        feature: 'pronunciation_assessment',
        granularity: 'word',
        units: 1,
        billingWindowStart,
      });

      // Save assessment to cache (14-day expiration)
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      
      // Extract miscue information from word-level error types
      const miscues = azureResult.words
        ?.filter(w => w.errorType && w.errorType !== 'None')
        .map(w => ({
          word: w.word,
          errorType: w.errorType,
        })) || [];
      
      const savedAssessment = await storage.savePronunciationAssessment({
        userId,
        songId,
        lineId: lineId || null,
        wordIndex: wordIndex || null,
        locale,
        source: 'azure',
        assessmentHash,
        azurePayload: JSON.stringify(azureResult.rawResponse),
        accuracyScore: azureResult.accuracyScore,
        fluencyScore: azureResult.fluencyScore,
        completenessScore: azureResult.completenessScore,
        prosodyScore: azureResult.prosodyScore,
        pronunciationScore: azureResult.pronunciationScore,
        miscueMetadata: JSON.stringify(miscues),
        expiresAt,
      });

      console.log('[Pronunciation] Azure assessment completed:', {
        userId,
        songId,
        hash: assessmentHash.substring(0, 8),
        score: azureResult.pronunciationScore,
      });

      return res.json({
        source: 'azure',
        cached: false,
        assessment: {
          accuracyScore: savedAssessment.accuracyScore,
          fluencyScore: savedAssessment.fluencyScore,
          completenessScore: savedAssessment.completenessScore,
          prosodyScore: savedAssessment.prosodyScore,
          pronunciationScore: savedAssessment.pronunciationScore,
          miscueMetadata: JSON.parse(savedAssessment.miscueMetadata || '[]'),
          words: azureResult.words,
        },
      });
    } catch (error: any) {
      console.error('[Pronunciation] Assessment error:', error);
      res.status(500).json({ error: error.message || 'Pronunciation assessment failed' });
    }
  });

  // GET /api/pronunciation/history/:songId - Get user's pronunciation assessments for a song
  app.get("/api/pronunciation/history/:songId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const { songId } = req.params;

      const assessments = await storage.getUserPronunciationAssessments(userId, songId);

      return res.json({
        songId,
        assessments: assessments.map(a => ({
          id: a.id,
          lineId: a.lineId,
          wordIndex: a.wordIndex,
          locale: a.locale,
          source: a.source,
          accuracyScore: a.accuracyScore,
          fluencyScore: a.fluencyScore,
          completenessScore: a.completenessScore,
          prosodyScore: a.prosodyScore,
          pronunciationScore: a.pronunciationScore,
          createdAt: a.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('[Pronunciation] History fetch error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch pronunciation history' });
    }
  });

  // GET /api/pronunciation/usage - Get user's Azure usage stats
  app.get("/api/pronunciation/usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const usageStats = await storage.getUserUsageStats(userId, 'pronunciation_assessment');
      const PREMIUM_MONTHLY_LIMIT = 10000;
      const FREE_MONTHLY_LIMIT = 0; // Free users use browser only

      const limit = user.isPremium ? PREMIUM_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT;

      return res.json({
        isPremium: user.isPremium,
        currentPeriodUsage: usageStats.currentPeriodUsage,
        limit,
        billingWindowStart: usageStats.billingWindowStart,
        percentUsed: limit > 0 ? Math.round((usageStats.currentPeriodUsage / limit) * 100) : 0,
      });
    } catch (error: any) {
      console.error('[Pronunciation] Usage stats error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch usage stats' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
