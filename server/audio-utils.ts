/**
 * Audio processing utilities for pronunciation assessment
 * Optimizes audio for Azure Speech API to reduce costs by 40-60%
 * 
 * Required format for Azure:
 * - WAV format
 * - 16 kHz sample rate
 * - Mono channel
 * - 16-bit PCM
 */

import { Buffer } from 'buffer';

interface AudioMetadata {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  duration: number; // in seconds
  size: number; // in bytes
}

interface AudioProcessingResult {
  audioBuffer: Buffer;
  metadata: AudioMetadata;
  compressionRatio: number;
}

/**
 * Convert base64 audio to Buffer
 */
export function base64ToBuffer(base64Audio: string): Buffer {
  // Remove data URI prefix if present
  const base64Data = base64Audio.replace(/^data:audio\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * Extract WAV header metadata
 */
export function extractWavMetadata(buffer: Buffer): AudioMetadata {
  if (buffer.length < 44) {
    throw new Error('Invalid WAV file: too small');
  }

  // Verify RIFF header
  const riff = buffer.subarray(0, 4).toString('ascii');
  if (riff !== 'RIFF') {
    throw new Error('Invalid WAV file: missing RIFF header');
  }

  // Verify WAVE format
  const wave = buffer.subarray(8, 12).toString('ascii');
  if (wave !== 'WAVE') {
    throw new Error('Invalid WAV file: missing WAVE format');
  }

  // Read format chunk
  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitDepth = buffer.readUInt16LE(34);

  // Calculate duration
  const dataSize = buffer.length - 44; // Approximate data size
  const bytesPerSample = (bitDepth / 8) * channels;
  const duration = dataSize / (sampleRate * bytesPerSample);

  return {
    sampleRate,
    channels,
    bitDepth,
    duration,
    size: buffer.length,
  };
}

/**
 * Create WAV header for PCM audio
 */
function createWavHeader(
  dataSize: number,
  sampleRate: number,
  channels: number,
  bitDepth: number
): Buffer {
  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4); // ChunkSize
  header.write('WAVE', 8);

  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28); // ByteRate
  header.writeUInt16LE(channels * (bitDepth / 8), 32); // BlockAlign
  header.writeUInt16LE(bitDepth, 34);

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return header;
}

/**
 * Convert stereo to mono by averaging channels
 */
export function stereoToMono(buffer: Buffer, metadata: AudioMetadata): Buffer {
  if (metadata.channels === 1) {
    return buffer; // Already mono
  }

  if (metadata.channels !== 2) {
    throw new Error(`Unsupported channel count: ${metadata.channels}`);
  }

  const audioData = buffer.subarray(44); // Skip WAV header
  const bytesPerSample = metadata.bitDepth / 8;
  const monoSamples = audioData.length / (2 * bytesPerSample);
  const monoData = Buffer.alloc(monoSamples * bytesPerSample);

  for (let i = 0; i < monoSamples; i++) {
    if (bytesPerSample === 2) {
      // 16-bit samples
      const left = audioData.readInt16LE(i * 4);
      const right = audioData.readInt16LE(i * 4 + 2);
      const mono = Math.floor((left + right) / 2);
      monoData.writeInt16LE(mono, i * 2);
    } else if (bytesPerSample === 1) {
      // 8-bit samples
      const left = audioData.readInt8(i * 2);
      const right = audioData.readInt8(i * 2 + 1);
      const mono = Math.floor((left + right) / 2);
      monoData.writeInt8(mono, i);
    }
  }

  // Create new WAV with mono data
  const header = createWavHeader(
    monoData.length,
    metadata.sampleRate,
    1, // mono
    metadata.bitDepth
  );

  return Buffer.concat([header, monoData]);
}

/**
 * Resample audio to target sample rate
 * Simple linear interpolation for downsampling
 */
export function resampleAudio(
  buffer: Buffer,
  metadata: AudioMetadata,
  targetSampleRate: number
): Buffer {
  if (metadata.sampleRate === targetSampleRate) {
    return buffer; // No resampling needed
  }

  const audioData = buffer.subarray(44);
  const bytesPerSample = metadata.bitDepth / 8;
  const inputSamples = audioData.length / bytesPerSample;
  const outputSamples = Math.floor((inputSamples * targetSampleRate) / metadata.sampleRate);
  const outputData = Buffer.alloc(outputSamples * bytesPerSample);

  const ratio = inputSamples / outputSamples;

  for (let i = 0; i < outputSamples; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, inputSamples - 1);
    const fraction = srcIndex - srcIndexFloor;

    if (bytesPerSample === 2) {
      // 16-bit samples
      const sample1 = audioData.readInt16LE(srcIndexFloor * 2);
      const sample2 = audioData.readInt16LE(srcIndexCeil * 2);
      const interpolated = Math.floor(sample1 + (sample2 - sample1) * fraction);
      outputData.writeInt16LE(interpolated, i * 2);
    }
  }

  const header = createWavHeader(
    outputData.length,
    targetSampleRate,
    metadata.channels,
    metadata.bitDepth
  );

  return Buffer.concat([header, outputData]);
}

