/**
 * Convert audio blob to WAV format for ACRCloud recognition
 * Falls back to original blob if conversion fails (mobile compatibility)
 * Now supports stereo audio with normalization for better recognition
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
      console.log('[AudioConverter] Number of channels:', audioBuffer.numberOfChannels);
      
      // Normalize audio levels for better recognition
      const normalizedBuffer = normalizeAudio(audioBuffer);
      
      // Convert to WAV (stereo if available)
      const wavBlob = audioBufferToWav(normalizedBuffer);
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
 * Normalize audio levels if too quiet for better recognition
 */
function normalizeAudio(audioBuffer: AudioBuffer): AudioBuffer {
  const numberOfChannels = audioBuffer.numberOfChannels;
  
  // Find the maximum amplitude across all channels
  let globalMax = 0;
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      globalMax = Math.max(globalMax, Math.abs(channelData[i]));
    }
  }
  
  // Only normalize if audio is too quiet (below 50% of max possible)
  if (globalMax > 0 && globalMax < 0.5) {
    const gain = 0.8 / globalMax; // Normalize to 80% of max
    console.log('[AudioConverter] Normalizing quiet audio by factor:', gain.toFixed(2));
    
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.max(-1, Math.min(1, channelData[i] * gain));
      }
    }
  } else {
    console.log('[AudioConverter] Audio levels OK, no normalization needed. Max:', globalMax.toFixed(3));
  }
  
  return audioBuffer;
}

/**
 * Convert AudioBuffer to WAV format blob
 * Supports stereo audio for richer recognition fingerprints
 */
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels; // Preserve original channels (mono or stereo)
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  // Get audio data from all channels
  const channelDataArrays: Float32Array[] = [];
  for (let ch = 0; ch < numberOfChannels; ch++) {
    channelDataArrays.push(audioBuffer.getChannelData(ch));
  }
  
  const samplesPerChannel = channelDataArrays[0].length;
  const totalSamples = samplesPerChannel * numberOfChannels;
  const dataSize = totalSamples * (bitDepth / 8);
  
  // Create WAV file buffer
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
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
  view.setUint32(40, dataSize, true);
  
  // Write interleaved audio data (for stereo: L R L R L R...)
  let offset = 44;
  for (let i = 0; i < samplesPerChannel; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelDataArrays[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  console.log(`[AudioConverter] Created WAV: ${numberOfChannels} channels, ${sampleRate}Hz, ${samplesPerChannel} samples`);
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
