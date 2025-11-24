ute)
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
        
        const sourceLanguage = translations[0]?.sourceLanguage;
        
        const baseLang = sourceLanguage?.split('-')[0];
        
        const phonetic_languages = ['es', 'fr', 'pt', 'de', 'pa', 'hi', 'zu', 'xh'];
        
        const needsPhonetics = baseLang && phonetic_languages.includes(baseLang);
        const hasMissingPhonetics = translations.some(t => 
          !t.phoneticGuide || 
          t.phoneticGuide.trim() === '' ||
          t.phoneticGuide === t.originalText ||
          t.phoneticGuide === t.translatedText
        );
        
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
          
          await storage.saveTranslations(songId, language, []);
          translations = [];
        }
      }
      
      if (translations.length === 0) {
        // Check for guest user OR authenticated user
        const guestId = req.headers['x-guest-id'];
        let userId: string;

        if (guestId && typeof guestId === 'string' && guestId.startsWith('guest-')) {
          userId = guestId;
        } else if (req.isAuthenticated()) {
          userId = (req.user as any).claims.sub;
        } else {
          return res.status(401).json({ error: "Authentication required" });
        }

        // Check daily translation limit (apply to all users including guests)
        const limitCheck = await storage.checkAndUpdateTranslationLimit(userId);

        if (!limitCheck.allowed) {
          return res.status(429).json({ 
            error: "Daily translation limit reached. Upgrade to Premium for unlimited translations!",
            dailyLimitReached: true,
            remaining: 0
          });
        }

        // Generate new translations (lyrics already fetched above)
        const lyricTexts = lyrics.map((line) => line.text);
        
        const song = await storage.getSong(songId);
        const songLanguage = song?.detectedLanguage;
        
        try {
          const translationResults = await batchTranslateLyrics(
            lyricTexts, 
            language, 
            songLanguage && songLanguage !== 'unknown' ? songLanguage : undefined
          );
          
          translations = translationResults.map((result) => ({
            ...result,
            targetLanguage: language,
          }));
          
          if (translationResults.length > 0 && translationResults[0].sourceLanguage) {
            const detectedLang = translationResults[0].sourceLanguage;
            if (detectedLang !== 'unknown' && (!songLanguage || songLanguage === 'unknown')) {
              await storage.updateSong(songId, { detectedLanguage: detectedLang });
              console.log(`[Translation] Persisted detected language: ${detectedLang} for song ${songId} (was: ${songLanguage || 'null'})`);
            }
          }
          
          await storage.saveTranslations(songId, language, translations);
        } catch (translationError: any) {
          console.error("Translation error:", translationError);
          
          return res.status(503).json({ 
            error: "Translation service is currently unavailable. Please try again later." 
          });
        }
      }
      
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
    