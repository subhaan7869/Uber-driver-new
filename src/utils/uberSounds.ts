export type UberSoundName =
  | 'online'
  | 'offline'
  | 'dispatch'
  | 'exclusiveDispatch'
  | 'accept'
  | 'startTrip'
  | 'completeTrip'
  | 'decline'
  | 'mapReport'
  | 'cashOut'
  | 'message'
  | 'highSurgeDispatch'
  | 'cashDispatch'
  | 'waitExpired'
  | 'cameraAlert';

export type HapticPatternKind = 'light' | 'accept' | 'dispatch' | 'cash' | 'alert';

export function triggerHaptic(kind: HapticPatternKind = 'light'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    switch (kind) {
      case 'accept':
        navigator.vibrate([25, 35, 50]);
        break;
      case 'dispatch':
        navigator.vibrate([45, 55, 45]);
        break;
      case 'cash':
        navigator.vibrate([30, 30, 30, 40, 65]);
        break;
      case 'alert':
        navigator.vibrate([70, 40, 70]);
        break;
      default:
        navigator.vibrate(18);
        break;
    }
  } catch {
    // Ignore unsupported or blocked haptics
  }
}

type Mp3Key =
  | 'online'
  | 'offline'
  | 'dispatch'
  | 'exclusiveDispatch'
  | 'accept'
  | 'startTrip';

const MP3_SOURCES: Record<Mp3Key, string> = {
  exclusiveDispatch: '/assets/aistudio/uber_tune_7af85c35.mp3',
  online: '/sounds/online.mp3',
  offline: '/sounds/offline.mp3',
  dispatch: '/sounds/dispatch.mp3',
  accept: '/sounds/accept.mp3',
  startTrip: '/sounds/start-trip.mp3',
};

interface ActivePlaybackHandle {
  stop: () => void;
  setOnEnded: (cb: () => void) => void;
  durationMs?: number;
}

