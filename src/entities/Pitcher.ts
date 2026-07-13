/**
 * Animated cartoon pitcher standing on the mound. Assembled from simple
 * procedural parts (torso, head, cap, arms, legs) in a container and
 * animated with tweens: idle breathing, a full windup (leg lift + arm
 * sweep), release, and follow-through.
 */
import Phaser from 'phaser';
import { FIELD } from '../game/config';
import { depthForZ, project, projectRadius } from '../physics/projection';

export type PitcherPhase = 'idle' | 'windup' | 'followthrough';

export class Pitcher {
  readonly container: Phaser.GameObjects.Container;
  private torso: Phaser.GameObjects.Ellipse;
  private head: Phaser.GameObjects.Arc;
  private cap: Phaser.GameObjects.Arc;
  private armThrow: Phaser.GameObjects.Rectangle;
  private armGlove: Phaser.GameObjects.Rectangle;
  private legL: Phaser.GameObjects.Rectangle;
  private legR: Phaser.GameObjects.Rectangle;
  private heldBall: Phaser.GameObjects.Arc;
  phase: PitcherPhase = 'idle';
  private idleTween: Phaser.Tweens.Tween | null = null;

  constructor(private scene: Phaser.Scene) {
    const p = project(0, FIELD.moundHeight, FIELD.moundZ);
    const s = projectRadius(1, FIELD.moundZ); // pixels per foot at the mound

    // Sizes in feet, converted to px at mound depth.
    const bodyH = 2.4 * s;
    const bodyW = 1.7 * s;

    this.legL = scene.add.rectangle(-bodyW * 0.22, -0.6 * s, 0.42 * s, 1.5 * s, 0x2b3a67).setOrigin(0.5, 0);
    this.legR = scene.add.rectangle(bodyW * 0.22, -0.6 * s, 0.42 * s, 1.5 * s, 0x2b3a67).setOrigin(0.5, 0);
    this.torso = scene.add.ellipse(0, -1.6 * s, bodyW, bodyH, 0xf4f6fb);
    this.armGlove = scene.add
      .rectangle(-bodyW * 0.55, -2.1 * s, 0.36 * s, 1.3 * s, 0xf4f6fb)
      .setOrigin(0.5, 0.12)
      .setRotation(0.5);
    this.armThrow = scene.add
      .rectangle(bodyW * 0.55, -2.1 * s, 0.36 * s, 1.45 * s, 0xf4f6fb)
      .setOrigin(0.5, 0.12)
      .setRotation(-0.4);
    this.head = scene.add.circle(0, -3.3 * s, 0.62 * s, 0xffcf9f);
    this.cap = scene.add.arc(0, -3.45 * s, 0.62 * s, 180, 360, false, 0xd7263d);
    this.heldBall = scene.add.circle(bodyW * 0.55, -0.9 * s, 0.22 * s, 0xffffff);

    // Red jersey accents.
    const belt = scene.add.rectangle(0, -0.72 * s, bodyW * 0.9, 0.22 * s, 0xd7263d);
    const number = scene.add.circle(0, -1.7 * s, 0.28 * s, 0xd7263d);

    this.container = scene.add.container(p.x, p.y, [
      this.legL,
      this.legR,
      this.armGlove,
      this.torso,
      belt,
      number,
      this.armThrow,
      this.heldBall,
      this.head,
      this.cap,
    ]);
    this.container.setDepth(depthForZ(FIELD.moundZ));
    this.startIdle();
  }

  private startIdle(): void {
    this.phase = 'idle';
    this.idleTween?.remove();
    this.container.setScale(1);
    this.idleTween = this.scene.tweens.add({
      targets: this.torso,
      scaleY: 1.04,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Play the windup. `duration` covers windup start -> release. The returned
   * promise-style callback fires exactly at the release frame so the pitch
   * manager can spawn the real ball at the release point.
   */
  windup(duration: number, onRelease: () => void): void {
    if (this.phase === 'windup') return;
    this.phase = 'windup';
    this.idleTween?.remove();
    this.heldBall.setVisible(true);

    const t = duration;
    const scene = this.scene;

    // Leg lift + slight coil.
    scene.tweens.add({
      targets: this.legL,
      scaleY: 0.45,
      y: this.legL.y - 8,
      duration: t * 0.42,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });
    scene.tweens.add({
      targets: this.container,
      scaleX: 0.94,
      duration: t * 0.42,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });
    // Throwing arm sweeps back then whips forward.
    scene.tweens.chain({
      targets: this.armThrow,
      tweens: [
        { rotation: -2.4, duration: t * 0.5, ease: 'Quad.easeOut' },
        { rotation: 1.1, duration: t * 0.32, ease: 'Back.easeIn' },
      ],
      onComplete: () => {
        this.heldBall.setVisible(false);
        onRelease();
        this.phase = 'followthrough';
        scene.tweens.add({
          targets: this.armThrow,
          rotation: -0.4,
          duration: 420,
          delay: 180,
          ease: 'Sine.easeInOut',
          onComplete: () => this.startIdle(),
        });
      },
    });
    // Glove arm counterbalances.
    scene.tweens.add({
      targets: this.armGlove,
      rotation: 1.2,
      duration: t * 0.5,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }

  /** Quick celebration hop (after strikeouts). */
  celebrate(): void {
    if (this.phase !== 'idle') return;
    this.scene.tweens.add({
      targets: this.container,
      y: this.container.y - 12,
      duration: 160,
      yoyo: true,
      repeat: 2,
      ease: 'Quad.easeOut',
    });
  }
}
