/**
 * Wind sock readout: an arrow whose direction/length shows the game's
 * current wind, which gently pushes fly balls. Purely informational.
 */
import Phaser from 'phaser';
import { DEPTHS } from '../game/config';
import { FONT } from './UiKit';

export class WindIndicator {
  private arrow: Phaser.GameObjects.Triangle;

  constructor(scene: Phaser.Scene, x: number, y: number, windX: number, windZ: number) {
    scene.add.rectangle(x, y, 120, 46, 0x102243, 0.92).setStrokeStyle(3, 0x7dfaff, 0.7).setDepth(DEPTHS.hud);
    scene.add
      .text(x - 44, y, 'WIND', { fontFamily: FONT, fontSize: '11px', color: '#8fa3c8' })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud + 1);

    const speed = Math.hypot(windX, windZ);
    // Screen-space arrow: +x wind blows right, +z wind blows "up" (out).
    const angle = Math.atan2(-windZ, windX);
    this.arrow = scene.add
      .triangle(x + 10, y, 0, -8, 16, 0, 0, 8, 0x7dfaff)
      .setDepth(DEPTHS.hud + 1)
      .setRotation(angle)
      .setScale(0.7 + Math.min(1, speed / 12) * 0.8);
    scene.add
      .text(x + 40, y, `${Math.round(speed)}`, { fontFamily: FONT, fontSize: '15px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud + 1);

    scene.tweens.add({
      targets: this.arrow,
      scaleY: this.arrow.scaleY * 0.85,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
