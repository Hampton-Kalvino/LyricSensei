import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: text("sess").notNull(), // Using text instead of jsonb for broader compatibility
    expire: timestamp("expire").notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  })
);

// Users table - Updated for multi-provider auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  username: varchar("username").unique(),
  country: varchar("country"),
  profileImageUrl: varchar("profile_image_url"),
  isPremium: boolean("is_premium").notNull().default(false),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  dailyTranslationCount: integer("daily_translation_count").notNull().default(0),
  lastTranslationDate: timestamp("last_translation_date"),
  passwordHash: varchar("password_hash"), // For password auth
  authProvider: varchar("auth_provider").notNull().default("password"), // "password", "google"
  isGuest: boolean("is_guest").notNull().default(false), // Guest mode users
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Song schema
export const songs = pgTable("songs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  album: text("album"),
  duration: integer("duration").notNull(), // in seconds
  albumArt: text("album_art"),
  audioUrl: text("audio_url"),
  previewOffsetSeconds: integer("preview_offset_seconds"), // Offset where preview starts in full song
  hasSyncedLyrics: boolean("has_synced_lyrics").default(false), // Whether lyrics have accurate timestamps
  detectedLanguage: varchar("detected_language", { length: 10 }), // ISO language code (e.g., 'en', 'es', 'pt', 'fr')
});

export const insertSongSchema = createInsertSchema(songs).omit({
  id: true,
});

export type InsertSong = z.infer<typeof insertSongSchema>;
export type Song = typeof songs.$inferSelect;

// Lyrics table
export const lyrics = pgTable("lyrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  songId: varchar("song_id").notNull().references(() => songs.id, { onDelete: 'cascade' }),
  startTime: real("start_time").notNull(), // in seconds
  endTime: real("end_time").notNull(),
  text: text("text").notNull(),
});

export const insertLyricSchema = createInsertSchema(lyrics).omit({
  id: true,
});

export type InsertLyric = z.infer<typeof insertLyricSchema>;
export type Lyric = typeof lyrics.$inferSelect;

// For backwards compatibility with frontend
export interface LyricLine {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

// Translations cache table
export const translationsCache = pgTable("translations_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  songId: varchar("song_id").notNull().references(() => songs.id, { onDelete: 'cascade' }),
  language: text("language").notNull(),
  translations: text("translations").notNull(), // JSON string
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTranslationsCacheSchema = createInsertSchema(translationsCache).omit({
  id: true,
  createdAt: true,
});

export type InsertTranslationsCache = z.infer<typeof insertTranslationsCacheSchema>;
export type TranslationsCache = typeof translationsCache.$inferSelect;

// Translation result schema
export interface Translation {
  originalText: string;
  translatedText: string;
  phoneticGuide: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

// Recognition history table
export const recognitionHistory = pgTable("recognition_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  songId: varchar("song_id").notNull().references(() => songs.id, { onDelete: 'cascade' }),
  confidence: real("confidence").notNull(),
  recognizedAt: timestamp("recognized_at").notNull().defaultNow(),
});

export const insertRecognitionHistorySchema = createInsertSchema(recognitionHistory).omit({
  id: true,
  recognizedAt: true,
});

export type InsertRecognitionHistory = z.infer<typeof insertRecognitionHistorySchema>;
export type RecognitionHistory = typeof recognitionHistory.$inferSelect;

// User favorites table
export const userFavorites = pgTable("user_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  songId: varchar("song_id").notNull().references(() => songs.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueUserSong: unique().on(table.userId, table.songId),
}));

export const insertUserFavoriteSchema = createInsertSchema(userFavorites).omit({
  id: true,
  createdAt: true,
});

export type InsertUserFavorite = z.infer<typeof insertUserFavoriteSchema>;
export type UserFavorite = typeof userFavorites.$inferSelect;

// Practice stats table - tracks pronunciation practice accuracy per user per song
export const practiceStats = pgTable("practice_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  songId: varchar("song_id").notNull().references(() => songs.id, { onDelete: 'cascade' }),
  totalAttempts: integer("total_attempts").notNull().default(0),
  successfulAttempts: integer("successful_attempts").notNull().default(0),
  lastPracticedAt: timestamp("last_practiced_at").notNull().defaultNow(),
}, (table) => ({
  uniqueUserSong: unique().on(table.userId, table.songId),
}));

