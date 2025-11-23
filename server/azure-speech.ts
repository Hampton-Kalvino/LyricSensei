/**
 * Azure Speech Services API client for Pronunciation Assessment
 * https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment
 * 
 * Pricing: Same as Speech-to-Text ($1/hour for standard model)
 * Free tier: 5 hours/month of audio processing
 * Features: Word, syllable, phoneme-level pronunciation scoring with miscue detection
 */

import crypto from "crypto";
import pRetry from "p-retry";

interface AzureSpeechConfig {
  key: string;
  region: string;
}

interface PronunciationAssessmentConfig {
  referenceText: string;
  gradingSystem?: "HundredMark" | "FivePoint";
  granularity?: "Phoneme" | "Word" | "FullText";
  dimension?: "Comprehensive" | "Basic";
  enableMiscue?: boolean;
  scenarioId?: string;
}

interface PronunciationAssessmentResponse {
  RecognitionStatus: string;
  DisplayText: string;
  NBest: Array<{
    Confidence: number;
    Lexical: string;
    ITN: string;
    MaskedITN: string;
    Display: string;
    PronunciationAssessment: {
      AccuracyScore: number;
      FluencyScore: number;
      CompletenessScore: number;
      PronScore: number;
      ProsodyScore?: number;
    };
    Words: Array<{
      Word: string;
      Offset: number;
      Duration: number;
      PronunciationAssessment: {
        AccuracyScore: number;
        ErrorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
      };
      Syllables?: Array<{
        Syllable: string;
        PronunciationAssessment: {
          AccuracyScore: number;
        };
        Offset: number;
        Duration: number;
      }>;
      Phonemes?: Array<{
        Phoneme: string;
        PronunciationAssessment: {
          AccuracyScore: number;
          NBestPhonemes?: Array<{
            Phoneme: string;
            Score: number;
          }>;
        };
        Offset: number;
        Duration: number;
      }>;
    }>;
  }>;
}

interface AssessmentResult {
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
  rawResponse: PronunciationAssessmentResponse;
}

// Supported locales for pronunciation assessment
// https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
const SUPPORTED_LOCALES: Record<string, string[]> = {
  'en': ['en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN'],
  'es': ['es-ES', 'es-MX', 'es-AR'],
  'fr': ['fr-FR', 'fr-CA'],
  'de': ['de-DE'],
  'it': ['it-IT'],
  'pt': ['pt-BR', 'pt-PT'],
  'ru': ['ru-RU'],
  'ja': ['ja-JP'],
  'ko': ['ko-KR'],
  'zh': ['zh-CN', 'zh-TW'],
  'ar': ['ar-SA', 'ar-EG'],
  'hi': ['hi-IN'],
  'tr': ['tr-TR'],
};

/**
 * Get Azure Speech Services configuration
 */
