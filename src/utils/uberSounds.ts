export type UberSoundName =
  | 'online'
  | 'offline'
  | 'dispatch'
  | 'accept'
  | 'startTrip'
  | 'completeTrip'
  | 'decline'
  | 'mapReport'
  | 'cashOut'
  | 'message';

const MP3_SOURCES: Record<'online' | 'offline' | 'dispatch' | 'accept' | 'startTrip', string> = {
  online: '/sounds/online.mp3',
  offline: '/sounds/offline.mp3',
  dispatch: '/sounds/dispatch.mp3',
  accept: '/sounds/accept.mp3',
  startTrip: '/sounds/start-trip.mp3',
};

class UberSoundEngine {
  private audioCache: Partial<Record<keyof typeof MP3_SOURCES, HTMLAudioElement>> = {};
  private dispatchLoopTimer: number | null = null;
  private activeDispatchAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private enabled = true;

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopDispatchLoop();
    }
  }

  public isEnabled() {
    return this.enabled;
  }

  public preload() {
    if (typeof window === 'undefined') return;
    (Object.keys(MP3_SOURCES) as Array<keyof typeof MP3_SOURCES>).forEach((key) => {
      if (!this.audioCache[key]) {
        const audio = new Audio(MP3_SOURCES[key]);
        audio.preload = 'auto';
        this.audioCache[key] = audio;
      }
    });
  }

  public unlock() {
    this.preload();
    if (typeof window !== 'undefined' && !this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctx) {
        this.audioCtx = new Ctx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  private playMp3(key: keyof typeof MP3_SOURCES, volume = 0.9) {
    if (!this.enabled || typeof window === 'undefined') return null;
    try {
      const src = MP3_SOURCES[key];
      const audio = new Audio(src);
      audio.volume = volume;
      audio.play().catch(() => {});
      return audio;
    } catch {
      return null;
    }
  }

  private playSynthTone(
    notes: Array<{ freq: number; delay: number; dur: number; type?: OscillatorType; gain?: number }>
  ) {
    if (!this.enabled || typeof window === 'undefined') return;
    this.unlock();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    for (const n of notes) {
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      osc.type = n.type ?? 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      const peak = n.gain ?? 0.14;
      gainNode.gain.setValueAtTime(0.0001, now + n.delay);
      gainNode.gain.exponentialRampToValueAtTime(peak, now + n.delay + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.dur);

      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.dur + 0.02);
    }
  }

  public play(name: UberSoundName) {
    if (!this.enabled) return;

    switch (name) {
      case 'online':
        this.playMp3('online', 0.9);
        break;
      case 'offline':
        this.stopDispatchLoop();
        this.playMp3('offline', 0.9);
        break;
      case 'dispatch':
        this.playMp3('dispatch', 0.95);
        break;
      case 'accept':
        this.stopDispatchLoop();
        this.playMp3('accept', 0.95);
        break;
      case 'startTrip':
        this.playMp3('startTrip', 0.95);
        break;
      case 'completeTrip':
        // Warm Uber-style rising 3-note completion chord
        this.playSynthTone([
          { freq: 523.25, delay: 0, dur: 0.14, gain: 0.15 },
          { freq: 659.25, delay: 0.08, dur: 0.16, gain: 0.16 },
          { freq: 783.99, delay: 0.16, dur: 0.28, gain: 0.18 },
        ]);
        break;
      case 'cashOut':
        this.playSynthTone([
          { freq: 587.33, delay: 0, dur: 0.12, gain: 0.14 },
          { freq: 880.0, delay: 0.09, dur: 0.24, gain: 0.16 },
        ]);
        break;
      case 'decline':
        this.stopDispatchLoop();
        this.playSynthTone([
          { freq: 320, delay: 0, dur: 0.08, type: 'triangle', gain: 0.09 },
          { freq: 240, delay: 0.06, dur: 0.1, type: 'triangle', gain: 0.08 },
        ]);
        break;
      case 'mapReport':
        this.playSynthTone([
          { freq: 660, delay: 0, dur: 0.08, gain: 0.11 },
          { freq: 880, delay: 0.06, dur: 0.12, gain: 0.12 },
        ]);
        break;
      case 'message':
        this.playSynthTone([
          { freq: 740, delay: 0, dur: 0.09, gain: 0.1 },
          { freq: 987.77, delay: 0.07, dur: 0.12, gain: 0.1 },
        ]);
        break;
    }
  }

  public startDispatchLoop() {
    this.stopDispatchLoop();
    if (!this.enabled || typeof window === 'undefined') return;

    const triggerPing = () => {
      if (!this.enabled) return;
      if (this.activeDispatchAudio) {
        this.activeDispatchAudio.pause();
        this.activeDispatchAudio.currentTime = 0;
      }
      this.activeDispatchAudio = this.playMp3('dispatch', 0.95);
    };

    triggerPing();
    this.dispatchLoopTimer = window.setInterval(triggerPing, 2400);
  }

  public stopDispatchLoop() {
    if (this.dispatchLoopTimer !== null) {
      window.clearInterval(this.dispatchLoopTimer);
      this.dispatchLoopTimer = null;
    }
    if (this.activeDispatchAudio) {
      this.activeDispatchAudio.pause();
      this.activeDispatchAudio.currentTime = 0;
      this.activeDispatchAudio = null;
    }
  }
}

export const uberSounds = new UberSoundEngine();
