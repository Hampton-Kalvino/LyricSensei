import type { Song } from "@shared/schema";
import { generateStoryCard, generateStoryCardCanvas } from "@/lib/share-utils";
import { detectSongLanguage } from "@/lib/language-utils";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";

/**
 * Convert blob to base64 string
 */
const blobToBase64 = async (blob: Blob): Promise<string> => {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const binaryString = Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join("");
  return btoa(binaryString);
};

export interface ShareOptions {
  song: Song;
  language?: string;
  includeImage?: boolean;
  albumArt?: string;
}

/**
 * Generates a shareable text for social media
 */
export const generateShareText = (song: Song): string => {
  return `🎵 Now listening to "${song.title}" by ${song.artist}\n\nLearn lyrics & pronunciation with Lyric Sensei 🎤\n\n#LyricSensei #MusicLearning #LanguagePractice`;
};

/**
 * Generates a share URL for the song
 */
export const generateShareUrl = (songId: string): string => {
  return `${window.location.origin}/share/${songId}`;
};

/**
 * Creates a shareable intent string for WhatsApp, Telegram, etc.
 */
export const createShareIntent = (song: Song): string => {
  const shareText = generateShareText(song);
  const shareUrl = generateShareUrl(song.id);
  return `${shareText}\n\n${shareUrl}`;
};

/**
 * Check if we're running on a mobile device
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Map language code to full language name
 */
function mapLanguageCode(code: string): string {
  const languageMap: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'pt': 'Portuguese',
    'it': 'Italian',
    'de': 'German',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Mandarin',
    'zh-CN': 'Mandarin',
    'zh-TW': 'Mandarin',
  };
  return languageMap[code] || code;
}

/**
 * Native share using Capacitor (mobile) or Web Share API (web)
 * Opens the device's native share sheet
 */
export const shareToSocialMedia = async (options: ShareOptions): Promise<boolean> => {
  const { song, albumArt, language } = options;
  const shareText = generateShareText(song);
  const shareUrl = generateShareUrl(song.id);

  try {
    // Mobile: Use Capacitor Share API for better file support
    if (isMobileDevice() && options.includeImage && albumArt) {
      try {
        console.log("[Share] Generating visual card for mobile...");
        
        // Use song's detected language, fallback to parameter, then auto-detect from artist
        const detectedLanguage = song.detectedLanguage ? 
          mapLanguageCode(song.detectedLanguage) : 
          (language || detectSongLanguage(song.artist));
        
        console.log("[Share] Using language:", detectedLanguage, "from song:", song.detectedLanguage);
        
        // Generate visual card with language
        let imageBlob: Blob;
        try {
          imageBlob = await generateStoryCard(song.title, song.artist, albumArt, detectedLanguage);
          console.log("[Share] Card generated:", imageBlob.size, "bytes");
        } catch (error) {
          console.warn("[Share] html-to-image failed, using canvas:", error);
          imageBlob = await generateStoryCardCanvas(song.title, song.artist, albumArt, detectedLanguage);
        }
        
        // Convert blob to base64
        const base64String = await blobToBase64(imageBlob);
        
        // Save to Capacitor cache
        const fileName = `lyric-sensei-${song.title.replace(/\s+/g, "-")}-${Date.now()}.png`;
        console.log("[Share] Saving image to cache...");
        
        await Filesystem.writeFile({
          path: fileName,
          data: base64String,
          directory: Directory.Cache,
        });
        
        // Get file URI
        const fileUri = (await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache,
        })).uri;
        
        console.log("[Share] Sharing via Capacitor Share API...");
        
        // Share using Capacitor
        await Share.share({
          title: `${song.title} - ${song.artist}`,
          text: shareText,
          url: fileUri,
          dialogTitle: "Share Song",
        });
        
        return true;
      } catch (error) {
        console.error("[Share] Mobile share with image failed:", error);
        // Fall through to text-only share
      }
    }
    
    // Web or fallback: Use Web Share API
    if (navigator.share) {
      console.log("[Share] Using Web Share API...");
      await navigator.share({
        title: `${song.title} - ${song.artist}`,
        text: shareText,
        url: shareUrl,
      });
      return true;
    } else {
      // Fallback: Copy to clipboard
      console.log("[Share] Using clipboard fallback...");
      const fullShareText = `${shareText}\n\n${shareUrl}`;
      await navigator.clipboard.writeText(fullShareText);
      return false;
    }
  } catch (error: any) {
    // User cancelled share or other error
    if (error.name !== "AbortError") {
      console.error("Share error:", error);
    }
    return false;
  }
};