export const insertPracticeStatsSchema = createInsertSchema(practiceStats).omit({
  id: true,
  lastPracticedAt: true,
});

export const updatePracticeStatsSchema = z.object({
  totalAttempts: z.number().int().nonnegative(),
  successfulAttempts: z.number().int().nonnegative(),
});

export type InsertPracticeStats = z.infer<typeof insertPracticeStatsSchema>;
export type UpdatePracticeStats = z.infer<typeof updatePracticeStatsSchema>;
export type PracticeStats = typeof practiceStats.$inferSelect;

// Practice stats with song info for displaying
export interface PracticeStatsWithSong {
  id: string;
  userId: string;
  songId: string;
  totalAttempts: number;
  successfulAttempts: number;
  lastPracticedAt: Date;
  song: {
    title: string;
    artist: string;
    albumArt?: string;
  };
  accuracyPercentage: number;
}

// Song recognition result schema
export interface RecognitionResult {
  songId: string;
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  audioUrl?: string;
  previewOffsetSeconds?: number;
  confidence: number;
  timestamp: number;
  isFavorite?: boolean;
}

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]["code"];

// Request/Response schemas for API
export const translateLyricsRequestSchema = z.object({
  lyrics: z.array(z.string()),
  targetLanguage: z.string(),
});

export type TranslateLyricsRequest = z.infer<typeof translateLyricsRequestSchema>;

export const recognizeSongRequestSchema = z.object({
  audioData: z.string(), // base64 encoded audio sample
  duration: z.number(),
});

export type RecognizeSongRequest = z.infer<typeof recognizeSongRequestSchema>;

export const updateUserProfileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  country: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().url().optional(),
});

export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

export const manualSelectSongSchema = z.object({
  artist: z.string().min(1, "Artist is required"),
  title: z.string().min(1, "Title is required"),
  album: z.string().optional(),
  albumArt: z.string().max(2000).optional(), // Max URL length
  duration: z.number().nonnegative().finite().optional(), // Must be non-negative and finite
});

export type ManualSelectSong = z.infer<typeof manualSelectSongSchema>;

// Pronunciation assessments table - stores detailed Azure Speech pronunciation scores
export const pronunciationAssessments = pgTable("pronunciation_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  songId: varchar("song_id").notNull().references(() => songs.id, { onDelete: 'cascade' }),
  lineId: varchar("line_id").references(() => lyrics.id, { onDelete: 'cascade' }),
  wordIndex: integer("word_index"),
  locale: varchar("locale", { length: 10 }).notNull(),
  source: varchar("source", { length: 10 }).notNull().default("browser"), // "browser" or "azure"
  assessmentHash: varchar("assessment_hash", { length: 64 }).notNull(), // Hash of audio + text for cache lookup
  azurePayload: text("azure_payload"), // Full Azure response JSON
  accuracyScore: real("accuracy_score"),
  fluencyScore: real("fluency_score"),
  completenessScore: real("completeness_score"),
  prosodyScore: real("prosody_score"),
  pronunciationScore: real("pronunciation_score"), // Overall score
  miscueMetadata: text("miscue_metadata"), // JSON: omissions, insertions, mispronunciations
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // For 14-day cache expiration
}, (table) => ({
  hashIdx: index("pronunciation_assessments_hash_idx").on(table.assessmentHash),
  userSongIdx: index("pronunciation_assessments_user_song_idx").on(table.userId, table.songId),
}));

export const insertPronunciationAssessmentSchema = createInsertSchema(pronunciationAssessments).omit({
  id: true,
  createdAt: true,
});

export type InsertPronunciationAssessment = z.infer<typeof insertPronunciationAssessmentSchema>;
export type PronunciationAssessment = typeof pronunciationAssessments.$inferSelect;

// Practice session cache - stores aggregated line-level cached results
export const practiceSessionCache = pgTable("practice_session_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  songId: varchar("song_id").notNull().references(() => songs.id, { onDelete: 'cascade' }),
  lineHash: varchar("line_hash", { length: 64 }).notNull(), // Hash of line text + locale
  locale: varchar("locale", { length: 10 }).notNull(),
  aggregatedScores: text("aggregated_scores").notNull(), // JSON: word-level scores
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => ({
  uniqueCache: unique().on(table.userId, table.songId, table.lineHash, table.locale),
  expiryIdx: index("practice_session_cache_expiry_idx").on(table.expiresAt),
}));

