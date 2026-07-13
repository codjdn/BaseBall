/**
 * The six pitch types. Movement is modeled as a constant lateral/vertical
 * acceleration applied during flight (plus wobble for the knuckleball);
 * PitchManager solves the initial velocity so the ball still arrives at the
 * intended target, which keeps every pitch hittable but visually distinct.
 */

export type PitchTypeId = 'fastball' | 'curveball' | 'slider' | 'changeup' | 'knuckleball' | 'sinker';

export interface PitchType {
  id: PitchTypeId;
  name: string;
  /** Display color for the pitch indicator. */
  color: number;
  /** Base flight time from release to plate in seconds (lower = faster). */
  flightTime: number;
  /** Lateral acceleration ft/s^2 (positive = toward first base). */
  breakX: number;
  /** Extra vertical acceleration ft/s^2 (negative = extra sink). */
  breakY: number;
  /** Random per-axis wobble amplitude (knuckleball). */
  wobble: number;
  /** Minimum difficulty level before this pitch enters the mix. */
  minLevel: number;
  /** Relative selection weight. */
  weight: number;
  /** Visual spin speed for the ball sprite (rad/s). */
  spin: number;
}

export const PITCH_TYPES: readonly PitchType[] = [
  {
    id: 'fastball',
    name: 'FASTBALL',
    color: 0xff5a5a,
    flightTime: 0.95,
    breakX: 0,
    breakY: 4, // slight "rise" illusion
    wobble: 0,
    minLevel: 0,
    weight: 4,
    spin: 28,
  },
  {
    id: 'changeup',
    name: 'CHANGEUP',
    color: 0x54e05e,
    flightTime: 1.28,
    breakX: 0,
    breakY: -6,
    wobble: 0,
    minLevel: 1,
    weight: 3,
    spin: 10,
  },
  {
    id: 'curveball',
    name: 'CURVEBALL',
    color: 0x6db4ff,
    flightTime: 1.22,
    breakX: -9,
    breakY: -16,
    wobble: 0,
    minLevel: 2,
    weight: 3,
    spin: 20,
  },
  {
    id: 'sinker',
    name: 'SINKER',
    color: 0xffa54f,
    flightTime: 1.02,
    breakX: 4,
    breakY: -14,
    wobble: 0,
    minLevel: 3,
    weight: 3,
    spin: 24,
  },
  {
    id: 'slider',
    name: 'SLIDER',
    color: 0xc77dff,
    flightTime: 1.05,
    breakX: 13,
    breakY: -6,
    wobble: 0,
    minLevel: 4,
    weight: 3,
    spin: 32,
  },
  {
    id: 'knuckleball',
    name: 'KNUCKLEBALL',
    color: 0xffe66d,
    flightTime: 1.35,
    breakX: 0,
    breakY: -4,
    wobble: 11,
    minLevel: 5,
    weight: 2,
    spin: 2,
  },
];

export function pitchTypeById(id: PitchTypeId): PitchType {
  return PITCH_TYPES.find((p) => p.id === id) ?? PITCH_TYPES[0];
}
