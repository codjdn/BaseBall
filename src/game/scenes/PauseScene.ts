/**
 * Pause overlay launched on top of a paused GameScene: resume, full
 * settings panel, and quit-to-menu.
 */
import Phaser from 'phaser';
import { buildSettingsPanel } from '../../ui/SettingsPanel';
import { makeButton, makePanel, makeTitle } from '../../ui/UiKit';
import { audio } from '../../audio/AudioManager';
import { DEPTHS, DESIGN_HEIGHT, DESIGN_WIDTH, SCENES } from '../config';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    const cx = DESIGN_WIDTH / 2;
    const cy = DESIGN_HEIGHT / 2;

    this.add
      .rectangle(cx, cy, DESIGN_WIDTH, DESIGN_HEIGHT, 0x040a16, 0.72)
      .setDepth(DEPTHS.overlay - 1)
      .setInteractive(); // block clicks reaching the game

    makePanel(this, cx, cy, 1080, 620);
    makeTitle(this, cx, cy - 268, 'PAUSED', 40);

    // The panel background sits at DEPTHS.overlay; lift the controls above it.
    buildSettingsPanel(this, cx, cy - 10).setDepth(DEPTHS.overlay + 1);

    makeButton(this, cx - 150, cy + 262, 'RESUME', () => this.resume(), { width: 240, height: 54 });
    makeButton(
      this,
      cx + 150,
      cy + 262,
      'QUIT TO MENU',
      () => {
        audio.stopMusic();
        this.scene.stop(SCENES.hud);
        this.scene.stop(SCENES.game);
        this.scene.stop();
        this.scene.start(SCENES.menu);
      },
      { width: 240, height: 54, color: 0x24427a },
    );

    this.input.keyboard?.on('keydown-ESC', () => this.resume());
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume(SCENES.game);
  }
}
