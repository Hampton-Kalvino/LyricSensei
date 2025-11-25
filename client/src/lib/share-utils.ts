import { toPng } from 'html-to-image';

/**
 * Generate a beautiful 1080×1920px story card for Instagram/Snapchat
 * Uses html-to-image to convert HTML to PNG blob
 */
export async function generateStoryCard(
  songTitle: string,
  artistName: string,
  albumArtwork: string
): Promise<Blob> {
  // Create hidden container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '1080px';
  container.style.height = '1920px';
  container.style.zIndex = '-1';
  container.style.pointerEvents = 'none';

  // Create story card HTML with Tidal-like design
  container.innerHTML = `
    <div style="
      width: 1080px;
      height: 1920px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: relative;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    ">
      <!-- Blurred background -->
      <div style="
        position: absolute;
        top: -50px;
        left: -50px;
        right: -50px;
        bottom: -50px;
        background-image: url(${albumArtwork});
        background-size: cover;
        background-position: center;
        filter: blur(80px) brightness(0.3);
        opacity: 0.6;
      "></div>

      <!-- Content: White card (Tidal-style) -->
      <div style="
        position: relative;
        z-index: 1;
        background: white;
        border-radius: 40px;
        padding: 60px 60px;
        width: 900px;
        box-shadow: 0 40px 100px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 50px;
      ">
        <!-- Logo at top -->
        <div style="
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
        ">
          <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Music note icon -->
            <path d="M25 5C25 5 10 12 10 25C10 35 17 40 25 40C33 40 40 35 40 25C40 12 25 5 25 5M27 15V30C27 33 25 35 22 35C19 35 17 33 17 30C17 27 19 25 22 25V15H27Z" fill="white" stroke="white" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </div>

        <!-- Album Art -->
        <div style="
          width: 650px;
          height: 650px;
          border-radius: 30px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        ">
          <img 
            src="${albumArtwork}" 
            style="
              width: 100%;
              height: 100%;
              object-fit: cover;
            "
            crossorigin="anonymous"
          />
        </div>

        <!-- Song Info -->
        <div style="text-align: center;">
          <div style="
            font-size: 56px;
            font-weight: 900;
            color: #1a1a1a;
            line-height: 1.2;
            margin-bottom: 16px;
          ">
            ${songTitle}
          </div>
          <div style="
            font-size: 40px;
            color: #666666;
            font-weight: 600;
            margin-bottom: 32px;
          ">
            ${artistName}
          </div>
        </div>

        <!-- Bottom: CTA -->
        <div style="text-align: center;">
          <div style="
            font-size: 36px;
            color: #667eea;
            font-weight: 700;
            margin-bottom: 8px;
          ">
            Download Lyric Sensei
          </div>
          <div style="
            font-size: 28px;
            color: #999999;
            font-weight: 500;
          ">
            lyricsensei.com
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    console.log('[Share] Generating story card image...');

    // Get the inner div (the actual card)
    const cardElement = container.firstChild as HTMLElement;

    // Convert to PNG with high quality
    const dataUrl = await toPng(cardElement, {
      quality: 1.0,
      pixelRatio: 2,
      width: 1080,
      height: 1920,
      cacheBust: true,
      backgroundColor: '#667eea',
    });

    console.log('[Share] Image generated, converting to blob...');

    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    console.log('[Share] Blob created:', blob.size, 'bytes');

    return blob;
  } catch (error) {
    console.error('[Share] Image generation failed:', error);
    throw error;
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}

/**
 * Alternative Canvas-based implementation if html-to-image fails
 * Matches Tidal-like design with white card and logo
 */
export async function generateStoryCardCanvas(
  songTitle: string,
  artistName: string,
  albumArtwork: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    // Background gradient (purple)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, 1920);
    bgGradient.addColorStop(0, '#667eea');
    bgGradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // Load album artwork
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Draw blurred background image
        ctx.filter = 'blur(40px) brightness(0.3)';
        ctx.globalAlpha = 0.6;
        ctx.drawImage(img, -50, -50, 1180, 2020);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';

        // Draw white card (Tidal-style)
        const cardWidth = 900;
        const cardHeight = 1400;
        const cardX = (1080 - cardWidth) / 2;
        const cardY = (1920 - cardHeight) / 2;
        const cardRadius = 40;

        // Card background with shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 20;

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(cardX + cardRadius, cardY);
        ctx.lineTo(cardX + cardWidth - cardRadius, cardY);
        ctx.quadraticCurveTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + cardRadius);
        ctx.lineTo(cardX + cardWidth, cardY + cardHeight - cardRadius);
        ctx.quadraticCurveTo(cardX + cardWidth, cardY + cardHeight, cardX + cardWidth - cardRadius, cardY + cardHeight);
        ctx.lineTo(cardX + cardRadius, cardY + cardHeight);
        ctx.quadraticCurveTo(cardX, cardY + cardHeight, cardX, cardY + cardHeight - cardRadius);
        ctx.lineTo(cardX, cardY + cardRadius);
        ctx.quadraticCurveTo(cardX, cardY, cardX + cardRadius, cardY);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = 'transparent';

        // Draw logo circle at top (purple gradient circle with music note)
        const logoCenterX = 540;
        const logoCenterY = cardY + 100;
        const logoRadius = 40;

        const logoGradient = ctx.createLinearGradient(
          logoCenterX - logoRadius,
          logoCenterY - logoRadius,
          logoCenterX + logoRadius,
          logoCenterY + logoRadius
        );
        logoGradient.addColorStop(0, '#667eea');
        logoGradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = logoGradient;

        ctx.beginPath();
        ctx.arc(logoCenterX, logoCenterY, logoRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw music note inside logo circle
        ctx.fillStyle = 'white';
        ctx.font = 'bold 50px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♪', logoCenterX, logoCenterY);

        // Draw album art
        const artSize = 650;
        const artX = (1080 - artSize) / 2;
        const artY = cardY + 180;

        ctx.save();
        const artRadius = 30;
        ctx.beginPath();
        ctx.moveTo(artX + artRadius, artY);
        ctx.lineTo(artX + artSize - artRadius, artY);
        ctx.quadraticCurveTo(artX + artSize, artY, artX + artSize, artY + artRadius);
        ctx.lineTo(artX + artSize, artY + artSize - artRadius);
        ctx.quadraticCurveTo(artX + artSize, artY + artSize, artX + artSize - artRadius, artY + artSize);
        ctx.lineTo(artX + artRadius, artY + artSize);
        ctx.quadraticCurveTo(artX, artY + artSize, artX, artY + artSize - artRadius);
        ctx.lineTo(artX, artY + artRadius);
        ctx.quadraticCurveTo(artX, artY, artX + artRadius, artY);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img, artX, artY, artSize, artSize);
        ctx.restore();

        // Text content
        ctx.textAlign = 'center';
        ctx.shadowColor = 'transparent';

        // Song title
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 56px system-ui';
        const titleY = artY + artSize + 80;
        const lines = songTitle.length > 25 ? songTitle.match(/.{1,25}/g) || [] : [songTitle];
        lines.slice(0, 2).forEach((line, i) => {
          ctx.fillText(line, 540, titleY + i * 70);
        });

        // Artist name
        ctx.fillStyle = '#666666';
        ctx.font = '600 40px system-ui';
        ctx.fillText(artistName, 540, titleY + (lines.length * 70) + 60);

        // CTA text
        ctx.fillStyle = '#667eea';
        ctx.font = 'bold 36px system-ui';
        ctx.fillText('Download Lyric Sensei', 540, cardY + cardHeight - 120);

        ctx.fillStyle = '#999999';
        ctx.font = '500 28px system-ui';
        ctx.fillText('lyricsensei.com', 540, cardY + cardHeight - 60);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('[Share] Canvas blob created:', blob.size, 'bytes');
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/png',
          1.0
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load album artwork'));
    };

    img.src = albumArtwork;
  });
}
