/**
 * PhoneticTTS - Text-to-Speech with IPA support for accurate phonetic pronunciation
 * Uses Web Speech API with IPA conversion for proper pronunciation of phonetic guides
 */

import { convertToIPA, getPhoneticSyllables } from './phonetic-converter';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export class PhoneticTTS {
  private synth: SpeechSynthesis | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private isCapacitor: boolean;

  constructor() {
    this.isCapacitor = Capacitor.isNativePlatform();
    
    if (!this.isCapacitor && typeof window !== 'undefined') {
      this.synth = window.speechSynthesis;
      this.loadVoice();
      
      // Voices may load asynchronously
      if (this.synth) {
        this.synth.onvoiceschanged = () => this.loadVoice();
      }
    }
  }

  private loadVoice() {
    if (!this.synth) return;
    
    const voices = this.synth.getVoices();
    
    // Prefer high-quality voices that handle IPA well
    const preferredVoices = [
      'Google US English',
      'Google UK English Female',
      'Google español',
      'Google français',
      'Google Deutsch',
      'Microsoft Zira',
      'Microsoft David',
      'Samantha', // macOS
      'Alex', // macOS
    ];

    for (const voiceName of preferredVoices) {
      const voice = voices.find(v => v.name.includes(voiceName));
      if (voice) {
        this.voice = voice;
        console.log('[PhoneticTTS] Selected voice:', voice.name);
        break;
      }
    }

    // Fallback to first available voice
    if (!this.voice && voices.length > 0) {
      this.voice = voices[0];
      console.log('[PhoneticTTS] Using fallback voice:', this.voice.name);
    }
  }

  /**
   * Get a voice for a specific language
   */
  private getVoiceForLanguage(language: string): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    
    const voices = this.synth.getVoices();
    const langCode = language.slice(0, 2).toLowerCase();
    
    // Try to find a voice matching the language
    const matchingVoice = voices.find(v => 
      v.lang.toLowerCase().startsWith(langCode)
    );
    
    return matchingVoice || this.voice;
  }

  /**
   * Speak phonetic text with proper pronunciation
   * Converts to IPA and uses appropriate TTS settings
   */
  async speakPhonetic(
    phoneticText: string, 
    language: string = 'en-US',
    options: {
      rate?: number;
      pitch?: number;
      volume?: number;
    } = {}
  ): Promise<void> {
    const { rate = 0.7, pitch = 1.0, volume = 1.0 } = options;

    // Convert phonetic to IPA for more accurate pronunciation
    const ipaText = convertToIPA(phoneticText, language);
    
    console.log('[PhoneticTTS] Original:', phoneticText);
    console.log('[PhoneticTTS] IPA:', ipaText);
    console.log('[PhoneticTTS] Language:', language);

    if (this.isCapacitor) {
      // Use Capacitor TTS on mobile
      return this.speakCapacitor(ipaText, language, rate);
    } else {
      // Use Web Speech API on web
      return this.speakWeb(ipaText, language, rate, pitch, volume);
    }
  }

  /**
   * Speak using Capacitor TextToSpeech plugin
   */
  private async speakCapacitor(
    text: string, 
    language: string,
    rate: number
  ): Promise<void> {
    try {
      await TextToSpeech.speak({
        text: text,
        lang: language,
        rate: rate,
        pitch: 1.0,
        volume: 1.0,
        category: 'playback',
      });
    } catch (error) {
      console.error('[PhoneticTTS] Capacitor TTS error:', error);
      throw error;
    }
  }

  /**
   * Speak using Web Speech API
   */
  private speakWeb(
    text: string,
    language: string,
    rate: number,
    pitch: number,
    volume: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('Speech synthesis not available'));
        return;
      }

      // Cancel any ongoing speech
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Get voice for language
      const voice = this.getVoiceForLanguage(language);
      if (voice) {
        utterance.voice = voice;
      }
      
      utterance.lang = language;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      utterance.onend = () => {
        console.log('[PhoneticTTS] Speech completed');
        resolve();
      };
      
      utterance.onerror = (event) => {
        console.error('[PhoneticTTS] Speech error:', event);
        reject(new Error(event.error));
      };

      this.synth.speak(utterance);
    });
  }

  /**
   * Speak the original word (not phonetic) - for hearing actual pronunciation
   */
  async speakOriginal(
    originalText: string,
    language: string = 'en-US',
    options: {
      rate?: number;
      pitch?: number;
      volume?: number;
    } = {}
  ): Promise<void> {
    const { rate = 0.85, pitch = 1.0, volume = 1.0 } = options;

    console.log('[PhoneticTTS] Speaking original:', originalText, 'in', language);

    if (this.isCapacitor) {
      return this.speakCapacitor(originalText, language, rate);
    } else {
      return this.speakWeb(originalText, language, rate, pitch, volume);
    }
  }

  /**
   * Speak phonetic text syllable by syllable with pauses
   * Useful for learning pronunciation step by step
   */
  async speakBySyllable(
    phoneticText: string,
    language: string = 'en-US',
    pauseMs: number = 400
  ): Promise<void> {
    const syllables = getPhoneticSyllables(phoneticText);
    
    console.log('[PhoneticTTS] Speaking syllables:', syllables);

    for (const syllable of syllables) {
      // Convert syllable to IPA
      const ipaSyllable = convertToIPA(syllable, language);
      
      if (this.isCapacitor) {
        await this.speakCapacitor(ipaSyllable, language, 0.6);
      } else {
        await this.speakWeb(ipaSyllable, language, 0.6, 1.2, 1.0);
      }
      
      // Pause between syllables
      await this.sleep(pauseMs);
    }
  }

  /**
   * Stop any ongoing speech
   */
  stop(): void {
    if (this.isCapacitor) {
      TextToSpeech.stop().catch(() => {});
    } else if (this.synth) {
      this.synth.cancel();
    }
  }

  /**
   * Check if TTS is available
   */
  isAvailable(): boolean {
    if (this.isCapacitor) {
      return true; // Capacitor TTS should always be available on mobile
    }
    return this.synth !== null && this.synth.getVoices().length > 0;
  }

  /**
   * Get available voices for a language
   */
  getVoicesForLanguage(language: string): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    
    const langCode = language.slice(0, 2).toLowerCase();
    return this.synth.getVoices().filter(v => 
      v.lang.toLowerCase().startsWith(langCode)
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let phoneticTTSInstance: PhoneticTTS | null = null;

export function getPhoneticTTS(): PhoneticTTS {
  if (!phoneticTTSInstance) {
    phoneticTTSInstance = new PhoneticTTS();
  }
  return phoneticTTSInstance;
}

/**
 * Quick helper function for speaking phonetic text
 */
export async function speakPhonetic(
  phoneticText: string,
  language: string = 'en-US'
): Promise<void> {
  const tts = getPhoneticTTS();
  return tts.speakPhonetic(phoneticText, language);
}

/**
 * Quick helper function for speaking original word
 */
export async function speakOriginal(
  originalText: string,
  language: string = 'en-US'
): Promise<void> {
  const tts = getPhoneticTTS();
  return tts.speakOriginal(originalText, language);
}
