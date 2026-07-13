/**
 * Smooth difficulty ramp. Level rises with pitches thrown (and a little with
 * score) from 0 to DIFFICULTY.maxLevel. All systems read derived scalars from
 * here instead of inventing their own curves.
 */
import { DIFFICULTY } from './config';
import { clamp, lerp } from '../utils/math';
import { events, GameEvent } from '../utils/events';

export class DifficultyManager {
  private pitches = 0;
  private levelValue = 0;

  get level(): number {
    return this.levelValue;
  }

  /** 0..1 normalized difficulty. */
  get t(): number {
    return this.levelValue / DIFFICULTY.maxLevel;
  }

  onPitchThrown(): void {
    this.pitches += 1;
    const next = clamp(this.pitches / DIFFICULTY.pitchesPerLevel, 0, DIFFICULTY.maxLevel);
    if (Math.floor(next) !== Math.floor(this.levelValue)) {
      events.emit(GameEvent.difficultyChanged, Math.floor(next));
    }
    this.levelValue = next;
  }

  /** Pitch flight time multiplier: pitches get faster as difficulty rises. */
  get pitchTimeScale(): number {
    return lerp(1.35, 0.82, this.t);
  }

  /** Multiplier on pitch movement (break) magnitude. */
  get movementScale(): number {
    return lerp(0.55, 1.5, this.t);
  }

  /** Fielder run speed in ft/s. */
  get fielderSpeed(): number {
    return lerp(14, 26, this.t);
  }

  /** Reaction delay before a fielder starts chasing (s). */
  get fielderReaction(): number {
    return lerp(0.55, 0.18, this.t);
  }

  /** Speed at which moving targets drift (ft/s). */
  get targetSpeed(): number {
    return lerp(0, 16, this.t);
  }

  /** Multiplier on target point values. */
  get targetValueScale(): number {
    return lerp(1, 2.2, this.t);
  }
}
