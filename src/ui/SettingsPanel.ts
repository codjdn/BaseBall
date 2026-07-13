/**
 * Reusable settings panel (used by the menu and the pause screen):
 * volumes, sensitivity, handedness, camera preview/mirroring, theme,
 * reduced motion, colorblind mode, and camera switching.
 */
import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { cameraManager } from '../handtracking/CameraManager';
import { storage } from '../utils/storage';
import { events, GameEvent } from '../utils/events';
import { FONT, makeButton, makeSlider, makeToggle } from './UiKit';

export function buildSettingsPanel(scene: Phaser.Scene, cx: number, cy: number): Phaser.GameObjects.Container {
  const s = storage.settings;
  const root = scene.add.container(cx, cy);
  const col1 = -230;
  const col2 = 230;
  let y1 = -170;
  let y2 = -170;

  const add = (obj: Phaser.GameObjects.Container): void => {
    root.add(obj);
  };

  add(
    makeSlider(scene, col1, y1, 280, 'SFX VOLUME', s.sfxVolume, (v) => {
      storage.updateSettings({ sfxVolume: v });
      audio.applyVolumes();
    }),
  );
  y1 += 74;
  add(
    makeSlider(scene, col1, y1, 280, 'MUSIC VOLUME', s.musicVolume, (v) => {
      storage.updateSettings({ musicVolume: v });
      audio.applyVolumes();
    }),
  );
  y1 += 74;
  add(
    makeSlider(scene, col1, y1, 280, 'SWING SENSITIVITY', (s.sensitivity - 0.5) / 1.5, (v) => {
      storage.updateSettings({ sensitivity: 0.5 + v * 1.5 });
    }),
  );
  y1 += 74;

  // Handedness selector.
  const handText = scene.add
    .text(col1 - 140, y1, 'BATTING HAND', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' })
    .setOrigin(0, 0.5);
  root.add(scene.add.container(0, 0, [handText]));
  const handBtn = makeButton(
    scene,
    col1 + 80,
    y1,
    s.handedness.toUpperCase(),
    () => {
      const next = storage.settings.handedness === 'right' ? 'left' : 'right';
      storage.updateSettings({ handedness: next });
      (handBtn.list[2] as Phaser.GameObjects.Text).setText(next.toUpperCase());
      events.emit(GameEvent.settingsChanged, {});
    },
    { width: 130, height: 42, fontSize: 17, color: 0x24427a },
  );
  add(handBtn);
  y1 += 74;

  // Theme selector.
  const themeBtn = makeButton(
    scene,
    col1,
    y1,
    `THEME: ${s.theme.toUpperCase()}`,
    () => {
      const order = ['auto', 'day', 'night'] as const;
      const next = order[(order.indexOf(storage.settings.theme) + 1) % order.length];
      storage.updateSettings({ theme: next });
      (themeBtn.list[2] as Phaser.GameObjects.Text).setText(`THEME: ${next.toUpperCase()}`);
    },
    { width: 280, height: 42, fontSize: 16, color: 0x24427a },
  );
  add(themeBtn);

  add(
    makeToggle(scene, col2, y2, 'CAMERA PREVIEW', s.showCameraPreview, (v) => {
      storage.updateSettings({ showCameraPreview: v });
      events.emit(GameEvent.settingsChanged, {});
    }),
  );
  y2 += 56;
  add(
    makeToggle(scene, col2, y2, 'MIRROR CAMERA', s.mirrorCamera, (v) => {
      storage.updateSettings({ mirrorCamera: v });
    }),
  );
  y2 += 56;
  add(
    makeToggle(scene, col2, y2, 'REDUCED MOTION', s.reducedMotion, (v) => {
      storage.updateSettings({ reducedMotion: v });
    }),
  );
  y2 += 56;
  add(
    makeToggle(scene, col2, y2, 'COLORBLIND COLORS', s.colorblind, (v) => {
      storage.updateSettings({ colorblind: v });
    }),
  );
  y2 += 56;
  add(
    makeToggle(scene, col2, y2, 'POINTER MODE (NO CAM)', s.pointerMode, (v) => {
      storage.updateSettings({ pointerMode: v });
      events.emit(GameEvent.settingsChanged, {});
    }),
  );
  y2 += 56;

  const switchBtn = makeButton(
    scene,
    col2,
    y2 + 8,
    'SWITCH CAMERA',
    () => {
      void cameraManager.switchFacing().then((ok) => {
        if (ok) storage.updateSettings({ cameraFacing: cameraManager.facing });
      });
    },
    { width: 240, height: 42, fontSize: 16, color: 0x24427a },
  );
  add(switchBtn);

  return root;
}
