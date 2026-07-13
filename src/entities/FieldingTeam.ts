/**
 * Manages the eight defensive players: assigns the closest fielder to chase
 * each batted ball, checks catch opportunities, and animates the throw back
 * to the pitcher after a play.
 */
import Phaser from 'phaser';
import { Fielder } from './Fielder';
import { BallPhysics } from '../physics/BallPhysics';
import { project, depthForZ } from '../physics/projection';
import { vec3, type Vec3 } from '../utils/math';
import { FIELD } from '../game/config';
import { events, GameEvent } from '../utils/events';
import { audio } from '../audio/AudioManager';

/** Defensive positions in world feet (x lateral, z depth). */
const POSITIONS: ReadonlyArray<{ name: string; x: number; z: number }> = [
  { name: '1B', x: 66, z: 72 },
  { name: '2B', x: 34, z: 118 },
  { name: 'SS', x: -34, z: 118 },
  { name: '3B', x: -66, z: 72 },
  { name: 'LF', x: -145, z: 235 },
  { name: 'CF', x: 0, z: 275 },
  { name: 'RF', x: 145, z: 235 },
  // The pitcher fields his position too (visual only; the Pitcher entity
  // handles pitching animation, this one stays hidden near the mound).
  { name: 'P', x: 14, z: 78 },
];

const CATCH_RADIUS = 5.5; // feet
const CATCH_MAX_HEIGHT = 11;

export class FieldingTeam {
  readonly fielders: Fielder[] = [];
  private chaser: Fielder | null = null;
  /** Only one catch attempt per play. */
  private catchArmed = false;

  constructor(private scene: Phaser.Scene) {
    for (const p of POSITIONS) {
      this.fielders.push(new Fielder(scene, p.name, p.x, p.z));
    }
  }

  /** Predict the landing point of a batted ball by cloning its physics. */
  static predictLanding(pos: Vec3, vel: Vec3): { landing: Vec3; time: number } {
    const sim = new BallPhysics();
    sim.launch(vec3(pos.x, pos.y, pos.z), vec3(vel.x, vel.y, vel.z), 'flight');
    let t = 0;
    while (sim.phase === 'flight' && !sim.landingPos && t < 12) {
      sim.update(1 / 30);
      t += 1 / 30;
    }
    return { landing: sim.landingPos ?? vec3(sim.pos.x, 0, sim.pos.z), time: t };
  }

  /** Called when the batter puts a ball in play. */
  onBallHit(ballPos: Vec3, ballVel: Vec3, speed: number, reaction: number): void {
    const { landing } = FieldingTeam.predictLanding(ballPos, ballVel);
    // Everyone flinches toward the ball; the closest gives chase.
    let best: Fielder | null = null;
    let bestDist = Infinity;
    for (const f of this.fielders) {
      const d = f.distanceTo(landing.x, landing.z);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    if (best && landing.z > 25) {
      best.chase(landing.x, landing.z, speed, reaction);
      this.chaser = best;
      this.catchArmed = true;
    }
  }

  /**
   * Per-frame catch check while the ball is in flight. Returns true if the
   * chaser caught it (ends the play with no points).
   */
  tryCatch(ball: BallPhysics): boolean {
    if (!this.catchArmed || !this.chaser || ball.phase !== 'flight') return false;
    if (ball.vel.y > 4) return false; // wait for the ball to come down
    if (ball.pos.y > CATCH_MAX_HEIGHT || ball.pos.y < 1) return false;
    const f = this.chaser;
    if (f.state !== 'chase' && f.state !== 'idle') return false;
    if (f.distanceTo(ball.pos.x, ball.pos.z) > CATCH_RADIUS) return false;

    this.catchArmed = false;
    f.didCatch();
    audio.play('catch');
    events.emit(GameEvent.caught, { fielder: f.name });
    return true;
  }

  /** After the ball dies (landed & rolled out), have the chaser collect it. */
  onPlayOver(ballPos: Vec3): void {
    this.catchArmed = false;
    if (this.chaser) {
      // If he's close to the dead ball, mime a pickup + throw to the mound.
      if (this.chaser.distanceTo(ballPos.x, ballPos.z) < 25) {
        this.chaser.pickUp();
        this.animateThrowBack(ballPos);
      } else {
        this.chaser.goHome();
      }
      this.chaser = null;
    }
    for (const f of this.fielders) f.goHome();
  }

  /** Everybody hops when the batter strikes out. */
  celebrate(): void {
    for (const f of this.fielders) f.didCatch();
  }

  /** Small ghost ball arcing from the fielder back to the mound. */
  private animateThrowBack(from: Vec3): void {
    const start = project(from.x, 2, from.z);
    const end = project(0, 5, FIELD.moundZ);
    const ghost = this.scene.add.image(start.x, start.y, 'ball').setDepth(depthForZ(from.z)).setScale(0.5);
    this.scene.tweens.add({
      targets: ghost,
      x: end.x,
      duration: 700,
      ease: 'Linear',
      onUpdate: (tw) => {
        const t = tw.progress;
        ghost.y = Phaser.Math.Linear(start.y, end.y, t) - Math.sin(t * Math.PI) * 60;
      },
      onComplete: () => {
        audio.play('catch', 0.4);
        ghost.destroy();
      },
    });
  }

  update(dt: number): void {
    for (const f of this.fielders) f.update(dt);
  }
}
