/**
 * Bat-ball contact resolution. Converts a swing (bat segment + tip velocity)
 * and the incoming ball position into an outgoing velocity vector plus a
 * quality judgment used for scoring and effects.
 *
 * Design goals:
 *  - timing (ball depth vs. the ideal contact plane) dominates direction
 *  - barrel contact (near the bat tip) dominates power
 *  - swing speed dominates exit velocity
 *  - hitting under/over the ball controls launch angle (pop fly vs. grounder)
 */
import { BAT } from '../game/config';
import { clamp, mapRange, pointSegmentDistance, pointSegmentT, vec3, type Vec3 } from '../utils/math';
import type { BatPose } from '../handtracking/BatInput';

export type HitQuality = 'perfect' | 'solid' | 'good' | 'weak';

export interface HitResult {
  quality: HitQuality;
  /** Outgoing velocity, world ft/s. */
  velocity: Vec3;
  exitVelocity: number;
  /** Degrees above horizontal. */
  launchAngle: number;
  /** Degrees off center field (negative = left/third-base side). */
  sprayAngle: number;
  /** True when |spray| exceeds fair territory. */
  foul: boolean;
  /** World-space contact point (for sparks). */
  contact: Vec3;
  /** 0..1 normalized swing power at contact. */
  power: number;
}

/** Is the ball currently touchable by the bat segment? */
export function checkContact(bat: BatPose, ballX: number, ballY: number): boolean {
  return (
    pointSegmentDistance(ballX, ballY, bat.baseX, bat.baseY, bat.tipX, bat.tipY) <=
    BAT.contactRadius
  );
}

export function resolveContact(
  bat: BatPose,
  ballPos: Vec3,
  ballVel: Vec3,
): HitResult {
  // Where along the bat did we make contact? (1 = tip / barrel end)
  const t = pointSegmentT(ballPos.x, ballPos.y, bat.baseX, bat.baseY, bat.tipX, bat.tipY);
  const cx = bat.baseX + (bat.tipX - bat.baseX) * t;
  const cy = bat.baseY + (bat.tipY - bat.baseY) * t;

  // --- Quality components ------------------------------------------------
  // Timing: how close is the ball to the ideal contact depth?
  const timingErr = clamp(
    Math.abs(ballPos.z - BAT.hitPlaneZ) / (BAT.hitZoneFar - BAT.hitPlaneZ),
    0,
    1,
  );
  // Sweet spot lives at ~78% of the way to the barrel end.
  const sweetErr = clamp(Math.abs(t - 0.78) / 0.5, 0, 1);
  // Swing power from tip speed.
  const power = clamp(
    (bat.speed - BAT.swingSpeedMin) / (BAT.swingSpeedMax - BAT.swingSpeedMin),
    0,
    1,
  );

  const qualityScore = (1 - 0.55 * timingErr - 0.45 * sweetErr) * (0.5 + 0.5 * power);
  const quality: HitQuality =
    timingErr < 0.22 && sweetErr < 0.35 && power > 0.5
      ? 'perfect'
      : qualityScore > 0.55
        ? 'solid'
        : qualityScore > 0.34
          ? 'good'
          : 'weak';

  // --- Exit velocity ------------------------------------------------------
  const incoming = Math.hypot(ballVel.x, ballVel.y, ballVel.z);
  const exitVelocity = clamp(
    BAT.exitVeloMin +
      (BAT.exitVeloMax - BAT.exitVeloMin) * power * (0.45 + 0.55 * clamp(qualityScore, 0, 1)) +
      incoming * 0.12, // a bit of the pitch speed reflects back
    BAT.exitVeloMin * 0.6,
    BAT.exitVeloMax,
  );

  // --- Direction ----------------------------------------------------------
  const speed = Math.max(bat.speed, 1);
  // Horizontal swing direction pushes the ball to that side; timing shifts it
  // further (early = pulled, late = sliced the other way).
  const swingDirX = bat.velX / speed;
  const timingShift = ((ballPos.z - BAT.hitPlaneZ) / BAT.hitZoneFar) * 30;
  let sprayAngle = swingDirX * 52 + timingShift * (swingDirX >= 0 ? 1 : -1);
  // Weak contact sprays unpredictably.
  if (quality === 'weak') sprayAngle += (Math.random() - 0.5) * 50;
  sprayAngle = clamp(sprayAngle, -78, 78);
  const foul = Math.abs(sprayAngle) > 45;

  // Vertical: hitting under the ball lofts it, over the ball chops it down,
  // and an uppercut swing (positive world velY) adds launch.
  const underOffset = clamp((ballPos.y - cy) / BAT.contactRadius, -1, 1);
  let launchAngle =
    12 + underOffset * 26 + clamp(bat.velY / speed, -1, 1) * 24 + (quality === 'perfect' ? 6 : 0);
  if (quality === 'weak') launchAngle += (Math.random() - 0.5) * 30;
  launchAngle = clamp(launchAngle, -12, 62);

  const spray = (sprayAngle * Math.PI) / 180;
  const launch = (launchAngle * Math.PI) / 180;
  const velocity = vec3(
    exitVelocity * Math.sin(spray) * Math.cos(launch),
    exitVelocity * Math.sin(launch),
    exitVelocity * Math.cos(spray) * Math.cos(launch),
  );

  return {
    quality,
    velocity,
    exitVelocity,
    launchAngle,
    sprayAngle,
    foul,
    contact: vec3(cx, cy, ballPos.z),
    power,
  };
}

/** Human-readable contact category, used for popups and stats. */
export function describeHit(result: HitResult): string {
  if (result.foul) return 'FOUL';
  if (result.quality === 'weak') return result.launchAngle < 8 ? 'WEAK GROUNDER' : 'BLOOPER';
  if (result.launchAngle < 8) return 'GROUND BALL';
  if (result.launchAngle < 22) return 'LINE DRIVE';
  if (result.launchAngle < 42) return mapRange(result.exitVelocity, 0, 180, 0, 1) > 0.6 ? 'DEEP FLY' : 'FLY BALL';
  return 'POP FLY';
}
