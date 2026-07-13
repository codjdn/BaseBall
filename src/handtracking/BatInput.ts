/**
 * Turns raw input (hand landmarks, or pointer as fallback) into a bat pose
 * in *world space* on the hitting plane, plus tip velocity for swing power.
 *
 * The bat is a segment: `base` (knuckle / grip) -> `tip` (fingertip / barrel
 * end). Velocity is measured over a short sliding window so a fast flick
 * registers even at low camera frame rates.
 */
import { BAT, DESIGN_HEIGHT, DESIGN_WIDTH } from '../game/config';
import { unprojectToPlane } from '../physics/projection';
import { clamp } from '../utils/math';
import { storage } from '../utils/storage';
import { handTracker } from './HandTracker';

export interface BatPose {
  /** Barrel end (fingertip) in world feet on the hitting plane. */
  tipX: number;
  tipY: number;
  /** Grip end (knuckle) in world feet. */
  baseX: number;
  baseY: number;
  /** Tip velocity, world ft/s. */
  velX: number;
  velY: number;
  /** Tip speed magnitude, ft/s. */
  speed: number;
  /** True when input is live (hand visible / pointer down or moved recently). */
  active: boolean;
}

interface Sample {
  x: number;
  y: number;
  t: number;
}

const VELOCITY_WINDOW_MS = 80;

export class BatInput {
  readonly pose: BatPose = {
    tipX: 0,
    tipY: 2.5,
    baseX: -1.5,
    baseY: 1.2,
    velX: 0,
    velY: 0,
    speed: 0,
    active: false,
  };

  private samples: Sample[] = [];
  private pointerX = DESIGN_WIDTH / 2;
  private pointerY = DESIGN_HEIGHT * 0.75;
  private pointerSeenAt = -Infinity;

  /** Feed pointer input (mouse/touch fallback mode). Design-space coords. */
  setPointer(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
    this.pointerSeenAt = performance.now();
  }

  /** Call once per game frame. */
  update(): void {
    const s = storage.settings;
    const now = performance.now();

    let tipSX: number;
    let tipSY: number;
    let baseSX: number;
    let baseSY: number;
    let active: boolean;

    if (!s.pointerMode && handTracker.pose.tracked) {
      const p = handTracker.pose;
      // Normalized video coords -> design screen coords. The camera sees a
      // mirror of the player, so mirroring (default on) makes rightward hand
      // motion move the bat right, which feels natural.
      const mx = s.mirrorCamera ? 1 - p.tipX : p.tipX;
      const my = p.tipY;
      const bx = s.mirrorCamera ? 1 - p.baseX : p.baseX;
      const by = p.baseY;

      const sens = s.sensitivity;
      tipSX = DESIGN_WIDTH * (0.5 + (mx - 0.5) * sens);
      tipSY = DESIGN_HEIGHT * (0.5 + (my - 0.5) * sens);
      baseSX = DESIGN_WIDTH * (0.5 + (bx - 0.5) * sens);
      baseSY = DESIGN_HEIGHT * (0.5 + (by - 0.5) * sens);
      active = true;
    } else if (s.pointerMode) {
      // Pointer fallback: the pointer is the fingertip; the grip trails
      // toward the batter's hands side.
      tipSX = this.pointerX;
      tipSY = this.pointerY;
      const side = s.handedness === 'right' ? -1 : 1;
      baseSX = tipSX + side * 110;
      baseSY = tipSY + 150;
      active = now - this.pointerSeenAt < 3000;
    } else {
      this.pose.active = false;
      this.pose.speed = 0;
      this.samples.length = 0;
      return;
    }

    // Clamp into the batting area (lower 3/4 of the screen).
    tipSX = clamp(tipSX, 20, DESIGN_WIDTH - 20);
    tipSY = clamp(tipSY, DESIGN_HEIGHT * 0.22, DESIGN_HEIGHT - 8);

    const tip = unprojectToPlane(tipSX, tipSY, BAT.hitPlaneZ);
    const base = unprojectToPlane(baseSX, baseSY, BAT.hitPlaneZ);

    // Keep the rendered bat a consistent world length along the finger axis.
    const dx = tip.x - base.x;
    const dy = tip.y - base.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    this.pose.tipX = tip.x;
    this.pose.tipY = tip.y;
    this.pose.baseX = tip.x - nx * BAT.lengthWorld;
    this.pose.baseY = tip.y - ny * BAT.lengthWorld;
    this.pose.active = active;

    // Sliding-window tip velocity.
    this.samples.push({ x: tip.x, y: tip.y, t: now });
    while (this.samples.length > 2 && now - this.samples[0].t > VELOCITY_WINDOW_MS) {
      this.samples.shift();
    }
    const first = this.samples[0];
    const dt = (now - first.t) / 1000;
    if (dt > 0.012) {
      this.pose.velX = (tip.x - first.x) / dt;
      this.pose.velY = (tip.y - first.y) / dt;
      this.pose.speed = Math.hypot(this.pose.velX, this.pose.velY);
    } else {
      this.pose.speed = 0;
    }
  }

  reset(): void {
    this.samples.length = 0;
    this.pose.speed = 0;
  }
}
