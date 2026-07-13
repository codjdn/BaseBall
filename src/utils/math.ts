/**
 * Small math helpers shared across systems. All angles are radians unless
 * a name says otherwise. World units are feet, world time is seconds.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential smoothing toward a target. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function len2(x: number, y: number): number {
  return Math.hypot(x, y);
}

/** Distance from point P to segment AB in 2D. */
export function pointSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq === 0 ? 0 : clamp(((px - ax) * abx + (py - ay) * aby) / lenSq, 0, 1);
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

/** Parameter t of the closest point on segment AB to point P (0 = A, 1 = B). */
export function pointSegmentT(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  return lenSq === 0 ? 0 : clamp(((px - ax) * abx + (py - ay) * aby) / lenSq, 0, 1);
}

export function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Map a value from one range to another, clamped to the output range. */
export function mapRange(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMax === inMin) return outMin;
  const t = clamp((v - inMin) / (inMax - inMin), 0, 1);
  return outMin + t * (outMax - outMin);
}

export const MPH_TO_FPS = 1.46667; // miles/hour -> feet/second
