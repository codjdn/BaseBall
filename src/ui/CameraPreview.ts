/**
 * Small corner preview of the webcam feed with a fingertip marker, so the
 * player can see what the tracker sees. Redraws the hidden <video> element
 * into a canvas texture. Can be hidden while tracking continues.
 */
import Phaser from 'phaser';
import { DEPTHS } from '../game/config';
import { cameraManager } from '../handtracking/CameraManager';
import { handTracker } from '../handtracking/HandTracker';
import { storage } from '../utils/storage';

const PREVIEW_W = 176;
const PREVIEW_H = 132;

export class CameraPreview {
  private texture: Phaser.Textures.CanvasTexture;
  private image: Phaser.GameObjects.Image;
  private frame: Phaser.GameObjects.Rectangle;
  private tipDot: Phaser.GameObjects.Arc;
  private statusText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const key = `campreview-${scene.scene.key}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.texture = scene.textures.createCanvas(key, PREVIEW_W, PREVIEW_H)!;

    this.frame = scene.add
      .rectangle(x, y, PREVIEW_W + 8, PREVIEW_H + 8, 0x102243, 0.9)
      .setStrokeStyle(3, 0x7dfaff, 0.8)
      .setDepth(DEPTHS.hud);
    this.image = scene.add.image(x, y, key).setDepth(DEPTHS.hud + 1);
    this.tipDot = scene.add.circle(x, y, 6, 0x54e05e).setDepth(DEPTHS.hud + 2).setVisible(false);
    this.statusText = scene.add
      .text(x, y + PREVIEW_H / 2 + 16, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#ffe66d',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud + 2);
  }

  setVisible(v: boolean): void {
    this.image.setVisible(v);
    this.frame.setVisible(v);
    this.statusText.setVisible(v);
    if (!v) this.tipDot.setVisible(false);
  }

  get visible(): boolean {
    return this.image.visible;
  }

  update(): void {
    if (!this.image.visible) return;
    const video = cameraManager.video;
    const ctx = this.texture.context;

    if (cameraManager.isRunning && video.readyState >= 2) {
      const mirror = storage.settings.mirrorCamera;
      ctx.save();
      if (mirror) {
        ctx.translate(PREVIEW_W, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, PREVIEW_W, PREVIEW_H);
      ctx.restore();
      this.texture.refresh();

      const pose = handTracker.pose;
      if (pose.tracked) {
        const nx = mirror ? 1 - pose.tipX : pose.tipX;
        this.tipDot.setVisible(true);
        this.tipDot.setPosition(
          this.image.x - PREVIEW_W / 2 + nx * PREVIEW_W,
          this.image.y - PREVIEW_H / 2 + pose.tipY * PREVIEW_H,
        );
        this.statusText.setText('TRACKING');
        this.statusText.setColor('#54e05e');
      } else {
        this.tipDot.setVisible(false);
        this.statusText.setText('SHOW YOUR HAND');
        this.statusText.setColor('#ffe66d');
      }
    } else {
      ctx.fillStyle = '#0a1428';
      ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
      this.texture.refresh();
      this.statusText.setText(storage.settings.pointerMode ? 'POINTER MODE' : 'NO CAMERA');
      this.statusText.setColor('#8fa3c8');
      this.tipDot.setVisible(false);
    }
  }

  destroy(): void {
    this.image.destroy();
    this.frame.destroy();
    this.tipDot.destroy();
    this.statusText.destroy();
  }
}
