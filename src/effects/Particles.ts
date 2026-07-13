/**
 * Particle helpers built on Phaser's emitter API and the tiny procedural
 * textures generated in BootScene ('px-circle', 'px-soft'). Every burst is
 * fire-and-forget; emitters are pooled by Phaser internally.
 */
import Phaser from 'phaser';
import { DEPTHS } from '../game/config';
import { storage } from '../utils/storage';

export class Particles {
  constructor(private scene: Phaser.Scene) {}

  private get mult(): number {
    return storage.settings.reducedMotion ? 0.35 : 1;
  }

  /** Contact sparks at bat-ball impact. */
  sparks(x: number, y: number, tint = 0xffe066, count = 18): void {
    const emitter = this.scene.add.particles(x, y, 'px-circle', {
      speed: { min: 140, max: 460 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      lifespan: { min: 160, max: 420 },
      tint,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    emitter.setDepth(DEPTHS.fx);
    emitter.explode(Math.round(count * this.mult));
    this.scene.time.delayedCall(600, () => emitter.destroy());
  }

  /** Dust puff for bounces, slides, and fielder skids. */
  dust(x: number, y: number, scale = 1): void {
    const emitter = this.scene.add.particles(x, y, 'px-soft', {
      speed: { min: 20, max: 90 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.7 * scale, end: 1.4 * scale },
      alpha: { start: 0.5, end: 0 },
      lifespan: { min: 250, max: 550 },
      tint: 0xcbb491,
      emitting: false,
    });
    emitter.setDepth(DEPTHS.fx);
    emitter.explode(Math.round(8 * this.mult));
    this.scene.time.delayedCall(700, () => emitter.destroy());
  }

  /** Celebration confetti (home runs, jackpots). */
  confetti(x: number, y: number, count = 60): void {
    const emitter = this.scene.add.particles(x, y, 'px-square', {
      speedX: { min: -260, max: 260 },
      speedY: { min: -420, max: -120 },
      gravityY: 600,
      rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.4 },
      lifespan: { min: 900, max: 1700 },
      tint: [0xff5a5a, 0xffe66d, 0x54e05e, 0x6db4ff, 0xc77dff, 0xff9ff3],
      emitting: false,
    });
    emitter.setDepth(DEPTHS.fx);
    emitter.explode(Math.round(count * this.mult));
    this.scene.time.delayedCall(1900, () => emitter.destroy());
  }

  /** Ring pulse when a target is hit. */
  ringPulse(x: number, y: number, tint: number, radius = 26): void {
    const ring = this.scene.add.circle(x, y, radius, tint, 0);
    ring.setStrokeStyle(5, tint, 0.95).setDepth(DEPTHS.fx).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: ring,
      scale: 3.2,
      alpha: 0,
      duration: storage.settings.reducedMotion ? 250 : 480,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
}
