/**
 * Phonetic to IPA Converter
 * Converts English-like phonetic representations to International Phonetic Alphabet (IPA)
 * for accurate text-to-speech pronunciation
 */

// Comprehensive phonetic to IPA mapping
const PHONETIC_TO_IPA_MAP: Record<string, string> = {
  // === VOWELS ===
  // Long vowels
  'ah': 'ɑ',
  'ay': 'eɪ',
  'ee': 'i',
  'eh': 'ɛ',
  'ih': 'ɪ',
  'oh': 'oʊ',
  'oo': 'u',
  'uh': 'ʌ',
  'aw': 'ɔ',
  'aa': 'æ',
  
  // Short vowels
  'a': 'æ',
  'e': 'ɛ',
  'i': 'ɪ',
  'o': 'ɒ',
  'u': 'ʊ',
  
  // === CONSONANTS ===
  'ch': 'tʃ',
  'sh': 'ʃ',
  'th': 'θ',
  'dh': 'ð',
  'ng': 'ŋ',
  'zh': 'ʒ',
  'kh': 'x',
  'rr': 'r',
  
  // === R-COLORED VOWELS ===
  'er': 'ɜr',
  'ar': 'ɑr',
  'or': 'ɔr',
  'air': 'ɛr',
  'ir': 'ɪr',
  'ur': 'ʊr',
  'uhr': 'ər',
  
  // === DIPHTHONGS ===
  'oy': 'ɔɪ',
  'ow': 'aʊ',
  'ew': 'ju',
  
  // === SPANISH PHONETICS ===
  'keh': 'ke',
  'seh': 'se',
  'teh': 'te',
  'meh': 'me',
  'peh': 'pe',
  'loh': 'lo',
  'noh': 'no',
  'doh': 'do',
  'roh': 'ro',
  'soh': 'so',
  'toh': 'to',
  'moo': 'mu',
  'choh': 'tʃo',
  'pahs': 'pas',
  'lahs': 'las',
  
  // === FRENCH PHONETICS ===
  'euh': 'ø',
  'ohr': 'ɔʁ',
  'ahn': 'ɑ̃',
  'ohn': 'ɔ̃',
  'uhn': 'œ̃',
  'een': 'ɛ̃',
  
  // === COMMON SYLLABLES ===
  'vahyant': 'væjənt',
  'proh': 'proʊ',
  'fohnd': 'fɔnd',
  'nohs': 'noʊz',
  'seeuhx': 'sjø',
  'keels': 'kilz',
  'keeeh': 'ki.e',
  
  // === COMMON WORD ENDINGS ===
  'tion': 'ʃən',
  'sion': 'ʒən',
  'ous': 'əs',
  'ness': 'nəs',
  'ment': 'mənt',
  'able': 'əbəl',
  'ible': 'ɪbəl',
};

// Language-specific IPA mappings
const SPANISH_PHONETIC_MAP: Record<string, string> = {
  // Spanish vowels are pure, not diphthongized
  'a': 'a',
  'e': 'e', 
  'i': 'i',
  'o': 'o',
  'u': 'u',
  'ah': 'a',
  'eh': 'e',
  'ee': 'i',
  'oh': 'o',
  'oo': 'u',
  // Spanish consonants
  'rr': 'r',
  'ny': 'ɲ', // ñ
  'll': 'ʎ', // ll (traditional)
  'j': 'x',  // j sound
  'g': 'ɡ',
  'b': 'β',  // soft b between vowels
  'd': 'ð',  // soft d between vowels
};

const FRENCH_PHONETIC_MAP: Record<string, string> = {
  'r': 'ʁ',  // French R
  'u': 'y',  // French u
  'eu': 'ø', // French eu
  'on': 'ɔ̃', // nasal
  'an': 'ɑ̃', // nasal
  'in': 'ɛ̃', // nasal
  'un': 'œ̃', // nasal
};

