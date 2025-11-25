import { toPng } from "html-to-image";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import type { Song } from "@shared/schema";
import logoImage from "@assets/ChatGPT Image Nov 5, 2025, 05_37_31 PM_1762887933822.png";

export interface StoryImageOptions {
  song: Song;
  albumArtUrl?: string;
}

export async function generateStoryImage({
  song,
  albumArtUrl,
}: StoryImageOptions): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  const STORY_WIDTH = 1080;
  const STORY_HEIGHT = 1920;
  
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;

  const cardPadding = 80;
  const cardWidth = STORY_WIDTH - cardPadding * 2;
  const cardTop = 600;
  
  const albumArtSize = cardWidth - 60;
  const albumArtX = (STORY_WIDTH - albumArtSize) / 2;
  const albumArtY = cardTop + 30;

  ctx.fillStyle = "#18181B";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  try {
    const logo = await loadImage(logoImage);
    const logoHeight = 280;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    const logoX = cardPadding + 20;
    const logoY = cardTop - logoHeight - 40;
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
  } catch (error) {
    console.error("Failed to load logo:", error);
    ctx.fillStyle = "#FAFAFA";
    ctx.font = "500 48px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("LYRIC SENSEI", cardPadding + 20, cardTop - 60);
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(cardPadding, cardTop, cardWidth, 1100);

  if (albumArtUrl) {
    try {
      const img = await loadImage(albumArtUrl);
      ctx.drawImage(img, albumArtX, albumArtY, albumArtSize, albumArtSize);
    } catch (error) {
      console.error("Failed to load album art:", error);
      drawPlaceholderArt(ctx, albumArtX, albumArtY, albumArtSize);
    }
  } else {
    drawPlaceholderArt(ctx, albumArtX, albumArtY, albumArtSize);
  }

  const textY = albumArtY + albumArtSize + 80;

  ctx.fillStyle = "#000000";
  ctx.font = "700 52px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  
  const titleLines = wrapText(ctx, song.title, cardWidth - 80);
  titleLines.forEach((line, index) => {
    ctx.fillText(line, STORY_WIDTH / 2, textY + index * 65);
  });

  ctx.fillStyle = "#52525B";
  ctx.font = "400 38px Inter, system-ui, sans-serif";
  const artistText = `Track by ${song.artist}`;
  ctx.fillText(artistText, STORY_WIDTH / 2, textY + titleLines.length * 65 + 50);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to generate image blob"));
      }
    }, "image/png");
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function drawPlaceholderArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) {
  ctx.fillStyle = "#E4E4E7";
  ctx.fillRect(x, y, size, size);

  ctx.fillStyle = "#A1A1AA";
  ctx.font = "400 80px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("♪", x + size / 2, y + size / 2);
  ctx.textBaseline = "alphabetic";
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Generate story image from React component using html-to-image
 * Returns data URL (for web) or file URI (for native)
 */
export async function generateStoryImageFromComponent(
  cardElement: HTMLDivElement,
  options?: {
    quality?: number;
    pixelRatio?: number;
  }
): Promise<string> {
  if (!cardElement) {
    throw new Error("Card element not found");
  }

  try {
    console.log("[Share] Generating image from component...");

    const dataUrl = await toPng(cardElement, {
      quality: options?.quality ?? 0.95,
      pixelRatio: options?.pixelRatio ?? 2,
      width: 1080,
      height: 1920,
      cacheBust: true,
    });

    return dataUrl;
  } catch (error) {
    console.error("[Share] Failed to generate story image:", error);
    throw new Error("Failed to generate story image");
  }
}

/**
 * Save image to device filesystem (Capacitor)
 * Returns file URI for native sharing
 */
export async function saveImageToFilesystem(
  dataUrl: string
): Promise<string> {
  try {
    if (!Capacitor.isNativePlatform()) {
      console.log("[Share] Not on native platform, returning data URL");
      return dataUrl;
    }

    console.log("[Share] Saving image to filesystem...");

    // Extract base64 data (remove "data:image/png;base64," prefix)
    const base64Data = dataUrl.split(",")[1];
    if (!base64Data) {
      throw new Error("Invalid data URL format");
    }

    const fileName = `story-${Date.now()}.png`;

    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });

    console.log("[Share] Image saved to:", result.uri);
    return result.uri;
  } catch (error) {
    console.error("[Share] Failed to save image:", error);
    throw error;
  }
}

/**
 * Convert data URL to blob for sharing
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/**
 * Check if device supports story sharing
 */
