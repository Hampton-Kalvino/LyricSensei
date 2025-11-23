/**
 * Utilities for word-by-word pronunciation practice
 */

export type WordPracticeStatus = 'pending' | 'success' | 'retry' | 'skipped';

export interface WordPracticeState {
  word: string;
  status: WordPracticeStatus;
  attempts: number;
  bestScore: number;
}

/**
 * Tokenize phonetic guide into individual words
 * Treats space-separated tokens as words, but preserves hyphenated syllables
 * e.g., "soos-peerahn-doh pohr lahs" → ["soos-peerahn-doh", "pohr", "lahs"]
 */
export function tokenizePhoneticWords(phoneticGuide: string): string[] {
  if (!phoneticGuide || phoneticGuide === "—") return [];
  
  return phoneticGuide
    .trim()
    .split(/\s+/) // Split on whitespace
    .filter(word => word.length > 0);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize text for pronunciation comparison
 * Removes punctuation, converts to lowercase
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove punctuation except hyphens and spaces
    .replace(/\s+/g, '') // Remove spaces for comparison
    .trim();
}

/**
 * Calculate pronunciation accuracy score (0-1)
 * Uses normalized Levenshtein distance
 */
export function calculateAccuracy(expected: string, actual: string): number {
  const normalizedExpected = normalizeForComparison(expected);
  const normalizedActual = normalizeForComparison(actual);
  
  if (normalizedExpected === normalizedActual) return 1.0;
  
  const distance = levenshteinDistance(normalizedExpected, normalizedActual);
  const maxLength = Math.max(normalizedExpected.length, normalizedActual.length);
  
  if (maxLength === 0) return 0;
  
  return Math.max(0, 1 - (distance / maxLength));
}

/**
 * Get accuracy tier based on score
 */
export function getAccuracyTier(score: number): 'success' | 'close' | 'retry' {
  if (score >= 0.8) return 'success';
  if (score >= 0.6) return 'close';
  return 'retry';
}

/**
 * Get feedback message based on accuracy
 */
export function getAccuracyFeedback(score: number): { title: string; description: string } {
  if (score >= 0.8) {
    return {
      title: "Excellent!",
      description: `${Math.round(score * 100)}% accurate. Great pronunciation!`
    };
  } else if (score >= 0.6) {
    return {
      title: "Almost there!",
      description: `${Math.round(score * 100)}% accurate. Keep practicing!`
    };
  } else {
    return {
      title: "Keep trying!",
      description: `${Math.round(score * 100)}% accurate. Listen and try again.`
    };
  }
}
