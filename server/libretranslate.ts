/**
 * LibreTranslate API client for free, open-source translation
 * https://libretranslate.com/
 * No API key required for public instance
 */

interface LibreTranslateRequest {
  q: string;
  source: string;
  target: string;
  format?: 'text' | 'html';
}

interface LibreTranslateResponse {
  translatedText: string;
}

interface PhoneticResult {
  originalText: string;
  translatedText: string;
  phoneticGuide: string;
}

// Language code mapping (LibreTranslate uses ISO 639-1 codes)
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
  'zh': 'zh',
  'ar': 'ar',
  'hi': 'hi',
  'tr': 'tr',
};

/**
 * Translate text using LibreTranslate
 */
async function translateText(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  const targetCode = languageMap[targetLang] || targetLang;
  
  try {
    const response = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetCode,
        format: 'text',
      } as LibreTranslateRequest),
    });

    if (!response.ok) {
      console.error('[LibreTranslate] API error:', response.status, response.statusText);
      throw new Error(`Translation failed: ${response.statusText}`);
    }

    const data: LibreTranslateResponse = await response.json();
    return data.translatedText;
  } catch (error) {
    console.error('[LibreTranslate] Translation error:', error);
    throw error;
  }
}

/**
 * Generate phonetic guide for translated text
 * For now, we'll use a simple romanization approach
 */
function generatePhoneticGuide(text: string, language: string): string {
  // For languages that use non-Latin scripts, provide romanization hints
  // This is a simplified version - a full implementation would use proper romanization libraries
  
  if (language === 'ja' || language === 'ko' || language === 'zh' || language === 'ar' || language === 'ru' || language === 'hi') {
    // For non-Latin scripts, return a placeholder indicating romanization would be helpful
    return `[${text}]`;
  }
  
  // For Latin-based languages, return the text as-is
  return text;
}

/**
 * Translate multiple lyrics with phonetic guides
 * Sequential processing with delays to respect free API rate limits
 */
export async function translateLyrics(
  lyrics: string[],
  targetLanguage: string
): Promise<PhoneticResult[]> {
  console.log(`[LibreTranslate] Translating ${lyrics.length} lyrics to ${targetLanguage} (this may take a moment...)`);
  
  const results: PhoneticResult[] = [];
  let successCount = 0;
  let failCount = 0;
  
  // Process one lyric at a time to avoid rate limiting
  for (let i = 0; i < lyrics.length; i++) {
    const lyric = lyrics[i];
    
    try {
      const translatedText = await translateText(lyric, targetLanguage);
      const phoneticGuide = generatePhoneticGuide(translatedText, targetLanguage);
      
      results.push({
        originalText: lyric,
        translatedText,
        phoneticGuide,
      });
      successCount++;
      
      // Add 1 second delay between each request to respect rate limits
      if (i < lyrics.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      // If rate limited, wait 3 seconds and try once more
      if (error instanceof Error && error.message.includes('Too Many Requests')) {
        console.log(`[LibreTranslate] Rate limited, waiting 3 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        try {
          const translatedText = await translateText(lyric, targetLanguage);
          const phoneticGuide = generatePhoneticGuide(translatedText, targetLanguage);
          
          results.push({
            originalText: lyric,
            translatedText,
            phoneticGuide,
          });
          successCount++;
        } catch (retryError) {
          console.error('[LibreTranslate] Retry failed for lyric:', lyric.substring(0, 50));
          // Return original text if both attempts fail
          results.push({
            originalText: lyric,
            translatedText: lyric,
            phoneticGuide: lyric,
          });
          failCount++;
        }
      } else {
        console.error('[LibreTranslate] Error translating lyric:', error);
        results.push({
          originalText: lyric,
          translatedText: lyric,
          phoneticGuide: lyric,
        });
        failCount++;
      }
    }
  }
  
  console.log(`[LibreTranslate] Translation complete: ${successCount} successful, ${failCount} failed`);
  return results;
}
