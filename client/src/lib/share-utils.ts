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

  // Create story card HTML
  container.innerHTML = `
    <div style="
      width: 1080px;
      height: 1920px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: relative;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
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

      <!-- Content -->
      <div style="
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 100px 80px;
        z-index: 1;
      ">
        <!-- Top: App Name -->
        <div style="
          font-size: 56px;
          font-weight: 900;
          color: white;
          text-align: center;
          letter-spacing: 4px;
          text-transform: uppercase;
          text-shadow: 0 4px 20px rgba(0,0,0,0.3);
        ">
          Lyric Sensei
        </div>

        <!-- Middle: Album & Info -->
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 60px;
        ">
          <!-- Album Art -->
          <div style="
            width: 700px;
            height: 700px;
            border-radius: 40px;
            overflow: hidden;
            box-shadow: 0 40px 100px rgba(0,0,0,0.6);
            border: 8px solid rgba(255,255,255,0.1);
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
          <div style="text-align: center; max-width: 900px;">
            <div style="
              font-size: 80px;
              font-weight: 900;
              color: white;
              line-height: 1.1;
              margin-bottom: 24px;
              text-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
              ${songTitle}
            </div>
            <div style="
              font-size: 52px;
              color: rgba(255,255,255,0.85);
              font-weight: 600;
              text-shadow: 0 2px 10px rgba(0,0,0,0.3);
            ">
              ${artistName}
            </div>
          </div>
        </div>

        <!-- Bottom: CTA -->
        <div style="text-align: center;">
          <div style="
            font-size: 44px;
            color: rgba(255,255,255,0.95);
            font-weight: 700;
            margin-bottom: 12px;
            text-shadow: 0 2px 10px rgba(0,0,0,0.3);
          ">
            Download Lyric Sensei
          </div>
          <div style="
            font-size: 36px;
            color: rgba(255,255,255,0.75);
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
 * More compatible but lower quality
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

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // Load album artwork
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Draw blurred background
        ctx.filter = 'blur(40px) brightness(0.3)';
        ctx.globalAlpha = 0.6;
        ctx.drawImage(img, -50, -50, 1180, 2020);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';

        // Draw album art with rounded corners
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 20;

        const artSize = 700;
        const artX = (1080 - artSize) / 2;
        const artY = 600;

        // Rounded corners
        const radius = 40;
        ctx.beginPath();
        ctx.moveTo(artX + radius, artY);
        ctx.lineTo(artX + artSize - radius, artY);
        ctx.quadraticCurveTo(
          artX + artSize,
          artY,
          artX + artSize,
          artY + radius
        );
        ctx.lineTo(artX + artSize, artY + artSize - radius);
        ctx.quadraticCurveTo(
          artX + artSize,
          artY + artSize,
          artX + artSize - radius,
          artY + artSize
        );
        ctx.lineTo(artX + radius, artY + artSize);
        ctx.quadraticCurveTo(
          artX,
          artY + artSize,
          artX,
          artY + artSize - radius
        );
        ctx.lineTo(artX, artY + radius);
        ctx.quadraticCurveTo(artX, artY, artX + radius, artY);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img, artX, artY, artSize, artSize);
        ctx.restore();

        // Text
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;

        // App name
        ctx.font = 'bold 56px system-ui';
        ctx.fillText('LYRIC SENSEI', 540, 150);

        // Song title
        ctx.font = '900 80px system-ui';
        ctx.fillText(songTitle.substring(0, 30), 540, 1400);
        ctx.fillText(songTitle.substring(30), 540, 1500);

        // Artist
        ctx.font = '600 52px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(artistName, 540, 1600);

        // CTA
        ctx.font = 'bold 44px system-ui';
        ctx.fillStyle = 'white';
        ctx.fillText('Download Lyric Sensei', 540, 1800);
        ctx.font = '500 36px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText('lyricsensei.com', 540, 1850);

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
