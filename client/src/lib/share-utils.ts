import { toPng } from 'html-to-image';

/**
 * Generate a beautiful 1080×1920px story card for Instagram/Snapchat
 * Uses html-to-image to convert HTML to PNG blob
 * Premium design with glassmorphism and gradient effects
 */
export async function generateStoryCard(
  songTitle: string,
  artistName: string,
  albumArtwork: string,
  lyricText?: string
): Promise<Blob> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.width = '1080px';
  container.style.height = '1920px';
  
  container.innerHTML = `
    <div style="
      width: 1080px;
      height: 1920px;
      background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 50%, #3B82F6 100%);
      position: relative;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
    ">
      <!-- Blurred Background Layer -->
      <div style="
        position: absolute;
        inset: -100px;
        background-image: url(${albumArtwork});
        background-size: cover;
        background-position: center;
        filter: blur(80px) brightness(0.25) saturate(1.5);
        opacity: 0.5;
      "></div>

      <!-- Gradient Overlay -->
      <div style="
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 50% 40%, rgba(139, 92, 246, 0.3) 0%, transparent 70%);
      "></div>

      <!-- Content -->
      <div style="
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 80px 60px;
        z-index: 1;
      ">
        <!-- Top: Logo + App Name -->
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        ">
          <!-- Logo -->
          <div style="
            width: 140px;
            height: 140px;
            background: white;
            border-radius: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          ">
            <img 
              src="/Lyric_Sensei_Logo_Single_Transparent.png"
              style="
                width: 100px;
                height: 100px;
                object-fit: contain;
              "
              crossorigin="anonymous"
            />
          </div>

          <!-- App Name -->
          <div style="
            font-size: 48px;
            font-weight: 800;
            color: white;
            letter-spacing: -1px;
            text-shadow: 0 4px 20px rgba(0,0,0,0.4);
          ">
            Lyric Sensei
          </div>

          <!-- Tagline -->
          <div style="
            font-size: 24px;
            color: rgba(255,255,255,0.85);
            font-weight: 500;
            text-align: center;
            text-shadow: 0 2px 10px rgba(0,0,0,0.3);
          ">
            Master Lyrics in Any Language
          </div>
        </div>

        <!-- Middle: Album Art Container -->
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 50px;
        ">
          <!-- Album Artwork with Glow -->
          <div style="
            position: relative;
            width: 650px;
            height: 650px;
          ">
            <!-- Glow Effect -->
            <div style="
              position: absolute;
              inset: -20px;
              background: linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(99, 102, 241, 0.5));
              border-radius: 50px;
              filter: blur(30px);
              opacity: 0.7;
            "></div>

            <!-- Album Art -->
            <div style="
              position: relative;
              width: 650px;
              height: 650px;
              border-radius: 36px;
              overflow: hidden;
              box-shadow: 
                0 30px 80px rgba(0,0,0,0.5),
                0 0 0 1px rgba(255,255,255,0.1);
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
          </div>

          <!-- Song Info Card -->
          <div style="
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 28px;
            padding: 40px 50px;
            text-align: center;
            max-width: 850px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          ">
            <!-- Song Title -->
            <div style="
              font-size: 72px;
              font-weight: 900;
              color: white;
              line-height: 1.1;
              margin-bottom: 20px;
              text-shadow: 0 4px 20px rgba(0,0,0,0.4);
            ">
              ${songTitle}
            </div>

            <!-- Artist -->
            <div style="
              font-size: 48px;
              color: rgba(255,255,255,0.9);
              font-weight: 600;
              text-shadow: 0 2px 10px rgba(0,0,0,0.3);
            ">
              ${artistName}
            </div>
          </div>

          ${lyricText ? `
          <!-- Lyric Snippet -->
          <div style="
            background: rgba(255,255,255,0.08);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 20px;
            padding: 32px 40px;
            max-width: 800px;
          ">
            <div style="
              font-size: 42px;
              color: rgba(255,255,255,0.95);
              font-style: italic;
              line-height: 1.5;
              text-align: center;
              text-shadow: 0 2px 8px rgba(0,0,0,0.2);
            ">
              "${lyricText}"
            </div>
          </div>
          ` : ''}
        </div>

        <!-- Bottom: Call to Action -->
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        ">
          <!-- Download Button Style -->
          <div style="
            background: white;
            color: #8B5CF6;
            font-size: 42px;
            font-weight: 800;
            padding: 24px 60px;
            border-radius: 100px;
            box-shadow: 
              0 10px 40px rgba(0,0,0,0.3),
              0 0 0 1px rgba(255,255,255,0.1);
          ">
            Download Lyric Sensei
          </div>

          <!-- Website -->
          <div style="
            font-size: 32px;
            color: rgba(255,255,255,0.8);
            font-weight: 600;
          ">
            lyricsensei.com
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const { toPng: toPngFunc } = await import('html-to-image');
    
    const dataUrl = await toPngFunc(container.firstChild as HTMLElement, {
      quality: 1.0,
      pixelRatio: 2,
      width: 1080,
      height: 1920,
      cacheBust: true
    });

    const response = await fetch(dataUrl);
    const blob = await response.blob();

    console.log('[Share] Story card created:', blob.size, 'bytes');
    return blob;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Alternative Canvas-based implementation if html-to-image fails
 */
export async function generateStoryCardCanvas(
  songTitle: string,
  artistName: string,
  albumArtwork: string,
  lyricText?: string
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

    // Background gradient (purple to blue)
    const bgGradient = ctx.createLinearGradient(0, 0, 1080, 1920);
    bgGradient.addColorStop(0, '#8B5CF6');
    bgGradient.addColorStop(0.5, '#6366F1');
    bgGradient.addColorStop(1, '#3B82F6');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // Load album artwork for blurred background
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Draw blurred background
        ctx.filter = 'blur(80px) brightness(0.25) saturate(1.5)';
        ctx.globalAlpha = 0.5;
        ctx.drawImage(img, -100, -100, 1280, 2120);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';

        // Radial gradient overlay
        const radialGrad = ctx.createRadialGradient(540, 768, 0, 540, 768, 800);
        radialGrad.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
        radialGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = radialGrad;
        ctx.fillRect(0, 0, 1080, 1920);

        // Load logo
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';

        const drawContent = () => {
          try {
            // Draw logo background circle
            ctx.fillStyle = 'white';
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 60;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 20;

            const logoRadius = 70;
            ctx.beginPath();
            ctx.arc(540, 240, logoRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowColor = 'transparent';

            // Draw logo
            if (logoImg.complete && logoImg.naturalWidth > 0) {
              ctx.drawImage(logoImg, 490, 190, 100, 100);
            }

            // App name
            ctx.fillStyle = 'white';
            ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 20;
            ctx.fillText('Lyric Sensei', 540, 390);

            // Tagline
            ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.shadowBlur = 10;
            ctx.fillText('Master Lyrics in Any Language', 540, 450);

            // Draw glow around album art
            const artX = 215;
            const artY = 550;
            const artSize = 650;

            ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
            ctx.shadowColor = 'transparent';
            ctx.beginPath();
            ctx.ellipse(540, 875, 375, 375, 0, 0, Math.PI * 2);
            ctx.fill();

            // Draw album art
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 80;
            ctx.shadowOffsetY = 30;

            ctx.save();
            ctx.beginPath();
            const rad = 36;
            ctx.moveTo(artX + rad, artY);
            ctx.lineTo(artX + artSize - rad, artY);
            ctx.quadraticCurveTo(artX + artSize, artY, artX + artSize, artY + rad);
            ctx.lineTo(artX + artSize, artY + artSize - rad);
            ctx.quadraticCurveTo(artX + artSize, artY + artSize, artX + artSize - rad, artY + artSize);
            ctx.lineTo(artX + rad, artY + artSize);
            ctx.quadraticCurveTo(artX, artY + artSize, artX, artY + artSize - rad);
            ctx.lineTo(artX, artY + rad);
            ctx.quadraticCurveTo(artX, artY, artX + rad, artY);
            ctx.closePath();
            ctx.clip();

            ctx.drawImage(img, artX, artY, artSize, artSize);
            ctx.restore();

            // Draw semi-transparent info card
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 40;
            ctx.fillStyle = 'rgba(255,255,255,0.1)';

            const cardX = 115;
            const cardY = 1280;
            const cardWidth = 850;
            const cardHeight = 280;
            const cardRad = 28;

            ctx.beginPath();
            ctx.moveTo(cardX + cardRad, cardY);
            ctx.lineTo(cardX + cardWidth - cardRad, cardY);
            ctx.quadraticCurveTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + cardRad);
            ctx.lineTo(cardX + cardWidth, cardY + cardHeight - cardRad);
            ctx.quadraticCurveTo(cardX + cardWidth, cardY + cardHeight, cardX + cardWidth - cardRad, cardY + cardHeight);
            ctx.lineTo(cardX + cardRad, cardY + cardHeight);
            ctx.quadraticCurveTo(cardX, cardY + cardHeight, cardX, cardY + cardHeight - cardRad);
            ctx.lineTo(cardX, cardY + cardRad);
            ctx.quadraticCurveTo(cardX, cardY, cardX + cardRad, cardY);
            ctx.closePath();
            ctx.fill();

            ctx.shadowColor = 'transparent';

            // Song title
            ctx.fillStyle = 'white';
            ctx.font = '900 72px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 20;
            ctx.fillText(songTitle.substring(0, 20), 540, 1360);

            // Artist
            ctx.font = '600 48px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.shadowBlur = 10;
            ctx.fillText(artistName, 540, 1430);

            // Download button
            ctx.fillStyle = 'white';
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 40;
            ctx.shadowOffsetY = 10;

            const btnRad = 50;
            ctx.beginPath();
            ctx.moveTo(290 + btnRad, 1680);
            ctx.lineTo(790 - btnRad, 1680);
            ctx.quadraticCurveTo(790, 1680, 790, 1680 + btnRad);
            ctx.lineTo(790, 1680 + btnRad);
            ctx.quadraticCurveTo(790, 1730, 790 - btnRad, 1730);
            ctx.lineTo(290 + btnRad, 1730);
            ctx.quadraticCurveTo(290, 1730, 290, 1680 + btnRad);
            ctx.lineTo(290, 1680 + btnRad);
            ctx.quadraticCurveTo(290, 1680, 290 + btnRad, 1680);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#8B5CF6';
            ctx.font = '800 42px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'transparent';
            ctx.fillText('Download Lyric Sensei', 540, 1705);

            // Website
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = '600 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText('lyricsensei.com', 540, 1810);

            // Convert to blob
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  console.log('[Share] Canvas card created:', blob.size, 'bytes');
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

        logoImg.onload = drawContent;
        logoImg.onerror = drawContent;
        logoImg.src = '/Lyric_Sensei_Logo_Single_Transparent.png';
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
