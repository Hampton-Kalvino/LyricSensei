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
        <!-- Album Art with Logo Overlay (Tidal-style) -->
        <div style="
          position: relative;
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
          
          <!-- Logo overlay on top-left corner -->
          <img 
            src="/lyric-sensei-logo.png" 
            style="
              position: absolute;
              top: 20px;
              left: 20px;
              width: 80px;
              height: 80px;
              object-fit: contain;
              background: rgba(255,255,255,0.95);
              border-radius: 12px;
              padding: 8px;
              box-shadow: 0 4px 16px rgba(0,0,0,0.3);
              z-index: 10;
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

        // Draw album art with rounded corners
        const artSize = 650;
        const artX = (1080 - artSize) / 2;
        const artY = cardY + 80;

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

        // Load and draw logo image on top-left corner (like Tidal)
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        
        const drawWithLogo = () => {
          try {
            // Draw white rounded background for logo (top-left corner)
            const logoBgX = artX + 20;
            const logoBgY = artY + 20;
            const logoBgSize = 96;
            const logoBgRadius = 12;

            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 16;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 4;

            ctx.beginPath();
            ctx.moveTo(logoBgX + logoBgRadius, logoBgY);
            ctx.lineTo(logoBgX + logoBgSize - logoBgRadius, logoBgY);
            ctx.quadraticCurveTo(logoBgX + logoBgSize, logoBgY, logoBgX + logoBgSize, logoBgY + logoBgRadius);
            ctx.lineTo(logoBgX + logoBgSize, logoBgY + logoBgSize - logoBgRadius);
            ctx.quadraticCurveTo(logoBgX + logoBgSize, logoBgY + logoBgSize, logoBgX + logoBgSize - logoBgRadius, logoBgY + logoBgSize);
            ctx.lineTo(logoBgX + logoBgRadius, logoBgY + logoBgSize);
            ctx.quadraticCurveTo(logoBgX, logoBgY + logoBgSize, logoBgX, logoBgY + logoBgSize - logoBgRadius);
            ctx.lineTo(logoBgX, logoBgY + logoBgRadius);
            ctx.quadraticCurveTo(logoBgX, logoBgY, logoBgX + logoBgRadius, logoBgY);
            ctx.closePath();
            ctx.fill();

            ctx.shadowColor = 'transparent';

            // Draw logo image
            if (logoImg.complete && logoImg.naturalWidth > 0) {
              const logoPadding = 8;
              ctx.drawImage(
                logoImg,
                logoBgX + logoPadding,
                logoBgY + logoPadding,
                logoBgSize - logoPadding * 2,
                logoBgSize - logoPadding * 2
              );
            }
          } catch (e) {
            console.error('[Share] Logo draw error:', e);
          }

          // Continue with text

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
        };

        logoImg.onload = drawWithLogo;
        logoImg.onerror = drawWithLogo;
        logoImg.src = '/lyric-sensei-logo.png';
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
