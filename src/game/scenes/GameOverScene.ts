/**
 * End-of-game results: final score with a count-up, new-record celebration,
 * this game's stats, and replay / menu buttons.
 */
import Phaser from 'phaser';
import { audio } from '../../audio/AudioManager';
import { Particles } from '../../effects/Particles';
import { FONT, makeButton, makePanel, makeTitle } from '../../ui/UiKit';
import { storage } from '../../utils/storage';
import { DEPTHS, DESIGN_HEIGHT, DESIGN_WIDTH, SCENES } from '../config';

interface GameOverData {
  score: number;
  stats: {
    hits: number;
    swings: number;
    homeRuns: number;
    perfectHits: number;
    bestCombo: number;
    longestHit: number;
    pitches: number;
    walks: number;
  };
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SCENES.gameOver);
  }

  create(data: GameOverData): void {
    const cx = DESIGN_WIDTH / 2;
    const cy = DESIGN_HEIGHT / 2;
    const isRecord = storage.recordGame(data.score);
    storage.updateStats({ bestCombo: Math.max(storage.stats.bestCombo, data.stats.bestCombo) });

    this.add.rectangle(cx, cy, DESIGN_WIDTH, DESIGN_HEIGHT, 0x0b1c33).setDepth(DEPTHS.sky);
    makePanel(this, cx, cy, 780, 620);
    makeTitle(this, cx, cy - 258, 'GAME OVER', 44);

    // Score count-up.
    const scoreText = this.add
      .text(cx, cy - 170, '0', { fontFamily: FONT, fontSize: '58px', color: '#7dfaff' })
      .setOrigin(0.5)
      .setDepth(DEPTHS.overlay);
    this.tweens.addCounter({
      from: 0,
      to: data.score,
      duration: 1100,
      ease: 'Cubic.easeOut',
      onUpdate: (tw) => scoreText.setText(Math.round(tw.getValue() ?? 0).toLocaleString()),
    });

    if (isRecord && data.score > 0) {
      const record = this.add
        .text(cx, cy - 110, '★ NEW HIGH SCORE! ★', { fontFamily: FONT, fontSize: '24px', color: '#ffd700' })
        .setOrigin(0.5)
        .setDepth(DEPTHS.overlay);
      this.tweens.add({ targets: record, scale: 1.12, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      new Particles(this).confetti(cx, cy - 220, 120);
      audio.play('jackpot');
    } else {
      this.add
        .text(cx, cy - 110, `BEST  ${storage.stats.bestScore.toLocaleString()}`, {
          fontFamily: FONT,
          fontSize: '20px',
          color: '#ffe66d',
        })
        .setOrigin(0.5)
        .setDepth(DEPTHS.overlay);
    }

    const s = data.stats;
    const contact = s.swings > 0 ? Math.round((s.hits / s.swings) * 100) : 0;
    const lines: Array<[string, string]> = [
      ['HITS', `${s.hits}`],
      ['HOME RUNS', `${s.homeRuns}`],
      ['PERFECT HITS', `${s.perfectHits}`],
      ['BEST COMBO', `x${s.bestCombo}`],
      ['LONGEST HIT', `${Math.round(s.longestHit)} FT`],
      ['CONTACT RATE', `${contact}%`],
      ['PITCHES SEEN', `${s.pitches}`],
      ['WALKS', `${s.walks}`],
    ];
    lines.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = cx - 330 + col * 340;
      const y = cy - 46 + row * 44;
      this.add
        .text(x, y, k, { fontFamily: FONT, fontSize: '15px', color: '#8fa3c8' })
        .setOrigin(0, 0.5)
        .setDepth(DEPTHS.overlay);
      this.add
        .text(x + 300, y, v, { fontFamily: FONT, fontSize: '15px', color: '#ffffff' })
        .setOrigin(1, 0.5)
        .setDepth(DEPTHS.overlay);
    });

    makeButton(this, cx - 150, cy + 240, 'PLAY AGAIN', () => this.scene.start(SCENES.game), {
      width: 250,
      height: 56,
    });
    makeButton(this, cx + 150, cy + 240, 'MENU', () => this.scene.start(SCENES.menu), {
      width: 250,
      height: 56,
      color: 0x24427a,
    });
  }
}
