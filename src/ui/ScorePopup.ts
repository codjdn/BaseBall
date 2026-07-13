/**
 * Floating animated score popups ("+250", "PERFECT!", "JACKPOT!") that rise
 * from where the points were earned and fade out.
 */
import Phaser from 'phaser';
import { DEPTHS } from '../game/config';
import { FONT } from './UiKit';
import { storage } from '../utils/storage';

export function scorePopup(
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
  color = '#ffe66d',
  size = 30,
): void {
  const text = scene.add
    .text(x, y, message, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color,
      stroke: '#00204a',
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(DEPTHS.fx + 10)
    .setScale(0.3);

  const reduced = storage.settings.reducedMotion;
  scene.tweens.add({
    targets: text,
    scale: 1,
    duration: reduced ? 120 : 260,
    ease: 'Back.easeOut',
  });
  scene.tweens.add({
    targets: text,
    y: y - (reduced ? 30 : 80),
    alpha: 0,
    delay: 500,
    duration: reduced ? 300 : 700,
    ease: 'Quad.easeIn',
    onComplete: () => text.destroy(),
  });
}
