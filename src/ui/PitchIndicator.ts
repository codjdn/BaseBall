/**
 * Small animated badge showing the upcoming/current pitch type. Pulses
 * during the windup so the player learns to read pitches. Uses shape +
 * color so it stays readable for colorblind players (the name is written
 * out, and each pitch keeps a fixed position dot pattern).
 */
import Phaser from 'phaser';
import { DEPTHS } from '../game/config';
import type { PitchType } from '../pitching/PitchTypes';
import { FONT } from './UiKit';

export class PitchIndicator {
  private container: Phaser.GameObjects.Container;
  private nameText: Phaser.GameObjects.Text;
  private badge: Phaser.GameObjects.Arc;
  private arrow: Phaser.GameObjects.Text;
  private pulse: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const bg = scene.add.rectangle(0, 0, 210, 54, 0x102243, 0.92).setStrokeStyle(3, 0x7dfaff, 0.7);
    this.badge = scene.add.circle(-80, 0, 15, 0x54e05e).setStrokeStyle(3, 0xffffff, 0.9);
    this.nameText = scene.add
      .text(10, -9, 'READY', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5);
    this.arrow = scene.add
      .text(10, 13, '', { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#8fa3c8' })
      .setOrigin(0.5);
    this.container = scene.add.container(x, y, [bg, this.badge, this.nameText, this.arrow]).setDepth(DEPTHS.hud);
    this.container.setAlpha(0.9);
    this.sceneRef = scene;
  }

  private sceneRef: Phaser.Scene;

  /** Show the pitch during the windup. */
  showPitch(pitch: PitchType): void {
    this.nameText.setText(pitch.name);
    this.badge.setFillStyle(pitch.color);
    // Break direction hint (colorblind-safe: text arrows, not just color).
    const dirX = pitch.breakX > 3 ? '→' : pitch.breakX < -3 ? '←' : '';
    const dirY = pitch.breakY < -8 ? '↓' : pitch.breakY > 2 ? '↑' : '';
    const wob = pitch.wobble > 0 ? '~' : '';
    this.arrow.setText(`${wob}${dirX}${dirY}${wob}` || '•');
    this.pulse?.remove();
    this.container.setScale(1);
    this.pulse = this.sceneRef.tweens.add({
      targets: this.badge,
      scale: { from: 1.35, to: 1 },
      duration: 300,
      repeat: 3,
      ease: 'Quad.easeOut',
    });
  }

  clear(): void {
    this.nameText.setText('READY');
    this.arrow.setText('');
    this.badge.setFillStyle(0x54e05e);
  }
}
