/**
 * Typed localStorage persistence for settings, high scores, statistics and
 * unlocks. Everything degrades gracefully when storage is unavailable
 * (private browsing, embedded webviews).
 */
import type { BatSkinId, Handedness } from '../game/config';

const KEY = 'finger-baseball-arcade/v1';

export interface Settings {
  handedness: Handedness;
  /** Swing sensitivity multiplier, 0.5 .. 2.0. */
  sensitivity: number;
  showCameraPreview: boolean;
  mirrorCamera: boolean;
  reducedMotion: boolean;
  colorblind: boolean;
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
  theme: 'day' | 'night' | 'auto';
  batSkin: BatSkinId;
  /** Preferred camera facing for mobile devices. */
  cameraFacing: 'user' | 'environment';
  /** Play with pointer input instead of the webcam. */
  pointerMode: boolean;
}

export interface Stats {
  gamesPlayed: number;
  totalScore: number;
  bestScore: number;
  swings: number;
  hits: number;
  homeRuns: number;
  bestCombo: number;
  longestHit: number; // feet
  perfectHits: number;
  strikeouts: number;
  walks: number;
}

interface SaveData {
  settings: Settings;
  stats: Stats;
}

export const DEFAULT_SETTINGS: Settings = {
  handedness: 'right',
  sensitivity: 1,
  showCameraPreview: true,
  mirrorCamera: true,
  reducedMotion: false,
  colorblind: false,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  theme: 'auto',
  batSkin: 'wood',
  cameraFacing: 'user',
  pointerMode: false,
};

export const DEFAULT_STATS: Stats = {
  gamesPlayed: 0,
  totalScore: 0,
  bestScore: 0,
  swings: 0,
  hits: 0,
  homeRuns: 0,
  bestCombo: 0,
  longestHit: 0,
  perfectHits: 0,
  strikeouts: 0,
  walks: 0,
};

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return {
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        stats: { ...DEFAULT_STATS, ...parsed.stats },
      };
    }
  } catch {
    /* storage unavailable or corrupt — fall through to defaults */
  }
  return { settings: { ...DEFAULT_SETTINGS }, stats: { ...DEFAULT_STATS } };
}

class Storage {
  private data: SaveData = load();

  get settings(): Settings {
    return this.data.settings;
  }

  get stats(): Stats {
    return this.data.stats;
  }

  updateSettings(patch: Partial<Settings>): void {
    Object.assign(this.data.settings, patch);
    this.persist();
  }

  updateStats(patch: Partial<Stats>): void {
    Object.assign(this.data.stats, patch);
    this.persist();
  }

  /** Record a finished game and return true if it set a new high score. */
  recordGame(score: number): boolean {
    const s = this.data.stats;
    s.gamesPlayed += 1;
    s.totalScore += score;
    const isRecord = score > s.bestScore;
    if (isRecord) s.bestScore = score;
    this.persist();
    return isRecord;
  }

  private persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* best effort */
    }
  }
}

/** App-wide singleton. */
export const storage = new Storage();
