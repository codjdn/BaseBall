/**
 * Camera setup & calibration: big live preview with the tracked fingertip,
 * a live bat preview you can waggle, plus sensitivity/mirroring/handedness
 * controls and camera switching. Reachable from the menu and pause screen.
 */
import Phaser from 'phaser';
import { Bat } from '../../entities/Bat';
import { BatInput } from '../../handtracking/BatInput';
import { cameraManager } from '../../handtracking/CameraManager';
import { handTracker } from '../../handtracking/HandTracker';
import { CameraPreview } from '../../ui/CameraPreview';
import { FONT, makeButton, makeSlider, makeToggle } from '../../ui/UiKit';
import { storage } from '../../utils/storage';
import { DEPTHS, DESIGN_HEIGHT, DESIGN_WIDTH, SCENES } from '../config';

export class CalibrationScene extends Phaser.Scene {
  private preview!: CameraPreview;
  private batInput!: BatInput;
  private bat!: Bat;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.calibration);
  }

  create(): void {
    this.add
      .rectangle(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT, 0x0b1c33)
      .setDepth(DEPTHS.sky);
    this.add
      .text(DESIGN_WIDTH / 2, 46, 'CAMERA SETUP', {
        fontFamily: FONT,
        fontSize: '34px',
        color: '#ffe66d',
        stroke: '#a3122b',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud);

    // Start the camera if it isn't running yet.
    if (!storage.settings.pointerMode && cameraManager.status !== 'running') {
      void cameraManager.start(storage.settings.cameraFacing).then((ok) => {
        if (ok) {
          void handTracker.load().then((loaded) => {
            if (loaded) handTracker.startDetection();
          });
        }
      });
    } else if (!storage.settings.pointerMode) {
      void handTracker.load().then((loaded) => {
        if (loaded) handTracker.startDetection();
      });
    }

    this.preview = new CameraPreview(this, DESIGN_WIDTH / 2, 200);
    this.batInput = new BatInput();
    this.bat = new Bat(this);

    this.hint = this.add
      .text(DESIGN_WIDTH / 2, 330, 'POINT YOUR INDEX FINGER AT THE CAMERA AND WAVE — THE BAT SHOULD FOLLOW', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#7dfaff',
        align: 'center',
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud);

    // Controls row.
    const cy = 420;
    makeSlider(this, 240, cy, 260, 'SENSITIVITY', (storage.settings.sensitivity - 0.5) / 1.5, (v) => {
      storage.updateSettings({ sensitivity: 0.5 + v * 1.5 });
    });
    makeToggle(this, 240, cy + 70, 'MIRROR CAMERA', storage.settings.mirrorCamera, (v) =>
      storage.updateSettings({ mirrorCamera: v }),
    );

    const handBtn = makeButton(
      this,
      640,
      cy,
      `HAND: ${storage.settings.handedness.toUpperCase()}`,
      () => {
        const next = storage.settings.handedness === 'right' ? 'left' : 'right';
        storage.updateSettings({ handedness: next });
        (handBtn.list[2] as Phaser.GameObjects.Text).setText(`HAND: ${next.toUpperCase()}`);
      },
      { width: 250, height: 46, fontSize: 16, color: 0x24427a },
    );
    makeButton(
      this,
      640,
      cy + 70,
      'SWITCH CAMERA',
      () => {
        void cameraManager.switchFacing().then((ok) => {
          if (ok) storage.updateSettings({ cameraFacing: cameraManager.facing });
        });
      },
      { width: 250, height: 46, fontSize: 16, color: 0x24427a },
    );
    makeToggle(this, 1040, cy, 'POINTER MODE (NO CAM)', storage.settings.pointerMode, (v) => {
      storage.updateSettings({ pointerMode: v });
    });

    makeButton(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT - 70, 'DONE', () => this.scene.start(SCENES.menu), {
      width: 240,
      height: 54,
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.batInput.setPointer(p.x, p.y));
  }

  override update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.preview.update();
    this.batInput.update();
    this.bat.update(this.batInput.pose, dt);

    if (storage.settings.pointerMode) {
      this.hint.setText('POINTER MODE: MOVE YOUR MOUSE OR FINGER ON SCREEN — THE BAT FOLLOWS');
    } else if (cameraManager.status === 'denied') {
      this.hint.setText('CAMERA PERMISSION DENIED — ALLOW ACCESS IN YOUR BROWSER, OR USE POINTER MODE');
    } else if (handTracker.pose.tracked) {
      this.hint.setText('TRACKING! SWING YOUR FINGER TO TEST THE BAT, THEN PRESS DONE');
    } else {
      this.hint.setText('POINT YOUR INDEX FINGER AT THE CAMERA AND WAVE — THE BAT SHOULD FOLLOW');
    }
  }
}
