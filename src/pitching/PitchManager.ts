/**
 * Chooses pitches (weighted by difficulty), aims them at or near the strike
 * zone, and solves the initial velocity so that — even with break
 * acceleration and wobble — the ball crosses the plate at the intended spot
 * after the intended flight time.
 */
import { FIELD, STRIKE_ZONE } from '../game/config';
import type { DifficultyManager } from '../game/DifficultyManager';
import type { BallPhysics } from '../physics/BallPhysics';
import { randPick, randRange, vec3, type Vec3 } from '../utils/math';
import { PITCH_TYPES, type PitchType } from './PitchTypes';

export interface PitchPlan {
  type: PitchType;
  /** Where the ball should cross the plate plane (z = 0). */
  target: Vec3;
  /** True if the target is inside the strike zone. */
  inZone: boolean;
  flightTime: number;
  release: Vec3;
  velocity: Vec3;
  accel: Vec3;
  wobble: number;
}

export class PitchManager {
  constructor(private difficulty: DifficultyManager) {}

  /** Pick the next pitch and pre-solve its trajectory. */
  plan(): PitchPlan {
    const level = this.difficulty.level;
    const available = PITCH_TYPES.filter((p) => p.minLevel <= level);
    const pool: PitchType[] = [];
    for (const p of available) for (let i = 0; i < p.weight * 2; i++) pool.push(p);
    const type = randPick(pool);

    // Aim: mostly strikes, with more painting-the-corners at high level.
    const zoneChance = 0.68 - this.difficulty.t * 0.12;
    const inZone = Math.random() < zoneChance;
    const target = inZone
      ? vec3(
          randRange(-STRIKE_ZONE.halfWidth * 0.85, STRIKE_ZONE.halfWidth * 0.85),
          randRange(STRIKE_ZONE.bottom + 0.3, STRIKE_ZONE.top - 0.3),
          0,
        )
      : this.ballTarget();

    const flightTime = type.flightTime * this.difficulty.pitchTimeScale;
    const release = vec3(randRange(-0.8, 0.8), FIELD.pitchReleaseY, FIELD.pitchReleaseZ);

    // Break acceleration, scaled with difficulty.
    const ms = this.difficulty.movementScale;
    const accel = vec3(type.breakX * ms, type.breakY * ms, 0);
    // Gravity is handled by BallPhysics; `accel` here is the *extra* break.
    // Solve initial velocity so pos(T) = target given constant accel + gravity:
    //   v = (target - release - 0.5*(a+g)*T^2) / T
    // Drag is small over 60 ft; the tiny undershoot it causes reads as natural.
    const g = -32.2;
    const T = flightTime;
    const velocity = vec3(
      (target.x - release.x - 0.5 * accel.x * T * T) / T,
      (target.y - release.y - 0.5 * (accel.y + g) * T * T) / T,
      (target.z - release.z) / T,
    );

    return {
      type,
      target,
      inZone,
      flightTime,
      release,
      velocity,
      accel,
      wobble: type.wobble * ms,
    };
  }

  /** A tempting ball just outside the zone. */
  private ballTarget(): Vec3 {
    const edge = Math.random();
    if (edge < 0.4) {
      // Off the plate horizontally.
      const side = Math.random() < 0.5 ? -1 : 1;
      return vec3(
        side * randRange(STRIKE_ZONE.halfWidth + 0.5, STRIKE_ZONE.halfWidth + 1.8),
        randRange(STRIKE_ZONE.bottom, STRIKE_ZONE.top),
        0,
      );
    }
    if (edge < 0.7) {
      // In the dirt.
      return vec3(randRange(-1.5, 1.5), randRange(0.2, STRIKE_ZONE.bottom - 0.4), 0);
    }
    // High cheese.
    return vec3(randRange(-1.5, 1.5), randRange(STRIKE_ZONE.top + 0.5, STRIKE_ZONE.top + 1.6), 0);
  }

  /** Configure the live ball physics for this pitch at the release moment. */
  release(plan: PitchPlan, ball: BallPhysics): void {
    ball.launch(plan.release, plan.velocity, 'pitch');
    ball.accel.x = plan.accel.x;
    ball.accel.y = plan.accel.y;
    ball.accel.z = 0;
    ball.wobbleAmp = plan.wobble;
  }
}
