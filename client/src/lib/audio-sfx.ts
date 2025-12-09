const SFX_SETTINGS_KEY = 'lyricsensei_sfx_settings';

interface SfxSettings {
  enabled: boolean;
  volume: number;
}

const defaultSettings: SfxSettings = {
  enabled: true,
  volume: 0.5
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export function getSfxSettings(): SfxSettings {
  try {
    const stored = localStorage.getItem(SFX_SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('[SFX] Failed to load settings:', e);
  }
  return defaultSettings;
}

export function saveSfxSettings(settings: SfxSettings): void {
  try {
    localStorage.setItem(SFX_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('[SFX] Failed to save settings:', e);
  }
}

export function playSuccessChime(): void {
  const settings = getSfxSettings();
  if (!settings.enabled) return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const volume = settings.volume * 0.3;

    const oscillator1 = ctx.createOscillator();
    const oscillator2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator1.type = 'sine';
    oscillator2.type = 'sine';
    oscillator1.frequency.setValueAtTime(523.25, now);
    oscillator2.frequency.setValueAtTime(659.25, now);
    oscillator1.frequency.setValueAtTime(659.25, now + 0.1);
    oscillator2.frequency.setValueAtTime(783.99, now + 0.1);

    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    oscillator1.start(now);
    oscillator2.start(now);
    oscillator1.stop(now + 0.3);
    oscillator2.stop(now + 0.3);

    console.log('[SFX] Success chime played');
  } catch (e) {
    console.error('[SFX] Failed to play success chime:', e);
  }
}

export function playErrorBuzzer(): void {
  const settings = getSfxSettings();
  if (!settings.enabled) return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const volume = settings.volume * 0.2;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, now);
    oscillator.frequency.setValueAtTime(120, now + 0.1);

    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    oscillator.start(now);
    oscillator.stop(now + 0.25);

    console.log('[SFX] Error buzzer played');
  } catch (e) {
    console.error('[SFX] Failed to play error buzzer:', e);
  }
}

export function playTestSound(type: 'success' | 'error'): void {
  if (type === 'success') {
    playSuccessChime();
  } else {
    playErrorBuzzer();
  }
}
