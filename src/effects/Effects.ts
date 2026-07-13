/**
 * Screen-level juice: shake, flash, hit stop, slow motion, and home-run
 * camera zoom. All effects respect the reduced-motion accessibility setting.
 */
import Phaser from 'phaser';
import { storage } from '../utils/storage';

export class Effects {
  /** Global time scale applied to gameplay updates (1 = normal). */
  timeScale = 1;
  private freezeUntil = 0;
  private slowmoUntil = 0;
  private slowmoScale = 1;

  constructor(private scene: Phaser.Scene) {}

  private get reduced(): boolean {
    return storage.settings.reducedMotion;
  }

  shake(intensity = 0.008, duration = 120): void {
    if (this.reduced) return;
    this.scene.cameras.main.shake(duration, intensity);
  }

  flash(color = 0xffffff, duration = 90, alpha = 0.6): void {
    if (this.reduced) return;
    const c = Phaser.Display.Color.IntegerToColor(color);
    this.scene.cameras.main.flash(duration, c.red, c.green, c.blue, false);
    void alpha;
  }

  /** Freeze gameplay for a few ms — sells the impact of big hits. */
  hitStop(ms: number): void {
    if (this.reduced) ms = Math.min(ms, 40);
    this.freezeUntil = Math.max(this.freezeUntil, performance.now() + ms);
  }

  /** Brief slow motion (perfect contact). */
  slowMotion(scale: number, ms: number): void {
    if (this.reduced) return;
    this.slowmoScale = scale;
    this.slowmoUntil = performance.now() + ms;
  }

  /** Punchy camera zoom used for home runs. Returns to 1 automatically. */
  zoomPunch(zoom = 1.12, ms = 700): void {
    if (this.reduced) return;
    const cam = this.scene.cameras.main;
    this.scene.tweens.add({
      targets: cam,
      zoom,
      duration: ms * 0.25,
      ease: 'Cubic.easeOut',
      yoyo: true,
      hold: ms * 0.5,
      onComplete: () => cam.setZoom(1),
    });
  }

  /** Call each frame; returns the dt (seconds) gameplay should advance by. */
  scaledDelta(deltaMs: number): number {
    const now = performance.now();
    if (now < this.freezeUntil) {
      this.timeScale = 0;
      return 0;
    }
    this.timeScale = now < this.slowmoUntil ? this.slowmoScale : 1;
    return (Math.min(deltaMs, 50) / 1000) * this.timeScale;
  }
}
