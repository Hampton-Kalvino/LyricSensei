/**
 * Detect song language from lyrics
 */
export function detectSongLanguage(lyrics: string): string {
  const text = lyrics.toLowerCase();

  const languagePatterns: Record<string, string[]> = {
    Spanish: ['el', 'la', 'los', 'las', 'de', 'en', 'es', 'que', 'por', 'para', 'con', 'tu', 'mi'],
    French: ['le', 'la', 'les', 'de', 'un', 'une', 'je', 'tu', 'il', 'nous', 'vous', 'ils', 'est', 'sont'],
    Portuguese: ['o', 'a', 'os', 'as', 'de', 'em', 'para', 'com', 'não', 'é', 'um', 'uma'],
    Italian: ['il', 'la', 'lo', 'i', 'le', 'di', 'da', 'in', 'con', 'per', 'non', 'che'],
    German: ['der', 'die', 'das', 'den', 'dem', 'des', 'und', 'ist', 'nicht', 'ich', 'du', 'er'],
    Japanese: ['は', 'が', 'を', 'に', 'の', 'で', 'と', 'も'],
    Korean: ['은', '는', '이', '가', '을', '를', '에', '의'],
    Mandarin: ['的', '是', '在', '了', '我', '你', '他'],
  };

  let maxMatches = 0;
  let detectedLanguage = 'English';

  for (const [language, patterns] of Object.entries(languagePatterns)) {
    let matches = 0;
    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        matches++;
      }
    }
    
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedLanguage = language;
    }
  }

  return detectedLanguage;
}
