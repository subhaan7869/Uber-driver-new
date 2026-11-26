export type VoiceDriverCommand =
  | 'accept'
  | 'decline'
  | 'go_online'
  | 'go_offline'
  | 'navigate'
  | 'read_message';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function parseSpokenDriverCommand(transcript: string): VoiceDriverCommand | null {
  const t = transcript.trim().toLowerCase();
  if (!t) return null;
  if (t.includes('accept') || t.includes('take trip') || t.includes('take job')) {
    return 'accept';
  }
  if (t.includes('decline') || t.includes('reject') || t.includes('skip') || t.includes('pass')) {
    return 'decline';
  }
  if (t.includes('go online') || t.includes('start shift')) {
    return 'go_online';
  }
  if (t.includes('go offline') || t.includes('stop requests') || t.includes('end shift')) {
    return 'go_offline';
  }
  if (t.includes('navigate') || t.includes('directions') || t.includes('route')) {
    return 'navigate';
  }
  if (t.includes('read message') || t.includes('message') || t.includes('rider note')) {
    return 'read_message';
  }
  return null;
}

export class DriverVoiceController {
  private recognition: SpeechRecognitionLike | null = null;
  private active = false;

  public start(
    onCommand: (cmd: VoiceDriverCommand, transcript: string) => void,
    onStatusChange?: (listening: boolean, lastHeard?: string) => void
  ): boolean {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onStatusChange?.(false);
      return false;
    }

    this.stop();
    try {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-GB';
      this.active = true;
      this.recognition = rec;

      rec.onresult = (ev) => {
        const len = ev.results.length;
        if (len === 0) return;
        const last = ev.results[len - 1];
        const transcript = last?.[0]?.transcript?.trim() ?? '';
        if (!transcript) return;
        onStatusChange?.(true, transcript);
        const cmd = parseSpokenDriverCommand(transcript);
        if (cmd) {
          onCommand(cmd, transcript);
        }
      };

      rec.onerror = () => {
        this.active = false;
        onStatusChange?.(false);
      };

      rec.onend = () => {
        if (this.active) {
          try {
            rec.start();
          } catch {
            this.active = false;
            onStatusChange?.(false);
          }
        } else {
          onStatusChange?.(false);
        }
      };

      rec.start();
      onStatusChange?.(true);
      return true;
    } catch {
      this.active = false;
      this.recognition = null;
      onStatusChange?.(false);
      return false;
    }
  }

  public stop(): void {
    this.active = false;
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {
        // Ignore stop errors
      }
      this.recognition = null;
    }
  }
}

export const driverVoiceController = new DriverVoiceController();
