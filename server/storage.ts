import type { Song, LyricLine, Translation, User, UpsertUser, InsertSong, InsertLyric, InsertTranslationsCache, RecognitionHistory, InsertRecognitionHistory, UserFavorite, InsertUserFavorite, PracticeStats, InsertPracticeStats, PracticeStatsWithSong, PronunciationAssessment, InsertPronunciationAssessment, PracticeSessionCache, InsertPracticeSessionCache, AzureUsageLedger, InsertAzureUsageLedger } from "@shared/schema";
import { songs, lyrics, translationsCache, users, recognitionHistory, userFavorites, practiceStats, pronunciationAssessments, practiceSessionCache, azureUsageLedger } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Songs
  getSong(id: string): Promise<Song | undefined>;
  getAllSongs(): Promise<Song[]>;
  createSong(song: InsertSong): Promise<Song>;
  findOrCreateSongByMetadata(title: string, artist: string, album?: string, albumArt?: string, duration?: number): Promise<Song>;
  updateSong(id: string, updates: Partial<InsertSong>): Promise<void>;
  
  // Lyrics
  getLyrics(songId: string): Promise<LyricLine[]>;
  saveLyrics(songId: string, lyricLines: LyricLine[]): Promise<void>;
  
  // Translations
  getTranslations(songId: string, language: string): Promise<Translation[]>;
  saveTranslations(songId: string, language: string, translationList: Translation[]): Promise<void>;
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(id: string, updates: { username?: string; country?: string; firstName?: string; lastName?: string; profileImageUrl?: string }): Promise<User>;
  updateUserPremiumStatus(id: string, isPremium: boolean): Promise<void>;
  updateUserStripeInfo(id: string, customerId?: string, subscriptionId?: string): Promise<void>;
  updateUserTranslationCount(id: string, count: number, resetDate: string): Promise<void>;
  checkAndUpdateTranslationLimit(userId: string): Promise<{ allowed: boolean, remaining: number }>;
  updateUserAuthProvider(userId: string, provider: string): Promise<void>;
  
  // Recognition History
  addRecognitionHistory(history: InsertRecognitionHistory): Promise<RecognitionHistory>;
  getUserRecognitionHistory(userId: string, limit?: number): Promise<Array<RecognitionHistory & { song: Song }>>;
  getTopResearchedSongs(limit?: number): Promise<Array<Song & { recognitionCount: number }>>;
  
  // Favorites
  addFavorite(userId: string, songId: string): Promise<UserFavorite>;
  removeFavorite(userId: string, songId: string): Promise<void>;
  getUserFavorites(userId: string): Promise<Array<UserFavorite & { song: Song }>>;
  isFavorite(userId: string, songId: string): Promise<boolean>;
  
  // Practice Stats
  updatePracticeStats(userId: string, songId: string, totalAttempts: number, successfulAttempts: number): Promise<PracticeStats>;
  getUserPracticeStats(userId: string): Promise<PracticeStatsWithSong[]>;
  getSongPracticeStats(userId: string, songId: string): Promise<PracticeStats | undefined>;
  
  // Pronunciation Assessments
  savePronunciationAssessment(assessment: InsertPronunciationAssessment): Promise<PronunciationAssessment>;
  getPronunciationAssessment(assessmentHash: string): Promise<PronunciationAssessment | undefined>;
  getUserPronunciationAssessments(userId: string, songId?: string): Promise<PronunciationAssessment[]>;
  cleanupExpiredAssessments(): Promise<void>;
  
  // Practice Session Cache
  savePracticeSessionCache(cache: InsertPracticeSessionCache): Promise<PracticeSessionCache>;
  getPracticeSessionCache(userId: string, songId: string, lineHash: string, locale: string): Promise<PracticeSessionCache | undefined>;
  cleanupExpiredCache(): Promise<void>;
  
  // Azure Usage Ledger
  recordAzureUsage(usage: InsertAzureUsageLedger): Promise<AzureUsageLedger>;
  getUserUsageForPeriod(userId: string, feature: string, billingWindowStart: Date): Promise<number>;
  getUserUsageStats(userId: string, feature: string): Promise<{ currentPeriodUsage: number; billingWindowStart: Date }>;
}

