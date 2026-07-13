/**
 * World <-> screen projection.
 *
 * The playfield lives in a right-handed pseudo-3D coordinate system measured
 * in feet:
 *   x: lateral (negative = third-base/left side, positive = first-base/right)
 *   y: height above the ground
 *   z: depth, 0 at home plate, increasing toward center field
 *
 * A virtual pinhole camera floats behind and above home plate looking out at
 * the field, which produces the classic arcade "behind the batter" isometric
 * feel: home plate large at the bottom, outfield fence small near the horizon.
 */
import { DESIGN_WIDTH } from '../game/config';
import type { Vec3 } from '../utils/math';

/** Camera height above ground (feet). */
const CAM_HEIGHT = 14;
/** Camera distance behind home plate (feet). */
const CAM_BACK = 26;
/** Focal length in pixels — tuned so the plate sits near the screen bottom. */
const FOCAL = 830;
/** Screen y of the optical horizon. */
const HORIZON_Y = 208;

const CX = DESIGN_WIDTH / 2;

export interface ScreenPoint {
  x: number;
  y: number;
  /** Perspective scale factor (1 at the plate, smaller further away). */
  scale: number;
  /** Camera-space depth, useful for z-sorting. */
  depth: number;
}

/** Project a world position to design-resolution screen coordinates. */
export function project(x: number, y: number, z: number): ScreenPoint {
  const d = z + CAM_BACK;
  const inv = FOCAL / d;
  return {
    x: CX + x * inv,
    y: HORIZON_Y + (CAM_HEIGHT - y) * inv,
    scale: inv / (FOCAL / CAM_BACK),
    depth: d,
  };
}

export function projectVec(p: Vec3): ScreenPoint {
  return project(p.x, p.y, p.z);
}

/**
 * Inverse-project a screen point onto the vertical plane z = planeZ.
 * Used to place the finger bat (screen-space input) into world space at the
 * hitting plane above home plate.
 */
export function unprojectToPlane(sx: number, sy: number, planeZ: number): { x: number; y: number } {
  const d = planeZ + CAM_BACK;
  return {
    x: ((sx - CX) * d) / FOCAL,
    y: CAM_HEIGHT - ((sy - HORIZON_Y) * d) / FOCAL,
  };
}

/** Screen-space radius of a sphere of world radius r at depth z. */
export function projectRadius(r: number, z: number): number {
  return (r * FOCAL) / (z + CAM_BACK);
}

/**
 * Depth-based display depth for Phaser z-ordering: objects nearer the camera
 * draw on top. Reserved bands below/above are used for the stadium and UI.
 */
export function depthForZ(z: number): number {
  return 1000 - z;
}
