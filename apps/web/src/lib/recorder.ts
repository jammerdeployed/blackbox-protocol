export interface RecorderConfig {
  timesliceMs?: number;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
}

export class WitnessRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  public sessionId: string | null = null;
  private chunkSequence = 0;
  private _isRecording = false;

  constructor(
    private onChunk: (chunk: Blob, sequence: number, isInit: boolean) => void,
    private config: RecorderConfig = {}
  ) {}

  get isRecording() {
    return this._isRecording;
  }

  async start(): Promise<string> {
    if (this._isRecording) throw new Error("Already recording");

    this.sessionId = crypto.randomUUID();
    this.chunkSequence = 0;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
    } catch (err) {
      throw new Error("Failed to get media devices: " + String(err));
    }

    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn("Wake lock failed:", err);
    }

    let mimeType = 'video/webm;codecs=vp8,opus';
    const types = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus'
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        mimeType = t;
        break;
      }
    }

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      videoBitsPerSecond: this.config.videoBitsPerSecond || 500000,
      audioBitsPerSecond: this.config.audioBitsPerSecond || 64000
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.onChunk(e.data, this.chunkSequence, this.chunkSequence === 0);
        this.chunkSequence++;
      }
    };

    this.mediaRecorder.start(this.config.timesliceMs || 1000);
    this._isRecording = true;

    return this.sessionId;
  }

  stop() {
    if (!this._isRecording) return;
    this._isRecording = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.wakeLock) {
      this.wakeLock.release().catch(console.warn);
      this.wakeLock = null;
    }
  }
}
