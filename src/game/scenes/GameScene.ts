/**
 * The gameplay scene: owns the pitch/hit/score loop state machine and every
 * world entity. UI lives in the parallel HudScene; communication happens
 * through the global event bus and a shared GameState instance.
 *
 * Play loop:
 *   waiting -> windup -> pitch (ball inbound, swing window) ->
 *     hit  -> live ball (fielders, targets, fence) -> resolve -> waiting
 *     miss -> strike/ball call                                -> waiting
 *   three outs -> game over
 */
import Phaser from 'phaser';
import { audio } from '../../audio/AudioManager';
import { Ball } from '../../entities/Ball';
import { Bat } from '../../entities/Bat';
import { FieldingTeam } from '../../entities/FieldingTeam';
import { Pitcher } from '../../entities/Pitcher';
import { TargetManager } from '../../entities/Targets';
import { Effects } from '../../effects/Effects';
import { Particles } from '../../effects/Particles';
import { BatInput } from '../../handtracking/BatInput';
import { checkContact, describeHit, resolveContact, type HitResult } from '../../physics/ContactModel';
import { depthForZ, project } from '../../physics/projection';
import type { PitchPlan } from '../../pitching/PitchManager';
import { PitchManager } from '../../pitching/PitchManager';
import { Crowd } from '../../stadium/Crowd';
import { Scoreboard } from '../../stadium/Scoreboard';
import { Sky } from '../../stadium/Sky';
import { Stadium } from '../../stadium/Stadium';
import { scorePopup } from '../../ui/ScorePopup';
import { events, GameEvent } from '../../utils/events';
import { clamp, randRange, vec3 } from '../../utils/math';
import { storage } from '../../utils/storage';
import { BAT, FEEDBACK_COLORS, SCENES, SCORING, STRIKE_ZONE } from '../config';
import { DifficultyManager } from '../DifficultyManager';
import { GameState } from '../GameState';

type Phase = 'waiting' | 'windup' | 'pitch' | 'live' | 'resolving' | 'over';

export class GameScene extends Phaser.Scene {
  readonly state = new GameState();
  readonly difficulty = new DifficultyManager();

  private sky!: Sky;
  private crowd!: Crowd;
  private scoreboard!: Scoreboard;
  private pitcher!: Pitcher;
  private team!: FieldingTeam;
  private targets!: TargetManager;
  private ball!: Ball;
  private bat!: Bat;
  private batInput!: BatInput;
  private fx!: Effects;
  private particles!: Particles;
  private pitchManager!: PitchManager;

  private phase: Phase = 'waiting';
  private phaseTimer = 0;
  private currentPitch: PitchPlan | null = null;
  private swungThisPitch = false;
  private hitResult: HitResult | null = null;
  private scoredThisPlay = false;
  private homeRunAnnounced = false;
  private wind = { x: 0, z: 0 };

  constructor() {
    super(SCENES.game);
  }

