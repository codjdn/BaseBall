/**
 * Title screen with the stadium as a living backdrop. Hosts the main menu
 * plus slide-in panels for settings, statistics, and bat skins.
 */
import Phaser from 'phaser';
import { audio } from '../../audio/AudioManager';
import { cameraManager } from '../../handtracking/CameraManager';
import { handTracker } from '../../handtracking/HandTracker';
import { Crowd } from '../../stadium/Crowd';
import { Sky } from '../../stadium/Sky';
import { Stadium } from '../../stadium/Stadium';
import { buildSettingsPanel } from '../../ui/SettingsPanel';
import { FONT, makeButton, makePanel, makeTitle } from '../../ui/UiKit';
import { storage } from '../../utils/storage';
import { BAT_SKINS, DEPTHS, DESIGN_HEIGHT, DESIGN_WIDTH, SCENES } from '../config';

type Panel = 'main' | 'settings' | 'stats' | 'skins';

export class MenuScene extends Phaser.Scene {
  private sky!: Sky;
  private crowd!: Crowd;
  private panels: Partial<Record<Panel, Phaser.GameObjects.Container>> = {};
  private statusText!: Phaser.GameObjects.Text;
  private starting = false;

  constructor() {
    super(SCENES.menu);
  }

  create(): void {
    this.starting = false;
    this.panels = {};
    this.sky = new Sky(this);
    new Stadium(this, this.sky.theme);
    this.crowd = new Crowd(this, this.sky.theme);
    this.crowd.cheer(0.4);

    // Dim the field slightly so menu text pops.
    this.add
      .rectangle(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT, 0x061022, 0.45)
      .setDepth(DEPTHS.hud - 1);

    this.buildMain();
    this.buildSettings();
    this.buildStats();
    this.buildSkins();
    this.showPanel('main');

    // First interaction unlocks audio + starts menu music.
    this.input.once('pointerdown', () => {
      audio.unlock();
      audio.startMusic();
    });
  }