/**
 * Generate Android intent URI for direct app sharing
 * This allows explicit app targeting on Android
 */
const generateAndroidIntent = (platform: "instagram" | "facebook" | "twitter", url: string, text: string): string => {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);

  switch (platform) {
    case "instagram":
      // Instagram doesn't support direct URL schemes from external apps for stories
      // We'll use the standard share which includes Instagram
      return "https://www.instagram.com/";
    case "facebook":
      // Facebook share dialog
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
    case "twitter":
      // Twitter/X intent
      return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    default:
      return "";
  }
};

/**
 * Share to Instagram with visual card
 * On mobile (Android/iOS): generates story card and shares via Capacitor Share API
 * On web: opens Instagram website
 */
export const shareToInstagram = async (song: Song, albumArt?: string, language?: string): Promise<void> => {
  const shareUrl = generateShareUrl(song.id);
  
  if (isMobileDevice()) {
    try {
      console.log("[Instagram Share] Generating visual card...");
      
      // Use song's detected language, fallback to parameter, then auto-detect from artist
      const detectedLanguage = song.detectedLanguage ? 
        mapLanguageCode(song.detectedLanguage) : 
        (language || detectSongLanguage(song.artist));
      
      console.log("[Instagram Share] Using language:", detectedLanguage, "from song:", song.detectedLanguage);
      
      // Generate visual card with language
      let imageBlob: Blob;
      try {
        imageBlob = await generateStoryCard(song.title, song.artist, albumArt || "", detectedLanguage);
        console.log("[Instagram Share] Card generated:", imageBlob.size, "bytes");
      } catch (error) {
        console.warn("[Instagram Share] html-to-image failed, using canvas:", error);
        imageBlob = await generateStoryCardCanvas(song.title, song.artist, albumArt || "", detectedLanguage);
      }
      
      // Convert blob to base64
      const base64String = await blobToBase64(imageBlob);
      
      // Save to Capacitor cache
      const fileName = `lyric-sensei-${song.title.replace(/\s+/g, "-")}-${Date.now()}.png`;
      console.log("[Instagram Share] Saving image to cache...");
      
      await Filesystem.writeFile({
        path: fileName,
        data: base64String,
        directory: Directory.Cache,
      });
      
      // Get file URI
      const fileUri = (await Filesystem.getUri({
        path: fileName,
        directory: Directory.Cache,
      })).uri;
      
      console.log("[Instagram Share] Sharing via Capacitor Share API...");
      
      // Share using Capacitor
      await Share.share({
        title: song.title,
        text: `Check out "${song.title}" by ${song.artist} on Lyric Sensei!\n\n${shareUrl}`,
        url: fileUri,
        dialogTitle: "Share to Instagram",
      });
      
      console.log("[Instagram Share] Success!");
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("[Instagram Share] Error:", error);
      }
      // Fallback to web
      window.open("https://www.instagram.com/", "_blank");
    }
  } else {
    // Web fallback: open Instagram profile
    window.open("https://www.instagram.com/", "_blank");
  }
};

/**
 * Share to Facebook
 */