export const insertPracticeSessionCacheSchema = createInsertSchema(practiceSessionCache).omit({
  id: true,
  createdAt: true,
});

export type InsertPracticeSessionCache = z.infer<typeof insertPracticeSessionCacheSchema>;
export type PracticeSessionCache = typeof practiceSessionCache.$inferSelect;

// Azure usage ledger - tracks API usage per user for quota management
export const azureUsageLedger = pgTable("azure_usage_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  feature: varchar("feature", { length: 50 }).notNull(), // e.g., "pronunciation_assessment"
  granularity: varchar("granularity", { length: 20 }).notNull(), // e.g., "word", "line", "phoneme"
  units: integer("units").notNull().default(1), // Number of API calls/units
  billingWindowStart: timestamp("billing_window_start").notNull(), // Start of billing period
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userFeatureIdx: index("azure_usage_ledger_user_feature_idx").on(table.userId, table.feature, table.billingWindowStart),
}));

export const insertAzureUsageLedgerSchema = createInsertSchema(azureUsageLedger).omit({
  id: true,
  createdAt: true,
});

export type InsertAzureUsageLedger = z.infer<typeof insertAzureUsageLedgerSchema>;
export type AzureUsageLedger = typeof azureUsageLedger.$inferSelect;

// Pronunciation assessment request/response schemas
export const pronunciationAssessRequestSchema = z.object({
  songId: z.string(),
  lineId: z.string(),
  locale: z.string().length(2), // ISO 639-1 language code
  audioBlob: z.string(), // base64 encoded audio
  referenceText: z.string(),
  wordIndex: z.number().int().nonnegative().optional(),
});

export type PronunciationAssessRequest = z.infer<typeof pronunciationAssessRequestSchema>;

export interface PronunciationAssessmentResult {
  assessmentId: string;
  accuracyScore: number;
  fluencyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  pronunciationScore: number;
  words?: Array<{
    word: string;
    accuracyScore: number;
    errorType?: 'None' | 'Omission' | 'Insertion' | 'Mispronunciation';
    syllables?: Array<{
      syllable: string;
      accuracyScore: number;
    }>;
    phonemes?: Array<{
      phoneme: string;
      accuracyScore: number;
    }>;
  }>;
  cached: boolean;
}

export interface UsageQuota {
  feature: string;
  currentPeriodUsage: number;
  limit: number;
  resetDate: Date;
  percentageUsed: number;
}

// Comments table - for user comments on songs
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  songId: varchar("song_id").notNull().references(() => songs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: varchar("parent_id"),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  songIdx: index("IDX_comment_song").on(table.songId),
  parentIdx: index("IDX_comment_parent").on(table.parentId),
}));

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// Comment with user info for display
export interface CommentWithUser extends Comment {
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
  replies?: CommentWithUser[];
}

// ============== COLLABORATIVE PLAYLISTS ==============