  private buildMain(): void {
    const cx = DESIGN_WIDTH / 2;
    const root = this.add.container(0, 0).setDepth(DEPTHS.overlay);

    const title = makeTitle(this, cx, 130, 'FINGER BASEBALL', 64);
    const sub = this.add
      .text(cx, 188, '⚾ YOUR FINGER IS THE BAT ⚾', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#7dfaff',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.overlay);
    this.tweens.add({ targets: title, y: 122, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const best = storage.stats.bestScore;
    const hs = this.add
      .text(cx, 228, best > 0 ? `HIGH SCORE  ${best.toLocaleString()}` : 'SET THE FIRST HIGH SCORE!', {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#ffe66d',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.overlay);

    const playBtn = makeButton(this, cx, 310, '▶  PLAY', () => void this.startGame(false), {
      width: 340,
      height: 64,
      fontSize: 28,
    });
    const pointerBtn = makeButton(this, cx, 384, 'PLAY WITHOUT CAMERA', () => void this.startGame(true), {
      width: 340,
      height: 48,
      fontSize: 17,
      color: 0x24427a,
    });
    const calibBtn = makeButton(this, cx, 448, 'CAMERA SETUP', () => this.scene.start(SCENES.calibration), {
      width: 340,
      height: 48,
      fontSize: 17,
      color: 0x24427a,
    });

    const row = 512;
    const settingsBtn = makeButton(this, cx - 118, row, 'SETTINGS', () => this.showPanel('settings'), {
      width: 200,
      height: 46,
      fontSize: 16,
      color: 0x24427a,
    });
    const statsBtn = makeButton(this, cx + 118, row, 'STATS', () => this.showPanel('stats'), {
      width: 200,
      height: 46,
      fontSize: 16,
      color: 0x24427a,
    });
    const skinsBtn = makeButton(this, cx, row + 58, 'BAT SKINS', () => this.showPanel('skins'), {
      width: 200,
      height: 46,
      fontSize: 16,
      color: 0x24427a,
    });

    this.statusText = this.add
      .text(cx, 636, '', { fontFamily: FONT, fontSize: '15px', color: '#8fa3c8' })
      .setOrigin(0.5)
      .setDepth(DEPTHS.overlay);

    root.add([title, sub, hs, playBtn, pointerBtn, calibBtn, settingsBtn, statsBtn, skinsBtn, this.statusText]);
    this.panels.main = root;
  }

  private buildSettings(): void {
    const cx = DESIGN_WIDTH / 2;
    const cy = DESIGN_HEIGHT / 2;
    const root = this.add.container(0, 0).setDepth(DEPTHS.overlay).setVisible(false);
    root.add(makePanel(this, cx, cy, 1060, 560));
    root.add(makeTitle(this, cx, cy - 236, 'SETTINGS', 36));
    root.add(buildSettingsPanel(this, cx, cy + 20));
    root.add(makeButton(this, cx, cy + 240, 'BACK', () => this.showPanel('main'), { width: 200, height: 46 }));
    this.panels.settings = root;
  }

  private buildStats(): void {
    const cx = DESIGN_WIDTH / 2;
    const cy = DESIGN_HEIGHT / 2;
    const root = this.add.container(0, 0).setDepth(DEPTHS.overlay).setVisible(false);
    root.add(makePanel(this, cx, cy, 760, 560));
    root.add(makeTitle(this, cx, cy - 236, 'STATISTICS', 36));

    const s = storage.stats;
    const swingRate = s.swings > 0 ? Math.round((s.hits / s.swings) * 100) : 0;
    const lines: Array<[string, string]> = [
      ['Games played', `${s.gamesPlayed}`],
      ['High score', s.bestScore.toLocaleString()],
      ['Total points', s.totalScore.toLocaleString()],
      ['Hits', `${s.hits}`],
      ['Swings', `${s.swings}  (${swingRate}% contact)`],
      ['Home runs', `${s.homeRuns}`],
      ['Perfect hits', `${s.perfectHits}`],
      ['Longest hit', `${Math.round(s.longestHit)} ft`],
      ['Best combo', `x${s.bestCombo}`],
      ['Strikeouts', `${s.strikeouts}`],
      ['Walks', `${s.walks}`],
    ];
    lines.forEach(([k, v], i) => {
      const y = cy - 180 + i * 34;
      root.add(
        this.add
          .text(cx - 300, y, k.toUpperCase(), { fontFamily: FONT, fontSize: '16px', color: '#8fa3c8' })
          .setOrigin(0, 0.5)
          .setDepth(DEPTHS.overlay),
      );
      root.add(
        this.add
          .text(cx + 300, y, v, { fontFamily: FONT, fontSize: '16px', color: '#ffffff' })
          .setOrigin(1, 0.5)
          .setDepth(DEPTHS.overlay),
      );
    });
    root.add(makeButton(this, cx, cy + 240, 'BACK', () => this.showPanel('main'), { width: 200, height: 46 }));
    this.panels.stats = root;
  }

  private buildSkins(): void {
    const cx = DESIGN_WIDTH / 2;
    const cy = DESIGN_HEIGHT / 2;
    const root = this.add.container(0, 0).setDepth(DEPTHS.overlay).setVisible(false);
    root.add(makePanel(this, cx, cy, 900, 560));
    root.add(makeTitle(this, cx, cy - 236, 'BAT SKINS', 36));

    const best = storage.stats.bestScore;
    BAT_SKINS.forEach((skin, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = cx - 270 + col * 270;
      const y = cy - 110 + row * 190;
      const unlocked = best >= skin.unlockScore;
      const equipped = storage.settings.batSkin === skin.id;

      const card = this.add
        .rectangle(x, y, 230, 150, 0x16294d, 1)
        .setStrokeStyle(4, equipped ? 0xffe66d : 0x2c3452)
        .setDepth(DEPTHS.overlay);
      // Mini bat preview.
      const bat = this.add.graphics().setDepth(DEPTHS.overlay);
      bat.fillStyle(unlocked ? skin.barrel : 0x44506e, 1);
      bat.fillRoundedRect(x - 60, y - 36, 120, 20, 10);
      bat.fillStyle(unlocked ? skin.handle : 0x333d55, 1);
      bat.fillRoundedRect(x - 92, y - 32, 36, 12, 6);
      const name = this.add
        .text(x, y + 12, skin.name.toUpperCase(), { fontFamily: FONT, fontSize: '15px', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(DEPTHS.overlay);
      const sub = this.add
        .text(
          x,
          y + 42,
          unlocked ? (equipped ? 'EQUIPPED' : 'TAP TO EQUIP') : `UNLOCK: ${skin.unlockScore.toLocaleString()} PTS`,
          {
            fontFamily: FONT,
            fontSize: '12px',
            color: unlocked ? (equipped ? '#ffe66d' : '#54e05e') : '#8fa3c8',
          },
        )
        .setOrigin(0.5)
        .setDepth(DEPTHS.overlay);

      if (unlocked) {
        card.setInteractive({ useHandCursor: true });
        card.on('pointerdown', () => {
          audio.play('click');
          storage.updateSettings({ batSkin: skin.id });
          // Rebuild the panel to refresh equipped highlights.
          this.panels.skins?.destroy();
          this.buildSkins();
          this.showPanel('skins');
        });
      }
      root.add([card, bat, name, sub]);
    });

    root.add(makeButton(this, cx, cy + 240, 'BACK', () => this.showPanel('main'), { width: 200, height: 46 }));
    this.panels.skins = root;
  }

  private showPanel(which: Panel): void {
    for (const [name, panel] of Object.entries(this.panels)) {
      panel.setVisible(name === which);
      if (name === which) {
        panel.setAlpha(0);
        this.tweens.add({ targets: panel, alpha: 1, duration: 180 });
      }
    }
  }

  /** Start the game, spinning up the camera + tracker unless in pointer mode. */
  private async startGame(pointerMode: boolean): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    audio.unlock();
    audio.startMusic();
    storage.updateSettings({ pointerMode });

    if (!pointerMode) {
      this.statusText.setText('STARTING CAMERA…');
      const [camOk, trackOk] = await Promise.all([
        cameraManager.status === 'running' ? Promise.resolve(true) : cameraManager.start(storage.settings.cameraFacing),
        handTracker.load(),
      ]);
      if (!camOk || !trackOk) {
        this.statusText.setText(
          camOk
            ? 'HAND TRACKING FAILED TO LOAD — CHECK CONNECTION, OR PLAY WITHOUT CAMERA'
            : 'CAMERA UNAVAILABLE OR DENIED — TRY "PLAY WITHOUT CAMERA"',
        );
        this.starting = false;
        return;
      }
      handTracker.startDetection();
    }

    this.cameras.main.fadeOut(300, 6, 16, 34);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(SCENES.game));
  }

  override update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.sky.update(dt);
    this.crowd.update(dt);
  }
}
