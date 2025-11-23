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
  const cardTop = 600; // Move card down to make room for bigger logo
  
  const albumArtSize = cardWidth - 60;
  const albumArtX = (STORY_WIDTH - albumArtSize) / 2;
  const albumArtY = cardTop + 30;

  ctx.fillStyle = "#18181B";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  // Logo: bigger, left-aligned within card area, closer to album card
  try {
    const logo = await loadImage(logoImage);
    const logoHeight = 280; // Bigger logo
    const logoWidth = (logo.width / logo.height) * logoHeight;
    // Position logo at left edge of card area, just above the card
    const logoX = cardPadding + 20; // Left-aligned with card, small padding
    const logoY = cardTop - logoHeight - 40; // 40px above the card
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
