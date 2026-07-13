/**
 * Sky backdrop: vertical gradient, sun or moon, stars at night, and slowly
 * drifting procedural clouds. Supports day/night themes.
 */
import Phaser from 'phaser';
import { DEPTHS, DESIGN_HEIGHT, DESIGN_WIDTH } from '../game/config';
import { randRange } from '../utils/math';
import { storage } from '../utils/storage';

export type ThemeId = 'day' | 'night';

export function resolveTheme(): ThemeId {
  const pref = storage.settings.theme;
  if (pref !== 'auto') return pref;
  const hour = new Date().getHours();
  return hour >= 7 && hour < 19 ? 'day' : 'night';
}

export const THEME_COLORS = {
  day: {
    skyTop: 0x2d7dd2,
    skyBottom: 0x97d8f5,
    grass: 0x4caf50,
    grassDark: 0x3f9a44,
    dirt: 0xc98d5a,
    fence: 0x2b6e3f,
    stands: 0x39597e,
    cloudAlpha: 0.9,
  },
  night: {
    skyTop: 0x0a1033,
    skyBottom: 0x27356b,
    grass: 0x2e7d43,
    grassDark: 0x276b39,
    dirt: 0xa9744a,
    fence: 0x1d4f2e,
    stands: 0x232f4b,
    cloudAlpha: 0.35,
  },
} as const;

export class Sky {
  readonly theme: ThemeId;
  private clouds: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene) {
    this.theme = resolveTheme();
    const colors = THEME_COLORS[this.theme];

    // Gradient sky via a generated texture stretched full-screen.
    const skyKey = `sky-${this.theme}`;
    if (!scene.textures.exists(skyKey)) {
      const canvas = scene.textures.createCanvas(skyKey, 8, 128)!;
      const ctx = canvas.context;
      const grad = ctx.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, `#${colors.skyTop.toString(16).padStart(6, '0')}`);
      grad.addColorStop(1, `#${colors.skyBottom.toString(16).padStart(6, '0')}`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 8, 128);
      canvas.refresh();
    }
    scene.add
      .image(0, 0, skyKey)
      .setOrigin(0)
      .setDisplaySize(DESIGN_WIDTH, DESIGN_HEIGHT)
      .setDepth(DEPTHS.sky);

    // Sun / moon with a soft halo.
    const isDay = this.theme === 'day';
    const cx = isDay ? DESIGN_WIDTH * 0.78 : DESIGN_WIDTH * 0.22;
    const halo = scene.add.circle(cx, 92, 52, isDay ? 0xffe66d : 0xd8e6ff, 0.25).setDepth(DEPTHS.sky + 1);
    scene.add.circle(cx, 92, 30, isDay ? 0xffe66d : 0xe8efff, 1).setDepth(DEPTHS.sky + 2);
    scene.tweens.add({ targets: halo, scale: 1.15, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    if (!isDay) {
      for (let i = 0; i < 40; i++) {
        const star = scene.add
          .circle(randRange(0, DESIGN_WIDTH), randRange(0, 170), randRange(0.7, 1.8), 0xffffff, randRange(0.4, 0.95))
          .setDepth(DEPTHS.sky + 1);
        scene.tweens.add({
          targets: star,
          alpha: 0.15,
          duration: randRange(800, 2400),
          yoyo: true,
          repeat: -1,
          delay: randRange(0, 2000),
        });
      }
    }

    // Drifting clouds.
    for (let i = 0; i < 5; i++) {
      const cloud = scene.add
        .image(randRange(-100, DESIGN_WIDTH + 100), randRange(28, 150), 'cloud')
        .setDepth(DEPTHS.sky + 3)
        .setAlpha(colors.cloudAlpha * randRange(0.6, 1))
        .setScale(randRange(0.7, 1.5));
      this.clouds.push(cloud);
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.x += dt * (5 + i * 2.4);
      if (c.x > DESIGN_WIDTH + 140) c.x = -140;
    }
  }
}
