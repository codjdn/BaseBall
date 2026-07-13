/**
 * Animated jumbotron above center field. Shows the live score, count
 * lights, and flashes hype messages (HOME RUN!, JACKPOT!, etc.) reacting to
 * game events.
 */
import Phaser from 'phaser';
import { FIELD } from '../game/config';
import type { GameState } from '../game/GameState';
import { fenceDistanceAt } from '../physics/BallPhysics';
import { depthForZ, project } from '../physics/projection';
import { events, GameEvent } from '../utils/events';

export class Scoreboard {
  private container: Phaser.GameObjects.Container;
  private scoreText: Phaser.GameObjects.Text;
  private messageText: Phaser.GameObjects.Text;
  private lights: Phaser.GameObjects.Arc[] = [];
  private messageTimer = 0;
  private flashTween: Phaser.Tweens.Tween | null = null;

  constructor(
    private scene: Phaser.Scene,
    private state: GameState,
  ) {
    const anchor = project(0, 40, fenceDistanceAt(0) + 55);
    const depth = depthForZ(FIELD.fenceCenter + 50);

    const w = 240;
    const h = 110;
    const frame = scene.add.rectangle(0, 0, w + 12, h + 12, 0x10131f).setStrokeStyle(3, 0x2c3452);
    const screen = scene.add.rectangle(0, 0, w, h, 0x060a14);
    const legL = scene.add.rectangle(-w * 0.3, h * 0.75, 10, h * 0.5, 0x2c3452);
    const legR = scene.add.rectangle(w * 0.3, h * 0.75, 10, h * 0.5, 0x2c3452);

    const title = scene.add
      .text(0, -h / 2 + 13, 'FINGER FIELD', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '13px',
        color: '#ffe66d',
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    this.scoreText = scene.add
      .text(0, -6, '0', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '34px',
        color: '#7dfaff',
      })
      .setOrigin(0.5);

    this.messageText = scene.add
      .text(0, 30, 'PLAY BALL!', {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // B/S/O indicator lights along the bottom.
    const lightsRow = scene.add.container(0, h / 2 - 10);
    const labels = ['B', 'B', 'B', 'S', 'S', 'O', 'O', 'O'];
    labels.forEach((ch, i) => {
      const x = -84 + i * 24 + (i >= 3 ? 8 : 0) + (i >= 5 ? 8 : 0);
      const light = scene.add.circle(x, 0, 6, 0x223047);
      this.lights.push(light);
      lightsRow.add(light);
      lightsRow.add(
        scene.add
          .text(x, -13, ch, { fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#8fa3c8' })
          .setOrigin(0.5),
      );
    });

    this.container = scene.add
      .container(anchor.x, anchor.y, [legL, legR, frame, screen, title, this.scoreText, this.messageText, lightsRow])
      .setDepth(depth);

    this.handlers = [
      [GameEvent.homeRun, () => this.flash('HOME RUN!', '#ffd700')],
      [GameEvent.strikeout, () => this.flash('STRIKEOUT', '#ff5a5a')],
      [GameEvent.walk, () => this.flash('WALK', '#6db4ff')],
      [GameEvent.caught, () => this.flash('CAUGHT!', '#ffa54f')],
      [
        GameEvent.scored,
        (e: { points: number; label: string }) => {
          if (e.label === 'JACKPOT') this.flash('JACKPOT!!', '#ffd700');
          else if (e.points >= 500) this.flash(`+${e.points}!`, '#54e05e');
        },
      ],
    ];
    for (const [name, fn] of this.handlers) events.on(name, fn);
  }

  private handlers: Array<[string, (...args: never[]) => void]>;

  private flash(msg: string, color: string): void {
    this.messageText.setText(msg).setColor(color);
    this.messageTimer = 2.4;
    this.flashTween?.remove();
    this.messageText.setScale(1);
    this.flashTween = this.scene.tweens.add({
      targets: this.messageText,
      scale: { from: 1.5, to: 1 },
      duration: 320,
      ease: 'Back.easeOut',
    });
  }

  update(dt: number): void {
    this.scoreText.setText(`${this.state.score}`);

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) {
        this.messageText.setText(`COMBO x${this.state.combo}`).setColor('#8fa3c8');
      }
    }

    // Light up balls (blue), strikes (yellow), outs (red).
    const { balls, strikes, outs } = this.state;
    for (let i = 0; i < 3; i++) this.lights[i].setFillStyle(i < balls ? 0x6db4ff : 0x223047);
    for (let i = 0; i < 2; i++) this.lights[3 + i].setFillStyle(i < strikes ? 0xffe66d : 0x223047);
    for (let i = 0; i < 3; i++) this.lights[5 + i].setFillStyle(i < outs ? 0xff5a5a : 0x223047);

    // Subtle idle shimmer.
    this.container.alpha = 0.96 + Math.sin(performance.now() / 300) * 0.04;
  }

  destroy(): void {
    for (const [name, fn] of this.handlers) events.off(name, fn);
  }
}