  create(): void {
    // Fresh state each run (Phaser reuses scene instances on restart).
    Object.assign(this, { phase: 'waiting', phaseTimer: 0.8, currentPitch: null, hitResult: null });
    (this as { state: GameState }).state = new GameState();
    (this as { difficulty: DifficultyManager }).difficulty = new DifficultyManager();

    this.sky = new Sky(this);
    new Stadium(this, this.sky.theme);
    this.crowd = new Crowd(this, this.sky.theme);
    this.scoreboard = new Scoreboard(this, this.state);
    this.pitcher = new Pitcher(this);
    this.team = new FieldingTeam(this);
    this.targets = new TargetManager(this, this.difficulty);
    this.ball = new Ball(this);
    this.bat = new Bat(this);
    this.batInput = new BatInput();
    this.fx = new Effects(this);
    this.particles = new Particles(this);
    this.pitchManager = new PitchManager(this.difficulty);

    // Per-game wind, gently pushing fly balls.
    this.wind.x = randRange(-7, 7);
    this.wind.z = randRange(-4, 9);

    this.drawStrikeZone();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.batInput.setPointer(p.x, p.y));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.batInput.setPointer(p.x, p.y));

    this.scene.launch(SCENES.hud, { state: this.state, wind: this.wind, gameScene: this });

    this.cameras.main.fadeIn(300, 6, 16, 34);

    events.once(GameEvent.gameOver, this.onGameOver, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scoreboard.destroy();
      this.targets.destroy();
      events.off(GameEvent.gameOver, this.onGameOver, this);
    });
  }

  /** Faint strike-zone guide floating over the plate. */
  private drawStrikeZone(): void {
    const tl = project(-STRIKE_ZONE.halfWidth, STRIKE_ZONE.top, 0);
    const br = project(STRIKE_ZONE.halfWidth, STRIKE_ZONE.bottom, 0);
    const g = this.add.graphics().setDepth(depthForZ(0) - 5);
    g.lineStyle(2, 0xffffff, 0.22);
    g.strokeRoundedRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y, 6);
    g.lineStyle(1, 0x7dfaff, 0.15);
    g.strokeRoundedRect(tl.x - 4, tl.y - 4, br.x - tl.x + 8, br.y - tl.y + 8, 8);
  }

  // --- Pitch sequencing ------------------------------------------------------

  private startWindup(): void {
    this.phase = 'windup';
    this.swungThisPitch = false;
    this.hitResult = null;
    this.scoredThisPlay = false;
    this.homeRunAnnounced = false;

    const plan = this.pitchManager.plan();
    this.currentPitch = plan;
    events.emit(GameEvent.windupStart, { type: plan.type });

    const windupDuration = 900 + randRange(0, 350);
    this.pitcher.windup(windupDuration, () => {
      if (this.phase !== 'windup') return;
      this.pitchManager.release(plan, this.ball.physics);
      this.ball.setSpin(plan.type.spin);
      this.ball.setTrailTint(0xffffff);
      this.ball.show();
      this.phase = 'pitch';
      this.state.pitchCount += 1;
      this.difficulty.onPitchThrown();
      audio.play('throw');
      events.emit(GameEvent.pitchReleased, { type: plan.type });
    });
  }

  private updatePitchPhase(dt: number): void {
    const ballPhys = this.ball.physics;
    ballPhys.update(dt);

    const pos = ballPhys.pos;
    const bat = this.batInput.pose;
    const swinging = bat.active && bat.speed >= BAT.swingSpeedMin;
    if (swinging && pos.z < 25) this.swungThisPitch = true;

    // Contact window: ball near the plate.
    if (pos.z <= BAT.hitZoneFar && pos.z >= BAT.hitZoneNear && swinging) {
      if (checkContact(bat, pos.x, pos.y)) {
        this.onContact();
        return;
      }
    }

    // Ball got past the batter (or bounced dead in the dirt).
    if (pos.z < BAT.hitZoneNear || ballPhys.phase === 'dead') {
      this.ball.hide();
      ballPhys.kill();
      this.judgeTake();
    }
  }

  /** No contact — call it a swing, a strike looking, or a ball. */
  private judgeTake(): void {
    const plan = this.currentPitch!;
    const state = this.state;
    if (this.swungThisPitch) {
      storage.updateStats({ swings: storage.stats.swings + 1 });
      state.swings += 1;
      state.resetCombo();
      audio.play('strike');
      this.showCall('SWING & MISS!', this.feedback().foul);
      state.addStrike('swing');
    } else if (plan.inZone) {
      audio.play('strike');
      this.showCall('STRIKE!', this.feedback().weak);
      state.addStrike('looking');
    } else {
      this.showCall('BALL', this.feedback().ball);
      state.addBall();
    }
    if (state.strikes === 0 && state.balls === 0 && !state.over) {
      // Count resolved (strikeout/walk handled by GameState events).
      if (storage.stats) storage.updateStats({ strikeouts: storage.stats.strikeouts });
    }
    this.toNextPitch(1.4);
  }

  // --- Contact & live ball -----------------------------------------------------

  private onContact(): void {
    const bat = this.batInput.pose;
    const ballPhys = this.ball.physics;
    const result = resolveContact(bat, ballPhys.pos, ballPhys.vel);
    this.hitResult = result;
    this.swungThisPitch = true;

    const state = this.state;
    state.swings += 1;
    storage.updateStats({ swings: storage.stats.swings + 1 });

    // Impact effects at the contact point.
    const cp = project(result.contact.x, result.contact.y, result.contact.z);
    const colors = this.feedback();
    this.particles.sparks(cp.x, cp.y, result.quality === 'perfect' ? colors.perfect : 0xffe066);
    this.fx.shake(result.quality === 'perfect' ? 0.012 : 0.006, result.quality === 'perfect' ? 200 : 110);
    this.fx.hitStop(result.quality === 'perfect' ? 110 : result.quality === 'weak' ? 30 : 60);
    if (result.quality === 'perfect') {
      this.fx.slowMotion(0.35, 650);
      this.fx.flash(0xffffff, 90);
      audio.play('crackPerfect');
      scorePopup(this, cp.x, cp.y - 60, 'PERFECT!', '#ffd700', 38);
      state.perfectHits += 1;
      storage.updateStats({ perfectHits: storage.stats.perfectHits + 1 });
    } else {
      audio.play('crack', result.quality === 'weak' ? 0.5 : 1);
    }

    // Launch the ball on its new trajectory (+ wind).
    ballPhys.launch(
      vec3(ballPhys.pos.x, Math.max(ballPhys.pos.y, 1.2), Math.max(ballPhys.pos.z, 1)),
      result.velocity,
      'flight',
    );
    ballPhys.accel.x = this.wind.x * 0.16;
    ballPhys.accel.z = this.wind.z * 0.16;
    this.ball.setSpin(18);
    this.ball.setTrailTint(result.quality === 'perfect' ? 0xffd700 : 0xbfefff);

    events.emit(GameEvent.ballHit, result);

    if (result.foul) {
      this.showCall('FOUL!', colors.foul);
      audio.play('foul');
      state.resetCombo();
      state.addStrike('foul');
      this.phase = 'live'; // let the foul ball fly for show
      this.phaseTimer = 1.6; // but resolve quickly
      return;
    }

    // Fair ball: defense reacts.
    state.hits += 1;
    state.clearCount();
    this.crowd.cheer(0.5);
    this.team.onBallHit(ballPhys.pos, ballPhys.vel, this.difficulty.fielderSpeed, this.difficulty.fielderReaction);
    this.phase = 'live';
    this.phaseTimer = 9; // hard cap on play length
  }

  private updateLivePhase(dt: number): void {
    const ballPhys = this.ball.physics;
    ballPhys.update(dt);
    const result = this.hitResult;

    // Foul balls just fly out; resolve on timer.
    if (result?.foul) {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0 || ballPhys.phase === 'dead') {
        this.ball.hide();
        ballPhys.kill();
        this.toNextPitch(1.1);
      }
      return;
    }

    // Home run?
    if (ballPhys.fenceHit?.cleared && !this.homeRunAnnounced) {
      this.homeRunAnnounced = true;
      this.onHomeRun();
    }

    // Fence rattle dust.
    if (ballPhys.fenceHit && !ballPhys.fenceHit.cleared && !this.scoredThisPlay) {
      const p = project(ballPhys.fenceHit.pos.x, ballPhys.fenceHit.pos.y, ballPhys.fenceHit.pos.z);
      this.particles.dust(p.x, p.y, 0.8);
    }

    // Catch attempt (only before the first bounce).
    if (!this.homeRunAnnounced && this.team.tryCatch(ballPhys)) {
      this.ball.hide();
      ballPhys.kill();
      this.state.resetCombo();
      const p = project(ballPhys.pos.x, ballPhys.pos.y, ballPhys.pos.z);
      scorePopup(this, p.x, p.y, 'CAUGHT!', '#ffa54f', 30);
      this.showCall('OUT… JUST KIDDING — NO POINTS!', this.feedback().weak);
      this.toNextPitch(1.8);
      return;
    }

    // First landing: score it.
    if (ballPhys.landingPos && !this.scoredThisPlay && !this.homeRunAnnounced) {
      this.scoredThisPlay = true;
      this.scoreLanding(ballPhys.landingPos.x, ballPhys.landingPos.z);
      const lp = project(ballPhys.landingPos.x, 0, ballPhys.landingPos.z);
      this.particles.dust(lp.x, lp.y, 1);
    }

    this.phaseTimer -= dt;
    if (ballPhys.phase === 'dead' || this.phaseTimer <= 0) {
      const deadPos = vec3(ballPhys.pos.x, 0, ballPhys.pos.z);
      this.ball.hide();
      ballPhys.kill();
      this.team.onPlayOver(deadPos);
      this.toNextPitch(1.5);
    }
  }

  private scoreLanding(x: number, z: number): void {
    const state = this.state;
    const result = this.hitResult!;
    const distance = Math.hypot(x, z);
    state.longestHit = Math.max(state.longestHit, distance);
    storage.updateStats({
      hits: storage.stats.hits + 1,
      longestHit: Math.max(storage.stats.longestHit, distance),
    });

    const target = this.targets.checkLanding(x, z);
    const lp = project(x, 0, z);
    let points: number;
    let label: string;

    if (target) {
      points = target.points;
      label = target.label;
      audio.play(label === 'JACKPOT' ? 'jackpot' : 'target');
      this.particles.ringPulse(lp.x, lp.y, target.color);
      if (label === 'JACKPOT') {
        this.particles.confetti(lp.x, lp.y, 80);
        this.fx.flash(0xffd700, 140);
        this.crowd.cheer(1);
      }
    } else {
      // Plain hit: points scale with distance & contact quality.
      points =
        SCORING.basePointsPerHit +
        Math.round(clamp(distance - 100, 0, 400) * 0.35) +
        (result.quality === 'perfect' ? 40 : result.quality === 'solid' ? 20 : 0);
      label = describeHit(result);
    }

    // Bonuses.
    if (result.quality === 'perfect') points += SCORING.perfectBonus;
    if (distance > 250) points += Math.round((distance - 250) * SCORING.distanceBonusPerFoot);

    const total = state.addScore(points, label, vec3(x, 0, z));
    state.bumpCombo();
    audio.play('combo', 0.6);
    this.crowd.cheer(0.55);

    const colors = this.feedback();
    scorePopup(this, lp.x, lp.y - 20, `+${total}`, this.hexColor(target ? colors.perfect : colors.good), 32);
    if (state.combo > 2) {
      scorePopup(this, lp.x, lp.y + 22, `COMBO x${state.combo}`, '#7dfaff', 20);
    }
  }

  private onHomeRun(): void {
    const state = this.state;
    const ballPhys = this.ball.physics;
    const distance = Math.hypot(ballPhys.pos.x, ballPhys.pos.z) + 25; // landing estimate
    state.homeRuns += 1;
    state.longestHit = Math.max(state.longestHit, distance);
    state.clearCount();
    storage.updateStats({
      homeRuns: storage.stats.homeRuns + 1,
      hits: storage.stats.hits + 1,
      longestHit: Math.max(storage.stats.longestHit, distance),
    });

    const points =
      SCORING.homeRunBase +
      Math.round(Math.max(0, distance - 320) * 2) +
      (this.hitResult?.quality === 'perfect' ? SCORING.perfectBonus : 0);
    const total = state.addScore(points, 'HOME RUN', vec3(ballPhys.pos.x, 0, ballPhys.pos.z));
    state.bumpCombo();

    events.emit(GameEvent.homeRun, { distance });
    audio.play('homer');
    this.crowd.cheer(1);
    this.fx.zoomPunch(1.14, 900);
    this.fx.flash(0xffe66d, 160);
    this.fx.shake(0.01, 260);

    const p = project(ballPhys.pos.x, ballPhys.pos.y, ballPhys.pos.z);
    this.particles.confetti(p.x, Math.max(120, p.y), 90);
    scorePopup(this, 640, 250, `HOME RUN!  +${total}`, '#ffd700', 44);
    scorePopup(this, 640, 300, `${Math.round(distance)} FT`, '#ffffff', 22);

    this.scoredThisPlay = true;
    this.phaseTimer = Math.min(this.phaseTimer, 2.6);
  }

  // --- Flow helpers -------------------------------------------------------------

  private toNextPitch(delay: number): void {
    if (this.state.over) return;
    this.phase = 'resolving';
    this.phaseTimer = delay;
  }

  private onGameOver(): void {
    this.phase = 'over';
    storage.updateStats({
      strikeouts: storage.stats.strikeouts + 1, // the final strikeout that ended the game
      walks: storage.stats.walks + this.state.walks,
    });
    audio.play('gameOver');
    this.time.delayedCall(1200, () => {
      this.scene.stop(SCENES.hud);
      this.scene.start(SCENES.gameOver, {
        score: this.state.score,
        stats: {
          hits: this.state.hits,
          swings: this.state.swings,
          homeRuns: this.state.homeRuns,
          perfectHits: this.state.perfectHits,
          bestCombo: this.state.bestCombo,
          longestHit: this.state.longestHit,
          pitches: this.state.pitchCount,
          walks: this.state.walks,
        },
      });
    });
  }

  private showCall(text: string, color: number): void {
    scorePopup(this, 640, 420, text, this.hexColor(color), 30);
  }

  private feedback(): Record<'perfect' | 'good' | 'weak' | 'foul' | 'ball', number> {
    return storage.settings.colorblind ? FEEDBACK_COLORS.colorblind : FEEDBACK_COLORS.normal;
  }

  private hexColor(c: number): string {
    return `#${c.toString(16).padStart(6, '0')}`;
  }

  pauseGame(): void {
    if (this.phase === 'over') return;
    this.scene.pause();
    this.scene.launch(SCENES.pause);
  }

  // --- Main loop ------------------------------------------------------------------

  override update(_time: number, deltaMs: number): void {
    const dt = this.fx.scaledDelta(deltaMs);
    const rawDt = Math.min(deltaMs, 50) / 1000;

    // Ambient systems tick in real time (unaffected by hit stop).
    this.sky.update(rawDt);
    this.crowd.update(rawDt);
    this.scoreboard.update(rawDt);
    this.targets.update(dt);
    this.team.update(dt);

    // Bat follows input even during hit stop (feels responsive).
    this.batInput.update();
    this.bat.update(this.batInput.pose, rawDt);
    this.ball.update(dt);

    if (dt <= 0) return;

    switch (this.phase) {
      case 'waiting':
      case 'resolving':
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0 && !this.state.over) this.startWindup();
        break;
      case 'pitch':
        this.updatePitchPhase(dt);
        break;
      case 'live':
        this.updateLivePhase(dt);
        break;
      case 'windup':
      case 'over':
        break;
    }
  }
}