// Playlists table
export const playlists = pgTable("playlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  inviteCode: varchar("invite_code", { length: 12 }).unique(),
  isPublic: boolean("is_public").notNull().default(false),
  coverImage: text("cover_image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlaylistSchema = createInsertSchema(playlists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type Playlist = typeof playlists.$inferSelect;

// Playlist songs table
export const playlistSongs = pgTable("playlist_songs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playlistId: varchar("playlist_id").notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  songId: varchar("song_id").notNull().references(() => songs.id, { onDelete: 'cascade' }),
  addedBy: varchar("added_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderIndex: integer("order_index").notNull().default(0),
  note: text("note"),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (table) => ({
  uniquePlaylistSong: unique().on(table.playlistId, table.songId),
  orderIdx: index("playlist_songs_order_idx").on(table.playlistId, table.orderIndex),
}));

export const insertPlaylistSongSchema = createInsertSchema(playlistSongs).omit({
  id: true,
  addedAt: true,
});

export type InsertPlaylistSong = z.infer<typeof insertPlaylistSongSchema>;
export type PlaylistSong = typeof playlistSongs.$inferSelect;

// Playlist collaborators table
export const playlistCollaborators = pgTable("playlist_collaborators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playlistId: varchar("playlist_id").notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar("role", { length: 20 }).notNull().default("editor"), // "owner", "editor", "viewer"
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (table) => ({
  uniquePlaylistUser: unique().on(table.playlistId, table.userId),
}));

export const insertPlaylistCollaboratorSchema = createInsertSchema(playlistCollaborators).omit({
  id: true,
  addedAt: true,
});

export type InsertPlaylistCollaborator = z.infer<typeof insertPlaylistCollaboratorSchema>;
export type PlaylistCollaborator = typeof playlistCollaborators.$inferSelect;

// Playlist with details for display
export interface PlaylistWithDetails extends Playlist {
  owner: {
    id: string;
    username: string | null;
    profileImageUrl: string | null;
  };
  songCount: number;
  collaboratorCount: number;
  isCollaborator: boolean;
  role?: string;
}

export interface PlaylistSongWithDetails extends PlaylistSong {
  song: Song;
  addedByUser: {
    id: string;
    username: string | null;
    profileImageUrl: string | null;
  };
}

// ============== MINI-GAMES ==============

// Game types enum
export const GAME_TYPES = ['speed_round', 'streak_challenge', 'word_match'] as const;
export type GameType = typeof GAME_TYPES[number];

// Leaderboard periods
export const LEADERBOARD_PERIODS = ['daily', 'weekly', 'all_time'] as const;
export type LeaderboardPeriod = typeof LEADERBOARD_PERIODS[number];

// Game sessions table
export const gameSessions = pgTable("game_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameType: varchar("game_type", { length: 30 }).notNull(),
  songId: varchar("song_id").references(() => songs.id, { onDelete: 'set null' }),
  lineIds: text("line_ids"), // JSON array of lyric line IDs used
  attempts: text("attempts"), // JSON array of attempt details
  score: integer("score").notNull().default(0),
  accuracyPct: real("accuracy_pct"),
  bestStreak: integer("best_streak").default(0),
  wordsCompleted: integer("words_completed").default(0),
  durationMs: integer("duration_ms"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userGameIdx: index("game_sessions_user_game_idx").on(table.userId, table.gameType),
  createdIdx: index("game_sessions_created_idx").on(table.createdAt),
}));

export const insertGameSessionSchema = createInsertSchema(gameSessions).omit({
  id: true,
  createdAt: true,
});

export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessions.$inferSelect;

// Leaderboard entries table
export const leaderboardEntries = pgTable("leaderboard_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameType: varchar("game_type", { length: 30 }).notNull(),
  period: varchar("period", { length: 20 }).notNull(), // "daily", "weekly", "all_time"
  periodStart: timestamp("period_start").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  bestScore: integer("best_score").notNull().default(0),
  bestAccuracy: real("best_accuracy"),
  bestStreak: integer("best_streak").default(0),
  gamesPlayed: integer("games_played").notNull().default(1),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
}, (table) => ({
  uniqueEntry: unique().on(table.gameType, table.period, table.periodStart, table.userId),
  leaderboardIdx: index("leaderboard_entries_idx").on(table.gameType, table.period, table.periodStart, table.bestScore),
}));

export const insertLeaderboardEntrySchema = createInsertSchema(leaderboardEntries).omit({
  id: true,
  recordedAt: true,
});

export type InsertLeaderboardEntry = z.infer<typeof insertLeaderboardEntrySchema>;
export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;

// Leaderboard entry with user info
export interface LeaderboardEntryWithUser extends LeaderboardEntry {
  user: {
    id: string;
    username: string | null;
    profileImageUrl: string | null;
  };
  rank: number;
}

// Game session with details for display
export interface GameSessionWithDetails extends GameSession {
  song?: {
    title: string;
    artist: string;
    albumArt: string | null;
  };
}

// Request schemas for games
export const startGameSessionSchema = z.object({
  gameType: z.enum(GAME_TYPES),
  songId: z.string().optional(),
});

export const completeGameSessionSchema = z.object({
  score: z.number().int().nonnegative(),
  accuracyPct: z.number().min(0).max(100).optional(),
  bestStreak: z.number().int().nonnegative().optional(),
  wordsCompleted: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative(),
  attempts: z.array(z.object({
    word: z.string(),
    correct: z.boolean(),
    accuracy: z.number().optional(),
  })).optional(),
});

export type StartGameSession = z.infer<typeof startGameSessionSchema>;
export type CompleteGameSession = z.infer<typeof completeGameSessionSchema>;

// Request schema for joining playlist
export const joinPlaylistSchema = z.object({
  inviteCode: z.string().min(1),
});

export type JoinPlaylist = z.infer<typeof joinPlaylistSchema>;
