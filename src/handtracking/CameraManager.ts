/**
 * Owns the webcam MediaStream and the hidden <video> element that feeds
 * MediaPipe. Handles permission flow, front/rear facing selection, and
 * switching between multiple cameras.
 */

export type CameraFacing = 'user' | 'environment';

export type CameraStatus = 'idle' | 'starting' | 'running' | 'denied' | 'unavailable';

export class CameraManager {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private statusValue: CameraStatus = 'idle';
  private facingValue: CameraFacing = 'user';
  private devices: MediaDeviceInfo[] = [];

  constructor() {
    this.video = document.getElementById('webcam') as HTMLVideoElement;
  }

  get status(): CameraStatus {
    return this.statusValue;
  }

  get facing(): CameraFacing {
    return this.facingValue;
  }

  get isRunning(): boolean {
    return this.statusValue === 'running';
  }

  /** Number of distinct video input devices (after permission is granted). */
  get cameraCount(): number {
    return this.devices.length;
  }

  async start(facing: CameraFacing = 'user'): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.statusValue = 'unavailable';
      return false;
    }
    this.stop();
    this.statusValue = 'starting';
    this.facingValue = facing;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: facing,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      // Enumerate devices now that we have permission (labels are populated).
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        this.devices = all.filter((d) => d.kind === 'videoinput');
      } catch {
        this.devices = [];
      }
      this.statusValue = 'running';
      return true;
    } catch (err) {
      this.statusValue =
        err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
          ? 'denied'
          : 'unavailable';
      return false;
    }
  }

  /** Toggle between front and rear cameras. */
  async switchFacing(): Promise<boolean> {
    return this.start(this.facingValue === 'user' ? 'environment' : 'user');
  }

  stop(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    this.video.srcObject = null;
    this.statusValue = 'idle';
  }
}

/** App-wide singleton — one webcam, one video element. */
export const cameraManager = new CameraManager();
