/**
 * Convert audio blob to WAV format for ACRCloud recognition
 * Falls back to original blob if conversion fails (mobile compatibility)
 */
export async function convertToWav(audioBlob: Blob): Promise<Blob> {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    try {
      console.log('[AudioConverter] Decoding audio data...');
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('[AudioConverter] Audio decoded successfully');
      console.log('[AudioConverter] Sample rate:', audioBuffer.sampleRate);
      console.log('[AudioConverter] Duration:', audioBuffer.duration);
      
      // Convert to WAV
      const wavBlob = audioBufferToWav(audioBuffer);
      console.log('[AudioConverter] Converted to WAV, size:', wavBlob.size);
      return wavBlob;
    } catch (decodeError) {
      console.warn('[AudioConverter] Failed to decode audio, using original blob:', decodeError);
      // Return original blob if decoding fails (ACRCloud supports multiple formats)
      return audioBlob;
    } finally {
      await audioContext.close();
    }
  } catch (error) {
    console.error('[AudioConverter] Conversion failed, using original blob:', error);
    // If any step fails, return the original blob
    return audioBlob;
  }
}

/**
 * Convert AudioBuffer to WAV format blob
 */
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = 1; // Mono
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  // Get audio data
  const channelData = audioBuffer.getChannelData(0);
  const length = channelData.length;
  
  // Create WAV file buffer
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  
  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * (bitDepth / 8), true);
  view.setUint16(32, numberOfChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length * 2, true);
  
  // Write audio data
  const offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
