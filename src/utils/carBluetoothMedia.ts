import { DriverOnlineStatus, TripOffer, TripStage } from '../types/driver';

export interface CarBluetoothMediaState {
  enabled: boolean;
  onlineStatus: DriverOnlineStatus;
  tripStage: TripStage;
  activeTrip: TripOffer | null;
  maneuverTitle?: string;
  maneuverSubtitle?: string;
  distanceToTurn?: string;
  etaMinLabel?: string;
  distanceRemaining?: string;
  cityLabel: string;
  voiceMuted: boolean;
}

export interface CarBluetoothHandlers {
  onSpeakTurn: () => void;
  onToggleVoiceMute: () => void;
  onSpeakStatus: () => void;
}

function createSilentWavBlobUrl(): string {
  // 1-second 8kHz mono 8-bit PCM silent WAV (valid RIFF/WAVE header)
  const sampleRate = 8000;
  const numSamples = sampleRate;
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, numSamples, true);

  // 8-bit unsigned PCM silence = 128
  for (let i = 0; i < numSamples; i++) {
    view.setUint8(44 + i, 128);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

class CarBluetoothMediaController {
  private audioEl: HTMLAudioElement | null = null;
  private blobUrl: string | null = null;
  private handlers: CarBluetoothHandlers | null = null;
  private active = false;

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    if (!this.blobUrl) {
      this.blobUrl = createSilentWavBlobUrl();
    }
    if (!this.audioEl) {
      const el = new Audio(this.blobUrl);
      el.loop = true;
      el.volume = 0.01;
      el.setAttribute('playsinline', 'true');
      this.audioEl = el;
    }
    return this.audioEl;
  }

  public async unlockAndStart(): Promise<boolean> {
    const el = this.ensureAudio();
    if (!el) return false;
    try {
      await el.play();
      this.active = true;
      return true;
    } catch {
      return false;
    }
  }

  public stop(): void {
    this.active = false;
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } catch {
        // Ignore pause error
      }
    }
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
      } catch {
        // Ignore Safari partial MediaSession support errors
      }
    }
  }

  public sync(state: CarBluetoothMediaState, handlers: CarBluetoothHandlers): void {
    this.handlers = handlers;

    if (!state.enabled) {
      if (this.active || (this.audioEl && !this.audioEl.paused)) {
        this.stop();
      }
      return;
    }

    const el = this.ensureAudio();
    if (el && el.paused) {
      void el
        .play()
        .then(() => {
          this.active = true;
        })
        .catch(() => {});
    }

    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    let title = `Uber Driver · ${state.cityLabel}`;
    let artist =
      state.onlineStatus === 'online'
        ? 'Online · Finding UK trips'
        : 'Offline · Tap Go Online';
    let album = state.voiceMuted ? 'Voice Nav Muted' : 'Car Bluetooth Nav Ready';

    if (state.activeTrip && state.tripStage !== 'idle') {
      if (state.tripStage === 'pickup' || state.tripStage === 'enroute') {
        const turnPrefix = state.distanceToTurn ? `${state.distanceToTurn} · ` : '';
        title = `${turnPrefix}${state.maneuverTitle || 'Follow UK route'}`;
        const legTag =
          state.tripStage === 'pickup'
            ? `Pickup ${state.activeTrip.riderName}`
            : `Dropoff ${state.activeTrip.dropoffArea}`;
        artist = `${state.etaMinLabel || `${state.activeTrip.tripMinutes} min`} · ${
          state.distanceRemaining || `${state.activeTrip.tripMiles} mi`
        } · ${legTag}`;
        album = `${state.activeTrip.serviceName} · £${state.activeTrip.fare.toFixed(2)}${
          state.voiceMuted ? ' · Muted' : ''
        }`;
      } else if (state.tripStage === 'waiting') {
        title = `Waiting for ${state.activeTrip.riderName}`;
        artist = state.activeTrip.pickupAddress;
        album = `${state.activeTrip.serviceName} · £${state.activeTrip.fare.toFixed(2)}`;
      } else if (state.tripStage === 'stop_wait') {
        title = `Mid-trip stop · ${state.activeTrip.riderName}`;
        artist = state.activeTrip.stopAddress || state.activeTrip.pickupArea;
        album = `Next: ${state.activeTrip.dropoffArea}`;
      } else if (state.tripStage === 'dropoff_arrived') {
        title = `Arrived · Complete £${state.activeTrip.fare.toFixed(2)} trip`;
        artist = state.activeTrip.dropoffAddress;
        album = `${state.activeTrip.serviceName} · ${state.activeTrip.riderName}`;
      }
    }

    try {
      if (typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          album,
          artwork: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          ],
        });
      }
      navigator.mediaSession.playbackState = state.voiceMuted ? 'paused' : 'playing';

      navigator.mediaSession.setActionHandler('play', () => {
        this.handlers?.onSpeakTurn();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.handlers?.onToggleVoiceMute();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.handlers?.onSpeakTurn();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.handlers?.onSpeakStatus();
      });
    } catch {
      // Ignore partial browser MediaSession support
    }
  }
}

export const carBluetoothMedia = new CarBluetoothMediaController();
