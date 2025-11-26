/**
 * Artist-based language detection with lyrics fallback
 */

const ARTIST_LANGUAGE_MAP: Record<string, string> = {
  // French Artists
  'Mylène Farmer': 'French',
  'Édith Piaf': 'French',
  'Céline Dion': 'French',
  'Jacques Brel': 'French',
  'Charles Aznavour': 'French',
  'Serge Gainsbourg': 'French',
  'Claudine Longet': 'French',
  'François Truffaut': 'French',
  
  // Spanish Artists
  'Willie Colón': 'Spanish',
  'Héctor Lavoe': 'Spanish',
  'Marc Anthony': 'Spanish',
  'Shakira': 'Spanish',
  'Bad Bunny': 'Spanish',
  'Juan Luis Guerra': 'Spanish',
  'Ricky Martin': 'Spanish',
  'Enrique Iglesias': 'Spanish',
  
  // Portuguese Artists
  'Caetano Veloso': 'Portuguese',
  'Gilberto Gil': 'Portuguese',
  'Tom Jobim': 'Portuguese',
  'João Gilberto': 'Portuguese',
  
  // Italian Artists
  'Andrea Bocelli': 'Italian',
  'Eros Ramazzotti': 'Italian',
  'Luciano Pavarotti': 'Italian',
  'Laura Pausini': 'Italian',
  
  // Japanese Artists
  'Hikaru Utada': 'Japanese',
  'Kenshi Yonezu': 'Japanese',
  'Shiina Ringo': 'Japanese',
  'Ryoji Noda': 'Japanese',
  
  // Korean Artists
  'BTS': 'Korean',
  'BLACKPINK': 'Korean',
  'TWICE': 'Korean',
  'EXO': 'Korean',
  
  // German Artists
  'Rammstein': 'German',
  'Nena': 'German',
  'Kraftwerk': 'German',
  'Einsturzende Neubauten': 'German',
  
  // Mandarin/Chinese Artists
  'Jay Chou': 'Mandarin',
  'Jolin Tsai': 'Mandarin',
  'Faye Wong': 'Mandarin',
  'Andy Lau': 'Mandarin',
};

/**
 * Detect song language from artist name, with lyrics fallback
 */
export function detectSongLanguage(artistName: string, lyrics?: string): string {
  // First, check artist map
  if (artistName) {
    const mappedLanguage = ARTIST_LANGUAGE_MAP[artistName];
    if (mappedLanguage) {
      return mappedLanguage;
    }
  }

  // Fallback: Detect from lyrics
  if (lyrics) {
    return detectFromLyrics(lyrics);
  }

  // Default
  return 'English';
}

/**
 * Detect language from lyrics content
 */
function detectFromLyrics(lyrics: string): string {
  const text = lyrics.toLowerCase();

  const patterns: Record<string, string[]> = {
    French: ['le', 'la', 'les', 'de', 'un', 'une', 'je', 'tu', 'vous', 'est', 'sont', 'avec', 'pour'],
    Spanish: ['el', 'la', 'los', 'las', 'de', 'en', 'que', 'por', 'con', 'mi', 'tu', 'es', 'ser'],
    Portuguese: ['o', 'a', 'os', 'as', 'de', 'em', 'para', 'não', 'é', 'um', 'uma', 'mais'],
    Italian: ['il', 'la', 'lo', 'i', 'le', 'di', 'da', 'in', 'con', 'che', 'non'],
    German: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'ich', 'du', 'ein', 'eine'],
    Japanese: ['は', 'が', 'を', 'に', 'の', 'で', 'も', 'や'],
    Korean: ['은', '는', '이', '가', '을', '를', '에', '의', '도'],
    Mandarin: ['的', '是', '在', '了', '我', '你', '他', '有'],
  };

  let maxMatches = 0;
  let detectedLanguage = 'English';

  for (const [language, words] of Object.entries(patterns)) {
    const matches = words.filter(word => text.includes(word)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedLanguage = language;
    }
  }

  return detectedLanguage;
}
