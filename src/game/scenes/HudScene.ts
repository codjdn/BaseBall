/**
 * Heads-up display running in parallel with GameScene: score, high score,
 * count (balls/strikes/outs), combo meter, pitch indicator, home run tally,
 * wind readout, camera preview, tracking warnings, and the pause button.
 */
import Phaser from 'phaser';
import type { GameScene } from './GameScene';
import type { GameState } from '../GameState';
import { DEPTHS, DESIGN_HEIGHT, DESIGN_WIDTH, FEEDBACK_COLORS, SCENES } from '../config';
import { CameraPreview } from '../../ui/CameraPreview';
import { PitchIndicator } from '../../ui/PitchIndicator';
import { WindIndicator } from '../../ui/WindIndicator';
import { FONT, makeButton } from '../../ui/UiKit';
import { events, GameEvent } from '../../utils/events';
import { storage } from '../../utils/storage';
import type { PitchType } from '../../pitching/PitchTypes';

export class HudScene extends Phaser.Scene {
  private state!: GameState;
  private gameScene!: GameScene;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private hrText!: Phaser.GameObjects.Text;
  private countDots: Phaser.GameObjects.Arc[] = [];
  private pitchIndicator!: PitchIndicator;
  private preview!: CameraPreview;
  private trackingWarning!: Phaser.GameObjects.Container;
  private handlers: Array<[string, (...args: never[]) => void]> = [];

  constructor() {
    super(SCENES.hud);
  }

  create(data: { state: GameState; wind: { x: number; z: number }; gameScene: GameScene }): void {
    this.state = data.state;
    this.gameScene = data.gameScene;
    this.countDots = [];

    // --- Top-left: score block ---------------------------------------------
    this.add
      .rectangle(16, 16, 300, 118, 0x102243, 0.92)
      .setOrigin(0)
      .setStrokeStyle(3, 0x7dfaff, 0.7)
      .setDepth(DEPTHS.hud);
    this.add
      .text(32, 30, 'SCORE', { fontFamily: FONT, fontSize: '13px', color: '#8fa3c8' })
      .setDepth(DEPTHS.hud + 1);
    this.scoreText = this.add
      .text(32, 48, '0', { fontFamily: FONT, fontSize: '38px', color: '#ffffff' })
      .setDepth(DEPTHS.hud + 1);
    this.add
      .text(32, 98, `BEST ${storage.stats.bestScore.toLocaleString()}`, {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffe66d',
      })
      .setDepth(DEPTHS.hud + 1);

    this.comboText = this.add
      .text(300, 62, '', { fontFamily: FONT, fontSize: '24px', color: '#7dfaff' })
      .setOrigin(1, 0.5)
      .setDepth(DEPTHS.hud + 1);
    this.hrText = this.add
      .text(300, 104, '', { fontFamily: FONT, fontSize: '14px', color: '#ff9ff3' })
      .setOrigin(1, 0.5)
      .setDepth(DEPTHS.hud + 1);

    // --- Top-center: balls/strikes/outs -------------------------------------
    this.buildCountDisplay();

    // --- Top-right: pitch indicator + wind + pause ---------------------------
    this.pitchIndicator = new PitchIndicator(this, DESIGN_WIDTH - 130, 46);
    new WindIndicator(this, DESIGN_WIDTH - 84, 106, data.wind.x, data.wind.z);
    makeButton(this, DESIGN_WIDTH - 262, 106, '⏸', () => this.gameScene.pauseGame(), {
      width: 52,
      height: 46,
      fontSize: 20,
      color: 0x24427a,
    }).setDepth(DEPTHS.hud + 2);

    // --- Bottom-left: camera preview ------------------------------------------
    this.preview = new CameraPreview(this, 112, DESIGN_HEIGHT - 100);
    this.preview.setVisible(storage.settings.showCameraPreview && !storage.settings.pointerMode);

    // --- Tracking-lost warning --------------------------------------------------
    const warnBg = this.add.rectangle(0, 0, 460, 54, 0xa3122b, 0.92).setStrokeStyle(3, 0xffffff, 0.9);
    const warnText = this.add
      .text(0, 0, '✋ SHOW YOUR HAND TO THE CAMERA', { fontFamily: FONT, fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5);
    this.trackingWarning = this.add
      .container(DESIGN_WIDTH / 2, 128, [warnBg, warnText])
      .setDepth(DEPTHS.hud + 3)
      .setVisible(false);

    // --- Event wiring --------------------------------------------------------------
    this.handlers = [
      [GameEvent.windupStart, (e: { type: PitchType }) => this.pitchIndicator.showPitch(e.type)],
      [
        GameEvent.trackingStatus,
        (e: { ok: boolean }) => {
          if (!storage.settings.pointerMode) this.trackingWarning.setVisible(!e.ok);
        },
      ],
      [
        GameEvent.settingsChanged,
        () => {
          this.preview.setVisible(storage.settings.showCameraPreview && !storage.settings.pointerMode);
          if (storage.settings.pointerMode) this.trackingWarning.setVisible(false);
        },
      ],
      [
        GameEvent.comboChanged,
        (combo: number) => {
          if (combo > 1) {
            this.tweens.add({ targets: this.comboText, scale: { from: 1.5, to: 1 }, duration: 250, ease: 'Back.easeOut' });
          }
        },
      ],
    ];
    for (const [name, fn] of this.handlers) events.on(name, fn);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const [name, fn] of this.handlers) events.off(name, fn);
      this.preview.destroy();
    });
  }

  private buildCountDisplay(): void {
    const cx = DESIGN_WIDTH / 2;
    this.add
      .rectangle(cx, 44, 320, 60, 0x102243, 0.92)
      .setStrokeStyle(3, 0x7dfaff, 0.7)
      .setDepth(DEPTHS.hud);

    const groups: Array<[string, number, number]> = [
      ['B', 3, cx - 118],
      ['S', 2, cx - 8],
      ['O', 3, cx + 84],
    ];
    for (const [label, count, gx] of groups) {
      this.add
        .text(gx - 18, 44, label, { fontFamily: FONT, fontSize: '20px', color: '#8fa3c8' })
        .setOrigin(0.5)
        .setDepth(DEPTHS.hud + 1);
      for (let i = 0; i < count; i++) {
        const dot = this.add
          .circle(gx + 8 + i * 24, 44, 8, 0x223047)
          .setStrokeStyle(2, 0x44506e)
          .setDepth(DEPTHS.hud + 1);
        this.countDots.push(dot);
      }
    }
  }

  override update(): void {
    const s = this.state;
    this.scoreText.setText(s.score.toLocaleString());
    this.comboText.setText(s.combo > 1 ? `x${s.combo}` : '');
    this.hrText.setText(s.homeRuns > 0 ? `${s.homeRuns} HR` : '');

    // Colorblind-aware count lights: balls also differ by stroke.
    const colors = storage.settings.colorblind ? FEEDBACK_COLORS.colorblind : FEEDBACK_COLORS.normal;
    for (let i = 0; i < 3; i++) this.countDots[i].setFillStyle(i < s.balls ? colors.ball : 0x223047);
    for (let i = 0; i < 2; i++) this.countDots[3 + i].setFillStyle(i < s.strikes ? colors.perfect : 0x223047);
    for (let i = 0; i < 3; i++) this.countDots[5 + i].setFillStyle(i < s.outs ? colors.foul : 0x223047);

    this.preview.update();
  }
}
