export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async startRecording(maxDuration: number = 5000): Promise<void> {
    try {
      console.log('[VoiceRecorder] Starting recording...');

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });

      console.log('[VoiceRecorder] Microphone accessed');

      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log('[VoiceRecorder] Audio chunk:', event.data.size, 'bytes');
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('[VoiceRecorder] Recording stopped');
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('[VoiceRecorder] Recording error:', event);
      };

      this.mediaRecorder.start(100);
      console.log('[VoiceRecorder] Recording started');

      setTimeout(() => {
        if (this.isRecording()) {
          this.stopRecording();
        }
      }, maxDuration);

    } catch (error) {
      console.error('[VoiceRecorder] Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { 
          type: this.mediaRecorder!.mimeType 
        });
        
        console.log('[VoiceRecorder] Recording complete:', audioBlob.size, 'bytes');

        this.stream?.getTracks().forEach(track => track.stop());
        
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('[VoiceRecorder] Using MIME type:', type);
        return type;
      }
    }

    return 'audio/webm';
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}
