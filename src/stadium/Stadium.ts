/**
 * Draws the ballpark itself: grass with mow stripes, dirt infield, base
 * paths, bases, foul lines, warning track, outfield fence, foul poles, and
 * dugouts — all projected through the shared pseudo-3D camera so the ball's
 * flight lines up with the artwork perfectly.
 */
import Phaser from 'phaser';
import { DEPTHS, FIELD } from '../game/config';
import { fenceDistanceAt } from '../physics/BallPhysics';
import { depthForZ, project } from '../physics/projection';
import { THEME_COLORS, type ThemeId } from './Sky';

export class Stadium {
  constructor(scene: Phaser.Scene, theme: ThemeId) {
    const colors = THEME_COLORS[theme];
    const ground = scene.add.graphics().setDepth(DEPTHS.stadium);
    const wall = scene.add.graphics().setDepth(depthForZ(FIELD.fenceCorner));

    // ---- Grass: fair territory polygon out to the fence -------------------
    const fencePoints: Array<{ x: number; z: number }> = [];
    for (let a = -Math.PI / 4; a <= Math.PI / 4 + 0.001; a += Math.PI / 60) {
      const d = fenceDistanceAt(a);
      fencePoints.push({ x: Math.sin(a) * d, z: Math.cos(a) * d });
    }

    ground.fillStyle(colors.grass, 1);
    ground.beginPath();
    const home = project(0, 0, -14);
    ground.moveTo(home.x, home.y);
    for (const fp of fencePoints) {
      const p = project(fp.x, 0, fp.z);
      ground.lineTo(p.x, p.y);
    }
    ground.closePath();
    ground.fillPath();

    // Foul-territory grass strip near the plate (wider than the diamond).
    ground.fillStyle(colors.grassDark, 1);
    const foulL = project(-95, 0, 55);
    const foulR = project(95, 0, 55);
    ground.fillTriangle(home.x, home.y, foulL.x, foulL.y, foulR.x, foulR.y);
    ground.fillStyle(colors.grass, 1);
    const inL = project(-70, 0, 62);
    const inR = project(70, 0, 62);
    ground.fillTriangle(home.x, home.y, inL.x, inL.y, inR.x, inR.y);

    // Mow stripes: alternating shaded bands of depth.
    ground.fillStyle(colors.grassDark, 0.45);
    for (let z0 = 90; z0 < 360; z0 += 44) {
      ground.beginPath();
      let first = true;
      for (let a = -Math.PI / 4; a <= Math.PI / 4 + 0.001; a += Math.PI / 40) {
        const zz = Math.min(z0, fenceDistanceAt(a));
        const p = project(Math.sin(a) * zz, 0, Math.cos(a) * zz);
        if (first) {
          ground.moveTo(p.x, p.y);
          first = false;
        } else ground.lineTo(p.x, p.y);
      }
      for (let a = Math.PI / 4; a >= -Math.PI / 4 - 0.001; a -= Math.PI / 40) {
        const zz = Math.min(z0 + 22, fenceDistanceAt(a));
        const p = project(Math.sin(a) * zz, 0, Math.cos(a) * zz);
        ground.lineTo(p.x, p.y);
      }
      ground.closePath();
      ground.fillPath();
    }

    // ---- Warning track ring just inside the fence --------------------------
    ground.fillStyle(colors.dirt, 0.9);
    ground.beginPath();
    let started = false;
    for (let a = -Math.PI / 4; a <= Math.PI / 4 + 0.001; a += Math.PI / 60) {
      const p = project(Math.sin(a) * (fenceDistanceAt(a) - 14), 0, Math.cos(a) * (fenceDistanceAt(a) - 14));
      if (!started) {
        ground.moveTo(p.x, p.y);
        started = true;
      } else ground.lineTo(p.x, p.y);
    }
    for (let a = Math.PI / 4; a >= -Math.PI / 4 - 0.001; a -= Math.PI / 60) {
      const p = project(Math.sin(a) * fenceDistanceAt(a), 0, Math.cos(a) * fenceDistanceAt(a));
      ground.lineTo(p.x, p.y);
    }
    ground.closePath();
    ground.fillPath();

    // ---- Dirt infield -------------------------------------------------------
    ground.fillStyle(colors.dirt, 1);
    ground.beginPath();
    started = false;
    for (let a = -Math.PI / 4; a <= Math.PI / 4 + 0.001; a += Math.PI / 40) {
      const p = project(Math.sin(a) * FIELD.infieldRadius, 0, Math.cos(a) * FIELD.infieldRadius);
      if (!started) {
        ground.moveTo(p.x, p.y);
        started = true;
      } else ground.lineTo(p.x, p.y);
    }
    const backL = project(-16, 0, -6);
    const backR = project(16, 0, -6);
    ground.lineTo(backR.x, backR.y);
    ground.lineTo(backL.x, backL.y);
    ground.closePath();
    ground.fillPath();

    // Infield grass square inside the base paths.
    const b = FIELD.baseDist / Math.SQRT2; // base corner offset (x or z component)
    ground.fillStyle(colors.grass, 1);
    const gHome = project(0, 0, 14);
    const gFirst = project(b - 10, 0, b + 4);
    const gSecond = project(0, 0, 2 * b - 12);
    const gThird = project(-b + 10, 0, b + 4);
    ground.beginPath();
    ground.moveTo(gHome.x, gHome.y);
    ground.lineTo(gFirst.x, gFirst.y);
    ground.lineTo(gSecond.x, gSecond.y);
    ground.lineTo(gThird.x, gThird.y);
    ground.closePath();
    ground.fillPath();

    // Mound and home plate dirt circles.
    this.groundEllipse(ground, colors.dirt, 0, FIELD.moundZ, 11);
    this.groundEllipse(ground, colors.dirt, 0, 0, 14);
    // Mound rubber & plate.
    const mound = project(0, FIELD.moundHeight, FIELD.moundZ);
    ground.fillStyle(0xffffff, 0.95);
    ground.fillRect(mound.x - 7, mound.y - 2, 14, 4);
    const plate = project(0, 0.05, 0);
    ground.fillStyle(0xffffff, 1);
    ground.fillPoints(
      [
        new Phaser.Geom.Point(plate.x - 14, plate.y - 4),
        new Phaser.Geom.Point(plate.x + 14, plate.y - 4),
        new Phaser.Geom.Point(plate.x + 10, plate.y + 4),
        new Phaser.Geom.Point(plate.x, plate.y + 9),
        new Phaser.Geom.Point(plate.x - 10, plate.y + 4),
      ],
      true,
    );
    // Batter's boxes.
    ground.lineStyle(3, 0xffffff, 0.85);
    ground.strokeRect(plate.x - 58, plate.y - 26, 34, 40);
    ground.strokeRect(plate.x + 24, plate.y - 26, 34, 40);

    // ---- Foul lines & bases -------------------------------------------------
    ground.lineStyle(4, 0xffffff, 0.95);
    for (const side of [-1, 1]) {
      const eachA = (side * Math.PI) / 4;
      const end = project(Math.sin(eachA) * fenceDistanceAt(eachA), 0, Math.cos(eachA) * fenceDistanceAt(eachA));
      const start = project(0, 0, 2);
      ground.lineBetween(start.x, start.y, end.x, end.y);
    }
    for (const [bx, bz] of [
      [b, b],
      [0, 2 * b],
      [-b, b],
    ]) {
      const p = project(bx, 0.1, bz);
      ground.fillStyle(0xffffff, 1);
      const r = 6;
      ground.fillPoints(
        [
          new Phaser.Geom.Point(p.x, p.y - r * 0.5),
          new Phaser.Geom.Point(p.x + r, p.y),
          new Phaser.Geom.Point(p.x, p.y + r * 0.5),
          new Phaser.Geom.Point(p.x - r, p.y),
        ],
        true,
      );
    }

    // ---- Outfield fence (vertical wall) --------------------------------------
    wall.fillStyle(colors.fence, 1);
    wall.beginPath();
    started = false;
    for (const fp of fencePoints) {
      const p = project(fp.x, 0, fp.z);
      if (!started) {
        wall.moveTo(p.x, p.y);
        started = true;
      } else wall.lineTo(p.x, p.y);
    }
    for (let i = fencePoints.length - 1; i >= 0; i--) {
      const fp = fencePoints[i];
      const p = project(fp.x, FIELD.fenceHeight, fp.z);
      wall.lineTo(p.x, p.y);
    }
    wall.closePath();
    wall.fillPath();
    // Yellow home-run line on top + distance markers.
    wall.lineStyle(3, 0xffe66d, 1);
    wall.beginPath();
    started = false;
    for (const fp of fencePoints) {
      const p = project(fp.x, FIELD.fenceHeight, fp.z);
      if (!started) {
        wall.moveTo(p.x, p.y);
        started = true;
      } else wall.lineTo(p.x, p.y);
    }
    wall.strokePath();
    for (const a of [-Math.PI / 5, 0, Math.PI / 5]) {
      const d = fenceDistanceAt(a);
      const p = project(Math.sin(a) * d, FIELD.fenceHeight * 0.5, Math.cos(a) * d);
      scene.add
        .text(p.x, p.y, `${Math.round(d)}`, {
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: '13px',
          color: '#ffe66d',
        })
        .setOrigin(0.5)
        .setDepth(depthForZ(FIELD.fenceCorner) + 1);
    }
    // Foul poles.
    for (const side of [-1, 1]) {
      const a = (side * Math.PI) / 4;
      const d = fenceDistanceAt(a);
      const bot = project(Math.sin(a) * d, 0, Math.cos(a) * d);
      const top = project(Math.sin(a) * d, 42, Math.cos(a) * d);
      wall.lineStyle(4, 0xffe66d, 1);
      wall.lineBetween(bot.x, bot.y, top.x, top.y);
    }

    // ---- Dugouts near the bottom corners -------------------------------------
    for (const side of [-1, 1]) {
      const near = project(side * 60, 0, 30);
      const dug = scene.add.container(near.x, near.y).setDepth(depthForZ(28));
      const roof = scene.add.rectangle(0, -26, 120, 12, 0x24427a).setStrokeStyle(2, 0x16294d);
      const box = scene.add.rectangle(0, -6, 120, 28, 0x16294d, 0.95);
      const rail = scene.add.rectangle(0, -18, 120, 3, 0xd7d7d7);
      dug.add([box, roof, rail]);
      // Tiny teammates watching from the rail.
      for (let i = 0; i < 4; i++) {
        dug.add(scene.add.circle(-42 + i * 28, -22, 5, 0xffcf9f));
        dug.add(scene.add.arc(-42 + i * 28, -24, 5, 180, 360, false, 0xd7263d));
      }
    }
  }

  private groundEllipse(g: Phaser.GameObjects.Graphics, color: number, x: number, z: number, radius: number): void {
    const c = project(x, 0, z);
    const rEdge = project(x + radius, 0, z);
    const rx = Math.abs(rEdge.x - c.x);
    g.fillStyle(color, 1);
    g.fillEllipse(c.x, c.y, rx * 2, rx * 0.72);
  }
}
