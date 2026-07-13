/**
 * Visual representation of the baseball: perspective-scaled sprite, soft
 * ground shadow, spin, and a fading motion trail during fast flight.
 */
import Phaser from 'phaser';
import { BALL } from '../game/config';
import { BallPhysics } from '../physics/BallPhysics';
import { depthForZ, project, projectRadius } from '../physics/projection';
import { storage } from '../utils/storage';

const TRAIL_LEN = 9;

export class Ball {
  readonly physics = new BallPhysics();
  private sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Ellipse;
  private trail: Phaser.GameObjects.Image[] = [];
  private trailTint = 0xffffff;
  private spin = 0;
  private trailTick = 0;

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.ellipse(0, 0, 30, 12, 0x000000, 0.28).setVisible(false);
    this.sprite = scene.add.image(0, 0, 'ball').setVisible(false);
    for (let i = 0; i < TRAIL_LEN; i++) {
      this.trail.push(scene.add.image(0, 0, 'ball-glow').setVisible(false).setBlendMode(Phaser.BlendModes.ADD));
    }
  }

  get visible(): boolean {
    return this.sprite.visible;
  }

  setSpin(radPerSec: number): void {
    this.spin = radPerSec;
  }

  setTrailTint(color: number): void {
    this.trailTint = color;
  }

  show(): void {
    this.sprite.setVisible(true);
    this.shadow.setVisible(true);
  }

  hide(): void {
    this.sprite.setVisible(false);
    this.shadow.setVisible(false);
    for (const t of this.trail) t.setVisible(false);
  }

  update(dt: number): void {
    if (!this.sprite.visible) return;
    const { pos, vel } = this.physics;

    const p = project(pos.x, pos.y, pos.z);
    const r = Math.max(2.5, projectRadius(BALL.radius, pos.z));
    this.sprite.setPosition(p.x, p.y);
    this.sprite.setDisplaySize(r * 2, r * 2);
    this.sprite.setDepth(depthForZ(pos.z));
    this.sprite.rotation += this.spin * dt;

    const sh = project(pos.x, 0, pos.z);
    const shadowScale = Math.max(0.25, 1 - pos.y / 90);
    this.shadow.setPosition(sh.x, sh.y);
    this.shadow.setSize(r * 2.4 * shadowScale, r * 1.0 * shadowScale);
    this.shadow.setDepth(depthForZ(pos.z) - 1);
    this.shadow.setAlpha(0.3 * shadowScale);

    // Motion trail: leave ghosts behind when moving fast.
    const speed = Math.hypot(vel.x, vel.y, vel.z);
    const wantTrail = speed > 60 && this.physics.phase !== 'dead' && !storage.settings.reducedMotion;
    this.trailTick += dt;
    if (wantTrail && this.trailTick > 0.016) {
      this.trailTick = 0;
      const ghost = this.trail.shift()!;
      this.trail.push(ghost);
      ghost
        .setVisible(true)
        .setPosition(p.x, p.y)
        .setDisplaySize(r * 2.6, r * 2.6)
        .setDepth(depthForZ(pos.z) - 2)
        .setTint(this.trailTint)
        .setAlpha(0.5);
    }
    for (let i = 0; i < this.trail.length; i++) {
      const g = this.trail[i];
      if (g.visible) {
        g.setAlpha(g.alpha - dt * 2.6);
        if (g.alpha <= 0) g.setVisible(false);
      }
    }
  }
}
