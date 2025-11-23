import logoImage from "@assets/ChatGPT Image Nov 5, 2025, 05_37_31 PM_1762887933822.png";

export interface AchievementImageOptions {
  songTitle: string;
  artist: string;
  accuracyPercentage: number;
  medalTier: 'Gold' | 'Silver' | 'Bronze';
  albumArtUrl?: string;
}

export async function generateAchievementImage({
  songTitle,
  artist,
  accuracyPercentage,
  medalTier,
  albumArtUrl,
}: AchievementImageOptions): Promise<Blob> {
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
  const cardTop = 500;
  
  const albumArtSize = 500;
  const albumArtX = (STORY_WIDTH - albumArtSize) / 2;
  const albumArtY = cardTop + 60;

  // Dark background
  ctx.fillStyle = "#18181B";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  // Logo
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

  // White card background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(cardPadding, cardTop, cardWidth, 1200);

  // Album art or placeholder
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

  // Medal trophy below album art
  const trophyY = albumArtY + albumArtSize + 80;
  drawTrophy(ctx, STORY_WIDTH / 2, trophyY, medalTier);

  // Accuracy percentage
  ctx.fillStyle = "#000000";
  ctx.font = "800 90px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${accuracyPercentage}%`, STORY_WIDTH / 2, trophyY + 220);

  // Medal tier label
  const medalColor = getMedalColor(medalTier);
  ctx.fillStyle = medalColor;
  ctx.font = "600 48px Inter, system-ui, sans-serif";
  ctx.fillText(`${medalTier} Medal`, STORY_WIDTH / 2, trophyY + 290);

  // Song title
  const titleY = trophyY + 380;
  ctx.fillStyle = "#000000";
  ctx.font = "700 44px Inter, system-ui, sans-serif";
  const titleLines = wrapText(ctx, songTitle, cardWidth - 120);
  titleLines.forEach((line, index) => {
    ctx.fillText(line, STORY_WIDTH / 2, titleY + index * 55);
  });

  // Artist
  ctx.fillStyle = "#52525B";
  ctx.font = "400 36px Inter, system-ui, sans-serif";
  const artistText = `Track by ${artist}`;
  ctx.fillText(artistText, STORY_WIDTH / 2, titleY + titleLines.length * 55 + 50);

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

function drawTrophy(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  medalTier: 'Gold' | 'Silver' | 'Bronze'
) {
  const color = getMedalColor(medalTier);
  const bgColor = getMedalBgColor(medalTier);
  
  // Circle background
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
  ctx.fill();

  // Draw trophy icon (simplified)
  ctx.fillStyle = color;
  ctx.font = "400 90px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🏆", centerX, centerY);
  ctx.textBaseline = "alphabetic";
}

function getMedalColor(medalTier: 'Gold' | 'Silver' | 'Bronze'): string {
  switch (medalTier) {
    case 'Gold':
      return "#EAB308";
    case 'Silver':
      return "#71717A";
    case 'Bronze':
      return "#EA580C";
  }
}

function getMedalBgColor(medalTier: 'Gold' | 'Silver' | 'Bronze'): string {
  switch (medalTier) {
    case 'Gold':
      return "rgba(234, 179, 8, 0.1)";
    case 'Silver':
      return "rgba(113, 113, 122, 0.1)";
    case 'Bronze':
      return "rgba(234, 88, 12, 0.1)";
  }
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
