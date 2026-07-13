/**
 * Arcade-flavored 3D ball flight: gravity, quadratic air drag, ground
 * bounces, rolling friction, and outfield fence collisions. Simulated with
 * semi-implicit Euler in fixed sub-steps for frame-rate independence.
 */
import { BALL, FIELD } from '../game/config';
import { vec3, type Vec3 } from '../utils/math';

export type BallPhase = 'pitch' | 'flight' | 'rolling' | 'dead';

export interface FenceHit {
  pos: Vec3;
  /** True if the ball cleared the fence (home run) rather than striking it. */
  cleared: boolean;
}

/** Fence distance from home plate at a given horizontal angle (radians from center field). */
export function fenceDistanceAt(angle: number): number {
  // Blend from center-field depth to corner depth as we approach the foul lines.
  const t = Math.min(1, Math.abs(angle) / (Math.PI / 4));
  return FIELD.fenceCenter - (FIELD.fenceCenter - FIELD.fenceCorner) * t;
}

export class BallPhysics {
  readonly pos: Vec3 = vec3();
  readonly vel: Vec3 = vec3();
  phase: BallPhase = 'dead';
  /** Set on first ground contact after a hit. */
  landingPos: Vec3 | null = null;
  bounces = 0;
  /** Filled when the ball reaches the outfield fence. */
  fenceHit: FenceHit | null = null;
  /** Extra acceleration used for pitch break / knuckle wobble. */
  readonly accel: Vec3 = vec3();
  wobbleAmp = 0;
  private wobblePhase = 0;
  private time = 0;

  launch(pos: Vec3, vel: Vec3, phase: BallPhase): void {
    Object.assign(this.pos, pos);
    Object.assign(this.vel, vel);
    this.phase = phase;
    this.landingPos = null;
    this.fenceHit = null;
    this.bounces = 0;
    this.time = 0;
    this.wobblePhase = Math.random() * Math.PI * 2;
    // Callers that want break/wobble (pitches) set these after launch.
    this.accel.x = this.accel.y = this.accel.z = 0;
    this.wobbleAmp = 0;
  }

  kill(): void {
    this.phase = 'dead';
    this.vel.x = this.vel.y = this.vel.z = 0;
  }

  /** Advance by dt seconds. */
  update(dt: number): void {
    if (this.phase === 'dead') return;
    // Sub-step for stable collisions at high exit velocity.
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h);
  }

  private step(h: number): void {
    const { pos, vel } = this;
    this.time += h;

    if (this.phase === 'rolling') {
      // Decelerate along the ground until at rest.
      const speed = Math.hypot(vel.x, vel.z);
      if (speed < BALL.restSpeed) {
        this.kill();
        return;
      }
      const dec = BALL.rollFriction * h;
      const k = Math.max(0, speed - dec) / speed;
      vel.x *= k;
      vel.z *= k;
      pos.x += vel.x * h;
      pos.z += vel.z * h;
      this.checkFence();
      return;
    }

    // Airborne: gravity + drag + pitch break.
    const speed = Math.hypot(vel.x, vel.y, vel.z);
    const dragK = BALL.drag * speed;
    let ax = -dragK * vel.x + this.accel.x;
    let ay = BALL.gravity - dragK * vel.y + this.accel.y;
    const az = -dragK * vel.z + this.accel.z;
    if (this.wobbleAmp > 0) {
      ax += Math.sin(this.time * 9 + this.wobblePhase) * this.wobbleAmp;
      ay += Math.cos(this.time * 7 + this.wobblePhase * 1.7) * this.wobbleAmp * 0.7;
    }
    vel.x += ax * h;
    vel.y += ay * h;
    vel.z += az * h;
    pos.x += vel.x * h;
    pos.y += vel.y * h;
    pos.z += vel.z * h;

    if (this.phase === 'flight') this.checkFence();

    // Ground contact.
    if (pos.y <= BALL.radius && vel.y < 0) {
      pos.y = BALL.radius;
      if (this.phase === 'flight' && !this.landingPos) {
        this.landingPos = vec3(pos.x, 0, pos.z);
      }
      this.bounces += 1;
      vel.y = -vel.y * BALL.bounceRestitution;
      vel.x *= BALL.bounceFriction;
      vel.z *= BALL.bounceFriction;
      if (vel.y < 4 || this.bounces > 6) {
        vel.y = 0;
        this.phase = this.phase === 'pitch' ? 'dead' : 'rolling';
      }
    }
  }

  private checkFence(): void {
    const { pos, vel } = this;
    if (pos.z <= 10) return;
    const angle = Math.atan2(pos.x, pos.z);
    const dist = Math.hypot(pos.x, pos.z);
    const fenceDist = fenceDistanceAt(angle);
    if (dist < fenceDist) return;

    if (pos.y > FIELD.fenceHeight) {
      // Sailed over the wall — record once and let it fly into the stands.
      if (!this.fenceHit) {
        this.fenceHit = { pos: vec3(pos.x, pos.y, pos.z), cleared: true };
      }
      // The crowd "catches" it shortly after.
      if (dist > fenceDist + 60) this.kill();
      return;
    }

    // Bounce off the wall back into play.
    this.fenceHit ??= { pos: vec3(pos.x, pos.y, pos.z), cleared: false };
    const nx = -Math.sin(angle);
    const nz = -Math.cos(angle);
    const vDotN = vel.x * nx + vel.z * nz;
    if (vDotN < 0) {
      vel.x -= 2 * vDotN * nx * 0.55;
      vel.z -= 2 * vDotN * nz * 0.55;
      vel.x *= 0.8;
      vel.z *= 0.8;
    }
    const push = dist - fenceDist + 0.5;
    pos.x -= Math.sin(angle) * push;
    pos.z -= Math.cos(angle) * push;
  }
}
