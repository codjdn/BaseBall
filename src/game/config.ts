/**
 * Global tuning constants and shared enums for the whole game.
 * Keeping every magic number here makes balancing a one-file job.
 */

export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

/** Rendering depth bands (Phaser `depth`). World objects use depthForZ(). */
export const DEPTHS = {
  sky: -100,
  stadium: -50,
  targetsGround: -20,
  // world band: ~600 (deep outfield) .. ~1030 (plate area)
  batTrail: 1040,
  bat: 1050,
  fx: 1100,
  hud: 2000,
  overlay: 3000,
} as const;

/** Field geometry (feet). */
export const FIELD = {
  moundZ: 60.5,
  moundHeight: 0.9,
  pitchReleaseY: 5.6,
  pitchReleaseZ: 55,
  /** Distance to the outfield fence at center field. */
  fenceCenter: 380,
  /** Distance to the fence at the foul lines. */
  fenceCorner: 320,
  fenceHeight: 10,
  /** Infield dirt radius from the plate. */
  infieldRadius: 105,
  baseDist: 90,
} as const;

/** Ball physics (feet, seconds). */
export const BALL = {
  radius: 0.7, // exaggerated for arcade readability
  gravity: -32.2,
  /** Quadratic air drag coefficient (1/ft). */
  drag: 0.0011,
  bounceRestitution: 0.48,
  bounceFriction: 0.72,
  rollFriction: 14, // ft/s^2 deceleration while rolling
  restSpeed: 2.5,
} as const;

/** Bat & contact tuning. */
export const BAT = {
  lengthWorld: 3.4, // feet
  radiusWorld: 0.45,
  contactRadius: 1.25, // bat radius + ball radius + arcade forgiveness
  /** Minimum tip speed (ft/s) for a movement to count as a swing. */
  swingSpeedMin: 16,
  /** Tip speed that maps to maximum power. */
  swingSpeedMax: 95,
  exitVeloMin: 55, // ft/s
  exitVeloMax: 178,
  hitPlaneZ: 1.2, // ideal contact depth
  hitZoneNear: -2.5,
  hitZoneFar: 5.0,
} as const;

/** Strike zone in world feet at the plate. */
export const STRIKE_ZONE = {
  halfWidth: 1.6,
  bottom: 1.4,
  top: 4.6,
} as const;

/** Scoring values. */
export const SCORING = {
  basePointsPerHit: 25,
  homeRunBase: 500,
  perfectBonus: 150,
  distanceBonusPerFoot: 0.6, // beyond 250 ft
  comboMax: 8,
  jackpot: 2500,
} as const;

/** Difficulty ramp: level grows with pitches thrown, capped. */
export const DIFFICULTY = {
  maxLevel: 10,
  pitchesPerLevel: 4,
} as const;

export type Handedness = 'left' | 'right';

export type BatSkinId = 'wood' | 'neon' | 'fire' | 'ice' | 'gold' | 'rainbow';

export interface BatSkin {
  id: BatSkinId;
  name: string;
  /** Score needed (lifetime best) to unlock. 0 = always available. */
  unlockScore: number;
  barrel: number;
  handle: number;
  trail: number;
  glow: number;
}

export const BAT_SKINS: readonly BatSkin[] = [
  { id: 'wood', name: 'Classic Wood', unlockScore: 0, barrel: 0xd9a35c, handle: 0x8a5a2b, trail: 0xffe9b0, glow: 0xffd27f },
  { id: 'neon', name: 'Neon Slugger', unlockScore: 2000, barrel: 0x37f4ff, handle: 0x1465b4, trail: 0x7dfaff, glow: 0x37f4ff },
  { id: 'fire', name: 'Heater', unlockScore: 5000, barrel: 0xff7a29, handle: 0x992e12, trail: 0xffb257, glow: 0xff5a1f },
  { id: 'ice', name: 'Frostbite', unlockScore: 9000, barrel: 0xbfefff, handle: 0x5f9dc9, trail: 0xe4fbff, glow: 0x9fdcff },
  { id: 'gold', name: 'Gold Glove', unlockScore: 14000, barrel: 0xffd94a, handle: 0xb98f1d, trail: 0xfff2a8, glow: 0xffdf6b },
  { id: 'rainbow', name: 'Prismatic', unlockScore: 20000, barrel: 0xff6ad5, handle: 0x7a3cff, trail: 0xffffff, glow: 0xff9ff3 },
];

/** Colorblind-safe accent colors used for scoring/judgment feedback. */
export const FEEDBACK_COLORS = {
  normal: { perfect: 0xffd700, good: 0x54e05e, weak: 0xffa54f, foul: 0xff5a5a, ball: 0x6db4ff },
  colorblind: { perfect: 0xffd700, good: 0x56b4e9, weak: 0xe69f00, foul: 0xcc79a7, ball: 0x0072b2 },
} as const;

export const SCENES = {
  boot: 'BootScene',
  menu: 'MenuScene',
  calibration: 'CalibrationScene',
  game: 'GameScene',
  hud: 'HudScene',
  pause: 'PauseScene',
  gameOver: 'GameOverScene',
} as const;
