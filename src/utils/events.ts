/**
 * Global event bus decoupling gameplay systems from UI/audio.
 * Payload shapes are documented next to each event name.
 */
import Phaser from 'phaser';

export const GameEvent = {
  /** { type: PitchTypeId } — pitcher started the windup. */
  windupStart: 'windup-start',
  /** { type: PitchTypeId } — ball left the pitcher's hand. */
  pitchReleased: 'pitch-released',
  /** HitResult — bat met ball. */
  ballHit: 'ball-hit',
  /** { kind: 'swing' | 'looking' } — a strike was called. */
  strike: 'strike',
  ball4: 'ball-called',
  walk: 'walk',
  foul: 'foul',
  strikeout: 'strikeout',
  /** LandingResult — ball's first ground contact after a hit. */
  ballLanded: 'ball-landed',
  homeRun: 'home-run',
  /** { fielder: string } — a fielder caught the ball on the fly. */
  caught: 'caught',
  /** { points, label, combo, worldPos } — points awarded. */
  scored: 'scored',
  comboChanged: 'combo-changed',
  gameOver: 'game-over',
  difficultyChanged: 'difficulty-changed',
  /** { ok: boolean } — hand tracking availability changed. */
  trackingStatus: 'tracking-status',
  settingsChanged: 'settings-changed',
} as const;

export const events = new Phaser.Events.EventEmitter();
