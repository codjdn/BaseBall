/**
 * Tiny arcade-styled UI factory: buttons, panels, and title text used by
 * every menu scene, so styling stays consistent and touch targets stay big.
 */
import Phaser from 'phaser';
import { DEPTHS } from '../game/config';
import { audio } from '../audio/AudioManager';

export const FONT = '"Arial Black", "Verdana", Arial, sans-serif';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  color?: number;
  disabled?: boolean;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? 300;
  const h = opts.height ?? 58;
  const color = opts.color ?? 0xd7263d;

  const bg = scene.add
    .rectangle(0, 0, w, h, color, 1)
    .setStrokeStyle(4, 0xffffff, 0.9);
  const shadow = scene.add.rectangle(4, 6, w, h, 0x000000, 0.3);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize: `${opts.fontSize ?? 24}px`,
      color: '#ffffff',
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [shadow, bg, text]).setDepth(DEPTHS.overlay);
  container.setSize(w, h);
  if (opts.disabled) {
    container.setAlpha(0.45);
    return container;
  }
  container.setInteractive({ useHandCursor: true });
  container.on('pointerover', () => {
    audio.play('hover');
    scene.tweens.add({ targets: container, scale: 1.06, duration: 90 });
  });
  container.on('pointerout', () => scene.tweens.add({ targets: container, scale: 1, duration: 90 }));
  container.on('pointerdown', () => {
    audio.unlock();
    audio.play('click');
    scene.tweens.add({
      targets: container,
      scale: 0.94,
      duration: 70,
      yoyo: true,
      onComplete: onClick,
    });
  });
  return container;
}

export function makePanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
): Phaser.GameObjects.Container {
  const shadow = scene.add.rectangle(6, 8, w, h, 0x000000, 0.35);
  const bg = scene.add.rectangle(0, 0, w, h, 0x102243, 0.96).setStrokeStyle(4, 0x7dfaff, 0.7);
  return scene.add.container(x, y, [shadow, bg]).setDepth(DEPTHS.overlay);
}

export function makeTitle(scene: Phaser.Scene, x: number, y: number, label: string, size = 52): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, label, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color: '#ffe66d',
      stroke: '#a3122b',
      strokeThickness: 10,
      shadow: { offsetX: 0, offsetY: 6, color: '#00000088', blur: 0, fill: true },
    })
    .setOrigin(0.5)
    .setDepth(DEPTHS.overlay);
}

/** Simple labeled slider (0..1). Returns a container with a getter/setter. */
export function makeSlider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  label: string,
  initial: number,
  onChange: (v: number) => void,
): Phaser.GameObjects.Container {
  const text = scene.add
    .text(-width / 2, -26, label, { fontFamily: FONT, fontSize: '16px', color: '#ffffff' })
    .setOrigin(0, 0.5);
  const track = scene.add.rectangle(0, 0, width, 8, 0x223047).setStrokeStyle(2, 0x7dfaff, 0.5);
  const fill = scene.add.rectangle(-width / 2, 0, width * initial, 8, 0x7dfaff).setOrigin(0, 0.5);
  const knob = scene.add.circle(-width / 2 + width * initial, 0, 14, 0xffffff).setStrokeStyle(3, 0x7dfaff);

  const container = scene.add.container(x, y, [text, track, fill, knob]).setDepth(DEPTHS.overlay);
  container.setSize(width + 30, 44);
  container.setInteractive();

  const setFromPointer = (pointer: Phaser.Input.Pointer): void => {
    const local = (pointer.x - container.x) / width + 0.5;
    const v = Phaser.Math.Clamp(local, 0, 1);
    knob.x = -width / 2 + width * v;
    fill.width = width * v;
    onChange(v);
  };
  container.on('pointerdown', (p: Phaser.Input.Pointer) => {
    audio.unlock();
    setFromPointer(p);
  });
  container.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (p.isDown) setFromPointer(p);
  });
  return container;
}

/** Two-state toggle pill. */
export function makeToggle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  initial: boolean,
  onChange: (v: boolean) => void,
): Phaser.GameObjects.Container {
  const text = scene.add
    .text(-150, 0, label, { fontFamily: FONT, fontSize: '16px', color: '#ffffff' })
    .setOrigin(0, 0.5);
  const pill = scene.add.rectangle(150, 0, 64, 30, initial ? 0x54e05e : 0x44506e).setStrokeStyle(2, 0xffffff, 0.7);
  const dot = scene.add.circle(150 + (initial ? 15 : -15), 0, 12, 0xffffff);
  let value = initial;

  const container = scene.add.container(x, y, [text, pill, dot]).setDepth(DEPTHS.overlay);
  container.setSize(360, 40);
  container.setInteractive({ useHandCursor: true });
  container.on('pointerdown', () => {
    audio.unlock();
    audio.play('click');
    value = !value;
    pill.setFillStyle(value ? 0x54e05e : 0x44506e);
    scene.tweens.add({ targets: dot, x: 150 + (value ? 15 : -15), duration: 120, ease: 'Cubic.easeOut' });
    onChange(value);
  });
  return container;
}
