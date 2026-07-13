/**
 * Generates every procedural texture the game needs (no binary assets are
 * shipped), then hands off to the menu. Also kicks off the MediaPipe model
 * download in the background so it's warm by the time the player hits Play.
 */
import Phaser from 'phaser';
import { SCENES } from '../config';
import { handTracker } from '../../handtracking/HandTracker';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    this.makeBallTexture();
    this.makeGlowTexture();
    this.makeParticleTextures();
    this.makeCloudTexture();

    // Warm up hand tracking in the background (non-blocking).
    void handTracker.load();

    this.scene.start(SCENES.menu);
  }

  private makeBallTexture(): void {
    const size = 64;
    const c = this.textures.createCanvas('ball', size, size)!;
    const ctx = c.context;
    const r = size / 2 - 2;

    // White ball with soft shading.
    const grad = ctx.createRadialGradient(size * 0.38, size * 0.34, r * 0.15, size / 2, size / 2, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.75, '#e9e9ee');
    grad.addColorStop(1, '#c5c8d4');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.fill();

    // Red seams: two arcs.
    ctx.strokeStyle = '#d7263d';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(size * 0.1, size / 2, r * 0.95, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.9, size / 2, r * 0.95, Math.PI - 0.9, Math.PI + 0.9);
    ctx.stroke();

    c.refresh();
  }

  private makeGlowTexture(): void {
    const size = 64;
    const c = this.textures.createCanvas('ball-glow', size, size)!;
    const ctx = c.context;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    c.refresh();
  }

  private makeParticleTextures(): void {
    // Small hard circle.
    let g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture('px-circle', 12, 12);
    g.destroy();

    // Soft blurry blob (canvas gradient).
    const c = this.textures.createCanvas('px-soft', 32, 32)!;
    const ctx = c.context;
    const grad = ctx.createRadialGradient(16, 16, 2, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    c.refresh();

    // Confetti square.
    g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 8, 8);
    g.generateTexture('px-square', 8, 8);
    g.destroy();
  }

  private makeCloudTexture(): void {
    const w = 160;
    const h = 64;
    const c = this.textures.createCanvas('cloud', w, h)!;
    const ctx = c.context;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    const blobs: Array<[number, number, number]> = [
      [40, 40, 22],
      [70, 32, 26],
      [102, 36, 24],
      [126, 44, 17],
      [55, 46, 20],
      [90, 48, 21],
    ];
    for (const [x, y, r] of blobs) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    c.refresh();
  }
}