const JAPANESE_PHONETIC_MAP: Record<string, string> = {
  'tsu': 'tsɯ',
  'shi': 'ɕi',
  'chi': 'tɕi',
  'fu': 'ɸɯ',
  'r': 'ɾ', // Japanese flap R
};

const KOREAN_PHONETIC_MAP: Record<string, string> = {
  'eo': 'ʌ',
  'eu': 'ɯ',
  'ae': 'ɛ',
  'oe': 'ø',
};

/**
 * Get language-specific phonetic map
 */
function getLanguageMap(language: string): Record<string, string> {
  const langCode = language.toLowerCase().slice(0, 2);
  
  switch (langCode) {
    case 'es':
      return { ...PHONETIC_TO_IPA_MAP, ...SPANISH_PHONETIC_MAP };
    case 'fr':
      return { ...PHONETIC_TO_IPA_MAP, ...FRENCH_PHONETIC_MAP };
    case 'ja':
      return { ...PHONETIC_TO_IPA_MAP, ...JAPANESE_PHONETIC_MAP };
    case 'ko':
      return { ...PHONETIC_TO_IPA_MAP, ...KOREAN_PHONETIC_MAP };
    default:
      return PHONETIC_TO_IPA_MAP;
  }
}

/**
 * Convert phonetic text to IPA
 * @param phonetic - Phonetic representation (e.g., "ah-vahyant")
 * @param language - Language code (e.g., "en-US", "es-ES")
 * @returns IPA representation
 */
export function convertToIPA(phonetic: string, language: string = 'en-US'): string {
  const map = getLanguageMap(language);
  let result = phonetic.toLowerCase();
  
  // Split by hyphens and spaces
  const parts = result.split(/[-\s]+/);
  
  // Convert each part, trying longest matches first
  const converted = parts.map(part => {
    // Try full part match first
    if (map[part]) {
      return map[part];
    }
    
    // Try to match substrings from longest to shortest
    let converted = '';
    let i = 0;
    
    while (i < part.length) {
      let matched = false;
      
      // Try matching from longest possible substring
      for (let len = Math.min(6, part.length - i); len > 0; len--) {
        const substr = part.substring(i, i + len);
        if (map[substr]) {
          converted += map[substr];
          i += len;
          matched = true;
          break;
        }
      }
      
      // If no match, keep original character
      if (!matched) {
        converted += part[i];
        i++;
      }
    }
    
    return converted;
  });
  
  return converted.join('');
}

/**
 * Prepare phonetic text for speech synthesis
 * Cleans and formats the text for better TTS pronunciation
 */
export function prepareForSpeech(phonetic: string, language: string = 'en-US'): string {
  // First convert to IPA
  const ipa = convertToIPA(phonetic, language);
  
  // For some TTS engines, we might want to add spaces between syllables
  // to slow down pronunciation
  return ipa;
}

/**
 * Get phonetic syllables for syllable-by-syllable playback
 */
export function getPhoneticSyllables(phonetic: string): string[] {
  return phonetic.split(/[-\s]+/).filter(s => s.length > 0);
}

/**
 * Convert IPA back to approximate phonetic text for display
 * (Reverse conversion for debugging)
 */
export function ipaToApproxPhonetic(ipa: string): string {
  const reverseMap: Record<string, string> = {};
  
  // Build reverse map
  for (const [phonetic, ipaChar] of Object.entries(PHONETIC_TO_IPA_MAP)) {
    reverseMap[ipaChar] = phonetic;
  }
  
  let result = ipa;
  
  // Replace IPA characters with phonetic equivalents
  for (const [ipaChar, phonetic] of Object.entries(reverseMap)) {
    result = result.replace(new RegExp(ipaChar, 'g'), phonetic);
  }
  
  return result;
}

export { PHONETIC_TO_IPA_MAP, SPANISH_PHONETIC_MAP, FRENCH_PHONETIC_MAP };