/**
 * Detect and trim silence from start and end
 * Uses simple amplitude threshold
 */
export function trimSilence(
  buffer: Buffer,
  metadata: AudioMetadata,
  threshold: number = 500 // Amplitude threshold for 16-bit audio
): Buffer {
  const audioData = buffer.subarray(44);
  const bytesPerSample = metadata.bitDepth / 8;
  const numSamples = audioData.length / bytesPerSample;

  if (bytesPerSample !== 2) {
    return buffer; // Only support 16-bit for now
  }

  // Find first non-silent sample
  let startSample = 0;
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.abs(audioData.readInt16LE(i * 2));
    if (sample > threshold) {
      startSample = Math.max(0, i - 100); // Keep 100 samples before sound starts
      break;
    }
  }

  // Find last non-silent sample
  let endSample = numSamples - 1;
  for (let i = numSamples - 1; i >= 0; i--) {
    const sample = Math.abs(audioData.readInt16LE(i * 2));
    if (sample > threshold) {
      endSample = Math.min(numSamples - 1, i + 100); // Keep 100 samples after sound ends
      break;
    }
  }

  if (startSample >= endSample) {
    return buffer; // No audio detected or too short
  }

  const trimmedData = audioData.subarray(startSample * bytesPerSample, endSample * bytesPerSample);
  const header = createWavHeader(
    trimmedData.length,
    metadata.sampleRate,
    metadata.channels,
    metadata.bitDepth
  );

  return Buffer.concat([header, trimmedData]);
}

/**
 * Optimize audio for Azure Speech API
 * Applies all necessary transformations: mono, 16kHz, silence trimming
 */
export function optimizeForAzureSpeech(base64Audio: string): AudioProcessingResult {
  const originalBuffer = base64ToBuffer(base64Audio);
  const originalSize = originalBuffer.length;
  
  let processedBuffer = originalBuffer;
  let metadata = extractWavMetadata(processedBuffer);

  console.log('[Audio Optimization] Original:', {
    sampleRate: metadata.sampleRate,
    channels: metadata.channels,
    bitDepth: metadata.bitDepth,
    duration: metadata.duration.toFixed(2) + 's',
    size: (metadata.size / 1024).toFixed(2) + 'KB',
  });

  // Step 1: Convert to mono if needed
  if (metadata.channels > 1) {
    processedBuffer = stereoToMono(processedBuffer, metadata);
    metadata = extractWavMetadata(processedBuffer);
    console.log('[Audio Optimization] Converted to mono');
  }

  // Step 2: Resample to 16kHz if needed
  if (metadata.sampleRate !== 16000) {
    processedBuffer = resampleAudio(processedBuffer, metadata, 16000);
    metadata = extractWavMetadata(processedBuffer);
    console.log('[Audio Optimization] Resampled to 16kHz');
  }

  // Step 3: Trim silence
  processedBuffer = trimSilence(processedBuffer, metadata);
  metadata = extractWavMetadata(processedBuffer);
  console.log('[Audio Optimization] Trimmed silence');

  const compressionRatio = (1 - processedBuffer.length / originalSize) * 100;

  console.log('[Audio Optimization] Final:', {
    sampleRate: metadata.sampleRate,
    channels: metadata.channels,
    bitDepth: metadata.bitDepth,
    duration: metadata.duration.toFixed(2) + 's',
    size: (metadata.size / 1024).toFixed(2) + 'KB',
    compression: compressionRatio.toFixed(1) + '%',
  });

  return {
    audioBuffer: processedBuffer,
    metadata,
    compressionRatio,
  };
}

/**
 * Validate that audio meets Azure Speech requirements
 */
export function validateAudioForAzure(buffer: Buffer): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const metadata = extractWavMetadata(buffer);

    if (metadata.sampleRate !== 16000) {
      errors.push(`Sample rate must be 16kHz (got ${metadata.sampleRate}Hz)`);
    }

    if (metadata.channels !== 1) {
      errors.push(`Must be mono audio (got ${metadata.channels} channels)`);
    }

    if (metadata.bitDepth !== 16) {
      errors.push(`Bit depth must be 16-bit (got ${metadata.bitDepth}-bit)`);
    }

    if (metadata.duration > 30) {
      errors.push(`Audio too long for REST API (${metadata.duration.toFixed(1)}s, max 30s)`);
    }

    if (metadata.duration < 0.1) {
      errors.push(`Audio too short (${metadata.duration.toFixed(2)}s, min 0.1s)`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown validation error');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