function getConfig(): AzureSpeechConfig {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  
  if (!key || !region) {
    throw new Error('Azure Speech credentials not configured. Please set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
  }
  
  return { key, region };
}

/**
 * Map language code to Azure locale
 */
export function mapLanguageToLocale(languageCode: string): string | null {
  const locales = SUPPORTED_LOCALES[languageCode];
  if (!locales || locales.length === 0) {
    return null; // Language not supported for pronunciation assessment
  }
  return locales[0]; // Return primary locale
}

/**
 * Check if language is supported for pronunciation assessment
 */
export function isLanguageSupported(languageCode: string): boolean {
  return languageCode in SUPPORTED_LOCALES;
}

/**
 * Create assessment hash for caching
 * Hash is based on: reference text + locale + audio fingerprint
 */
export function createAssessmentHash(
  referenceText: string,
  locale: string,
  audioBuffer: Buffer
): string {
  // Create a lightweight audio fingerprint (first 1KB + last 1KB + length)
  const audioFingerprint = audioBuffer.length > 2048
    ? Buffer.concat([
        audioBuffer.subarray(0, 1024),
        audioBuffer.subarray(-1024),
        Buffer.from(audioBuffer.length.toString())
      ])
    : audioBuffer;
  
  const hash = crypto.createHash('sha256');
  hash.update(referenceText);
  hash.update(locale);
  hash.update(audioFingerprint);
  
  return hash.digest('hex');
}

/**
 * Assess pronunciation using Azure Speech Services
 * Uses REST API for short audio (up to 30 seconds)
 */
export async function assessPronunciation(
  audioBuffer: Buffer,
  config: PronunciationAssessmentConfig,
  locale: string = 'en-US'
): Promise<AssessmentResult> {
  const { key, region } = getConfig();
  
  // Build pronunciation assessment configuration header
  const pronConfig = {
    ReferenceText: config.referenceText,
    GradingSystem: config.gradingSystem || "HundredMark",
    Granularity: config.granularity || "Phoneme",
    Dimension: config.dimension || "Comprehensive",
    EnableMiscue: config.enableMiscue !== false, // Default true
  };
  
  // REST API endpoint for short audio
  const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
  const url = new URL(endpoint);
  url.searchParams.set('language', locale);
  url.searchParams.set('format', 'detailed');
  
  console.log(`[Azure Speech] Assessing pronunciation for locale: ${locale}`);
  
  // Make API call with retry logic
  const response = await pRetry(
    async () => {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          'Pronunciation-Assessment': JSON.stringify(pronConfig),
          'Accept': 'application/json',
        },
        body: audioBuffer,
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[Azure Speech] API Error: ${res.status} - ${errorText}`);
        throw new Error(`Azure Speech API error: ${res.status} - ${errorText}`);
      }
      
      return res;
    },
    {
      retries: 3,
      minTimeout: 1000,
      maxTimeout: 5000,
      onFailedAttempt: (error) => {
        console.log(`[Azure Speech] Attempt ${error.attemptNumber} failed. Retrying...`);
      },
    }
  );
  
  const data: PronunciationAssessmentResponse = await response.json();
  
  if (data.RecognitionStatus !== 'Success') {
    throw new Error(`Speech recognition failed: ${data.RecognitionStatus}`);
  }
  
  if (!data.NBest || data.NBest.length === 0) {
    throw new Error('No pronunciation assessment results returned');
  }
  
  // Extract best result
  const best = data.NBest[0];
  const assessment = best.PronunciationAssessment;
  
  // Build normalized result
  const result: AssessmentResult = {
    accuracyScore: assessment.AccuracyScore,
    fluencyScore: assessment.FluencyScore,
    completenessScore: assessment.CompletenessScore,
    prosodyScore: assessment.ProsodyScore,
    pronunciationScore: assessment.PronScore,
    words: best.Words?.map(word => ({
      word: word.Word,
      accuracyScore: word.PronunciationAssessment.AccuracyScore,
      errorType: word.PronunciationAssessment.ErrorType,
      syllables: word.Syllables?.map(syl => ({
        syllable: syl.Syllable,
        accuracyScore: syl.PronunciationAssessment.AccuracyScore,
      })),
      phonemes: word.Phonemes?.map(ph => ({
        phoneme: ph.Phoneme,
        accuracyScore: ph.PronunciationAssessment.AccuracyScore,
      })),
    })),
    rawResponse: data,
  };
  
  console.log(`[Azure Speech] Assessment complete - Pronunciation: ${result.pronunciationScore}, Accuracy: ${result.accuracyScore}`);
  
  return result;
}

/**
 * Batch assess multiple words/lines
 * For efficiency, combines multiple assessments into single API calls
 */
export async function batchAssessPronunciation(
  items: Array<{
    audioBuffer: Buffer;
    referenceText: string;
    locale: string;
  }>
): Promise<AssessmentResult[]> {
  // Azure REST API doesn't support true batching, so we process sequentially
  // but with shared connection pooling for efficiency
  const results: AssessmentResult[] = [];
  
  for (const item of items) {
    try {
      const result = await assessPronunciation(
        item.audioBuffer,
        {
          referenceText: item.referenceText,
          granularity: 'Phoneme',
          enableMiscue: true,
        },
        item.locale
      );
      results.push(result);
    } catch (error) {
      console.error(`[Azure Speech] Batch assessment failed for "${item.referenceText}":`, error);
      throw error;
    }
  }
  
  return results;
}

/**
 * Validate audio format
 * Azure requires: WAV, 16kHz, mono, 16-bit PCM
 */
export function validateAudioFormat(audioBuffer: Buffer): {
  valid: boolean;
  error?: string;
} {
  // Basic WAV header validation
  if (audioBuffer.length < 44) {
    return { valid: false, error: 'Audio file too small (< 44 bytes)' };
  }
  
  // Check RIFF header
  const riff = audioBuffer.subarray(0, 4).toString('ascii');
  if (riff !== 'RIFF') {
    return { valid: false, error: 'Invalid WAV format: missing RIFF header' };
  }
  
  // Check WAVE format
  const wave = audioBuffer.subarray(8, 12).toString('ascii');
  if (wave !== 'WAVE') {
    return { valid: false, error: 'Invalid WAV format: missing WAVE identifier' };
  }
  
  return { valid: true };
}
