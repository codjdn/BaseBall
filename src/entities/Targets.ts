/**
 * Arcade scoring targets scattered across the field: neon landing rings,
 * floating value signs, and rare BONUS/JACKPOT holograms. The ball scores
 * whichever target contains its first landing point.
 *
 * Targets animate (pulse/bob), drift around at higher difficulty, and
 * periodically despawn/respawn somewhere new.
 */
import Phaser from 'phaser';
import { DEPTHS, SCORING } from '../game/config';
import type { DifficultyManager } from '../game/DifficultyManager';
import { fenceDistanceAt } from '../physics/BallPhysics';
import { depthForZ, project, projectRadius } from '../physics/projection';
import { clamp, randPick, randRange } from '../utils/math';

type TargetKind = 'ring' | 'sign' | 'bucket' | 'bonus' | 'jackpot';

interface TargetDef {
  kind: TargetKind;
  value: number;
  label: string;
  color: number;
  radius: number; // feet
  weight: number;
}

const TARGET_DEFS: readonly TargetDef[] = [
  { kind: 'ring', value: 50, label: '50', color: 0x54e05e, radius: 26, weight: 5 },
  { kind: 'ring', value: 100, label: '100', color: 0x6db4ff, radius: 21, weight: 5 },
  { kind: 'bucket', value: 250, label: '250', color: 0xffe66d, radius: 16, weight: 4 },
  { kind: 'sign', value: 500, label: '500', color: 0xffa54f, radius: 13, weight: 3 },
  { kind: 'sign', value: 750, label: '750', color: 0xc77dff, radius: 11, weight: 2 },
  { kind: 'sign', value: 1000, label: '1000', color: 0xff5a5a, radius: 9, weight: 1.5 },
  { kind: 'bonus', value: 400, label: 'BONUS', color: 0x37f4ff, radius: 14, weight: 1.5 },
  { kind: 'jackpot', value: SCORING.jackpot, label: 'JACKPOT', color: 0xffd700, radius: 8, weight: 0.7 },
];

interface ActiveTarget {
  def: TargetDef;
  x: number;
  z: number;
  driftAngle: number;
  /** Seconds until this target despawns and respawns elsewhere. */
  life: number;
  age: number;
  ring: Phaser.GameObjects.Graphics;
  sign: Phaser.GameObjects.Container;
}

const MAX_TARGETS = 6;

export class TargetManager {
  private targets: ActiveTarget[] = [];

  constructor(
    private scene: Phaser.Scene,
    private difficulty: DifficultyManager,
  ) {
    for (let i = 0; i < MAX_TARGETS; i++) this.spawn();
  }

  private spawn(): void {
    const def = this.pickDef();
    // Place in fair territory, mid-outfield band, away from other targets.
    let x = 0;
    let z = 150;
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = randRange(-0.62, 0.62); // radians off center field
      const bandMin = def.value >= 500 ? 200 : 120;
      const dist = randRange(bandMin, fenceDistanceAt(angle) - 25);
      x = Math.sin(angle) * dist;
      z = Math.cos(angle) * dist;
      if (this.targets.every((t) => Math.hypot(t.x - x, t.z - z) > t.def.radius + def.radius + 15)) break;
    }

    const ring = this.scene.add.graphics().setDepth(DEPTHS.targetsGround).setBlendMode(Phaser.BlendModes.ADD);

