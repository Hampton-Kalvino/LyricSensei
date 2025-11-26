import { toPng } from 'html-to-image';

/**
 * Generate optimized 1080×1920px story card for Instagram/Snapchat
 * Dark background with centered album art and language call-to-action
 */
export async function generateStoryCard(
  songTitle: string,
  artistName: string,
  albumArtwork: string,
  songLanguage: string = 'Spanish'
): Promise<Blob> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '1080px';
  container.style.height = '1920px';
  
  container.innerHTML = `
    <div style="
      width: 1080px;
      height: 1920px;
      background: #1a1a1a;
      position: relative;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
    ">
      <!-- Dark Blurred Background -->
      <div style="
        position: absolute;
        inset: -100px;
        background-image: url(${albumArtwork});
        background-size: cover;
        background-position: center;
        filter: blur(100px) brightness(0.2);
        opacity: 0.8;
      "></div>

      <!-- Dark Overlay -->
      <div style="
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.8) 100%);
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
        <!-- Top: Logo Horizontal (Left Aligned) -->
        <div style="
          display: flex;
          align-items: center;
          gap: 20px;
        ">
          <img 
            src="/Lyric_Sensei_Logo_Single_Transparent.png"
            style="
              width: 70px;
              height: 70px;
              object-fit: contain;
            "
            alt="Lyric Sensei"
            crossorigin="anonymous"
          />
          <div style="
            font-size: 52px;
            font-weight: 800;
            color: #8B5CF6;
            letter-spacing: -1px;
          ">
            Lyric Sensei
          </div>
        </div>

        <!-- Middle: Centered Album Cover -->
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 60px;
        ">
          <!-- Album Cover Container with CONTAIN -->
          <div style="
            width: 750px;
            height: 750px;
            border-radius: 24px;
            overflow: hidden;
            background: rgba(0,0,0,0.3);
            box-shadow: 
              0 50px 120px rgba(0,0,0,0.8),
              0 0 0 1px rgba(255,255,255,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <img 
              src="${albumArtwork}" 
              style="
                width: 100%;
                height: 100%;
                object-fit: contain;
              "
              alt="Album Art"
              crossorigin="anonymous"
            />
          </div>

          <!-- Song Title - Artist Name -->
          <div style="
            text-align: center;
            max-width: 900px;
          ">
            <div style="
              font-size: 72px;
              font-weight: 700;
              color: #FFFFFF;
              line-height: 1.2;
              margin-bottom: 16px;
            ">
              ${songTitle} - ${artistName}
            </div>
          </div>

          <!-- Learn [Language] CTA -->
          <div style="
            font-size: 56px;
            font-weight: 900;
            color: #8B5CF6;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
          ">
            Learn ${songLanguage}
          </div>
        </div>

        <!-- Bottom: App Link -->
        <div style="
          text-align: center;
        ">
          <div style="
            font-size: 48px;
            font-weight: 700;
            color: #FFFFFF;
            margin-bottom: 16px;
          ">
            lyricsensei.com
          </div>
          <div style="
            font-size: 36px;
            color: rgba(255,255,255,0.6);
            font-weight: 500;
          ">
            Available on iOS & Android
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const dataUrl = await toPng(container.firstChild as HTMLElement, {
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
 * Canvas fallback for story card generation
 */
export async function generateStoryCardCanvas(
  songTitle: string,
  artistName: string,
  albumArtwork: string,
  songLanguage: string = 'Spanish'
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

    // Dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 1080, 1920);

    // Load album artwork
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Draw blurred background
        ctx.filter = 'blur(100px) brightness(0.2)';
        ctx.globalAlpha = 0.8;
        ctx.drawImage(img, -100, -100, 1280, 2120);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';

        // Dark overlay gradient
        const overlayGrad = ctx.createLinearGradient(0, 0, 0, 1920);
        overlayGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
        overlayGrad.addColorStop(0.5, 'rgba(0,0,0,0.4)');
        overlayGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = overlayGrad;
        ctx.fillRect(0, 0, 1080, 1920);

        // Load logo
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';

        const drawContent = () => {
          try {
            // Draw logo
            if (logoImg.complete && logoImg.naturalWidth > 0) {
              ctx.drawImage(logoImg, 80, 80, 70, 70);
            }

            // App name
            ctx.fillStyle = '#8B5CF6';
            ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('Lyric Sensei', 170, 115);

            // Album art with contain logic
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 120;
            ctx.shadowOffsetY = 50;

            const artX = 165;
            const artY = 585;
            const artSize = 750;
            const artRad = 24;

            // Draw rounded container background
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.moveTo(artX + artRad, artY);
            ctx.lineTo(artX + artSize - artRad, artY);
            ctx.quadraticCurveTo(artX + artSize, artY, artX + artSize, artY + artRad);
            ctx.lineTo(artX + artSize, artY + artSize - artRad);
            ctx.quadraticCurveTo(artX + artSize, artY + artSize, artX + artSize - artRad, artY + artSize);
            ctx.lineTo(artX + artRad, artY + artSize);
            ctx.quadraticCurveTo(artX, artY + artSize, artX, artY + artSize - artRad);
            ctx.lineTo(artX, artY + artRad);
            ctx.quadraticCurveTo(artX, artY, artX + artRad, artY);
            ctx.closePath();
            ctx.fill();

            // Clip and draw image with contain
            ctx.beginPath();
            ctx.moveTo(artX + artRad, artY);
            ctx.lineTo(artX + artSize - artRad, artY);
            ctx.quadraticCurveTo(artX + artSize, artY, artX + artSize, artY + artRad);
            ctx.lineTo(artX + artSize, artY + artSize - artRad);
            ctx.quadraticCurveTo(artX + artSize, artY + artSize, artX + artSize - artRad, artY + artSize);
            ctx.lineTo(artX + artRad, artY + artSize);
            ctx.quadraticCurveTo(artX, artY + artSize, artX, artY + artSize - artRad);
            ctx.lineTo(artX, artY + artRad);
            ctx.quadraticCurveTo(artX, artY, artX + artRad, artY);
            ctx.closePath();
            ctx.clip();

            // Calculate contain fit
            const imgRatio = img.width / img.height;
            const containerRatio = artSize / artSize;
            let drawWidth, drawHeight, drawX, drawY;

            if (imgRatio > containerRatio) {
              drawHeight = artSize;
              drawWidth = artSize * imgRatio;
              drawX = artX - (drawWidth - artSize) / 2;
              drawY = artY;
            } else {
              drawWidth = artSize;
              drawHeight = artSize / imgRatio;
              drawX = artX;
              drawY = artY - (drawHeight - artSize) / 2;
            }

            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            ctx.restore();

            ctx.shadowColor = 'transparent';

            // Song - Artist
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '700 72px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${songTitle} - ${artistName}`, 540, 1440);

            // Learn Language
            ctx.fillStyle = '#8B5CF6';
            ctx.font = '900 56px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(`LEARN ${songLanguage.toUpperCase()}`, 540, 1560);

            // Website
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '700 48px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText('lyricsensei.com', 540, 1720);

            // Platform info
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '500 36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText('Available on iOS & Android', 540, 1800);

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
