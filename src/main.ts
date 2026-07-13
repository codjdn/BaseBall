/**
 * Entry point. Creates the Phaser game with every scene registered and
 * removes the HTML boot loader once the engine is ready.
 */
import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './game/config';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { CalibrationScene } from './game/scenes/CalibrationScene';
import { GameScene } from './game/scenes/GameScene';
import { HudScene } from './game/scenes/HudScene';
import { PauseScene } from './game/scenes/PauseScene';
import { GameOverScene } from './game/scenes/GameOverScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  backgroundColor: '#0b1c33',
  scale: {
    // FIT keeps the whole field visible on any screen; the game is designed
    // landscape-first and letterboxes gracefully in portrait.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  fps: {
    smoothStep: true,
  },
  input: {
    activePointers: 2, // multi-touch: one finger bats, another can hit pause
  },
  scene: [BootScene, MenuScene, CalibrationScene, GameScene, HudScene, PauseScene, GameOverScene],
};

const game = new Phaser.Game(config);

game.events.once(Phaser.Core.Events.READY, () => {
  const loader = document.getElementById('boot-loader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 450);
  }
});
