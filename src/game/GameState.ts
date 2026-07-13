/**
 * Pure state container for one game session: score, count, outs, combo.
 * Emits events so the HUD and audio can react without coupling.
 */
import { SCORING } from './config';
import { events, GameEvent } from '../utils/events';

export class GameState {
  score = 0;
  balls = 0;
  strikes = 0;
  outs = 0;
  combo = 1;
  homeRuns = 0;
  hits = 0;
  swings = 0;
  perfectHits = 0;
  walks = 0;
  pitchCount = 0;
  longestHit = 0;
  bestCombo = 1;
  over = false;

  addScore(points: number, label: string, worldPos?: { x: number; y: number; z: number }): number {
    const total = Math.round(points * this.combo);
    this.score += total;
    events.emit(GameEvent.scored, { points: total, label, combo: this.combo, worldPos });
    return total;
  }

  bumpCombo(): void {
    this.combo = Math.min(SCORING.comboMax, this.combo + 1);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    events.emit(GameEvent.comboChanged, this.combo);
  }

  resetCombo(): void {
    if (this.combo !== 1) {
      this.combo = 1;
      events.emit(GameEvent.comboChanged, this.combo);
    }
  }

  /** Register a strike; returns true if it caused a strikeout. */
  addStrike(kind: 'swing' | 'looking' | 'foul'): boolean {
    if (kind === 'foul' && this.strikes >= 2) return false; // fouls can't strike out
    this.strikes += 1;
    events.emit(kind === 'foul' ? GameEvent.foul : GameEvent.strike, { kind });
    if (this.strikes >= 3) {
      this.strikes = 0;
      this.balls = 0;
      this.outs += 1;
      this.resetCombo();
      events.emit(GameEvent.strikeout, { outs: this.outs });
      if (this.outs >= 3) this.endGame();
      return true;
    }
    return false;
  }

  /** Register a ball; returns true if it caused a walk. */
  addBall(): boolean {
    this.balls += 1;
    events.emit(GameEvent.ball4, { balls: this.balls });
    if (this.balls >= 4) {
      this.balls = 0;
      this.strikes = 0;
      this.walks += 1;
      // A walk is a small consolation prize in arcade mode.
      this.addScore(SCORING.basePointsPerHit, 'WALK');
      events.emit(GameEvent.walk, {});
      return true;
    }
    return false;
  }

  /** Reset the count after a ball put in play. */
  clearCount(): void {
    this.balls = 0;
    this.strikes = 0;
  }

  private endGame(): void {
    if (this.over) return;
    this.over = true;
    events.emit(GameEvent.gameOver, { score: this.score });
  }
}
