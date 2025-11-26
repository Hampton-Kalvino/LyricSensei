import { toPng } from 'html-to-image';

/**
 * Generate a beautiful 1080×1920px story card for Instagram/Snapchat
 * Minimalist white design with purple accents
 */
export async function generateStoryCard(
  songTitle: string,
  artistName: string,
  albumArtwork: string
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
      background: #FFFFFF;
      position: relative;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <!-- Subtle Gradient Background -->
      <div style="
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, #F9FAFB 0%, #FFFFFF 50%, #F3F4F6 100%);
      "></div>

      <!-- Content -->
      <div style="
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 100px 80px;
      ">
        <!-- Top: Logo -->
        <div style="
          display: flex;
          align-items: center;
          gap: 20px;
        ">
          <img 
            src="/Lyric_Sensei_Logo_Single_Transparent.png"
            style="
              width: 80px;
              height: 80px;
              object-fit: contain;
            "
            crossorigin="anonymous"
          />
          <div style="
            font-size: 48px;
            font-weight: 800;
            color: #8B5CF6;
            letter-spacing: -1px;
          ">
            Lyric Sensei
          </div>
        </div>

        <!-- Middle: Album + Info -->
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 60px;
        ">
          <!-- Album Art with Shadow -->
          <div style="
            width: 700px;
            height: 700px;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 
              0 40px 100px rgba(0,0,0,0.15),
              0 0 0 1px rgba(0,0,0,0.05);
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
              font-size: 80px;
              font-weight: 900;
              color: #111827;
              line-height: 1.1;
              margin-bottom: 20px;
            ">
              ${songTitle}
            </div>
            <div style="
              font-size: 52px;
              color: #6B7280;
              font-weight: 600;
            ">
              ${artistName}
            </div>
          </div>
        </div>

        <!-- Bottom: CTA -->
        <div style="text-align: center;">
          <div style="
            display: inline-block;
            background: #8B5CF6;
            color: white;
            font-size: 40px;
            font-weight: 700;
            padding: 28px 70px;
            border-radius: 100px;
            box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3);
          ">
            Download Now
          </div>
          <div style="
            font-size: 32px;
            color: #9CA3AF;
            margin-top: 24px;
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
 * Minimalist white design matching the HTML version
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

    // Subtle gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, 1920);
    bgGradient.addColorStop(0, '#F9FAFB');
    bgGradient.addColorStop(0.5, '#FFFFFF');
    bgGradient.addColorStop(1, '#F3F4F6');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // Load album artwork
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Load logo
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';

        const drawContent = () => {
          try {
            // Draw logo
            if (logoImg.complete && logoImg.naturalWidth > 0) {
              ctx.drawImage(logoImg, 80, 100, 80, 80);
            }

            // App name
            ctx.fillStyle = '#8B5CF6';
            ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('Lyric Sensei', 180, 140);

            // Album art with shadow
            ctx.shadowColor = 'rgba(0,0,0,0.15)';
            ctx.shadowBlur = 100;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 40;

            const artX = 190;
            const artY = 590;
            const artSize = 700;
            const artRad = 24;

            ctx.save();
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

            ctx.drawImage(img, artX, artY, artSize, artSize);
            ctx.restore();

            ctx.shadowColor = 'transparent';

            // Song title
            ctx.fillStyle = '#111827';
            ctx.font = '900 80px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const titleY = 1400;
            const titleLines = songTitle.length > 20 ? [songTitle.substring(0, 20), songTitle.substring(20)] : [songTitle];
            titleLines.slice(0, 2).forEach((line, i) => {
              ctx.fillText(line, 540, titleY + i * 100);
            });

            // Artist name
            ctx.fillStyle = '#6B7280';
            ctx.font = '600 52px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(artistName, 540, titleY + (titleLines.length * 100) + 80);

            // Download button
            ctx.fillStyle = '#8B5CF6';
            ctx.shadowColor = 'rgba(139, 92, 246, 0.3)';
            ctx.shadowBlur = 30;
            ctx.shadowOffsetY = 10;

            const btnX = 310;
            const btnY = 1700;
            const btnW = 460;
            const btnH = 80;
            const btnRad = 40;

            ctx.beginPath();
            ctx.moveTo(btnX + btnRad, btnY);
            ctx.lineTo(btnX + btnW - btnRad, btnY);
            ctx.quadraticCurveTo(btnX + btnW, btnY, btnX + btnW, btnY + btnRad);
            ctx.lineTo(btnX + btnW, btnY + btnH - btnRad);
            ctx.quadraticCurveTo(btnX + btnW, btnY + btnH, btnX + btnW - btnRad, btnY + btnH);
            ctx.lineTo(btnX + btnRad, btnY + btnH);
            ctx.quadraticCurveTo(btnX, btnY + btnH, btnX, btnY + btnH - btnRad);
            ctx.lineTo(btnX, btnY + btnRad);
            ctx.quadraticCurveTo(btnX, btnY, btnX + btnRad, btnY);
            ctx.closePath();
            ctx.fill();

            // Button text
            ctx.fillStyle = 'white';
            ctx.font = '700 40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'transparent';
            ctx.fillText('Download Now', 540, 1740);

            // Website
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '500 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText('lyricsensei.com', 540, 1830);

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