    // Floating sign above the zone with the value text. Depth-sorted by its
    // world z so it draws in front of the fence/stands but behind near play.
    const p = project(x, 9, z);
    const textSize = Math.max(11, Math.round(projectRadius(10, z)));
    const label = this.scene.add
      .text(0, 0, def.label, {
        fontFamily: '"Arial Black", Arial, sans-serif',
        fontSize: `${textSize}px`,
        color: '#ffffff',
        stroke: '#00204a',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const pad = 6;
    const bg = this.scene.add
      .rectangle(0, 0, label.width + pad * 2, label.height + pad, def.color, 0.85)
      .setStrokeStyle(2, 0xffffff, 0.9);
    const sign = this.scene.add.container(p.x, p.y, [bg, label]).setDepth(depthForZ(z));
    sign.setScale(0);
    this.scene.tweens.add({ targets: sign, scale: 1, duration: 350, ease: 'Back.easeOut' });

    this.targets.push({
      def,
      x,
      z,
      driftAngle: randRange(0, Math.PI * 2),
      life: randRange(9, 18),
      age: randRange(0, 5),
      ring,
      sign,
    });
  }

  private pickDef(): TargetDef {
    // Higher difficulty biases toward richer targets.
    const bias = this.difficulty.t;
    const pool: TargetDef[] = [];
    for (const def of TARGET_DEFS) {
      const w = def.weight * (def.value >= 500 ? 0.6 + bias : 1.2 - bias * 0.5);
      for (let i = 0; i < Math.max(1, Math.round(w * 2)); i++) pool.push(def);
    }
    return randPick(pool);
  }

  /**
   * Check a landing point against all targets. Returns the award (already
   * difficulty-scaled) or null. The struck target explodes and respawns.
   */
  checkLanding(x: number, z: number): { points: number; label: string; color: number } | null {
    let hit: ActiveTarget | null = null;
    for (const t of this.targets) {
      if (Math.hypot(t.x - x, t.z - z) <= t.def.radius) {
        // Prefer the most valuable overlapping target.
        if (!hit || t.def.value > hit.def.value) hit = t;
      }
    }
    if (!hit) return null;

    const points = Math.round((hit.def.value * this.difficulty.targetValueScale) / 10) * 10;
    const result = { points, label: hit.def.label, color: hit.def.color };
    this.despawn(hit, true);
    this.scene.time.delayedCall(randRange(800, 2200), () => this.spawn());
    return result;
  }

  private despawn(t: ActiveTarget, hit: boolean): void {
    this.targets = this.targets.filter((o) => o !== t);
    t.ring.destroy();
    this.scene.tweens.add({
      targets: t.sign,
      scale: hit ? 1.6 : 0,
      alpha: 0,
      duration: hit ? 420 : 250,
      ease: hit ? 'Back.easeIn' : 'Quad.easeIn',
      onComplete: () => t.sign.destroy(),
    });
  }

  update(dt: number): void {
    for (const t of [...this.targets]) {
      t.age += dt;
      t.life -= dt;
      if (t.life <= 0) {
        this.despawn(t, false);
        this.scene.time.delayedCall(randRange(500, 1500), () => this.spawn());
        continue;
      }

      // Drift (speed scales with difficulty), bouncing off a lane boundary.
      const speed = this.difficulty.targetSpeed;
      if (speed > 0.5) {
        t.x += Math.cos(t.driftAngle) * speed * dt;
        t.z += Math.sin(t.driftAngle) * speed * dt * 0.4;
        const angle = Math.atan2(t.x, t.z);
        const dist = Math.hypot(t.x, t.z);
        if (Math.abs(angle) > 0.65 || dist > fenceDistanceAt(angle) - 20 || dist < 110) {
          t.driftAngle += Math.PI * randRange(0.75, 1.25);
          t.x = clamp(t.x, -250, 250);
          t.z = clamp(t.z, 115, 360);
        }
      }

      this.draw(t);
    }
  }

  private draw(t: ActiveTarget): void {
    const pulse = 1 + Math.sin(t.age * 3) * 0.08;
    const g = t.ring;
    g.clear();

    const center = project(t.x, 0, t.z);
    const rx = projectRadius(t.def.radius, t.z) * pulse;
    const ry = rx * 0.36; // ground ellipse squash from the camera angle

    // Outer glow ring + inner fill.
    g.lineStyle(Math.max(2, rx * 0.14), t.def.color, 0.9);
    g.strokeEllipse(center.x, center.y, rx * 2, ry * 2);
    g.fillStyle(t.def.color, 0.16 + 0.08 * Math.sin(t.age * 5));
    g.fillEllipse(center.x, center.y, rx * 2, ry * 2);
    if (t.def.kind === 'jackpot' || t.def.kind === 'bonus') {
      g.lineStyle(2, 0xffffff, 0.8);
      g.strokeEllipse(center.x, center.y, rx * 1.3, ry * 1.3);
    }

    // Bob the floating sign above the ring.
    const sp = project(t.x, 9 + Math.sin(t.age * 2.1) * 1.2, t.z);
    t.sign.setPosition(sp.x, sp.y);
    t.sign.setDepth(depthForZ(t.z));
  }

  destroy(): void {
    for (const t of this.targets) {
      t.ring.destroy();
      t.sign.destroy();
    }
    this.targets = [];
  }
}
