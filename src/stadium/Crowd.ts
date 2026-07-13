/**
 * The animated crowd: banks of colored dots in the stands beyond the fence.
 * Fans bob idly, and when something exciting happens (`cheer()`) they jump
 * in a stadium wave with confetti-bright enthusiasm.
 */
import Phaser from 'phaser';
import { FIELD } from '../game/config';
import { fenceDistanceAt } from '../physics/BallPhysics';
import { depthForZ, project } from '../physics/projection';
import { randPick, randRange } from '../utils/math';
import { THEME_COLORS, type ThemeId } from './Sky';

const FAN_COLORS = [0xff5a5a, 0xffe66d, 0x54e05e, 0x6db4ff, 0xc77dff, 0xff9ff3, 0xf4f6fb, 0xffa54f];

interface Fan {
  dot: Phaser.GameObjects.Arc;
  baseY: number;
  phase: number;
  jump: number;
}

export class Crowd {
  private fans: Fan[] = [];
  private time = 0;
  private excitement = 0;

  constructor(scene: Phaser.Scene, theme: ThemeId) {
    const colors = THEME_COLORS[theme];
    const depth = depthForZ(FIELD.fenceCenter + 40);

    // Stand structure: three tiers of bleachers hugging the fence arc.
    const stands = scene.add.graphics().setDepth(depth - 1);
    for (let tier = 0; tier < 3; tier++) {
      stands.fillStyle(colors.stands, 1 - tier * 0.14);
      stands.beginPath();
      let first = true;
      for (let a = -Math.PI / 3.2; a <= Math.PI / 3.2 + 0.001; a += Math.PI / 40) {
        const d = fenceDistanceAt(Math.max(-Math.PI / 4, Math.min(Math.PI / 4, a))) + 6 + tier * 26;
        const p = project(Math.sin(a) * d, FIELD.fenceHeight + 2 + tier * 9, Math.cos(a) * d);
        if (first) {
          stands.moveTo(p.x, p.y);
          first = false;
        } else stands.lineTo(p.x, p.y);
      }
      for (let a = Math.PI / 3.2; a >= -Math.PI / 3.2 - 0.001; a -= Math.PI / 40) {
        const d = fenceDistanceAt(Math.max(-Math.PI / 4, Math.min(Math.PI / 4, a))) + 6 + (tier + 1) * 26;
        const p = project(Math.sin(a) * d, FIELD.fenceHeight + 4 + (tier + 1) * 9, Math.cos(a) * d);
        stands.lineTo(p.x, p.y);
      }
      stands.closePath();
      stands.fillPath();
    }

    // Fans: dots along each tier.
    for (let tier = 0; tier < 3; tier++) {
      for (let a = -Math.PI / 3.4; a <= Math.PI / 3.4; a += Math.PI / randRange(52, 60)) {
        const d = fenceDistanceAt(Math.max(-Math.PI / 4, Math.min(Math.PI / 4, a))) + 14 + tier * 26;
        const p = project(
          Math.sin(a) * d,
          FIELD.fenceHeight + 5.5 + tier * 9 + randRange(-1, 1),
          Math.cos(a) * d,
        );
        const dot = scene.add.circle(p.x, p.y, randRange(2.2, 3.4), randPick(FAN_COLORS)).setDepth(depth);
        this.fans.push({ dot, baseY: p.y, phase: randRange(0, Math.PI * 2), jump: randRange(0.6, 1.4) });
      }
    }
  }

  /** Ramp up the crowd for a moment (0.5 = good hit, 1 = home run). */
  cheer(intensity = 0.6): void {
    this.excitement = Math.max(this.excitement, intensity);
  }

  update(dt: number): void {
    this.time += dt;
    this.excitement = Math.max(0, this.excitement - dt * 0.35);
    const idle = 0.8;
    const wave = this.excitement * 7;
    for (const f of this.fans) {
      const bob = Math.sin(this.time * (2 + this.excitement * 6) + f.phase) * (idle + wave * f.jump);
      f.dot.y = f.baseY - Math.max(0, bob);
    }
  }
}
