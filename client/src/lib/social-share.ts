import type { Song } from "@shared/schema";
import { generateStoryCard, generateStoryCardCanvas } from "@/lib/share-utils";

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
 * Native share using Web Share API - opens the device's native share sheet
 * This is the PRIMARY method for mobile sharing to Instagram, Facebook, Twitter, etc.
 */
export const shareToSocialMedia = async (options: ShareOptions): Promise<boolean> => {
  const { song, albumArt } = options;
  const shareText = generateShareText(song);
  const shareUrl = generateShareUrl(song.id);

  try {
    // Modern Web Share API - supported on most mobile browsers
    if (navigator.share) {
      if (options.includeImage && albumArt) {
        try {
          console.log("[Share] Generating visual card...");
          
          // Generate visual card
          let imageBlob: Blob;
          try {
            imageBlob = await generateStoryCard(song.title, song.artist, albumArt);
            console.log("[Share] Card generated:", imageBlob.size, "bytes");
          } catch (error) {
            console.warn("[Share] html-to-image failed, using canvas:", error);
            imageBlob = await generateStoryCardCanvas(song.title, song.artist, albumArt);
          }
          
          // Create file
          const file = new File(
            [imageBlob],
            `lyric-sensei-${song.title.replace(/\s+/g, "-")}.png`,
            { type: "image/png" }
          );
          
          console.log("[Share] Sharing with image...");
          
          await navigator.share({
            files: [file],
            title: `${song.title} - ${song.artist}`,
            text: shareText,
            url: shareUrl,
          });
        } catch (error) {
          console.error("[Share] Share with image failed:", error);
          // Fallback to text-only share
          await navigator.share({
            title: `${song.title} - ${song.artist}`,
            text: shareText,
            url: shareUrl,
          });
        }
      } else {
        await navigator.share({
          title: `${song.title} - ${song.artist}`,
          text: shareText,
          url: shareUrl,
        });
      }
      return true;
    } else {
      // Fallback: Copy to clipboard on unsupported browsers
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
 * On mobile: generates story card and shares via Web Share API
 * On web: opens Instagram website
 */
export const shareToInstagram = async (song: Song, albumArt?: string): Promise<void> => {
  const shareUrl = generateShareUrl(song.id);
  
  if (isMobileDevice() && typeof navigator.share === "function") {
    try {
      console.log("[Instagram Share] Generating visual card...");
      
      // Generate visual card
      let imageBlob: Blob;
      try {
        imageBlob = await generateStoryCard(song.title, song.artist, albumArt || "");
        console.log("[Instagram Share] Card generated:", imageBlob.size, "bytes");
      } catch (error) {
        console.warn("[Instagram Share] html-to-image failed, using canvas:", error);
        imageBlob = await generateStoryCardCanvas(song.title, song.artist, albumArt || "");
      }
      
      // Create file
      const file = new File(
        [imageBlob],
        `lyric-sensei-${song.title.replace(/\s+/g, "-")}.png`,
        { type: "image/png" }
      );
      
      console.log("[Instagram Share] Sharing via Web Share API...");
      
      // Share with image
      await navigator.share({
        files: [file],
        title: song.title,
        text: `Check out "${song.title}" by ${song.artist} on Lyric Sensei!`,
        url: shareUrl,
      });
      
      console.log("[Instagram Share] Success!");
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("[Instagram Share] Error:", error);
      }
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
 */
export const shareToTwitter = async (song: Song, albumArt?: string): Promise<void> => {
  const shareUrl = generateShareUrl(song.id);
  const shareText = generateShareText(song);

  if (isMobileDevice() && typeof navigator.share === "function") {
    try {
      console.log("[Twitter Share] Generating visual card...");
      
      // Generate visual card
      let imageBlob: Blob;
      try {
        imageBlob = await generateStoryCard(song.title, song.artist, albumArt || "");
        console.log("[Twitter Share] Card generated:", imageBlob.size, "bytes");
      } catch (error) {
        console.warn("[Twitter Share] html-to-image failed, using canvas:", error);
        imageBlob = await generateStoryCardCanvas(song.title, song.artist, albumArt || "");
      }
      
      // Create file
      const file = new File(
        [imageBlob],
        `lyric-sensei-${song.title.replace(/\s+/g, "-")}.png`,
        { type: "image/png" }
      );
      
      console.log("[Twitter Share] Sharing via Web Share API...");
      
      // Share with image
      await navigator.share({
        files: [file],
        title: song.title,
        text: `Listening to "${song.title}" by ${song.artist} on Lyric Sensei!\n\n${shareUrl}`,
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
