import { MIME_TYPE_PREFERENCE, DEFAULT_RECORDER_CONFIG } from '@blackbox-protocol/shared';
import type { RecorderConfig } from '@blackbox-protocol/shared';
import { cs, en, getStoredLocale } from './locales';

const getTexts = () => (getStoredLocale() === 'cs' ? cs : en);

export class WitnessRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  public stream: MediaStream | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  public sessionId: string | null = null;
  public mimeType: string = 'video/mp4';
  private chunkSequence = 0;
  private _isRecording = false;

  constructor(
    private onChunk: (chunk: Blob, sequence: number, isInit: boolean) => void,
    private config: Partial<RecorderConfig> = {}
  ) {}

  get isRecording(): boolean {
    return this._isRecording;
  }

  async start(): Promise<string> {
    const t = getTexts();
    if (this._isRecording) throw new Error(t.alreadyRecording);

    this.sessionId = crypto.randomUUID();
    this.chunkSequence = 0;

    // 1. Acquire Camera & Mic with fallback constraints for iOS & Android
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err) {
      console.warn('Primary constraints failed, falling back to basic video/audio:', err);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (fallbackErr) {
        throw new Error(t.cameraPermissionDenied);
      }
    }

    // 2. Acquire WakeLock if supported
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake lock request skipped:', err);
    }

    // 3. Find optimal supported MIME type (fMP4 preferred for cross-platform zero-remux streaming)
    let selectedMimeType: string = 'video/mp4';
    for (const t of MIME_TYPE_PREFERENCE) {
      if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)) {
        selectedMimeType = t;
        break;
      }
    }
    this.mimeType = selectedMimeType;

    // 4. Initialize MediaRecorder with prioritized options
    const targetVideoBits = this.config.videoBitsPerSecond || DEFAULT_RECORDER_CONFIG.videoBitsPerSecond;
    const targetAudioBits = this.config.audioBitsPerSecond || DEFAULT_RECORDER_CONFIG.audioBitsPerSecond;

    try {
      const options: MediaRecorderOptions = {
        videoBitsPerSecond: targetVideoBits,
        audioBitsPerSecond: targetAudioBits,
        mimeType: selectedMimeType,
      };
      this.mediaRecorder = new MediaRecorder(this.stream, options);
    } catch (e) {
      console.warn('MediaRecorder with explicit options failed, falling back to default:', e);
      this.mediaRecorder = new MediaRecorder(this.stream);
    }

    this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        const isInit = this.chunkSequence === 0;
        this.onChunk(e.data, this.chunkSequence, isInit);
        this.chunkSequence++;
      }
    };

    const timeslice = this.config.timesliceMs || DEFAULT_RECORDER_CONFIG.timesliceMs;
    this.mediaRecorder.start(timeslice);
    this._isRecording = true;

    return this.sessionId;
  }

  stop(): void {
    if (!this._isRecording) return;
    this._isRecording = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (err) {
        console.warn('Error stopping MediaRecorder:', err);
      }
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.wakeLock) {
      this.wakeLock.release().catch(console.warn);
      this.wakeLock = null;
    }
  }
}