export const shareToFacebook = async (song: Song): Promise<void> => {
  const shareUrl = generateShareUrl(song.id);
  const shareText = generateShareText(song);

  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    shareUrl
  )}&quote=${encodeURIComponent(shareText)}`;

  window.open(facebookShareUrl, "facebook-share", "width=550,height=420");
};

/**
 * Share to Twitter/X with visual card
 * On mobile (Android/iOS): generates story card and shares via Capacitor Share API
 * On web: opens Twitter web intent
 */
export const shareToTwitter = async (song: Song, albumArt?: string, language?: string): Promise<void> => {
  const shareUrl = generateShareUrl(song.id);
  const shareText = generateShareText(song);

  if (isMobileDevice()) {
    try {
      console.log("[Twitter Share] Generating visual card...");
      
      // Use song's detected language, fallback to parameter, then auto-detect from artist
      const detectedLanguage = song.detectedLanguage ? 
        mapLanguageCode(song.detectedLanguage) : 
        (language || detectSongLanguage(song.artist));
      
      console.log("[Twitter Share] Using language:", detectedLanguage, "from song:", song.detectedLanguage);
      
      // Generate visual card with language
      let imageBlob: Blob;
      try {
        imageBlob = await generateStoryCard(song.title, song.artist, albumArt || "", detectedLanguage);
        console.log("[Twitter Share] Card generated:", imageBlob.size, "bytes");
      } catch (error) {
        console.warn("[Twitter Share] html-to-image failed, using canvas:", error);
        imageBlob = await generateStoryCardCanvas(song.title, song.artist, albumArt || "", detectedLanguage);
      }
      
      // Convert blob to base64
      const base64String = await blobToBase64(imageBlob);
      
      // Save to Capacitor cache
      const fileName = `lyric-sensei-${song.title.replace(/\s+/g, "-")}-${Date.now()}.png`;
      console.log("[Twitter Share] Saving image to cache...");
      
      await Filesystem.writeFile({
        path: fileName,
        data: base64String,
        directory: Directory.Cache,
      });
      
      // Get file URI
      const fileUri = (await Filesystem.getUri({
        path: fileName,
        directory: Directory.Cache,
      })).uri;
      
      console.log("[Twitter Share] Sharing via Capacitor Share API...");
      
      // Share using Capacitor
      await Share.share({
        title: song.title,
        text: `Listening to "${song.title}" by ${song.artist} on Lyric Sensei!\n\n${shareUrl}`,
        url: fileUri,
        dialogTitle: "Share to Twitter",
      });
      
      console.log("[Twitter Share] Success!");
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("[Twitter Share] Error:", error);
        // Fallback to web share
        const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          shareText
        )}&url=${encodeURIComponent(shareUrl)}`;
        window.open(twitterShareUrl, "twitter-share", "width=550,height=420");
      }
    }
  } else {
    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText
    )}&url=${encodeURIComponent(shareUrl)}`;

    window.open(twitterShareUrl, "twitter-share", "width=550,height=420");
  }
};

/**
 * Share to WhatsApp (supports both web and mobile)
 */
export const shareToWhatsApp = async (song: Song): Promise<void> => {
  const shareUrl = generateShareUrl(song.id);
  const shareText = generateShareText(song);
  const fullMessage = `${shareText}\n\n${shareUrl}`;

  if (isMobileDevice()) {
    // Mobile: use WhatsApp app if installed
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      fullMessage
    )}`;
    window.open(whatsappUrl, "_blank");
  } else {
    // Web: use WhatsApp Web
    const whatsappWebUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(
      fullMessage
    )}`;
    window.open(whatsappWebUrl, "_blank");
  }
};

/**
 * Share to Telegram
 */
export const shareToTelegram = async (song: Song): Promise<void> => {
  const shareUrl = generateShareUrl(song.id);
  const shareText = generateShareText(song);
  const fullMessage = `${shareText}\n\n${shareUrl}`;

  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
    shareUrl
  )}&text=${encodeURIComponent(shareText)}`;

  window.open(telegramUrl, "_blank");
};

/**
 * Copy share link to clipboard
 */
export const copyShareLink = async (song: Song): Promise<boolean> => {
  const shareUrl = generateShareUrl(song.id);
  const shareText = generateShareText(song);
  const fullText = `${shareText}\n\n${shareUrl}`;

  try {
    await navigator.clipboard.writeText(fullText);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
};
