/**
 * Azure Translator API client
 * https://learn.microsoft.com/en-us/azure/ai-services/translator/
 * 
 * Free tier: 2M characters/month (~400 songs)
 * Paid tier: $10 per 1M characters
 */

import crypto from "crypto";
import OpenAI from "openai";

interface AzureTranslatorConfig {
  key: string;
  region: string;
  endpoint: string;
}

interface TranslateRequest {
  text: string;
}

interface TranslateResponse {
  detectedLanguage?: {
    language: string;
    score: number;
  };
  translations: Array<{
    text: string;
    to: string;
    transliteration?: {
      script: string;
      text: string;
    };
  }>;
}

interface TransliterationResponse {
  text: string;
  script: string;
}

interface PhoneticResult {
  originalText: string;
  translatedText: string;
  phoneticGuide: string;
  sourceLanguage?: string;
}

// Language code mapping (Azure uses ISO 639-1 codes)
const languageMap: Record<string, string> = {
  'en': 'en',
  'es': 'es',
  'fr': 'fr',
  'de': 'de',
  'it': 'it',
  'pt': 'pt',
  'ru': 'ru',
  'ja': 'ja',
  'ko': 'ko',
  'zh': 'zh-Hans', // Simplified Chinese
  'ar': 'ar',
  'hi': 'hi',
  'tr': 'tr',
};

/**
 * Get Azure Translator configuration
 */
function getConfig(): AzureTranslatorConfig {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  
  if (!key || !region) {
    throw new Error('Azure Translator credentials not configured. Please set AZURE_TRANSLATOR_KEY and AZURE_TRANSLATOR_REGION.');
  }
  
  return {
    key,
    region,
    endpoint: 'https://api.cognitive.microsofttranslator.com',
  };
}

/**
 * Reverse transliterate Latin script back to native script
 * For example: "Tere ton meri" → "ਤੇਰੇ ਤੋਂ ਮੇਰੀ"
 */
async function reverseTransliterate(text: string, language: string): Promise<string> {
  try {
    const config = getConfig();
    
    // Map languages to their native scripts
    const scriptMap: Record<string, { fromScript: string; toScript: string }> = {
      'pa': { fromScript: 'Latn', toScript: 'Guru' },  // Punjabi: Latin → Gurmukhi
      'hi': { fromScript: 'Latn', toScript: 'Deva' },  // Hindi: Latin → Devanagari
      'ur': { fromScript: 'Latn', toScript: 'Arab' },  // Urdu: Latin → Arabic
    };
    
    const scripts = scriptMap[language];
    if (!scripts) {
      console.log(`[Reverse Transliterate] No script mapping for ${language}`);
      return text;
    }
    
    const url = new URL('/transliterate', config.endpoint);
    url.searchParams.set('api-version', '3.0');
    url.searchParams.set('language', language);
    url.searchParams.set('fromScript', scripts.fromScript);
    url.searchParams.set('toScript', scripts.toScript);
    
    console.log(`[Reverse Transliterate] Converting ${language} from ${scripts.fromScript} → ${scripts.toScript}`);
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.key,
        'Ocp-Apim-Subscription-Region': config.region,
        'Content-Type': 'application/json',
        'X-ClientTraceId': crypto.randomUUID(),
      },
      body: JSON.stringify([{ text }]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Reverse Transliterate] Failed (${response.status}):`, errorText);
      return text;
    }

    const data: TransliterationResponse[] = await response.json();
    const nativeScript = data[0]?.text || text;
    
    console.log(`[Reverse Transliterate] "${text.substring(0, 30)}" → "${nativeScript.substring(0, 30)}"`);
    return nativeScript;
  } catch (error) {
    console.error('[Reverse Transliterate] Error:', error);
    return text;
  }
}

/**
 * Use OpenAI to translate romanized Punjabi/Hindi to English
 * Fallback for when Azure can't handle romanized text
 */
async function translateWithOpenAI(text: string, sourceLang: string, targetLang: string): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log('[OpenAI] API key not configured');
      return text;
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const languageNames: Record<string, string> = {
      'pa': 'Punjabi',
      'hi': 'Hindi',
      'ur': 'Urdu',
      'en': 'English',
    };
    
    const sourceName = languageNames[sourceLang] || sourceLang;
    const targetName = languageNames[targetLang] || targetLang;
    
    console.log(`[OpenAI] Translating romanized ${sourceName} to ${targetName}: "${text.substring(0, 30)}..."`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate romanized ${sourceName} text to ${targetName}. Provide only the translation, no explanations or notes.`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const translated = response.choices[0]?.message?.content?.trim() || text;
    console.log(`[OpenAI] Translation: "${translated.substring(0, 50)}..."`);
    return translated;
  } catch (error) {
    console.error('[OpenAI] Translation error:', error);
    return text;
  }
}

/**
 * Pre-detect language using pattern matching for commonly misidentified languages
 * Returns language code if confident match, null otherwise
 */
function preDetectLanguage(text: string): string | null {
  const sample = text.toLowerCase().substring(0, 500);
  
  // Punjabi/Hindi romanization patterns
  // Check for common Punjabi words and patterns
  const punjabiPatterns = [
    /\b(tere|tera|meri|mera|naa|ton|da|di|de|te|hai|hain|nahi|koi|kya)\b/,
    /\b(main|tu|tum|aap|hum|woh|yeh)\b/,
    /\b(pyaar|dil|nazar|hasdi|rehna|kare|karan|jaan)\b/,
    /(kh|gh|dh|th|bh|ph)\w/,  // Aspirated consonants
    /\w+(aan|iyan|diyan|giyan)\b/,  // Punjabi plural endings
  ];
  
  let punjabiScore = 0;
  punjabiPatterns.forEach(pattern => {
    const matches = sample.match(new RegExp(pattern, 'g'));
    if (matches) punjabiScore += matches.length;
  });
  
  // If high Punjabi score, return 'pa'
  if (punjabiScore >= 3) {
    console.log(`[Pre-Detection] Detected Punjabi patterns (score: ${punjabiScore})`);
    return 'pa';
  }
  
  return null;
}

/**
 * Detect the language of a given text using Azure Translator
 * Returns the detected language code (e.g., 'en', 'es', 'pt')
 * Best-effort: returns 'unknown' if credentials are missing or detection fails
 */
export async function detectLanguage(text: string): Promise<string> {
  try {
    // Pre-detect for commonly misidentified languages
    const preDetected = preDetectLanguage(text);
    if (preDetected) {
      return preDetected;
    }
    
    // Check if credentials are available (best-effort approach)
    if (!process.env.AZURE_TRANSLATOR_KEY || !process.env.AZURE_TRANSLATOR_REGION) {
      console.log('[Azure Translator] Credentials not configured, skipping language detection');
      return 'unknown';
    }
    
    const config = getConfig();
    
    const response = await fetch(
      `${config.endpoint}/detect?api-version=3.0`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': config.key,
          'Ocp-Apim-Subscription-Region': config.region,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ Text: text.substring(0, 1000) }]), // Use first 1000 chars
      }
    );

    if (!response.ok) {
      console.error('[Azure Translator] Language detection failed:', response.status);
      return 'unknown';
    }

    const results = await response.json();
    if (results && results.length > 0 && results[0].language) {
      const detectedLang = results[0].language;
      console.log(`[Azure Translator] Detected language: ${detectedLang}`);
      return detectedLang;
    }
    
    return 'unknown';
  } catch (error) {
    console.error('[Azure Translator] Language detection error:', error);
    return 'unknown';
  }
}

/**
 * Translate text using Azure Translator
 * Returns both the translated text and the detected source language
 */
async function translateText(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<{ translatedText: string; detectedLanguage: string }> {
  const config = getConfig();
  const targetCode = languageMap[targetLang] || targetLang;
  
  try {
    // Build the request URL
    const url = new URL('/translate', config.endpoint);
    url.searchParams.set('api-version', '3.0');
    url.searchParams.set('to', targetCode);
    
    // Only set 'from' if it's not auto-detect
    if (sourceLang !== 'auto') {
      const sourceCode = languageMap[sourceLang] || sourceLang;
      url.searchParams.set('from', sourceCode);
    }
    
    // Make the request
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.key,
        'Ocp-Apim-Subscription-Region': config.region,
        'Content-Type': 'application/json',
        'X-ClientTraceId': crypto.randomUUID(),
      },
      body: JSON.stringify([{ text }]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Azure Translator] API error:', response.status, errorText);
      throw new Error(`Translation failed: ${response.statusText}`);
    }

    const data: TranslateResponse[] = await response.json();
    
    if (!data || !data[0] || !data[0].translations || !data[0].translations[0]) {
      throw new Error('Invalid response from Azure Translator');
    }
    
    return {
      translatedText: data[0].translations[0].text,
      detectedLanguage: data[0].detectedLanguage?.language || 'unknown'
    };
  } catch (error) {
    console.error('[Azure Translator] Translation error:', error);
    throw error;
  }
}

// Map of languages with their source and target scripts for transliteration
// Azure requires explicit fromScript and toScript values
// This is defined at module level so both functions can access it
const transliterationMap: Record<string, { language: string; fromScript: string; toScript: string }> = {
  'ja': { language: 'ja', fromScript: 'Jpan', toScript: 'Latn' },      // Japanese Kana/Kanji → Romaji
  'ko': { language: 'ko', fromScript: 'Hang', toScript: 'Latn' },      // Korean Hangul → Latin
  'zh': { language: 'zh-Hans', fromScript: 'Hans', toScript: 'Latn' }, // Simplified Chinese → Pinyin
  'zh-Hans': { language: 'zh-Hans', fromScript: 'Hans', toScript: 'Latn' },
  'zh-Hant': { language: 'zh-Hant', fromScript: 'Hant', toScript: 'Latn' }, // Traditional Chinese → Pinyin
  'ar': { language: 'ar', fromScript: 'Arab', toScript: 'Latn' },      // Arabic → Latin
  'ru': { language: 'ru', fromScript: 'Cyrl', toScript: 'Latn' },      // Russian Cyrillic → Latin
  'hi': { language: 'hi', fromScript: 'Deva', toScript: 'Latn' },      // Hindi Devanagari → Latin
  'pa': { language: 'pa', fromScript: 'Guru', toScript: 'Latn' },      // Punjabi Gurmukhi → Latin
  'ur': { language: 'ur', fromScript: 'Arab', toScript: 'Latn' },      // Urdu Arabic → Latin
  'th': { language: 'th', fromScript: 'Thai', toScript: 'Latn' },      // Thai → Latin
  'el': { language: 'el', fromScript: 'Grek', toScript: 'Latn' },      // Greek → Latin
  'he': { language: 'he', fromScript: 'Hebr', toScript: 'Latn' },      // Hebrew → Latin
};