export class DatabaseStorage implements IStorage {
  // Songs
  async getSong(id: string): Promise<Song | undefined> {
    const [song] = await db.select().from(songs).where(eq(songs.id, id));
    if (!song) return undefined;
    
    // Normalize duration if it appears to be in milliseconds (> 3600 seconds = 1 hour)
    if (song.duration > 3600) {
      const normalizedDuration = Math.floor(song.duration / 1000);
      console.log(`[Storage] Normalizing legacy duration for song ${song.id}: ${song.duration} → ${normalizedDuration}s`);
      await this.updateSong(song.id, { duration: normalizedDuration });
      return { ...song, duration: normalizedDuration };
    }
    
    return song;
  }

  async getAllSongs(): Promise<Song[]> {
    const allSongs = await db.select().from(songs);
    
    // Normalize legacy millisecond durations in all songs
    return allSongs.map(song => {
      if (song.duration > 3600) {
        const normalizedDuration = Math.floor(song.duration / 1000);
        console.log(`[Storage] Normalizing legacy duration for song ${song.id}: ${song.duration} → ${normalizedDuration}s`);
        // Note: We don't auto-persist here to avoid unnecessary DB writes
        // The next time this song is accessed via getSong or findOrCreateSongByMetadata, it will be persisted
        return { ...song, duration: normalizedDuration };
      }
      return song;
    });
  }

  async createSong(song: InsertSong): Promise<Song> {
    const [newSong] = await db.insert(songs).values(song).returning();
    return newSong;
  }

  async findOrCreateSongByMetadata(title: string, artist: string, album?: string, albumArt?: string, duration?: number): Promise<Song> {
    // Normalize title, artist, and album for comparison (case-insensitive, trimmed)
    const normalizedTitle = title.trim().toLowerCase();
    const normalizedArtist = artist.trim().toLowerCase();
    const normalizedAlbum = album?.trim().toLowerCase() || '';
    
    // Try to find existing song by normalized title, artist, AND album
    // This ensures different versions (live vs studio, different albums) are separate entries
    const allSongs = await db.select().from(songs);
    const existingSong = allSongs.find(
      s => s.title.trim().toLowerCase() === normalizedTitle && 
           s.artist.trim().toLowerCase() === normalizedArtist &&
           (s.album?.trim().toLowerCase() || '') === normalizedAlbum
    );
    
    if (existingSong) {
      // Check if legacy millisecond duration needs fixing (BEFORE modifying the object)
      const hasLegacyDuration = existingSong.duration > 3600;
      const normalizedLegacyDuration = hasLegacyDuration 
        ? Math.floor(existingSong.duration / 1000) 
        : existingSong.duration;
      
      if (hasLegacyDuration) {
        console.log(`[Storage] Detected legacy duration for song ${existingSong.id}: ${existingSong.duration} → ${normalizedLegacyDuration}s`);
      }
      
      // Update duration and album art if provided and different
      const updates: Partial<InsertSong> = {};
      
      // Always fix legacy duration
      if (hasLegacyDuration) {
        updates.duration = normalizedLegacyDuration;
      } else if (duration !== undefined) {
        // Update if: new value is different, OR existing is 0/null (missing data)
        const shouldUpdateDuration = duration !== existingSong.duration || 
                                     existingSong.duration === 0 || 
                                     existingSong.duration === null;
        if (shouldUpdateDuration && duration > 0) {
          updates.duration = duration;
        }
      }
      
      if (albumArt !== undefined) {
        // Update if: new value is different, OR existing is null (missing data)
        const shouldUpdateArt = albumArt !== existingSong.albumArt || 
                               existingSong.albumArt === null;
        if (shouldUpdateArt && albumArt) {
          updates.albumArt = albumArt;
        }
      }
      
      // Persist updates if needed
      if (Object.keys(updates).length > 0) {
        await this.updateSong(existingSong.id, updates);
        return { ...existingSong, ...updates };
      }
      
      return existingSong;
    }

    // Create new song if not found
    // Sanitize incoming duration (if > 3600, assume it's in milliseconds and convert)
    let sanitizedDuration = duration ?? 180;
    if (sanitizedDuration > 3600) {
      console.log(`[Storage] Sanitizing incoming duration: ${sanitizedDuration} → ${Math.floor(sanitizedDuration / 1000)}s`);
      sanitizedDuration = Math.floor(sanitizedDuration / 1000);
    }
    
    const newSong: InsertSong = {
      title: title.trim(),
      artist: artist.trim(),
      album: album?.trim() || null,
      duration: sanitizedDuration,
      albumArt: albumArt ?? null,
      audioUrl: null,
    };

    const [created] = await db.insert(songs).values(newSong).returning();
    return created;
  }

