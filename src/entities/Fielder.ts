/**
 * One cartoon defensive player. Built from simple shapes in a container,
 * scaled by perspective as he moves around the field. State machine:
 * idle -> react -> chase -> catch/pickup -> throw -> return -> idle.
 */
import Phaser from 'phaser';
import { depthForZ, project, projectRadius } from '../physics/projection';
import { damp, len2 } from '../utils/math';

export type FielderState = 'idle' | 'react' | 'chase' | 'catch' | 'throw' | 'return' | 'celebrate';

/** Perspective scale is normalized against this reference depth. */
const REF_Z = 120;

export class Fielder {
  readonly container: Phaser.GameObjects.Container;
  state: FielderState = 'idle';
  /** Current world position (y always 0 — feet on the ground). */
  x: number;
  z: number;
  /** Chase destination. */
  targetX = 0;
  targetZ = 0;
  speed = 16;
  private bobTime = Math.random() * 10;
  private body: Phaser.GameObjects.Ellipse;
  private glove: Phaser.GameObjects.Arc;
  private legL: Phaser.GameObjects.Rectangle;
  private legR: Phaser.GameObjects.Rectangle;
  private stateTimer = 0;

  constructor(
    private scene: Phaser.Scene,
    readonly name: string,
    readonly homeX: number,
    readonly homeZ: number,
  ) {
    this.x = homeX;
    this.z = homeZ;

    const s = projectRadius(1, REF_Z); // px per foot at reference depth

    this.legL = scene.add.rectangle(-0.35 * s, -0.5 * s, 0.4 * s, 1.4 * s, 0x24427a).setOrigin(0.5, 0);
    this.legR = scene.add.rectangle(0.35 * s, -0.5 * s, 0.4 * s, 1.4 * s, 0x24427a).setOrigin(0.5, 0);
    this.body = scene.add.ellipse(0, -1.55 * s, 1.7 * s, 2.3 * s, 0x3f7ad1);
    const head = scene.add.circle(0, -3.15 * s, 0.6 * s, 0xffcf9f);
    const cap = scene.add.arc(0, -3.3 * s, 0.6 * s, 180, 360, false, 0x24427a);
    this.glove = scene.add.circle(0.95 * s, -1.9 * s, 0.42 * s, 0x8a5a2b);

    this.container = scene.add.container(0, 0, [this.legL, this.legR, this.body, this.glove, head, cap]);
    this.render();
  }

  /** Order the fielder to chase a world point. */
  chase(x: number, z: number, speed: number, reactionDelay: number): void {
    this.targetX = x;
    this.targetZ = z;
    this.speed = speed;
    this.state = 'react';
    this.stateTimer = reactionDelay;
  }

  goHome(): void {
    if (this.state === 'idle') return;
    this.targetX = this.homeX;
    this.targetZ = this.homeZ;
    this.state = 'return';
  }

  /** Snappy caught-it pose, then celebrate. */
  didCatch(): void {
    this.state = 'celebrate';
    this.stateTimer = 1.2;
    this.scene.tweens.add({
      targets: this.container,
      angle: { from: -8, to: 8 },
      duration: 120,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.container.setAngle(0),
    });
  }

  /** Scoop up a rolling/landed ball, then wind a throw. */
  pickUp(): void {
    this.state = 'throw';
    this.stateTimer = 0.5;
  }

  get isNearTarget(): boolean {
    return len2(this.targetX - this.x, this.targetZ - this.z) < 3;
  }

  distanceTo(x: number, z: number): number {
    return len2(x - this.x, z - this.z);
  }

  update(dt: number): void {
    this.bobTime += dt;
    switch (this.state) {
      case 'react':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.state = 'chase';
        break;
      case 'chase':
      case 'return': {
        const dx = this.targetX - this.x;
        const dz = this.targetZ - this.z;
        const dist = len2(dx, dz);
        if (dist < 1.5) {
          if (this.state === 'return') this.state = 'idle';
        } else {
          const step = Math.min(dist, this.speed * dt);
          this.x += (dx / dist) * step;
          this.z += (dz / dist) * step;
        }
        break;
      }
      case 'throw':
      case 'celebrate':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.goHome();
        break;
      case 'idle': {
        // Gentle drift back to exact home spot.
        this.x = damp(this.x, this.homeX, 1.2, dt);
        this.z = damp(this.z, this.homeZ, 1.2, dt);
        break;
      }
    }
    this.render();
  }

  private render(): void {
    const p = project(this.x, 0, this.z);
    const scale = projectRadius(1, this.z) / projectRadius(1, REF_Z);
    this.container.setPosition(p.x, p.y);
    this.container.setScale(scale);
    this.container.setDepth(depthForZ(this.z));

    const moving = this.state === 'chase' || this.state === 'return';
    if (moving) {
      // Running: legs scissor, body leans toward the target.
      const swing = Math.sin(this.bobTime * 14) * 0.5;
      this.legL.setRotation(swing);
      this.legR.setRotation(-swing);
      this.container.setAngle(Math.sign(this.targetX - this.x) * 6);
      this.glove.setY(-2.2 * projectRadius(1, REF_Z));
    } else {
      // Idle: soft breathing bob, occasional ready crouch.
      this.legL.setRotation(0);
      this.legR.setRotation(0);
      if (this.state === 'idle') this.container.setAngle(0);
      this.body.scaleY = 1 + Math.sin(this.bobTime * 2.2) * 0.03;
      this.glove.setY(-1.9 * projectRadius(1, REF_Z));
    }
    if (this.state === 'celebrate') {
      this.container.y -= Math.abs(Math.sin(this.bobTime * 10)) * 14 * scale;
    }
  }
}