/**
 * Transliterate text to Latin script using Azure Translator
 * Used for non-Latin scripts (Japanese, Korean, Arabic, etc.)
 * 
 * Note: Korean uses the translate endpoint with toScript parameter,
 * not the transliterate endpoint (which doesn't support Korean)
 */
async function transliterateText(
  text: string,
  sourceLanguage: string
): Promise<string> {
  const config = getConfig();
  const scriptConfig = transliterationMap[sourceLanguage];
  
  if (!scriptConfig) {
    // Language doesn't support transliteration, return original
    return text;
  }
  
  try {
    // Korean requires special handling - use translate endpoint with toScript
    if (sourceLanguage === 'ko') {
      return await transliterateKorean(text, config);
    }
    
    // For other languages, use standard transliterate endpoint
    const url = new URL('/transliterate', config.endpoint);
    url.searchParams.set('api-version', '3.0');
    url.searchParams.set('language', scriptConfig.language);
    url.searchParams.set('fromScript', scriptConfig.fromScript);
    url.searchParams.set('toScript', scriptConfig.toScript);
    
    console.log(`[Azure Translator] Transliterating ${sourceLanguage} (${scriptConfig.fromScript} → ${scriptConfig.toScript})`);
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.key,
        'Ocp-Apim-Subscription-Region': config.region,
        'Content-Type': 'application/json',
        'X-ClientTraceId': crypto.randomUUID(),
      },
      body: JSON.stringify([{ text }]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Azure Translator] Transliteration failed (${response.status}):`, errorText);
      console.error(`[Azure Translator] Request URL: ${url.toString()}`);
      console.error(`[Azure Translator] Language: ${scriptConfig.language}, fromScript: ${scriptConfig.fromScript}, toScript: ${scriptConfig.toScript}`);
      return text; // Fallback to original
    }

    const data: TransliterationResponse[] = await response.json();
    
    if (!data || !data[0] || !data[0].text) {
      console.error(`[Azure Translator] Invalid transliteration response:`, JSON.stringify(data).substring(0, 200));
      return text;
    }
    
    const transliterated = data[0].text;
    console.log(`[Azure Translator] Transliterated: "${text.substring(0, 30)}" → "${transliterated.substring(0, 30)}"`);
    
    // Apply syllable separation for Japanese
    if (sourceLanguage === 'ja') {
      const syllabified = splitJapaneseSyllables(transliterated);
      console.log(`[Azure Translator] Japanese syllabified: "${transliterated.substring(0, 30)}" → "${syllabified.substring(0, 30)}"`);
      return syllabified;
    }
    
    return transliterated;
  } catch (error) {
    console.error('[Azure Translator] Transliteration error:', error);
    return text; // Fallback to original
  }
}

/**
 * Romanize Korean text using the translate endpoint with toScript parameter
 * Korean doesn't support the /transliterate endpoint, but we can use
 * /translate with from=ko&to=ko&toScript=Latn to get romanization
 */
async function transliterateKorean(
  text: string,
  config: { endpoint: string; key: string; region: string }
): Promise<string> {
  try {
    const url = new URL('/translate', config.endpoint);
    url.searchParams.set('api-version', '3.0');
    url.searchParams.set('from', 'ko');
    url.searchParams.set('to', 'ko');
    url.searchParams.set('toScript', 'Latn');
    
    console.log(`[Azure Translator] Romanizing Korean text (ko→ko with toScript=Latn)`);
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.key,
        'Ocp-Apim-Subscription-Region': config.region,
        'Content-Type': 'application/json',
        'X-ClientTraceId': crypto.randomUUID(),
      },
      body: JSON.stringify([{ text }]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Azure Translator] Korean romanization failed (${response.status}):`, errorText);
      return text;
    }

    const data: TranslateResponse[] = await response.json();
    const romanized = data[0]?.translations?.[0]?.transliteration?.text;
    
    if (!romanized) {
      console.error(`[Azure Translator] No romanization in response:`, JSON.stringify(data).substring(0, 200));
      return text;
    }
    
    // Apply syllable separation for easier reading
    const syllabified = splitKoreanSyllables(romanized);
    console.log(`[Azure Translator] Korean romanized: "${text.substring(0, 30)}" → "${syllabified.substring(0, 30)}"`);
    return syllabified;
  } catch (error) {
    console.error('[Azure Translator] Korean romanization error:', error);
    return text;
  }
}

/**
 * Split Japanese romanization into syllables for easier reading
 * Japanese syllables follow simple CV or CVC patterns (mora-based)
 * Example: "nijimu namida" → "ni-ji-mu na-mi-da", "kokoro" → "ko-ko-ro"
 * 
 * Japanese romanization patterns:
 * - Basic mora: CV (consonant + vowel) or just V (vowel)
 * - Special: n (syllabic n), elongated vowels (ō, ū)
 * - Digraphs: ch, sh, ts, ry, ky, etc.
 */
function splitJapaneseSyllables(romanized: string): string {
  // Process each word separately
  const words = romanized.split(/\s+/);
  
  const syllabifiedWords = words.map(word => {
    if (word.length <= 2) return word;
    
    // Handle existing hyphens or punctuation - skip
    if (/[-''`]/.test(word)) return word;
    
    // Japanese vowels
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    
    // Common Japanese romanization digraphs (must be processed first)
    const digraphs = ['ch', 'sh', 'ts', 'ky', 'gy', 'ny', 'hy', 'by', 'py', 'my', 'ry'];
    
    const syllables: string[] = [];
    let i = 0;
    
    while (i < word.length) {
      let syllable = '';
      
      // Check for digraphs first
      let foundDigraph = false;
      for (const digraph of digraphs) {
        if (word.substring(i, i + digraph.length).toLowerCase() === digraph) {
          syllable += digraph;
          i += digraph.length;
          foundDigraph = true;
          break;
        }
      }
      
      // If no digraph, collect single consonant (if any)
      if (!foundDigraph && i < word.length && !vowels.includes(word[i].toLowerCase())) {
        syllable += word[i];
        i++;
      }
      
      // Add vowel (required for most syllables)
      if (i < word.length && vowels.includes(word[i].toLowerCase())) {
        syllable += word[i];
        i++;
        
        // Check for long vowel markers (ō, ū, etc.) or doubled vowels
        if (i < word.length && (vowels.includes(word[i].toLowerCase()) || word[i] === 'ー')) {
          // Long vowel - keep with current syllable
          syllable += word[i];
          i++;
        }
      }
      
      // Special case: syllabic 'n' at end of syllable
      if (i < word.length && word[i].toLowerCase() === 'n') {
        const nextChar = i + 1 < word.length ? word[i + 1].toLowerCase() : '';
        // If next is consonant (not vowel) or end of word, 'n' is syllabic
        if (!nextChar || !vowels.includes(nextChar)) {
          syllable += 'n';
          i++;
        }
      }
      
      if (syllable) {
        syllables.push(syllable);
      }
    }
    
    return syllables.join('-');
  });
  
  return syllabifiedWords.join(' ');
}

/**
 * Split Korean romanization into syllables for easier reading
 * Korean syllables follow CV(C) patterns with clear vowel nuclei
 * Example: "Neowa hamkke" → "Neo-wa ham-kke", "annyeonghaseyo" → "an-nyeong-ha-se-yo"
 * 
 * Korean syllable structure:
 * - Onset (initial consonant): any consonant or cluster
 * - Nucleus (vowel): required, can be diphthong
 * - Coda (final consonant): optional, limited to: k, l, m, n, p, t, ng
 */
function splitKoreanSyllables(romanized: string): string {
  // Process each word separately, handling existing punctuation
  const words = romanized.split(/\s+/);
  
  const syllabifiedWords = words.map(word => {
    if (word.length <= 2) return word; // Don't split very short words
    
    // Handle words with existing hyphens or punctuation - skip syllabification
    if (/[-''`]/.test(word)) return word;
    
    // Korean romanization vowels - LONGEST FIRST for proper matching
    const vowels = [
      'wae', 'yeo', 'oe', 'ae', 'eo', 'eu', 'wa', 'wo', 'we', 'ya', 'ye', 'yo', 'yu', 'ui',
      'a', 'e', 'i', 'o', 'u'
    ];
    
    // Valid coda consonants that can end a Korean syllable
    // These are the only consonants that can be syllable-final
    const validCodas = ['ng', 'k', 'l', 'm', 'n', 'p', 't'];
    
    const syllables: string[] = [];
    let i = 0;
    
    while (i < word.length) {
      let syllable = '';
      
      // 1. Collect onset (initial consonants)
      while (i < word.length && !'aeiouy'.includes(word[i].toLowerCase())) {
        syllable += word[i];
        i++;
      }
      
      // 2. Find and collect nucleus (vowel) - check longest patterns first
      let vowelFound = false;
      for (const vowel of vowels) {
        if (word.substring(i, i + vowel.length).toLowerCase() === vowel) {
          syllable += vowel;
          i += vowel.length;
          vowelFound = true;
          break;
        }
      }
      
      if (!vowelFound) {
        // No vowel found - append consonants to previous syllable
        if (syllables.length > 0 && syllable.length > 0) {
          syllables[syllables.length - 1] += syllable;
        }
        break;
      }
      
      // 3. Check for coda (trailing consonant)
      if (i < word.length && !'aeiouy'.includes(word[i].toLowerCase())) {
        // Look ahead at all upcoming consonants
        let nextConsonants = '';
        let j = i;
        while (j < word.length && !'aeiouy'.includes(word[j].toLowerCase())) {
          nextConsonants += word[j];
          j++;
        }
        
        if (j >= word.length) {
          // End of word - take all remaining consonants
          syllable += nextConsonants;
          i = j;
        } else {
          // More vowels ahead - determine syllable boundary
          const cons = nextConsonants.toLowerCase();
          
          // Check for "ng" first (the only 2-letter coda)
          if (cons.startsWith('ng')) {
            // Keep "ng" as coda, rest (if any) start next syllable
            syllable += cons.substring(0, 2);
            i += 2;
          } else if (validCodas.includes(cons[0]) && cons.length > 1) {
            // Valid single-letter coda + more: keep first, rest to next syllable
            syllable += cons[0];
            i += 1;
          }
          // else: no coda - all consonants start next syllable
        }
      }
      
      syllables.push(syllable);
    }
    
    return syllables.join('-');
  });
  
  return syllabifiedWords.join(' ');
}

