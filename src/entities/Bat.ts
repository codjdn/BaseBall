/**
 * The finger bat. Rendered every frame with Graphics as a tapered capsule
 * between the projected grip and tip, with:
 *  - a glowing additive motion trail following the barrel
 *  - slight stretch along the swing direction at high speeds
 *  - skin colors from the equipped bat skin
 */
import Phaser from 'phaser';
import { BAT, BAT_SKINS, DEPTHS, type BatSkin } from '../game/config';
import type { BatPose } from '../handtracking/BatInput';
import { project } from '../physics/projection';
import { clamp, mapRange } from '../utils/math';
import { storage } from '../utils/storage';

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

const TRAIL_LIFE = 0.24;

export class Bat {
  private gfx: Phaser.GameObjects.Graphics;
  private trailGfx: Phaser.GameObjects.Graphics;
  private trail: TrailPoint[] = [];
  private skin: BatSkin;
  private rainbowHue = 0;

  constructor(scene: Phaser.Scene) {
    this.trailGfx = scene.add.graphics().setDepth(DEPTHS.batTrail).setBlendMode(Phaser.BlendModes.ADD);
    this.gfx = scene.add.graphics().setDepth(DEPTHS.bat);
    this.skin = this.resolveSkin();
  }

  refreshSkin(): void {
    this.skin = this.resolveSkin();
  }

  private resolveSkin(): BatSkin {
    return BAT_SKINS.find((s) => s.id === storage.settings.batSkin) ?? BAT_SKINS[0];
  }

  setVisible(v: boolean): void {
    this.gfx.setVisible(v);
    this.trailGfx.setVisible(v);
  }

  update(pose: BatPose, dt: number): void {
    const g = this.gfx;
    g.clear();
    if (!pose.active) {
      this.trail.length = 0;
      this.trailGfx.clear();
      return;
    }

    // Project the bat segment onto the screen at the hitting plane.
    const tip = project(pose.tipX, pose.tipY, BAT.hitPlaneZ);
    const base = project(pose.baseX, pose.baseY, BAT.hitPlaneZ);

    let dx = tip.x - base.x;
    let dy = tip.y - base.y;
    const len = Math.hypot(dx, dy) || 1;

    // Stretch with swing speed (squash-and-stretch juice).
    const stretch = storage.settings.reducedMotion
      ? 1
      : 1 + clamp(mapRange(pose.speed, BAT.swingSpeedMin, BAT.swingSpeedMax, 0, 0.22), 0, 0.22);
    dx = (dx / len) * len * stretch;
    dy = (dy / len) * len * stretch;
    const tx = base.x + dx;
    const ty = base.y + dy;

    // Rainbow skin cycles hue continuously.
    let barrel = this.skin.barrel;
    let trailColor = this.skin.trail;
    if (this.skin.id === 'rainbow') {
      this.rainbowHue = (this.rainbowHue + dt * 120) % 360;
      const c = Phaser.Display.Color.HSVToRGB(this.rainbowHue / 360, 0.75, 1) as Phaser.Display.Color;
      barrel = c.color;
      trailColor = c.color;
    }

    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle + Math.PI / 2);
    const ny = Math.sin(angle + Math.PI / 2);
    const wTip = 13; // barrel half-width, px
    const wBase = 6; // handle half-width

    // Soft glow behind the barrel.
    g.fillStyle(this.skin.glow, 0.22);
    g.fillCircle(tx, ty, wTip * 2.2);

    // Tapered bat body as a quad + rounded caps.
    g.fillStyle(barrel, 1);
    g.beginPath();
    g.moveTo(base.x + nx * wBase, base.y + ny * wBase);
    g.lineTo(tx + nx * wTip, ty + ny * wTip);
    g.lineTo(tx - nx * wTip, ty - ny * wTip);
    g.lineTo(base.x - nx * wBase, base.y - ny * wBase);
    g.closePath();
    g.fillPath();
    g.fillCircle(tx, ty, wTip);
    // Handle + knob.
    g.fillStyle(this.skin.handle, 1);
    g.fillCircle(base.x, base.y, wBase + 2);
    const knobX = base.x - Math.cos(angle) * 8;
    const knobY = base.y - Math.sin(angle) * 8;
    g.fillCircle(knobX, knobY, wBase + 1);
    // Highlight stripe for a rounded look.
    g.fillStyle(0xffffff, 0.28);
    g.fillCircle(tx - nx * wTip * 0.4, ty - ny * wTip * 0.4, wTip * 0.38);

    // --- Trail ------------------------------------------------------------
    if (!storage.settings.reducedMotion && pose.speed > BAT.swingSpeedMin * 0.6) {
      this.trail.push({ x: tx, y: ty, age: 0 });
    }
    for (const p of this.trail) p.age += dt;
    while (this.trail.length > 26 || (this.trail.length && this.trail[0].age > TRAIL_LIFE)) {
      this.trail.shift();
    }
    const t = this.trailGfx;
    t.clear();
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1];
      const b = this.trail[i];
      const alpha = (1 - b.age / TRAIL_LIFE) * 0.55;
      const width = (1 - b.age / TRAIL_LIFE) * wTip * 1.6 + 2;
      t.lineStyle(width, trailColor, alpha);
      t.beginPath();
      t.moveTo(a.x, a.y);
      t.lineTo(b.x, b.y);
      t.strokePath();
    }
  }
}
