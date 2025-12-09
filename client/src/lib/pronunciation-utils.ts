/**
 * Utilities for word-by-word pronunciation practice
 */

export type WordPracticeStatus = 'pending' | 'success' | 'retry' | 'skipped';

export interface WordPracticeState {
  word: string;           // The phonetic representation (for display)
  originalWord?: string;  // The original lyric word (for matching)
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
 * Removes punctuation, converts to lowercase, removes hyphens
 * Preserves international characters (Latin, CJK, etc.) but normalizes accents
 */
function normalizeForComparison(text: string): string {
  // First normalize and remove diacritical marks for Latin letters
  let normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .replace(/[-\s]/g, '');          // Remove hyphens and spaces
  
  // Remove common punctuation but keep letters (any script) and numbers
  // This preserves CJK, Arabic, Cyrillic, etc.
  normalized = normalized.replace(/[.,!?;:'"()[\]{}@#$%^&*+=<>\/\\|`~]/g, '');
  
  return normalized.trim();
}

/**
 * Convert phonetic syllables to approximate pronunciation
 * Maps common phonetic patterns to how they sound
 */
function phoneticToSounds(phonetic: string): string {
  let sounds = phonetic.toLowerCase();
  
  // Common phonetic mappings to simplified sounds
  const mappings: [RegExp, string][] = [
    [/eeh?/g, 'i'],      // "eeh" sounds like "ee"
    [/ah/g, 'a'],        // "ah" sounds like "a"
    [/oh/g, 'o'],        // "oh" sounds like "o"
    [/oo/g, 'u'],        // "oo" sounds like "u"
    [/eh/g, 'e'],        // "eh" sounds like "e"
    [/ay/g, 'ei'],       // "ay" sounds like "ei"
    [/ow/g, 'ou'],       // "ow" sounds like "ou"
    [/th/g, 't'],        // simplify "th"
    [/sh/g, 's'],        // simplify "sh"
    [/ch/g, 'c'],        // simplify "ch"
    [/ph/g, 'f'],        // "ph" sounds like "f"
    [/wh/g, 'w'],        // simplify "wh"
    [/ck/g, 'k'],        // "ck" sounds like "k"
    [/gh/g, ''],         // silent "gh"
    [/kn/g, 'n'],        // "kn" sounds like "n"
    [/wr/g, 'r'],        // "wr" sounds like "r"
    [/mb$/g, 'm'],       // silent "b" at end
    [/ng/g, 'n'],        // simplify "ng"
  ];
  
  for (const [pattern, replacement] of mappings) {
    sounds = sounds.replace(pattern, replacement);
  }
  
  return sounds.replace(/[-\s]/g, '');
}

/**
 * Extract core sounds from a word for fuzzy matching
 * For Latin scripts: replaces vowels with 'V' markers
 * For non-Latin scripts (CJK, etc.): keeps characters as-is
 */
function extractCoreSounds(word: string): string {
  const normalized = word.toLowerCase();
  
  // Check if word contains mostly non-Latin characters (CJK, Arabic, etc.)
  const latinChars = normalized.match(/[a-z]/g) || [];
  const totalChars = normalized.replace(/[\s\d]/g, '').length;
  
  // If less than half Latin, return the normalized word as-is (no vowel replacement)
  if (totalChars > 0 && latinChars.length < totalChars / 2) {
    return normalized.replace(/[\s]/g, '');
  }
  
  // For Latin scripts, apply vowel clustering
  return normalized
    .replace(/[aeiou]+/g, 'V') // Replace vowel clusters with V
    .replace(/[^a-zV]/g, '');  // Keep only letters and V markers
}

/**
 * Calculate syllable-aware accuracy between expected phonetic and actual transcript
 * Uses multiple comparison strategies and takes the best match
 */
export function calculateAccuracy(expected: string, actual: string): number {
  if (!expected || !actual) return 0;
  
  const normalizedExpected = normalizeForComparison(expected);
  const normalizedActual = normalizeForComparison(actual);
  
  // Perfect match
  if (normalizedExpected === normalizedActual) return 1.0;
  
  // Strategy 1: Direct Levenshtein on normalized strings
  const directDistance = levenshteinDistance(normalizedExpected, normalizedActual);
  const maxLen = Math.max(normalizedExpected.length, normalizedActual.length);
  const directScore = maxLen > 0 ? Math.max(0, 1 - (directDistance / maxLen)) : 0;
  
  // Strategy 2: Compare phonetic sounds
  const expectedSounds = phoneticToSounds(expected);
  const actualSounds = phoneticToSounds(actual);
  const soundsDistance = levenshteinDistance(expectedSounds, actualSounds);
  const soundsMaxLen = Math.max(expectedSounds.length, actualSounds.length);
  const soundsScore = soundsMaxLen > 0 ? Math.max(0, 1 - (soundsDistance / soundsMaxLen)) : 0;
  
  // Strategy 3: Core consonant pattern matching
  const expectedCore = extractCoreSounds(normalizedExpected);
  const actualCore = extractCoreSounds(normalizedActual);
  const coreDistance = levenshteinDistance(expectedCore, actualCore);
  const coreMaxLen = Math.max(expectedCore.length, actualCore.length);
  const coreScore = coreMaxLen > 0 ? Math.max(0, 1 - (coreDistance / coreMaxLen)) : 0;
  
  // Strategy 4: Check if actual contains expected or vice versa (partial match)
  let containsScore = 0;
  if (normalizedActual.includes(normalizedExpected) || normalizedExpected.includes(normalizedActual)) {
    const shorter = Math.min(normalizedExpected.length, normalizedActual.length);
    const longer = Math.max(normalizedExpected.length, normalizedActual.length);
    containsScore = shorter / longer;
  }
  
  // Strategy 5: First few characters match (speech recognition often gets the start right)
  const prefixLen = Math.min(3, normalizedExpected.length, normalizedActual.length);
  const prefixMatch = normalizedExpected.substring(0, prefixLen) === normalizedActual.substring(0, prefixLen);
  const prefixBonus = prefixMatch ? 0.15 : 0;
  
  // Take the best score from all strategies
  const baseScore = Math.max(directScore, soundsScore, coreScore, containsScore);
  
  // Apply prefix bonus but cap at 1.0
  const finalScore = Math.min(1.0, baseScore + prefixBonus);
  
  // Log for debugging
  console.log('[Accuracy] Expected:', expected, '→', normalizedExpected);
  console.log('[Accuracy] Actual:', actual, '→', normalizedActual);
  console.log('[Accuracy] Scores - Direct:', directScore.toFixed(2), 
              'Sounds:', soundsScore.toFixed(2), 
              'Core:', coreScore.toFixed(2),
              'Contains:', containsScore.toFixed(2),
              'Final:', finalScore.toFixed(2));
  
  return finalScore;
}

/**
 * Calculate accuracy with support for matching against BOTH original word AND phonetic
 * Handles cases where speech recognition returns "Pensaba" but phonetic is "pehn-sahbah"
 * Takes the BEST score from either match strategy
 */
export function calculateAccuracyWithOriginal(
  expectedPhonetic: string,
  expectedOriginal: string | undefined,
  actualTranscript: string
): number {
  if (!actualTranscript) return 0;

  // Strategy 1: Try matching against phonetic representation
  const phoneticScore = calculateAccuracy(expectedPhonetic, actualTranscript);
  
  console.log('[Accuracy] Phonetic match:', {
    expected: expectedPhonetic,
    actual: actualTranscript,
    score: Math.round(phoneticScore * 100) + '%'
  });

  // Strategy 2: If original word provided, try matching against it
  if (expectedOriginal && expectedOriginal !== expectedPhonetic) {
    const originalScore = calculateAccuracy(expectedOriginal, actualTranscript);
    
    console.log('[Accuracy] Original match:', {
      expected: expectedOriginal,
      actual: actualTranscript,
      score: Math.round(originalScore * 100) + '%'
    });

    // Take the BEST score from either phonetic or original
    const bestScore = Math.max(phoneticScore, originalScore);
    const bestFrom = bestScore === phoneticScore ? 'phonetic' : 'original';
    
    console.log('[Accuracy] Best score:', Math.round(bestScore * 100) + '%', '(from', bestFrom, 'match)');
    
    return bestScore;
  }

  return phoneticScore;
}

/**
 * Get accuracy tier based on score
 */
export function getAccuracyTier(score: number): 'success' | 'close' | 'retry' {
  // >50% is considered OK/success per user request
  if (score > 0.5) return 'success';
  if (score >= 0.3) return 'close';
  return 'retry';
}

/**
 * Get feedback message based on accuracy
 */
export function getAccuracyFeedback(score: number): { title: string; description: string } {
  if (score > 0.5) {
    return {
      title: "Excellent!",
      description: `${Math.round(score * 100)}% accurate. Great pronunciation!`
    };
  } else if (score >= 0.3) {
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
