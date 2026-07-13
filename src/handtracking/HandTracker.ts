/**
 * Thin wrapper around MediaPipe Tasks Vision HandLandmarker.
 *
 * Runs detection on each new video frame (via requestVideoFrameCallback when
 * available) and exposes the latest smoothed index-finger pose in *normalized
 * video coordinates* (0..1, un-mirrored). Consumers decide how to mirror and
 * map into screen space.
 *
 * The WASM runtime and .task model are fetched from Google's CDN so the repo
 * stays small; swap WASM_URL / MODEL_URL for local paths under public/ to
 * fully self-host.
 */
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { OneEuroFilter2D } from './OneEuroFilter';
import { cameraManager } from './CameraManager';
import { events, GameEvent } from '../utils/events';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

// Landmark indices we care about (MediaPipe hand topology).
const INDEX_TIP = 8;
const INDEX_MCP = 5;
const WRIST = 0;

export interface FingerPose {
  /** Index fingertip, normalized video coords. */
  tipX: number;
  tipY: number;
  /** Index finger base knuckle (MCP), normalized video coords. */
  baseX: number;
  baseY: number;
  /** Wrist, normalized. */
  wristX: number;
  wristY: number;
  /** True when a hand is currently visible. */
  tracked: boolean;
  /** ms timestamp of the source video frame. */
  timestamp: number;
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private running = false;
  private rafHandle = 0;
  private lastVideoTime = -1;
  private loadPromise: Promise<boolean> | null = null;

  private readonly tipFilter = new OneEuroFilter2D(1.4, 0.02);
  private readonly baseFilter = new OneEuroFilter2D(1.2, 0.012);

  readonly pose: FingerPose = {
    tipX: 0.5,
    tipY: 0.8,
    baseX: 0.5,
    baseY: 0.9,
    wristX: 0.5,
    wristY: 0.95,
    tracked: false,
    timestamp: 0,
  };

  /** Frames since a hand was last seen — used for "show your hand" hints. */
  framesWithoutHand = 0;

  /** Lazily create the landmarker (heavy: WASM + model download). */
  load(): Promise<boolean> {
    this.loadPromise ??= (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
        this.landmarker = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        return true;
      } catch (err) {
        console.error('HandLandmarker failed to load', err);
        return false;
      }
    })();
    return this.loadPromise;
  }

  /**
   * Same as `load()`, but resolves `false` if the CDN fetch (WASM + model,
   * ~10-20MB from Google's servers) takes too long, instead of leaving a
   * "STARTING CAMERA…" screen stuck forever on slow/unreliable networks.
   * The underlying attempt keeps running in the background — if it succeeds
   * late, `isLoaded` flips true and the next `load()`/`loadWithTimeout()`
   * call resolves immediately.
   */
  loadWithTimeout(timeoutMs = 20000): Promise<boolean> {
    const attempt = this.load();
    return Promise.race([
      attempt,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
  }

  get isLoaded(): boolean {
    return this.landmarker !== null;
  }

  /** Begin per-frame detection. Camera must already be running. */
  startDetection(): void {
    if (this.running || !this.landmarker) return;
    this.running = true;
    this.scheduleNextFrame();
  }

  stopDetection(): void {
    this.running = false;
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = 0;
    this.pose.tracked = false;
  }

  private scheduleNextFrame(): void {
    if (!this.running) return;
    const video = cameraManager.video;
    // requestVideoFrameCallback fires exactly once per camera frame, which
    // avoids wasted inference and lowers latency vs. rAF polling.
    if ('requestVideoFrameCallback' in video) {
      video.requestVideoFrameCallback(() => {
        this.detect();
        this.scheduleNextFrame();
      });
    } else {
      this.rafHandle = requestAnimationFrame(() => {
        this.detect();
        this.scheduleNextFrame();
      });
    }
  }

  private detect(): void {
    const video = cameraManager.video;
    if (!this.landmarker || !cameraManager.isRunning || video.readyState < 2) return;
    if (video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;

    const now = performance.now();
    let result;
    try {
      result = this.landmarker.detectForVideo(video, now);
    } catch {
      return; // transient failures (e.g., during camera switch) are fine
    }

    const lm = result.landmarks?.[0];
    if (lm && lm.length > INDEX_TIP) {
      const tip = this.tipFilter.filter(lm[INDEX_TIP].x, lm[INDEX_TIP].y, now);
      const base = this.baseFilter.filter(lm[INDEX_MCP].x, lm[INDEX_MCP].y, now);
      this.pose.tipX = tip.x;
      this.pose.tipY = tip.y;
      this.pose.baseX = base.x;
      this.pose.baseY = base.y;
      this.pose.wristX = lm[WRIST].x;
      this.pose.wristY = lm[WRIST].y;
      this.pose.timestamp = now;
      if (!this.pose.tracked) events.emit(GameEvent.trackingStatus, { ok: true });
      this.pose.tracked = true;
      this.framesWithoutHand = 0;
    } else {
      this.framesWithoutHand += 1;
      if (this.pose.tracked && this.framesWithoutHand > 8) {
        this.pose.tracked = false;
        this.tipFilter.reset();
        this.baseFilter.reset();
        events.emit(GameEvent.trackingStatus, { ok: false });
      }
    }
  }
}

/** App-wide singleton — the model is expensive, load it once. */
export const handTracker = new HandTracker();