  // Lyrics
  async getLyrics(songId: string): Promise<LyricLine[]> {
    const lyricLines = await db
      .select()
      .from(lyrics)
      .where(eq(lyrics.songId, songId))
      .orderBy(lyrics.startTime, lyrics.id); // Deterministic ordering
    
    return lyricLines.map(l => ({
      id: l.id,
      startTime: l.startTime,
      endTime: l.endTime,
      text: l.text,
    }));
  }

  async saveLyrics(songId: string, lyricLines: LyricLine[]): Promise<void> {
    // Delete existing lyrics for this song
    await db.delete(lyrics).where(eq(lyrics.songId, songId));
    
    // Insert new lyrics
    if (lyricLines.length > 0) {
      await db.insert(lyrics).values(
        lyricLines.map(l => ({
          songId,
          startTime: l.startTime,
          endTime: l.endTime,
          text: l.text,
        }))
      );
    }
  }

  // Translations
  async getTranslations(songId: string, language: string): Promise<Translation[]> {
    const [cached] = await db
      .select()
      .from(translationsCache)
      .where(
        and(
          eq(translationsCache.songId, songId),
          eq(translationsCache.language, language)
        )
      );
    
    if (cached) {
      return JSON.parse(cached.translations);
    }
    return [];
  }

  async saveTranslations(
    songId: string,
    language: string,
    translationList: Translation[]
  ): Promise<void> {
    // Delete existing cache entry
    await db
      .delete(translationsCache)
      .where(
        and(
          eq(translationsCache.songId, songId),
          eq(translationsCache.language, language)
        )
      );
    
    // Insert new cache entry
    await db.insert(translationsCache).values({
      songId,
      language,
      translations: JSON.stringify(translationList),
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(user: UpsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First try to find existing user by email (if email is provided)
    if (userData.email) {
      const existingUser = await this.getUserByEmail(userData.email);
      
      if (existingUser) {
        // Update existing user with new data
        const [updatedUser] = await db
          .update(users)
          .set({
            ...userData,
            id: existingUser.id, // Keep existing ID
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id))
          .returning();
        return updatedUser;
      }
    }
    
    // Create new user if no existing user found
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserProfile(id: string, updates: { username?: string; country?: string; firstName?: string; lastName?: string; profileImageUrl?: string }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserPremiumStatus(id: string, isPremium: boolean): Promise<void> {
    await db.update(users).set({ isPremium }).where(eq(users.id, id));
  }

  async updateUserStripeInfo(
    id: string,
    customerId?: string,
    subscriptionId?: string
  ): Promise<void> {
    await db
      .update(users)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      })
      .where(eq(users.id, id));
  }

  async updateUserTranslationCount(id: string, count: number, resetDate: string): Promise<void> {
    await db
      .update(users)
      .set({
        dailyTranslationCount: count,
        lastTranslationDate: new Date(resetDate),
      })
      .where(eq(users.id, id));
  }

  async updateUserAuthProvider(userId: string, provider: string): Promise<void> {
    await db.update(users).set({ authProvider: provider }).where(eq(users.id, userId));
  }

  async checkAndUpdateTranslationLimit(userId: string): Promise<{ allowed: boolean, remaining: number }> {
    const user = await this.getUser(userId);
    
    if (!user) {
      return { allowed: false, remaining: 0 };
    }

    // Premium users have unlimited translations
    if (user.isPremium) {
      return { allowed: true, remaining: -1 }; // -1 indicates unlimited
    }

    const FREE_TIER_DAILY_LIMIT = 4;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Check if we need to reset the daily count
    const lastTranslation = user.lastTranslationDate;
    const needsReset = !lastTranslation || 
      new Date(lastTranslation.getFullYear(), lastTranslation.getMonth(), lastTranslation.getDate()).getTime() < today.getTime();

    if (needsReset) {
      // Reset count for new day
      await db.update(users).set({
        dailyTranslationCount: 1,
        lastTranslationDate: now,
      }).where(eq(users.id, userId));
      
      return { allowed: true, remaining: FREE_TIER_DAILY_LIMIT - 1 };
    }

    // Check if user has exceeded limit
    if (user.dailyTranslationCount >= FREE_TIER_DAILY_LIMIT) {
      return { allowed: false, remaining: 0 };
    }

    // Increment count
    await db.update(users).set({
      dailyTranslationCount: user.dailyTranslationCount + 1,
      lastTranslationDate: now,
    }).where(eq(users.id, userId));

    return { 
      allowed: true, 
      remaining: FREE_TIER_DAILY_LIMIT - user.dailyTranslationCount - 1 
    };
  }

  // Recognition History
  async addRecognitionHistory(history: InsertRecognitionHistory): Promise<RecognitionHistory> {
    const [newHistory] = await db.insert(recognitionHistory).values(history).returning();
    return newHistory;
  }

  async getUserRecognitionHistory(userId: string, limit: number = 50): Promise<Array<RecognitionHistory & { song: Song }>> {
    const historyWithSongs = await db
      .select({
        id: recognitionHistory.id,
        userId: recognitionHistory.userId,
        songId: recognitionHistory.songId,
        confidence: recognitionHistory.confidence,
        recognizedAt: recognitionHistory.recognizedAt,
        song: songs,
      })
      .from(recognitionHistory)
      .leftJoin(songs, eq(recognitionHistory.songId, songs.id))
      .where(eq(recognitionHistory.userId, userId))
      .orderBy(desc(recognitionHistory.recognizedAt))
      .limit(limit);

    return historyWithSongs.map(h => ({
      id: h.id,
      userId: h.userId,
      songId: h.songId,
      confidence: h.confidence,
      recognizedAt: h.recognizedAt,
      song: h.song!,
    }));
  }

  async getTopResearchedSongs(limit: number = 10): Promise<Array<Song & { recognitionCount: number }>> {
    // Get songs with recognition count, ordered by count
    const topSongs = await db
      .select({
        song: songs,
        recognitionCount: sql<number>`count(${recognitionHistory.id})::int`,
      })
      .from(songs)
      .leftJoin(recognitionHistory, eq(songs.id, recognitionHistory.songId))
      .groupBy(songs.id)
      .orderBy(desc(sql`count(${recognitionHistory.id})`))
      .limit(limit);

    return topSongs
      .filter(result => result.recognitionCount > 0) // Only include songs that have been recognized
      .map(result => ({
        ...result.song,
        recognitionCount: result.recognitionCount,
      }));
  }

  async updateSong(id: string, updates: Partial<InsertSong>): Promise<void> {
    await db.update(songs).set(updates).where(eq(songs.id, id));
  }

  // Favorites
  async addFavorite(userId: string, songId: string): Promise<UserFavorite> {
    const [favorite] = await db.insert(userFavorites).values({
      userId,
      songId,
    }).returning();
    return favorite;
  }

  async removeFavorite(userId: string, songId: string): Promise<void> {
    await db.delete(userFavorites)
      .where(and(
        eq(userFavorites.userId, userId),
        eq(userFavorites.songId, songId)
      ));
  }

  async getUserFavorites(userId: string): Promise<Array<UserFavorite & { song: Song }>> {
    const favoritesWithSongs = await db
      .select({
        id: userFavorites.id,
        userId: userFavorites.userId,
        songId: userFavorites.songId,
        createdAt: userFavorites.createdAt,
        song: songs,
      })
      .from(userFavorites)
      .leftJoin(songs, eq(userFavorites.songId, songs.id))
      .where(eq(userFavorites.userId, userId))
      .orderBy(desc(userFavorites.createdAt));

    return favoritesWithSongs.map(f => ({
      id: f.id,
      userId: f.userId,
      songId: f.songId,
      createdAt: f.createdAt,
      song: f.song!,
    }));
  }

  async isFavorite(userId: string, songId: string): Promise<boolean> {
    const [favorite] = await db
      .select()
      .from(userFavorites)
      .where(and(
        eq(userFavorites.userId, userId),
        eq(userFavorites.songId, songId)
      ))
      .limit(1);
    
    return !!favorite;
  }

  // Practice Stats
  async updatePracticeStats(userId: string, songId: string, totalAttempts: number, successfulAttempts: number): Promise<PracticeStats> {
    // Try to find existing stats
    const [existing] = await db
      .select()
      .from(practiceStats)
      .where(and(
        eq(practiceStats.userId, userId),
        eq(practiceStats.songId, songId)
      ))
      .limit(1);

    if (existing) {
      // Update existing stats
      const [updated] = await db
        .update(practiceStats)
        .set({
          totalAttempts: existing.totalAttempts + totalAttempts,
          successfulAttempts: existing.successfulAttempts + successfulAttempts,
          lastPracticedAt: new Date(),
        })
        .where(and(
          eq(practiceStats.userId, userId),
          eq(practiceStats.songId, songId)
        ))
        .returning();
      return updated;
    } else {
      // Create new stats
      const [newStats] = await db
        .insert(practiceStats)
        .values({
          userId,
          songId,
          totalAttempts,
          successfulAttempts,
        })
        .returning();
      return newStats;
    }
  }

  async getUserPracticeStats(userId: string): Promise<PracticeStatsWithSong[]> {
    const statsWithSongs = await db
      .select({
        id: practiceStats.id,
        userId: practiceStats.userId,
        songId: practiceStats.songId,
        totalAttempts: practiceStats.totalAttempts,
        successfulAttempts: practiceStats.successfulAttempts,
        lastPracticedAt: practiceStats.lastPracticedAt,
        song: songs,
      })
      .from(practiceStats)
      .leftJoin(songs, eq(practiceStats.songId, songs.id))
      .where(eq(practiceStats.userId, userId))
      .orderBy(desc(practiceStats.lastPracticedAt));

    return statsWithSongs.map(s => {
      const accuracyPercentage = s.totalAttempts > 0 
        ? Math.min(100, Math.round((s.successfulAttempts / s.totalAttempts) * 100)) 
        : 0;
      
      return {
        id: s.id,
        userId: s.userId,
        songId: s.songId,
        totalAttempts: s.totalAttempts,
        successfulAttempts: s.successfulAttempts,
        lastPracticedAt: s.lastPracticedAt,
        song: {
          title: s.song!.title,
          artist: s.song!.artist,
          albumArt: s.song!.albumArt || undefined,
        },
        accuracyPercentage,
      };
    });
  }

  async getSongPracticeStats(userId: string, songId: string): Promise<PracticeStats | undefined> {
    const [stats] = await db
      .select()
      .from(practiceStats)
      .where(and(
        eq(practiceStats.userId, userId),
        eq(practiceStats.songId, songId)
      ))
      .limit(1);
    
    return stats;
  }

  // Pronunciation Assessments
  async savePronunciationAssessment(assessment: InsertPronunciationAssessment): Promise<PronunciationAssessment> {
    const [saved] = await db
      .insert(pronunciationAssessments)
      .values(assessment)
      .returning();
    return saved;
  }

  async getPronunciationAssessment(assessmentHash: string): Promise<PronunciationAssessment | undefined> {
    const [assessment] = await db
      .select()
      .from(pronunciationAssessments)
      .where(and(
        eq(pronunciationAssessments.assessmentHash, assessmentHash),
        gte(pronunciationAssessments.expiresAt, new Date())
      ))
      .limit(1);
    return assessment;
  }

  async getUserPronunciationAssessments(userId: string, songId?: string): Promise<PronunciationAssessment[]> {
    const conditions = songId 
      ? and(
          eq(pronunciationAssessments.userId, userId),
          eq(pronunciationAssessments.songId, songId),
          gte(pronunciationAssessments.expiresAt, new Date())
        )
      : and(
          eq(pronunciationAssessments.userId, userId),
          gte(pronunciationAssessments.expiresAt, new Date())
        );
    
    const assessments = await db
      .select()
      .from(pronunciationAssessments)
      .where(conditions)
      .orderBy(desc(pronunciationAssessments.createdAt));
    
    return assessments;
  }

  async cleanupExpiredAssessments(): Promise<void> {
    await db
      .delete(pronunciationAssessments)
      .where(lte(pronunciationAssessments.expiresAt, new Date()));
  }

  // Practice Session Cache
  async savePracticeSessionCache(cache: InsertPracticeSessionCache): Promise<PracticeSessionCache> {
    const [saved] = await db
      .insert(practiceSessionCache)
      .values(cache)
      .onConflictDoUpdate({
        target: [
          practiceSessionCache.userId,
          practiceSessionCache.songId,
          practiceSessionCache.lineHash,
          practiceSessionCache.locale
        ],
        set: {
          aggregatedScores: cache.aggregatedScores,
          expiresAt: cache.expiresAt,
        },
      })
      .returning();
    return saved;
  }

  async getPracticeSessionCache(
    userId: string,
    songId: string,
    lineHash: string,
    locale: string
  ): Promise<PracticeSessionCache | undefined> {
    const [cache] = await db
      .select()
      .from(practiceSessionCache)
      .where(and(
        eq(practiceSessionCache.userId, userId),
        eq(practiceSessionCache.songId, songId),
        eq(practiceSessionCache.lineHash, lineHash),
        eq(practiceSessionCache.locale, locale),
        gte(practiceSessionCache.expiresAt, new Date())
      ))
      .limit(1);
    return cache;
  }

  async cleanupExpiredCache(): Promise<void> {
    await db
      .delete(practiceSessionCache)
      .where(lte(practiceSessionCache.expiresAt, new Date()));
  }

  // Azure Usage Ledger
  async recordAzureUsage(usage: InsertAzureUsageLedger): Promise<AzureUsageLedger> {
    const [saved] = await db
      .insert(azureUsageLedger)
      .values(usage)
      .returning();
    return saved;
  }

  async getUserUsageForPeriod(
    userId: string,
    feature: string,
    billingWindowStart: Date
  ): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`sum(${azureUsageLedger.units})`,
      })
      .from(azureUsageLedger)
      .where(and(
        eq(azureUsageLedger.userId, userId),
        eq(azureUsageLedger.feature, feature),
        eq(azureUsageLedger.billingWindowStart, billingWindowStart)
      ));
    
    return result[0]?.total || 0;
  }

  async getUserUsageStats(
    userId: string,
    feature: string
  ): Promise<{ currentPeriodUsage: number; billingWindowStart: Date }> {
    // Get start of current billing period (beginning of current month)
    const now = new Date();
    const billingWindowStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const usage = await this.getUserUsageForPeriod(userId, feature, billingWindowStart);
    
    return {
      currentPeriodUsage: usage,
      billingWindowStart,
    };
  }
}

export const storage = new DatabaseStorage();