/**
 * Split phonetic text into syllables for easier reading
 * Handles both Spanish and French vowel sounds including nasal vowels
 * Example: "ohlah" → "oh-lah", "bonzhoor" → "bon-zhoor"
 */
function splitIntoSyllables(phonetic: string): string {
  // Process each word separately (preserve spaces)
  const words = phonetic.split(' ');
  
  const syllabifiedWords = words.map(word => {
    if (word.length <= 2) return word; // Don't split very short words
    
    // Remove existing hyphens to process clean phonetic text
    let cleanWord = word.toLowerCase().replace(/-/g, '');
    if (cleanWord.length <= 2) return word; // Don't split very short words
    
    // All recognized vowel sounds (including nasal vowels from French)
    // Order by length (longest first) to match correctly
    const vowelSounds = ['ahn', 'ohn', 'yan', 'wah', 'woh', 'weh', 'yeh', 'yah', 'yoh', 'ehn', 'uan',
                          'ah', 'eh', 'ee', 'oh', 'oo', 'ay', 'oy', 'ow', 'uh', 'an', 'on'];
    
    // Digraphs to keep together
    const digraphs = ['ch', 'sh', 'zh', 'rr', 'ny', 'ph', 'th', 'gh', 'nk', 'ks'];
    
    // Valid syllable codas (consonants that can end a syllable)
    const validCodas = ['m', 'n', 't', 'd', 'r', 's', 'x', 'z', 'b', 'p', 'g', 'k', 'l', 'f', 'v', 'w', 'y'];
    
    const syllables: string[] = [];
    let i = 0;
    
    while (i < cleanWord.length) {
      let syllable = '';
      
      // Try to match a vowel sound (longest first)
      let foundVowel = false;
      for (const vowelSound of vowelSounds) {
        if (cleanWord.substring(i).startsWith(vowelSound)) {
          syllable += vowelSound;
          i += vowelSound.length;
          foundVowel = true;
          break;
        }
      }
      
      if (!foundVowel) {
        // No vowel found at current position, skip this character to avoid infinite loop
        // (malformed phonetic text)
        syllable += cleanWord[i];
        i += 1;
        syllables.push(syllable);
        continue;
      }
      
      // Now collect consonants after the vowel
      let consonantCluster = '';
      while (i < cleanWord.length) {
        // Try to match digraph first
        let foundDigraph = false;
        for (const digraph of digraphs) {
          if (cleanWord.substring(i).startsWith(digraph)) {
            consonantCluster += digraph;
            i += digraph.length;
            foundDigraph = true;
            break;
          }
        }
        
        if (!foundDigraph) {
          // Check for single consonant
          const char = cleanWord[i];
          if (/[bcdfghjklmnpqrstvwxz]/.test(char)) {
            consonantCluster += char;
            i += 1;
          } else {
            // Not a consonant (must be a vowel starting next syllable)
            break;
          }
        }
      }
      
      // Decide how much of consonant cluster to attach to current syllable
      if (consonantCluster.length === 0) {
        // No consonants after vowel
        syllables.push(syllable);
      } else if (consonantCluster.length === 1) {
        // Single consonant: check if it's likely a coda or onset
        const consonant = consonantCluster[0];
        
        // Look ahead: is there another vowel after this consonant?
        if (i < cleanWord.length) {
          // There's more text, so this consonant is likely onset of next syllable
          syllables.push(syllable);
          i -= 1; // Back up so next iteration starts with this consonant
        } else {
          // No more text, this is a coda
          syllable += consonant;
          syllables.push(syllable);
        }
      } else {
        // Multiple consonants: split before the last one (usual syllable structure CV-CVC)
        // Exception: if it's a digraph, keep it together
        const lastTwoChars = consonantCluster.slice(-2);
        let isLastDigraph = digraphs.includes(lastTwoChars);
        
        if (isLastDigraph) {
          // Last two chars are a digraph, keep with syllable
          syllable += consonantCluster;
          syllables.push(syllable);
        } else {
          // Split before last consonant
          const codaLength = 1; // For simplicity, just take last consonant as potential coda
          syllable += consonantCluster.slice(0, -codaLength);
          syllables.push(syllable);
          
          // Back up so next iteration starts with the last consonant
          i -= codaLength;
        }
      }
    }
    
    return syllables.join('-');
  });
  
  return syllabifiedWords.join(' ');
}

/**
 * Convert Zulu/Xhosa text to English-friendly phonetic pronunciation
 * Example: "Ngishutheni" → "ngee-shoo-teh-nee", "S'hamba" → "sahm-bah"
 * 
 * Zulu/Xhosa pronunciation rules:
 * 1. Vowels are pure (like Spanish): a=ah, e=eh, i=ee, o=oh, u=oo
 * 2. "ng" at word start is a single sound (like "ng" in "sing")
 * 3. Clicks (c, q, x) are approximated as regular consonants for simplicity
 * 4. "hl" is a voiceless lateral (approximated as "hl")
 * 5. Apostrophes indicate dropped vowels
 */