export function canShareStories(): boolean {
  if (typeof window === "undefined") return false;

  const isAndroid = /Android/.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

  return isAndroid || isIOS;
}

/**
 * Share story image to native apps
 */
export async function shareStoryToNativeApps(
  imageDataUrl: string,
  songTitle: string,
  artist: string,
  shareUrl: string
): Promise<boolean> {
  try {
    if (!navigator.share) {
      console.log("[Share] Web Share API not available");
      return false;
    }

    console.log("[Share] Starting share to native apps...");

    // Convert data URL to blob
    const blob = await dataUrlToBlob(imageDataUrl);
    const file = new File([blob], `story-${Date.now()}.png`, {
      type: "image/png",
    });

    // Use Web Share API with file
    await navigator.share({
      title: `${songTitle} - ${artist}`,
      text: `Check out "${songTitle}" by ${artist} on Lyric Sensei!`,
      url: shareUrl,
      files: [file],
    });

    console.log("[Share] Share successful");
    return true;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.log("[Share] Share cancelled");
      return false;
    }
    console.error("[Share] Share failed:", error);
    throw error;
  }
}

/**
 * Share to Instagram using Capacitor Share API
 * On native: Uses native Share Sheet
 * On web: Opens Instagram web intent
 */
export async function shareToInstagramStory(
  imageUri: string,
  songTitle: string,
  artist: string,
  shareUrl: string
): Promise<void> {
  try {
    console.log("[Instagram] Starting share...");

    if (Capacitor.isNativePlatform()) {
      // Native app: Use Capacitor Share API
      await Share.share({
        title: songTitle,
        text: `${songTitle} by ${artist}`,
        url: shareUrl,
        files: [imageUri],
      } as any);
      console.log("[Instagram] Native share completed");
    } else {
      // Web: Open Instagram share intent
      const instagramUrl = `https://www.instagram.com/`;
      window.open(instagramUrl, "_blank");
      console.log("[Instagram] Opened Instagram web");
    }
  } catch (error) {
    console.error("[Instagram] Share failed:", error);
    throw error;
  }
}

/**
 * Share to Snapchat using Capacitor Share API
 */
export async function shareToSnapchat(
  imageUri: string,
  songTitle: string,
  artist: string
): Promise<void> {
  try {
    console.log("[Snapchat] Starting share...");

    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title: songTitle,
        text: `${songTitle} by ${artist}`,
        files: [imageUri],
      } as any);
      console.log("[Snapchat] Share completed");
    } else {
      console.log("[Snapchat] Snapchat sharing only available on mobile");
    }
  } catch (error) {
    console.error("[Snapchat] Share failed:", error);
    throw error;
  }
}

/**
 * Share to Twitter
 * Note: Twitter doesn't accept images via share API
 */
export async function shareToTwitter(
  songTitle: string,
  artist: string,
  shareUrl: string
): Promise<void> {
  try {
    console.log("[Twitter] Starting share...");

    const text = `🎵 Listening to "${songTitle}" by ${artist} on Lyric Sensei\n\n${shareUrl}`;

    if (Capacitor.isNativePlatform()) {
      // Native: Try native Twitter app
      await Share.share({
        title: songTitle,
        text: text,
        url: shareUrl,
      } as any);
    } else {
      // Web: Use Twitter web intent
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(twitterUrl, "_blank");
    }

    console.log("[Twitter] Share completed");
  } catch (error) {
    console.error("[Twitter] Share failed:", error);
    throw error;
  }
}

/**
 * Generic share using native share sheet
 */
export async function shareMore(
  imageUri: string | null,
  songTitle: string,
  artist: string,
  shareUrl: string
): Promise<void> {
  try {
    console.log("[More] Starting share...");

    const shareOptions: any = {
      title: songTitle,
      text: `Check out ${songTitle} by ${artist} on Lyric Sensei`,
      url: shareUrl,
    };

    if (imageUri) {
      shareOptions.files = [imageUri];
    }

    await Share.share(shareOptions);
    console.log("[More] Share completed");
  } catch (error) {
    console.error("[More] Share failed:", error);
    // Fallback: share without image
    try {
      await Share.share({
        title: songTitle,
        text: `Check out ${songTitle} by ${artist} on Lyric Sensei`,
        url: shareUrl,
      } as any);
    } catch (fallbackError) {
      console.error("[More] Fallback share also failed:", fallbackError);
      throw fallbackError;
    }
  }
}