class UberSoundEngine {
  private audioCache: Partial<Record<Mp3Key, HTMLAudioElement>> = {};
  private rawBufferPromises: Partial<Record<Mp3Key, Promise<ArrayBuffer | null>>> = {};
  private bufferCache: Partial<Record<Mp3Key, AudioBuffer>> = {};
  private bufferPromises: Partial<Record<Mp3Key, Promise<AudioBuffer | null>>> = {};
  private dispatchLoopTimer: number | null = null;
  private dispatchLoopActive = false;
  private activeDispatchHandle: ActivePlaybackHandle | null = null;
  private audioCtx: AudioContext | null = null;
  private enabled = true;
  private globalListenersAttached = false;
  private pendingLoopKind: 'exclusive' | 'radar' | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.attachGlobalUnlockListeners();
    }
  }

  private attachGlobalUnlockListeners() {
    if (this.globalListenersAttached || typeof window === 'undefined') return;
    this.globalListenersAttached = true;

    const handleUserGesture = () => {
      this.unlock();
    };

    window.addEventListener('pointerdown', handleUserGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', handleUserGesture, { capture: true, passive: true });
    window.addEventListener('click', handleUserGesture, { capture: true, passive: true });
    window.addEventListener('keydown', handleUserGesture, { capture: true, passive: true });
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        this.audioCtx = new Ctx();
      }
    }
    return this.audioCtx;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopDispatchLoop();
    }
  }

  public isEnabled() {
    return this.enabled;
  }

  private prefetchRaw(key: Mp3Key): Promise<ArrayBuffer | null> {
    const existing = this.rawBufferPromises[key];
    if (existing) return existing;
    if (typeof fetch === 'undefined') return Promise.resolve(null);

    const p = fetch(MP3_SOURCES[key])
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .catch(() => null);
    this.rawBufferPromises[key] = p;
    return p;
  }

  public preload() {
    if (typeof window === 'undefined') return;
    this.attachGlobalUnlockListeners();

    (Object.keys(MP3_SOURCES) as Mp3Key[]).forEach((key) => {
      if (!this.audioCache[key]) {
        const audio = new Audio(MP3_SOURCES[key]);
        audio.preload = 'auto';
        audio.load();
        this.audioCache[key] = audio;
      }
      void this.prefetchRaw(key);
    });

    if (this.audioCtx) {
      (Object.keys(MP3_SOURCES) as Mp3Key[]).forEach((key) => {
        void this.loadDecodedBuffer(key);
      });
    }
  }

  private loadDecodedBuffer(key: Mp3Key): Promise<AudioBuffer | null> {
    if (this.bufferCache[key]) {
      return Promise.resolve(this.bufferCache[key]!);
    }
    const existing = this.bufferPromises[key];
    if (existing) return existing;

    const ctx = this.ensureAudioContext();
    if (!ctx) return Promise.resolve(null);

    const promise = this.prefetchRaw(key)
      .then((arr) => {
        if (!arr) return null;
        // Clone ArrayBuffer so decodeAudioData never detaches shared bytes
        return ctx.decodeAudioData(arr.slice(0));
      })
      .then((decoded) => {
        if (decoded) {
          this.bufferCache[key] = decoded;
        }
        return decoded;
      })
      .catch(() => null);

    this.bufferPromises[key] = promise;
    return promise;
  }

  public unlock() {
    this.preload();
    const ctx = this.ensureAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      // Play 1-sample silent buffer to strictly unlock Web Audio on iOS Safari
      try {
        const silentBuffer = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silentBuffer;
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        // Ignore if context cannot start yet
      }

      (Object.keys(MP3_SOURCES) as Mp3Key[]).forEach((key) => {
        void this.loadDecodedBuffer(key);
      });
    }

    if (this.pendingLoopKind && this.enabled) {
      const kind = this.pendingLoopKind;
      this.pendingLoopKind = null;
      this.startDispatchLoop(kind);
    }
  }

  private playBuffer(
    key: Mp3Key,
    volume = 0.95
  ): ActivePlaybackHandle | null {
    const ctx = this.audioCtx;
    const buffer = this.bufferCache[key];
    if (!ctx || !buffer) return null;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      source.connect(gain);
      gain.connect(ctx.destination);

      let stopped = false;
      source.start(0);

      return {
        durationMs: Math.round(buffer.duration * 1000),
        stop: () => {
          if (stopped) return;
          stopped = true;
          source.onended = null;
          try {
            source.stop();
          } catch {
            // Already ended
          }
          source.disconnect();
          gain.disconnect();
        },
        setOnEnded: (cb: () => void) => {
          source.onended = () => {
            if (!stopped) cb();
          };
        },
      };
    } catch {
      return null;
    }
  }

  private playMp3(
    key: Mp3Key,
    volume = 0.95,
    onAutoplayBlocked?: () => void
  ): ActivePlaybackHandle | null {
    if (!this.enabled || typeof window === 'undefined') return null;

    // 1. Prefer decoded Web Audio AudioBuffer (immune to timer/async autoplay blocks once unlocked)
    const bufferHandle = this.playBuffer(key, volume);
    if (bufferHandle) {
      return bufferHandle;
    }

    // Trigger decoding if AudioContext exists
    if (this.audioCtx) {
      void this.loadDecodedBuffer(key);
    }

    // 2. Fallback to HTMLAudioElement
    try {
      const cached = this.audioCache[key] ?? new Audio(MP3_SOURCES[key]);
      this.audioCache[key] = cached;

      cached.pause();
      cached.currentTime = 0;
      cached.muted = false;
      cached.volume = volume;

      const playPromise = cached.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          onAutoplayBlocked?.();
        });
      }

      return {
        stop: () => {
          cached.onended = null;
          cached.pause();
          cached.currentTime = 0;
        },
        setOnEnded: (cb: () => void) => {
          cached.onended = cb;
        },
      };
    } catch {
      onAutoplayBlocked?.();
      return null;
    }
  }

  private playSynthTone(
    notes: Array<{ freq: number; delay: number; dur: number; type?: OscillatorType; gain?: number }>
  ) {
    if (!this.enabled || typeof window === 'undefined') return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = n.type ?? 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      const peak = n.gain ?? 0.14;
      gainNode.gain.setValueAtTime(0.0001, now + n.delay);
      gainNode.gain.exponentialRampToValueAtTime(peak, now + n.delay + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.dur);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

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
      case 'exclusiveDispatch':
        this.playMp3('exclusiveDispatch', 0.95);
        break;
      case 'accept':
        this.stopDispatchLoop();
        this.playMp3('accept', 0.95);
        break;
      case 'startTrip':
        this.playMp3('startTrip', 0.95);
        break;
      case 'completeTrip':
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
      case 'highSurgeDispatch':
        this.playSynthTone([
          { freq: 659.25, delay: 0, dur: 0.11, gain: 0.15 },
          { freq: 880, delay: 0.09, dur: 0.12, gain: 0.16 },
          { freq: 1174.66, delay: 0.18, dur: 0.22, gain: 0.18 },
        ]);
        break;
      case 'cashDispatch':
        this.playSynthTone([
          { freq: 523.25, delay: 0, dur: 0.09, gain: 0.14 },
          { freq: 659.25, delay: 0.08, dur: 0.09, gain: 0.14 },
          { freq: 1046.5, delay: 0.16, dur: 0.2, gain: 0.17 },
        ]);
        break;
      case 'waitExpired':
        this.playSynthTone([
          { freq: 440, delay: 0, dur: 0.14, type: 'triangle', gain: 0.14 },
          { freq: 554.37, delay: 0.14, dur: 0.18, type: 'triangle', gain: 0.15 },
        ]);
        break;
      case 'cameraAlert':
        this.playSynthTone([
          { freq: 920, delay: 0, dur: 0.08, type: 'square', gain: 0.08 },
          { freq: 920, delay: 0.12, dur: 0.09, type: 'square', gain: 0.08 },
        ]);
        break;
    }
  }

  public startDispatchLoop(kind: 'exclusive' | 'radar' = 'exclusive') {
    this.stopDispatchLoop();
    if (!this.enabled || typeof window === 'undefined') return;

    this.dispatchLoopActive = true;
    const sourceKey: Mp3Key =
      kind === 'exclusive' ? 'exclusiveDispatch' : 'dispatch';

    const scheduleNext = (delayMs: number) => {
      if (!this.dispatchLoopActive || !this.enabled) return;
      if (this.dispatchLoopTimer !== null) {
        window.clearTimeout(this.dispatchLoopTimer);
      }
      this.dispatchLoopTimer = window.setTimeout(triggerPing, delayMs);
    };

    const triggerPing = () => {
      if (!this.dispatchLoopActive || !this.enabled) return;
      if (this.activeDispatchHandle) {
        this.activeDispatchHandle.stop();
        this.activeDispatchHandle = null;
      }

      const handle = this.playMp3(sourceKey, 0.95, () => {
        if (!this.dispatchLoopActive) return;
        // If HTMLAudio fallback was autoplay-blocked while AudioBuffer was decoding, retry via buffer once decoded
        if (this.audioCtx && this.audioCtx.state === 'running') {
          void this.loadDecodedBuffer(sourceKey).then((buf) => {
            if (buf && this.dispatchLoopActive && !this.activeDispatchHandle?.durationMs) {
              triggerPing();
            }
          });
        } else {
          this.pendingLoopKind = kind;
        }
      });
      this.activeDispatchHandle = handle;

      if (kind === 'exclusive' && handle) {
        handle.setOnEnded(() => {
          scheduleNext(400);
        });
        scheduleNext((handle.durationMs ?? 3500) + 650);
      } else {
        scheduleNext(2400);
      }
    };

    triggerPing();
  }

  public stopDispatchLoop() {
    this.dispatchLoopActive = false;
    this.pendingLoopKind = null;
    if (this.dispatchLoopTimer !== null) {
      window.clearTimeout(this.dispatchLoopTimer);
      this.dispatchLoopTimer = null;
    }
    if (this.activeDispatchHandle) {
      this.activeDispatchHandle.stop();
      this.activeDispatchHandle = null;
    }
  }
}

export const uberSounds = new UberSoundEngine();