function zuluToPhonetic(text: string): string {
  let phonetic = text.toLowerCase();
  
  // Step 1: Handle apostrophes (contractions like S'hamba = Si + hamba)
  phonetic = phonetic.replace(/s'/g, 'sah-');     // S' → sah
  phonetic = phonetic.replace(/n'/g, 'nah-');     // N' → nah
  
  // Step 2: Handle special consonant clusters
  phonetic = phonetic.replace(/ng'/g, 'ng-');     // ng' → ng
  phonetic = phonetic.replace(/hl/g, '§HL§');     // Lateral fricative
  phonetic = phonetic.replace(/dl/g, '§DL§');     // Voiced lateral
  phonetic = phonetic.replace(/sh/g, '§SH§');     // Preserve sh
  phonetic = phonetic.replace(/th/g, '§TH§');     // Preserve th
  
  // Step 3: Handle word-initial "ng" (velar nasal)
  phonetic = phonetic.replace(/\bng/g, '§NG§');
  
  // Step 4: Map vowels to phonetic equivalents
  phonetic = phonetic.replace(/a/g, 'ah');
  phonetic = phonetic.replace(/e/g, 'eh');
  phonetic = phonetic.replace(/i/g, 'ee');
  phonetic = phonetic.replace(/o/g, 'oh');
  phonetic = phonetic.replace(/u/g, 'oo');
  
  // Step 5: Restore protected consonant clusters
  phonetic = phonetic.replace(/§HL§/g, 'hl');
  phonetic = phonetic.replace(/§DL§/g, 'dl');
  phonetic = phonetic.replace(/§SH§/g, 'sh');
  phonetic = phonetic.replace(/§TH§/g, 'th');
  phonetic = phonetic.replace(/§NG§/g, 'ng');
  
  // Step 6: Clean up extra spaces and normalize
  phonetic = phonetic.replace(/\s+/g, ' ').trim();
  
  // Step 7: Split into syllables for easier reading
  phonetic = splitIntoSyllables(phonetic);
  
  return phonetic;
}

/**
 * Convert Spanish text to English-friendly phonetic pronunciation
 * Example: "Hola" → "oh-lah", "Anda y ve" → "ahn-dah ee veh"
 * 
 * Implementation strategy:
 * 1. Normalize diacritics and case
 * 2. Process digraphs (ch, ll, rr, ñ) before single letters
 * 3. Apply context-sensitive consonant rules (c/g before e/i)
 * 4. Map vowels and diphthongs
 * 5. Split into syllables for readability
 */
function spanishToPhonetic(text: string): string {
  // Normalize to lowercase for processing
  let phonetic = text.toLowerCase();
  
  // Step 1: Handle digraphs FIRST (before processing individual letters)
  // Must be done before single-letter replacements to avoid breaking them
  phonetic = phonetic.replace(/ch/g, '§CH§');  // Use temporary marker
  phonetic = phonetic.replace(/ll/g, '§Y§');
  phonetic = phonetic.replace(/rr/g, '§RR§');
  phonetic = phonetic.replace(/ñ/g, '§NY§');
  
  // Step 2: Handle silent H and special letter combinations
  phonetic = phonetic.replace(/h/g, '');  // Silent H
  
  // "que" and "qui" (u is silent)
  phonetic = phonetic.replace(/que/g, 'KEH');
  phonetic = phonetic.replace(/qui/g, 'KEE');
  
  // "gue" and "gui" (u is silent)
  phonetic = phonetic.replace(/gue/g, 'GEH');
  phonetic = phonetic.replace(/gui/g, 'GEE');
  
  // "güe" and "güi" (u is pronounced)
  phonetic = phonetic.replace(/güe/g, 'GWEH');
  phonetic = phonetic.replace(/güi/g, 'GWEE');
  
  // Step 3: Context-sensitive consonants
  // C before e/i sounds like S
  phonetic = phonetic.replace(/ce/g, 'SEH');
  phonetic = phonetic.replace(/ci/g, 'SEE');
  // G before e/i sounds like H (soft g)
  phonetic = phonetic.replace(/ge/g, 'HEH');
  phonetic = phonetic.replace(/gi/g, 'HEE');
  
  // V before e/i (keep as V for proper vowel combination)
  // V elsewhere sounds like B
  phonetic = phonetic.replace(/ve/g, 'VEH');
  phonetic = phonetic.replace(/vi/g, 'VEE');
  phonetic = phonetic.replace(/v/g, 'B');
  
  // Z always sounds like S in Latin American Spanish
  phonetic = phonetic.replace(/z/g, 'S');
  
  // J sounds like H
  phonetic = phonetic.replace(/j/g, 'H');
  
  // Standalone Y (as in "y" meaning "and") sounds like EE
  phonetic = phonetic.replace(/\sy\s/g, ' EE ');
  phonetic = phonetic.replace(/^y\s/g, 'EE ');
  phonetic = phonetic.replace(/\sy$/g, ' EE');
  
  // X can be KS or H (in Mexico/Texas names), use KS as default
  phonetic = phonetic.replace(/x/g, 'KS');
  
  // Step 4: Handle diphthongs (must be before single vowels)
  phonetic = phonetic.replace(/ai/g, 'AY');
  phonetic = phonetic.replace(/ay/g, 'AY');
  phonetic = phonetic.replace(/ei/g, 'AY');
  phonetic = phonetic.replace(/ey/g, 'AY');
  phonetic = phonetic.replace(/oi/g, 'OY');
  phonetic = phonetic.replace(/oy/g, 'OY');
  phonetic = phonetic.replace(/au/g, 'OW');
  phonetic = phonetic.replace(/eu/g, 'EH-OO');
  phonetic = phonetic.replace(/ue/g, 'WEH');
  phonetic = phonetic.replace(/ua/g, 'WAH');
  phonetic = phonetic.replace(/uo/g, 'WOH');
  phonetic = phonetic.replace(/ie/g, 'YEH');
  phonetic = phonetic.replace(/ia/g, 'YAH');
  phonetic = phonetic.replace(/io/g, 'YOH');
  
  // Step 5: Single vowels (including accented versions)
  // Accented vowels indicate stress but sound the same
  phonetic = phonetic.replace(/á/g, 'AH');
  phonetic = phonetic.replace(/a/g, 'AH');
  phonetic = phonetic.replace(/é/g, 'EH');
  phonetic = phonetic.replace(/e/g, 'EH');
  phonetic = phonetic.replace(/í/g, 'EE');
  phonetic = phonetic.replace(/i/g, 'EE');
  phonetic = phonetic.replace(/ó/g, 'OH');
  phonetic = phonetic.replace(/o/g, 'OH');
  phonetic = phonetic.replace(/ú/g, 'OO');
  phonetic = phonetic.replace(/ü/g, 'OO');
  phonetic = phonetic.replace(/u/g, 'OO');
  
  // Step 6: Restore digraph markers
  phonetic = phonetic.replace(/§CH§/g, 'CH');
  phonetic = phonetic.replace(/§Y§/g, 'Y');
  phonetic = phonetic.replace(/§RR§/g, 'RR');
  phonetic = phonetic.replace(/§NY§/g, 'NY');
  
  // Step 7: Clean up and format
  // Convert to lowercase for readability (like Google Translate style)
  phonetic = phonetic.toLowerCase();
  // Remove multiple spaces, trim
  phonetic = phonetic.replace(/\s+/g, ' ').trim();
  
  // Step 8: Split into syllables for easier reading
  phonetic = splitIntoSyllables(phonetic);
  
  return phonetic;
}

/**
 * Convert Portuguese text to English-friendly phonetic pronunciation
 * Example: "Obrigado" → "oh-bree-gah-doo", "Coração" → "koh-rah-sow"
 * 
 * Implementation strategy:
 * 1. Handle digraphs (nh, lh, ch)
 * 2. Process nasal vowels (ão, õe, em/en at end)
 * 3. Context-sensitive consonants (c, g, x, r)
 * 4. Vowel mappings with Brazilian Portuguese pronunciation
 * 5. Split into syllables for readability
 */
function portugueseToPhonetic(text: string): string {
  console.log('[Portuguese Phonetic] Input:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  let phonetic = text.toLowerCase();
  
  // Step 1: Protect digraphs FIRST (before removing h)
  phonetic = phonetic.replace(/nh/g, '§NY§');  // nh sounds like ny
  phonetic = phonetic.replace(/lh/g, '§LY§');  // lh sounds like ly
  phonetic = phonetic.replace(/ch/g, '§SH§');  // ch sounds like sh
  
  // Step 2: Now remove silent H (h that's not part of digraphs)
  phonetic = phonetic.replace(/h/g, '');  // All remaining h is silent
  
  // Step 3: Nasal vowels (most specific first)
  phonetic = phonetic.replace(/ãe/g, '§AYN§');  // mãe → mayn
  phonetic = phonetic.replace(/ão/g, '§OWN§');  // não → nown, coração → koh-rah-sown
  phonetic = phonetic.replace(/õe/g, '§OYN§');  // põe → poyn
  phonetic = phonetic.replace(/ã/g, '§AN§');    // irmã → eer-man
  phonetic = phonetic.replace(/õ/g, '§ON§');    // põe → pon
  
  // Nasal combinations - more patterns needed
  phonetic = phonetic.replace(/em(\s|$|[^aeiouáéíóú])/g, '§AYN§$1');   // bem → bayn, tem → tayn
  phonetic = phonetic.replace(/en([dts])/g, '§AYN§$1');                 // entender → ayn-tayn-dayr
  phonetic = phonetic.replace(/en(\s|$)/g, '§AYN§$1');                  // hífen → ee-fayn
  phonetic = phonetic.replace(/im(\s|$)/g, '§EEN§$1');                  // assim → ah-seen
  phonetic = phonetic.replace(/in(\s|$)/g, '§EEN§$1');                  // fim → feen
  phonetic = phonetic.replace(/om(\s|$)/g, '§OWN§$1');                  // bom → bown
  phonetic = phonetic.replace(/on(\s|$)/g, '§OWN§$1');                  // não → nown
  phonetic = phonetic.replace(/um(\s|$)/g, '§OON§$1');                  // um → oon
  phonetic = phonetic.replace(/un(\s|$)/g, '§OON§$1');                  // algum → ahl-goon
  
  // Step 4: Cedilla
  phonetic = phonetic.replace(/ç/g, 'S');   // ç always = s
  
  // Step 5: Context-sensitive X
  // x at start or after consonant = sh
  phonetic = phonetic.replace(/(^|\s)x/g, '$1§SH§');
  phonetic = phonetic.replace(/([^aeiouáéíóú])x/g, '$1§SH§');
  // x between vowels = ks or sh (use sh for simplicity)
  phonetic = phonetic.replace(/ex([aeiou])/g, 'eh§SH§$1');
  phonetic = phonetic.replace(/x/g, 'KS');  // Default x = ks
  
  // Step 6: Context-sensitive R
  // rr = strong R
  phonetic = phonetic.replace(/rr/g, '§RR§');
  // r at word start = strong R
  phonetic = phonetic.replace(/(^|\s)r/g, '$1§RR§');
  // r at word end or before consonant = H sound (Brazilian Portuguese)
  phonetic = phonetic.replace(/r(\s|$)/g, 'H$1');        // beijar → bay-zhah
  phonetic = phonetic.replace(/r([^aeiouáéíóú])/g, 'H$1');  // forte → foh-tee
  // r between vowels = soft r (keep as r)
  
  // Step 7: J sounds like ZH (like French j)
  phonetic = phonetic.replace(/j/g, 'ZH');
  
  // Step 8: Context-sensitive C and G (handle accented vowels first)
  // C before e/i (including accented) = s
  phonetic = phonetic.replace(/cê/g, 'SAY');   // cê → say (ê = ay)
  phonetic = phonetic.replace(/cé/g, 'SEH');   // cé → seh (é = eh)
  phonetic = phonetic.replace(/ce/g, 'SEH');   // ce → seh
  phonetic = phonetic.replace(/cí/g, 'SEE');   // cí → see
  phonetic = phonetic.replace(/ci/g, 'SEE');   // ci → see
  // G before e/i = zh (like French j)
  phonetic = phonetic.replace(/ge/g, 'ZHEH');
  phonetic = phonetic.replace(/gi/g, 'ZHEE');
  
  // Step 9: QU combinations
  phonetic = phonetic.replace(/que/g, 'KEH');
  phonetic = phonetic.replace(/qui/g, 'KEE');
  phonetic = phonetic.replace(/qua/g, 'KWAH');
  phonetic = phonetic.replace(/quo/g, 'KWOH');
  
  // GU combinations
  phonetic = phonetic.replace(/gue/g, 'GEH');
  phonetic = phonetic.replace(/gui/g, 'GEE');
  phonetic = phonetic.replace(/gua/g, 'GWAH');
  phonetic = phonetic.replace(/guo/g, 'GWOH');
  
  // Step 10: Diphthongs (before single vowels)
  phonetic = phonetic.replace(/ai/g, 'AY');
  phonetic = phonetic.replace(/ei/g, 'AY');
  phonetic = phonetic.replace(/oi/g, 'OY');
  phonetic = phonetic.replace(/ou/g, 'OH');    // Portuguese ou = oh (not ow)
  phonetic = phonetic.replace(/au/g, 'OW');
  phonetic = phonetic.replace(/eu/g, 'EH-OO');
  phonetic = phonetic.replace(/iu/g, 'YOO');
  phonetic = phonetic.replace(/ui/g, 'WEE');
  
  // Step 11: Single vowels with accents
  phonetic = phonetic.replace(/á/g, 'AH');
  phonetic = phonetic.replace(/â/g, 'AN');     // â is nasal
  phonetic = phonetic.replace(/à/g, 'AH');
  phonetic = phonetic.replace(/é/g, 'EH');
  phonetic = phonetic.replace(/ê/g, 'AY');     // ê is closed (você = voh-say)
  phonetic = phonetic.replace(/í/g, 'EE');
  phonetic = phonetic.replace(/ó/g, 'AW');     // ó is open (avó = ah-vaw)
  phonetic = phonetic.replace(/ô/g, 'OH');     // ô is closed (avô = ah-voh)
  phonetic = phonetic.replace(/ú/g, 'OO');
  
  // Step 12: Single vowels (unaccented)
  // E at word end = ee or silent (use ee)
  phonetic = phonetic.replace(/e(\s|$)/g, 'EE$1');
  // O at word end = oo
  phonetic = phonetic.replace(/o(\s|$)/g, 'OO$1');
  // Regular vowels
  phonetic = phonetic.replace(/a/g, 'AH');
  phonetic = phonetic.replace(/e/g, 'EH');
  phonetic = phonetic.replace(/i/g, 'EE');
  phonetic = phonetic.replace(/o/g, 'OH');
  phonetic = phonetic.replace(/u/g, 'OO');
  
  // Step 13: Restore protected markers
  phonetic = phonetic.replace(/§NY§/g, 'NY');
  phonetic = phonetic.replace(/§LY§/g, 'LY');
  phonetic = phonetic.replace(/§SH§/g, 'SH');
  phonetic = phonetic.replace(/§RR§/g, 'RR');
  phonetic = phonetic.replace(/§AYN§/g, 'AYN');
  phonetic = phonetic.replace(/§OWN§/g, 'OWN');
  phonetic = phonetic.replace(/§OYN§/g, 'OYN');
  phonetic = phonetic.replace(/§AN§/g, 'AN');
  phonetic = phonetic.replace(/§ON§/g, 'ON');
  phonetic = phonetic.replace(/§EEN§/g, 'EEN');
  phonetic = phonetic.replace(/§OON§/g, 'OON');
  
  // Step 14: Clean up and format
  phonetic = phonetic.toLowerCase();
  phonetic = phonetic.replace(/\s+/g, ' ').trim();
  
  // Step 15: Split into syllables
  phonetic = splitIntoSyllables(phonetic);
  
  console.log('[Portuguese Phonetic] Output:', phonetic.substring(0, 50) + (phonetic.length > 50 ? '...' : ''));
  
  return phonetic;
}

/**
 * Convert French text to English-friendly phonetic pronunciation
 * Example: "Bonjour" → "bon-zhoor", "Je t'aime" → "zhuh tem"
 * 
 * Uses protected markers to preserve multi-character phonemes during processing
 */
function frenchToPhonetic(text: string): string {
  let phonetic = text.toLowerCase();
  
  // Step 0: Remove apostrophes in contractions (Je t'aime → Je taime)
  phonetic = phonetic.replace(/'/g, '');
  phonetic = phonetic.replace(/'/g, '');
  
  // Step 1: Use markers to protect multi-character combinations
  // Nasal vowels FIRST (most specific)
  phonetic = phonetic.replace(/ain/g, '§AHN§');
  phonetic = phonetic.replace(/ein/g, '§AHN§');
  phonetic = phonetic.replace(/ien/g, '§YAN§');
  phonetic = phonetic.replace(/an/g, '§AHN§');
  phonetic = phonetic.replace(/en/g, '§AHN§');
  phonetic = phonetic.replace(/in/g, '§AN§');
  phonetic = phonetic.replace(/un/g, '§AN§');
  phonetic = phonetic.replace(/on/g, '§OHN§');
  
  // Vowel combinations
  phonetic = phonetic.replace(/eau/g, '§OH§');
  phonetic = phonetic.replace(/au/g, '§OH§');
  phonetic = phonetic.replace(/oi/g, '§WAH§');
  phonetic = phonetic.replace(/ou/g, '§OO§');
  phonetic = phonetic.replace(/eu/g, '§UH§');
  phonetic = phonetic.replace(/œu/g, '§UH§');
  phonetic = phonetic.replace(/ai/g, '§EH§');
  phonetic = phonetic.replace(/ei/g, '§EH§');
  
  // Step 2: Consonant digraphs
  phonetic = phonetic.replace(/ch/g, '§SH§');
  phonetic = phonetic.replace(/gn/g, '§NY§');
  phonetic = phonetic.replace(/qu/g, '§K§');
  phonetic = phonetic.replace(/ç/g, '§S§');
  
  // J and soft G
  phonetic = phonetic.replace(/j/g, '§ZH§');
  phonetic = phonetic.replace(/ge/g, '§ZHEH§');
  phonetic = phonetic.replace(/gi/g, '§ZHEE§');
  
  // Soft C
  phonetic = phonetic.replace(/ce/g, '§SEH§');
  phonetic = phonetic.replace(/ci/g, '§SEE§');
  
  // Step 3: Accented vowels
  phonetic = phonetic.replace(/é/g, '§AY§');
  phonetic = phonetic.replace(/è/g, '§EH§');
  phonetic = phonetic.replace(/ê/g, '§EH§');
  phonetic = phonetic.replace(/ë/g, '§EH§');
  phonetic = phonetic.replace(/à/g, '§AH§');
  phonetic = phonetic.replace(/â/g, '§AH§');
  phonetic = phonetic.replace(/ô/g, '§OH§');
  phonetic = phonetic.replace(/î/g, '§EE§');
  phonetic = phonetic.replace(/ï/g, '§EE§');
  phonetic = phonetic.replace(/ù/g, '§OO§');
  phonetic = phonetic.replace(/û/g, '§OO§');
  phonetic = phonetic.replace(/ü/g, '§OO§');
  
  // Step 4: Single vowels
  phonetic = phonetic.replace(/a/g, '§AH§');
  phonetic = phonetic.replace(/e/g, '§UH§');
  phonetic = phonetic.replace(/i/g, '§EE§');
  phonetic = phonetic.replace(/o/g, '§OH§');
  phonetic = phonetic.replace(/u/g, '§OO§');
  phonetic = phonetic.replace(/y/g, '§EE§');
  
  // Step 5: Restore markers to actual phonemes
  phonetic = phonetic.replace(/§AHN§/g, 'ahn');
  phonetic = phonetic.replace(/§OHN§/g, 'ohn');
  phonetic = phonetic.replace(/§AN§/g, 'an');
  phonetic = phonetic.replace(/§YAN§/g, 'yan');
  phonetic = phonetic.replace(/§WAH§/g, 'wah');
  phonetic = phonetic.replace(/§OH§/g, 'oh');
  phonetic = phonetic.replace(/§OO§/g, 'oo');
  phonetic = phonetic.replace(/§UH§/g, 'uh');
  phonetic = phonetic.replace(/§EH§/g, 'eh');
  phonetic = phonetic.replace(/§AH§/g, 'ah');
  phonetic = phonetic.replace(/§EE§/g, 'ee');
  phonetic = phonetic.replace(/§AY§/g, 'ay');
  phonetic = phonetic.replace(/§SH§/g, 'sh');
  phonetic = phonetic.replace(/§NY§/g, 'ny');
  phonetic = phonetic.replace(/§ZH§/g, 'zh');
  phonetic = phonetic.replace(/§ZHEH§/g, 'zheh');
  phonetic = phonetic.replace(/§ZHEE§/g, 'zhee');
  phonetic = phonetic.replace(/§SEH§/g, 'seh');
  phonetic = phonetic.replace(/§SEE§/g, 'see');
  phonetic = phonetic.replace(/§K§/g, 'k');
  phonetic = phonetic.replace(/§S§/g, 's');
  
  // Step 6: Handle silent final 'e' very selectively
  // Only remove trailing 'uh' in very specific safe patterns
  // Avoid removing from words like "je" (zhuh), preserve essential schwas
  
  // Pattern 1: Remove 'uh' after 'm' at word end (aime → ehmuh → ehm)
  phonetic = phonetic.replace(/muh(\s|$)/gi, 'm$1');
  
  // Pattern 2: Then simplify 'ehm' to 'em' (aime → ehm → em)
  phonetic = phonetic.replace(/ehm(\s|$)/gi, 'em$1');
  
  // Pattern 3: Remove 'uh' after specific safe consonants at word boundaries  
  phonetic = phonetic.replace(/([st])uh(\s|$)/gi, '$1$2');
  
  // Clean up multiple spaces
  phonetic = phonetic.replace(/\s+/g, ' ').trim();
  
  // Step 7: Simplify problematic consonant clusters (TTS cleanup)
  // These patterns can cause TTS to spell out letters instead of pronouncing words
  // Similar to German: avoid patterns that look like abbreviations
  phonetic = phonetic.replace(/ht\b/g, 't');    // "naht" instead of "nahht" (TTS stops spelling)
  phonetic = phonetic.replace(/nkt\b/g, 'nk');  // Remove extra consonants at word boundaries
  phonetic = phonetic.replace(/st(\s|$)/g, 's$1');  // Simplify st clusters
  
  // Split into syllables
  phonetic = splitIntoSyllables(phonetic);
  
  return phonetic;
}

/**
 * Clean romanized text to remove redundant English portions
 * For mixed-language lyrics (e.g., Japanese + English), removes English parts that are already in the translation
 */
function cleanRomanization(romanized: string, originalText: string): string {
  // Check if original text contains Latin alphabet (indicates mixed language)
  const hasLatin = /[a-zA-Z]/.test(originalText);
  
  if (!hasLatin) {
    // Pure non-Latin script, return as-is
    return romanized;
  }
  
  // Extract only the romanized parts (non-English words)
  let cleaned = romanized;
  
  // Remove text in parentheses (often redundant English)
  cleaned = cleaned.replace(/\([^)]+\)/g, '').trim();
  
  // Remove text in brackets (sometimes used for translations)
  cleaned = cleaned.replace(/\[[^\]]+\]/g, '').trim();
  
  // Common English words/phrases that should be filtered
  const commonEnglishWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'you', 'him', 'she', 'it', 'we', 'they',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could',
    'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'heart', 'love', 'time', 'day', 'night', 'way', 'life', 'world', 'hand', 'part',
    'uneasy', 'easy', 'hard', 'good', 'bad', 'new', 'old', 'first', 'last', 'long', 'great', 'little'
  ]);
  
  // Remove standalone English words
  const words = cleaned.split(/\s+/);
  const filteredWords = words.filter(word => {
    const cleanWord = word.replace(/[.,!?;:'"]/g, '').toLowerCase();
    
    // Keep if it has hyphens (romanized syllables)
    if (word.includes('-')) return true;
    
    // Keep very short words (often particles in romanization)
    if (cleanWord.length <= 2) return true;
    
    // Filter out common English words
    if (commonEnglishWords.has(cleanWord)) return false;
    
    // Check if it's likely English (contains only ASCII letters, no special chars)
    // Japanese romanization often has repeated vowels or specific patterns
    const looksLikeEnglish = /^[a-z]+$/i.test(cleanWord) && cleanWord.length > 3;
    
    if (looksLikeEnglish) {
      // Additional check: Japanese romanization often has doubled vowels (aa, ii, oo, uu, ee)
      // or ends with specific patterns (shi, chi, tsu, etc.)
      const hasDoubledVowels = /(aa|ii|uu|ee|oo)/.test(cleanWord);
      const hasJapanesePatterns = /(shi|chi|tsu|dzu|kyo|ryo|sha|cha)/.test(cleanWord);
      
      // Keep if it looks like romanized Japanese
      if (hasDoubledVowels || hasJapanesePatterns) return true;
      
      // Otherwise filter out
      return false;
    }
    
    return true;
  });
  
  cleaned = filteredWords.join(' ').trim();
  
  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned || romanized; // Fallback to original if everything was filtered
}

/**
 * Add syllable breakdowns to Indic romanized text
 * Handles Devanagari/Gurmukhi transliteration patterns
 * Example: "tere toṁ merī" → "te-re toṁ me-rī"
 */
function addIndicSyllables(text: string): string {
  // Process each word separately
  const words = text.split(' ');
  
  const syllabifiedWords = words.map(word => {
    if (word.length <= 2) return word; // Don't split very short words
    
    // Common Indic vowel patterns (including diacritics: ā, ī, ū, ē, ō, etc.)
    const vowelPattern = 'ā|ī|ū|ē|ō|ai|au|a|e|i|o|u';
    
    // Match pattern: (vowel) + (consonants) + (vowel)
    const syllableRegex = new RegExp(`(${vowelPattern})([bcdfghjklmnpqrstvwxyz]+)(${vowelPattern})`, 'gi');
    
    let result = word.replace(syllableRegex, (match, v1, cons, v2) => {
      // Handle consonant clusters (keep digraphs together: kh, gh, th, dh, ph, bh, ch, jh, ṭh, ḍh)
      if (cons.length > 1) {
        // Check for Indic digraphs
        const digraphs = ['kh', 'gh', 'th', 'dh', 'ph', 'bh', 'ch', 'jh', 'ṭh', 'ḍh', 'nh', 'sh'];
        for (const digraph of digraphs) {
          if (cons.endsWith(digraph)) {
            return `${v1}-${cons}${v2}`;
          }
          if (cons.startsWith(digraph)) {
            return `${v1}-${cons}${v2}`;
          }
        }
        // Split before last consonant for regular clusters
        return `${v1}${cons.slice(0, -1)}-${cons.slice(-1)}${v2}`;
      }
      // Single consonant goes with following vowel
      return `${v1}-${cons}${v2}`;
    });
    
    return result;
  });
  
  return syllabifiedWords.join(' ');
}

/**
 * Convert Punjabi/Hindi romanized text to English-friendly phonetics
 * Handles romanized Punjabi/Hindi that's already in Latin script
 * Adds pronunciation guides for English speakers
 */
function punjabiToPhonetic(text: string): string {
  let phonetic = text;
  
  // Clean up apostrophes and special chars
  phonetic = phonetic.replace(/'/g, '');
  phonetic = phonetic.replace(/`/g, '');
  
  // Vowel pronunciation guides (case-insensitive)
  phonetic = phonetic.replace(/aa/gi, 'ah');        // "aa" → "ah" (like "father")
  phonetic = phonetic.replace(/ee/gi, 'ee');        // "ee" → "ee" (like "see")
  phonetic = phonetic.replace(/oo/gi, 'oo');        // "oo" → "oo" (like "food")
  phonetic = phonetic.replace(/ai/gi, 'ai');        // "ai" → "ai" (like "aisle")
  phonetic = phonetic.replace(/au/gi, 'aw');        // "au" → "aw" (like "saw")
  
  // Consonant pronunciation guides
  phonetic = phonetic.replace(/\bph/gi, 'f');       // "ph" → "f" (like "fun")
  phonetic = phonetic.replace(/kh/gi, 'kh');        // Keep "kh" (guttural k)
  phonetic = phonetic.replace(/gh/gi, 'gh');        // Keep "gh" (voiced)
  phonetic = phonetic.replace(/dh/gi, 'dh');        // Keep "dh" (aspirated d)
  phonetic = phonetic.replace(/th/gi, 'th');        // Keep "th" (aspirated t, NOT English "th")
  
  // Common word replacements for clarity
  phonetic = phonetic.replace(/\bnaa\b/gi, 'nah');  // "naa" → "nah"
  phonetic = phonetic.replace(/\bhain\b/gi, 'hayn'); // "hain" → "hayn"
  
  // Add spacing after commas
  phonetic = phonetic.replace(/,(\S)/g, ', $1');
  
  // Make pronunciation more English-friendly
  phonetic = phonetic.replace(/\bde\b/gi, 'day');   // "de" → "day"
  phonetic = phonetic.replace(/\bte\b/gi, 'tay');   // "te" → "tay"
  phonetic = phonetic.replace(/\bda\b/gi, 'dah');   // "da" → "dah"
  
  return phonetic.trim();
}

/**
 * Convert German text to TTS-friendly phonetic pronunciation
 * Optimized for Text-to-Speech engines (avoids patterns that get spelled out)
 * 
 * Example: "Das ist unsre Nacht" → "dahs ist oon-zreh naht"
 * 
 * TTS-friendly rules:
 * 1. Use simple vowels that TTS recognizes: a→ah, e→eh, i→ee, o→oh, u→oo
 * 2. Avoid abbreviation-like patterns: "ihst"→"ist", "oond"→"unt"
 * 3. Simplify consonant clusters: "cht"→"ht", "sht"→"st"
 * 4. Common word mappings for natural pronunciation
 */
function germanToPhonetic(text: string): string {
  let phonetic = text.toLowerCase();
  
  // Step 1: Handle common German words FIRST (whole word replacements)
  // These are optimized to sound natural when spoken by TTS
  phonetic = phonetic.replace(/\bund\b/g, '§UNT§');        // und → "unt"
  phonetic = phonetic.replace(/\bauf\b/g, '§OFF§');        // auf → "off"
  phonetic = phonetic.replace(/\bich\b/g, '§ISH§');        // ich → "ish"
  phonetic = phonetic.replace(/\bmich\b/g, '§MISH§');      // mich → "mish"
  phonetic = phonetic.replace(/\bdich\b/g, '§DISH§');      // dich → "dish"
  phonetic = phonetic.replace(/\bnicht\b/g, '§NISHT§');    // nicht → "nisht"
  phonetic = phonetic.replace(/\bist\b/g, '§IST§');        // ist → "ist"
  phonetic = phonetic.replace(/\bwie\b/g, '§VEE§');        // wie → "vee"
  phonetic = phonetic.replace(/\bfür\b/g, '§FOOR§');       // für → "foor"
  
  // Step 2: Handle umlauts (before vowel processing)
  phonetic = phonetic.replace(/ä/g, '§AE§');   // ä → "eh"
  phonetic = phonetic.replace(/ö/g, '§OE§');   // ö → "uh"
  phonetic = phonetic.replace(/ü/g, '§UE§');   // ü → "oo"
  phonetic = phonetic.replace(/ß/g, 'ss');     // ß → "ss"
  
  // Step 3: Handle vowel combinations (diphthongs)
  phonetic = phonetic.replace(/ei/g, '§EI§');  // ei → "eye"
  phonetic = phonetic.replace(/ie/g, '§IE§');  // ie → "ee"
  phonetic = phonetic.replace(/äu/g, '§OY§');  // äu → "oy"
  phonetic = phonetic.replace(/eu/g, '§OY§');  // eu → "oy"
  phonetic = phonetic.replace(/au/g, '§OW§');  // au → "ow"
  
  // Step 4: Handle consonant combinations (TTS-friendly versions)
  phonetic = phonetic.replace(/sch/g, '§SH§');  // sch → "sh"
  
  // Simplify st/sp at word start (avoid "sht" which TTS spells)
  phonetic = phonetic.replace(/\bst/g, '§ST§');  // st → "st" (not "sht")
  phonetic = phonetic.replace(/\bsp/g, '§SP§');  // sp → "sp" (not "shp")
  
  // ch handling - simplified for TTS
  phonetic = phonetic.replace(/ch/g, '§H§');    // ch → "h" (simple, TTS-friendly)
  
  // Step 5: Handle individual consonants
  phonetic = phonetic.replace(/w/g, 'v');       // w → "v"
  phonetic = phonetic.replace(/\bv/g, 'f');     // v at start → "f"
  phonetic = phonetic.replace(/z/g, 'ts');      // z → "ts"
  phonetic = phonetic.replace(/j/g, 'y');       // j → "y"
  
  // Step 6: Handle vowels (TTS-friendly versions)
  phonetic = phonetic.replace(/a/g, 'ah');
  phonetic = phonetic.replace(/e/g, 'eh');
  phonetic = phonetic.replace(/i/g, 'ee');      // "ee" instead of "ih" (TTS-friendly)
  phonetic = phonetic.replace(/o/g, 'oh');
  phonetic = phonetic.replace(/u/g, 'oo');
  
  // Step 7: Restore protected combinations
  phonetic = phonetic.replace(/§UNT§/g, 'unt');
  phonetic = phonetic.replace(/§OFF§/g, 'off');
  phonetic = phonetic.replace(/§ISH§/g, 'ish');
  phonetic = phonetic.replace(/§MISH§/g, 'mish');
  phonetic = phonetic.replace(/§DISH§/g, 'dish');
  phonetic = phonetic.replace(/§NISHT§/g, 'nisht');
  phonetic = phonetic.replace(/§IST§/g, 'ist');
  phonetic = phonetic.replace(/§VEE§/g, 'vee');
  phonetic = phonetic.replace(/§FOOR§/g, 'foor');
  phonetic = phonetic.replace(/§AE§/g, 'eh');
  phonetic = phonetic.replace(/§OE§/g, 'uh');
  phonetic = phonetic.replace(/§UE§/g, 'oo');
  phonetic = phonetic.replace(/§EI§/g, 'eye');
  phonetic = phonetic.replace(/§IE§/g, 'ee');
  phonetic = phonetic.replace(/§OY§/g, 'oy');
  phonetic = phonetic.replace(/§OW§/g, 'ow');
  phonetic = phonetic.replace(/§SH§/g, 'sh');
  phonetic = phonetic.replace(/§ST§/g, 'st');
  phonetic = phonetic.replace(/§SP§/g, 'sp');
  phonetic = phonetic.replace(/§H§/g, 'h');
  
  // Step 8: Simplify problematic consonant clusters (TTS cleanup)
  // These patterns still look like abbreviations after vowel replacement
  phonetic = phonetic.replace(/ht\b/g, 't');    // "naht" instead of "nahht"
  phonetic = phonetic.replace(/dt\b/g, 't');    // "stat" instead of "stahdt"
  
  // Step 9: Clean up and split into syllables
  phonetic = phonetic.replace(/\s+/g, ' ').trim();
  phonetic = splitIntoSyllables(phonetic);
  
  return phonetic;
}

/**
 * Convert Swedish text to TTS-friendly phonetic pronunciation
 * Optimized for Text-to-Speech engines (avoids patterns that get spelled out)
 * 
 * Example: "Jag älskar dig" → "yahg ehl-skar dey"
 * 
 * TTS-friendly rules:
 * 1. Special vowels: å→"oh", ä→"eh", ö→"uh"
 * 2. Consonants: j→"y", k before e/i/y/ä/ö→"sh"
 * 3. Common words: och→"oh", är→"ehr", jag→"yahg"
 * 4. Simplify clusters for natural pronunciation
 */
function swedishToPhonetic(text: string): string {
  let phonetic = text.toLowerCase();
  
  // Step 1: Handle common Swedish words FIRST (whole word replacements)
  // These are optimized to sound natural when spoken by TTS
  phonetic = phonetic.replace(/\boch\b/g, '§OH§');         // och → "oh"
  phonetic = phonetic.replace(/\bär\b/g, '§EHR§');         // är → "ehr"
  phonetic = phonetic.replace(/\bjag\b/g, '§YAHG§');       // jag → "yahg"
  phonetic = phonetic.replace(/\bsom\b/g, '§SOHM§');       // som → "sohm"
  phonetic = phonetic.replace(/\bmed\b/g, '§MEH§');        // med → "meh"
  phonetic = phonetic.replace(/\bför\b/g, '§FUR§');        // för → "fur"
  phonetic = phonetic.replace(/\bett\b/g, '§ET§');         // ett → "et"
  phonetic = phonetic.replace(/\bden\b/g, '§DEN§');        // den → "den"
  phonetic = phonetic.replace(/\bdet\b/g, '§DEH§');        // det → "deh"
  
  // Step 2: Handle special vowels (å, ä, ö)
  phonetic = phonetic.replace(/å/g, '§AA§');   // å → "oh"
  phonetic = phonetic.replace(/ä/g, '§AE§');   // ä → "eh"
  phonetic = phonetic.replace(/ö/g, '§OE§');   // ö → "uh"
  
  // Step 3: Handle consonant combinations
  phonetic = phonetic.replace(/sj/g, '§SH§');   // sj → "sh"
  phonetic = phonetic.replace(/skj/g, '§SH§');  // skj → "sh"
  phonetic = phonetic.replace(/stj/g, '§SH§');  // stj → "sh"
  phonetic = phonetic.replace(/sch/g, '§SH§');  // sch → "sh"
  phonetic = phonetic.replace(/tj/g, '§CH§');   // tj → "ch"
  phonetic = phonetic.replace(/kj/g, '§CH§');   // kj → "ch"
  phonetic = phonetic.replace(/dj/g, '§Y§');    // dj → "y"
  
  // Nasalized endings
  phonetic = phonetic.replace(/tion\b/g, '§SHUN§');  // -tion → "shun"
  phonetic = phonetic.replace(/sion\b/g, '§SHUN§');  // -sion → "shun"
  
  // Word-final -ig/-lig/-dig → "ee" sound
  phonetic = phonetic.replace(/ig\b/g, '§EE§');     // -ig → "ee"
  phonetic = phonetic.replace(/lig\b/g, '§LEE§');   // -lig → "lee"
  phonetic = phonetic.replace(/dig\b/g, '§DEE§');   // -dig → "dee"
  
  // k before e/i/y/ä/ö → "sh" (soft k)
  phonetic = phonetic.replace(/k([eiyäö])/g, '§SH§$1');
  
  // Step 4: Handle j and other consonants
  phonetic = phonetic.replace(/j/g, 'y');       // j → "y"
  
  // Step 5: Handle vowels (TTS-friendly versions)
  phonetic = phonetic.replace(/a/g, 'ah');
  phonetic = phonetic.replace(/e/g, 'eh');
  phonetic = phonetic.replace(/i/g, 'ee');
  phonetic = phonetic.replace(/o/g, 'oh');
  phonetic = phonetic.replace(/u/g, 'oo');
  phonetic = phonetic.replace(/y/g, 'ee');      // Swedish y → "ee" sound
  
  // Step 6: Restore protected combinations
  phonetic = phonetic.replace(/§OH§/g, 'oh');
  phonetic = phonetic.replace(/§EHR§/g, 'ehr');
  phonetic = phonetic.replace(/§YAHG§/g, 'yahg');
  phonetic = phonetic.replace(/§SOHM§/g, 'sohm');
  phonetic = phonetic.replace(/§MEH§/g, 'meh');
  phonetic = phonetic.replace(/§FUR§/g, 'fur');
  phonetic = phonetic.replace(/§ET§/g, 'et');
  phonetic = phonetic.replace(/§DEN§/g, 'den');
  phonetic = phonetic.replace(/§DEH§/g, 'deh');
  phonetic = phonetic.replace(/§AA§/g, 'oh');
  phonetic = phonetic.replace(/§AE§/g, 'eh');
  phonetic = phonetic.replace(/§OE§/g, 'uh');
  phonetic = phonetic.replace(/§SH§/g, 'sh');
  phonetic = phonetic.replace(/§CH§/g, 'ch');
  phonetic = phonetic.replace(/§Y§/g, 'y');
  phonetic = phonetic.replace(/§SHUN§/g, 'shun');
  phonetic = phonetic.replace(/§EE§/g, 'ee');
  phonetic = phonetic.replace(/§LEE§/g, 'lee');
  phonetic = phonetic.replace(/§DEE§/g, 'dee');
  
  // Step 7: Clean up and split into syllables
  phonetic = phonetic.replace(/\s+/g, ' ').trim();
  phonetic = splitIntoSyllables(phonetic);
  
  return phonetic;
}

/**
 * Generate phonetic guide for original text based on source language
 * 
 * For non-Latin scripts (Japanese, Arabic, Russian, etc.): Use Azure transliteration API
 * For Latin languages (Spanish, French, Portuguese, etc.): Generate English-friendly phonetics
 */
async function generatePhoneticGuide(
  originalText: string,
  sourceLanguage: string
): Promise<string> {
  console.log(`[Phonetic Guide] Generating for language: ${sourceLanguage}, text: "${originalText.substring(0, 30)}${originalText.length > 30 ? '...' : ''}"`);
  
  // Normalize language code: strip script suffix (e.g., "pa-Latn" → "pa")
  const baseLang = sourceLanguage.split('-')[0];
  
  // For Punjabi/Hindi/Urdu: Use reverse transliteration strategy
  // (These are often already romanized, so we need special handling)
  if (baseLang === 'pa' || baseLang === 'hi' || baseLang === 'ur') {
    try {
      console.log(`[Phonetic Guide] Processing Indic language: ${baseLang}`);
      
      // Check if text is romanized by attempting reverse transliteration
      const nativeScript = await reverseTransliterate(originalText, baseLang);
      
      if (nativeScript !== originalText) {
        // Text was romanized, we converted it to native script
        console.log(`[Phonetic Guide] Text was romanized, converted to native script`);
        
        // Forward transliterate to get proper romanization with diacritics
        console.log(`[Phonetic Guide] Converting to phonetic romanization with syllables`);
        const properRomanization = await transliterateText(nativeScript, baseLang);
        
        // Add syllable breakdowns for easier reading
        const withSyllables = addIndicSyllables(properRomanization);
        console.log(`[Phonetic Guide] Result: "${originalText.substring(0, 30)}" → "${withSyllables.substring(0, 30)}"`);
        return withSyllables;
      } else {
        // Text is already in native script (Devanagari/Gurmukhi)
        console.log(`[Phonetic Guide] Text already in native script, transliterating directly`);
        
        // Forward transliterate directly to get romanization with diacritics
        const properRomanization = await transliterateText(originalText, baseLang);
        
        // Add syllable breakdowns for easier reading
        const withSyllables = addIndicSyllables(properRomanization);
        console.log(`[Phonetic Guide] Result: "${originalText.substring(0, 30)}" → "${withSyllables.substring(0, 30)}"`);
        return withSyllables;
      }
    } catch (error) {
      console.error(`[Phonetic Guide] Error in phonetic generation:`, error);
      // Try manual fallback only if text appears to be romanized
      if (!/[\u0900-\u097F\u0A00-\u0A7F]/.test(originalText)) {
        return punjabiToPhonetic(originalText);
      }
      return originalText;
    }
  }
  
  // Check if this language has a transliteration mapping (non-Latin script)
  // This converts scripts like Japanese Kanji → Romaji, Arabic → Latin, etc.
  if (transliterationMap[baseLang]) {
    console.log(`[Phonetic Guide] Language ${baseLang} has transliteration mapping, calling transliterateText`);
    const result = await transliterateText(originalText, baseLang);
    console.log(`[Phonetic Guide] Transliteration result: "${result.substring(0, 50)}${result.length > 50 ? '...' : ''}"`);
    
    // Clean up mixed-language romanization
    const cleaned = cleanRomanization(result, originalText);
    console.log(`[Phonetic Guide] Cleaned romanization: "${cleaned.substring(0, 50)}${cleaned.length > 50 ? '...' : ''}"`);
    return cleaned;
  }
  
  // Generate English-friendly phonetics for Zulu and Xhosa
  if (baseLang === 'zu' || baseLang === 'xh') {
    console.log(`[Phonetic Guide] Generating Zulu/Xhosa phonetics for: ${baseLang}`);
    return zuluToPhonetic(originalText);
  }
  
  // Generate English-friendly phonetics for Spanish
  if (baseLang === 'es') {
    return spanishToPhonetic(originalText);
  }
  
  // Generate English-friendly phonetics for French
  if (baseLang === 'fr') {
    return frenchToPhonetic(originalText);
  }
  
  // Generate English-friendly phonetics for Portuguese
  if (baseLang === 'pt') {
    return portugueseToPhonetic(originalText);
  }
  
  // Generate English-friendly phonetics for German
  if (baseLang === 'de') {
    return germanToPhonetic(originalText);
  }
  
  // Generate English-friendly phonetics for Swedish
  if (baseLang === 'sv') {
    return swedishToPhonetic(originalText);
  }
  
  // For other Latin languages, return original text
  // (Italian would need its own phonetic function)
  console.log(`[Phonetic Guide] No phonetic generation for ${baseLang}, returning original`);
  return originalText;
}

/**
 * Translate multiple lyrics with phonetic guides
 * Uses sequential processing to manage API costs and rate limits
 */
export async function translateLyrics(
  lyrics: string[],
  targetLanguage: string
): Promise<PhoneticResult[]> {
  console.log(`[Azure Translator] Translating ${lyrics.length} lyrics to ${targetLanguage}`);
  
  const results: PhoneticResult[] = [];
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();
  
  // Process lyrics sequentially to avoid overwhelming the API
  for (let i = 0; i < lyrics.length; i++) {
    const lyric = lyrics[i];
    
    try {
      const { translatedText, detectedLanguage: rawDetected } = await translateText(lyric, targetLanguage);
      
      // Post-detection correction: Override Azure's misidentification
      let detectedLanguage = rawDetected;
      if (rawDetected === 'sq') {
        const corrected = preDetectLanguage(lyric);
        if (corrected) {
          console.log(`[Post-Detection] Correcting ${rawDetected} → ${corrected}`);
          detectedLanguage = corrected;
        }
      }
      
      // Generate phonetic guide based on detected source language
      const phoneticGuide = await generatePhoneticGuide(lyric, detectedLanguage);
      
      results.push({
        originalText: lyric,
        translatedText,
        phoneticGuide,
        sourceLanguage: detectedLanguage,
      });
      successCount++;
      
      // Small delay between requests (100ms) for API stability
      if (i < lyrics.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('[Azure Translator] Error translating lyric:', error);
      // Return original text if translation fails
      results.push({
        originalText: lyric,
        translatedText: lyric,
        phoneticGuide: lyric,
        sourceLanguage: 'unknown',
      });
      failCount++;
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Azure Translator] Translation complete in ${duration}s: ${successCount} successful, ${failCount} failed`);
  return results;
}

/**
 * Batch translate multiple texts at once (more efficient for Azure)
 * Azure supports up to 100 texts per request
 */
export async function batchTranslateLyrics(
  lyrics: string[],
  targetLanguage: string,
  sourceLanguage?: string
): Promise<PhoneticResult[]> {
  console.log(`[Azure Translator] Batch translating ${lyrics.length} lyrics to ${targetLanguage}${sourceLanguage ? ` from ${sourceLanguage}` : ''}`);
  
  const config = getConfig();
  const targetCode = languageMap[targetLanguage] || targetLanguage;
  const results: PhoneticResult[] = [];
  
  // Azure supports up to 100 texts per request
  const batchSize = 100;
  const startTime = Date.now();
  
  try {
    for (let i = 0; i < lyrics.length; i += batchSize) {
      const batch = lyrics.slice(i, i + batchSize);
      
      // Build the request URL
      const url = new URL('/translate', config.endpoint);
      url.searchParams.set('api-version', '3.0');
      url.searchParams.set('to', targetCode);
      
      // Set source language if provided (prevents auto-detection)
      if (sourceLanguage && sourceLanguage !== 'unknown') {
        const sourceCode = languageMap[sourceLanguage] || sourceLanguage;
        url.searchParams.set('from', sourceCode);
        console.log(`[Azure Translator] Using source language: ${sourceCode}`);
      }
      
      // Prepare batch request body
      const requestBody = batch.map(text => ({ text }));
      
      // Make the request
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': config.key,
          'Ocp-Apim-Subscription-Region': config.region,
          'Content-Type': 'application/json',
          'X-ClientTraceId': crypto.randomUUID(),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Azure Translator] Batch API error:', response.status, errorText);
        throw new Error(`Batch translation failed: ${response.statusText}`);
      }

      const data: TranslateResponse[] = await response.json();
      
      // Process batch results - need to await phonetic guide generation
      for (let index = 0; index < batch.length; index++) {
        const originalText = batch[index];
        const responseItem = data[index];
        let translatedText = responseItem?.translations?.[0]?.text || originalText;
        
        // Use provided source language if available, otherwise use detected
        let detectedLang = responseItem?.detectedLanguage?.language || 'unknown';
        let finalSourceLanguage = sourceLanguage || detectedLang;
        
        // Post-detection correction: Override Azure's misidentification (only if auto-detecting)
        // Albanian ('sq') is often confused with romanized Punjabi/Hindi
        if (!sourceLanguage && detectedLang === 'sq') {
          const corrected = preDetectLanguage(originalText);
          if (corrected) {
            console.log(`[Post-Detection] Correcting ${detectedLang} → ${corrected}`);
            finalSourceLanguage = corrected;
          }
        }
        
        // Normalize language code
        const baseLang = finalSourceLanguage.split('-')[0];
        
        // Detect if Azure couldn't translate (returned same text)
        // This happens with romanized Punjabi/Hindi/Urdu
        const azureFailedToTranslate = translatedText === originalText;
        const isRomanizedIndic = ['pa', 'hi', 'ur'].includes(baseLang);
        
        if (azureFailedToTranslate && isRomanizedIndic && targetCode === 'en') {
          console.log(`[Fallback Strategy] Azure couldn't translate romanized ${baseLang}`);
          
          try {
            // Strategy: Reverse transliterate to native script, then translate
            console.log(`[Fallback Strategy] Step 1: Converting to native script`);
            const nativeScript = await reverseTransliterate(originalText, baseLang);
            
            if (nativeScript !== originalText) {
              // Successfully converted to native script, now translate
              console.log(`[Fallback Strategy] Step 2: Translating native script to English`);
              const { translatedText: englishTranslation } = await translateText(nativeScript, 'en', baseLang);
              translatedText = englishTranslation;
              console.log(`[Fallback Strategy] Success: "${originalText.substring(0, 30)}" → "${translatedText.substring(0, 30)}"`);
            } else {
              // Reverse transliteration failed, keep romanized text
              console.log(`[Fallback Strategy] Reverse transliteration failed, keeping romanized text`);
            }
          } catch (error) {
            console.error(`[Fallback Strategy] Error:`, error);
            // Keep romanized text which is already readable
          }
        }
        
        // Generate phonetic guide based on SOURCE language, not target
        const phoneticGuide = await generatePhoneticGuide(originalText, finalSourceLanguage);
        
        results.push({
          originalText,
          translatedText,
          phoneticGuide,
          sourceLanguage: finalSourceLanguage,
        });
      }
      
      // Small delay between batches
      if (i + batchSize < lyrics.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Azure Translator] Batch translation complete in ${duration}s: ${results.length} lyrics translated`);
    return results;
  } catch (error) {
    console.error('[Azure Translator] Batch translation error:', error);
    
    // Fallback to sequential translation if batch fails
    console.log('[Azure Translator] Falling back to sequential translation');
    return translateLyrics(lyrics, targetLanguage);
  }
}
