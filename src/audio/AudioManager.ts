/**
 * WebAudio-based sound system. Every sound is synthesized at runtime, so the
 * repo ships no audio binaries — but each key can be overridden with a real
 * recording by adding an entry to FILE_OVERRIDES (e.g. 'crack':
 * 'assets/sounds/crack.mp3'). Files, when present, take priority over synth.
 */
import { storage } from '../utils/storage';

export type SoundKey =
  | 'click'
  | 'hover'
  | 'crack'
  | 'crackPerfect'
  | 'throw'
  | 'catch'
  | 'cheer'
  | 'homer'
  | 'strike'
  | 'foul'
  | 'walk'
  | 'combo'
  | 'jackpot'
  | 'target'
  | 'gameOver'
  | 'countdown';

/** Map a key to a file under public/ to replace its placeholder synth. */
const FILE_OVERRIDES: Partial<Record<SoundKey, string>> = {};

class AudioManager {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers = new Map<SoundKey, AudioBuffer>();
  private musicTimer: number | null = null;
  private musicStep = 0;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.ctx.destination);
    this.musicGain.connect(this.ctx.destination);
    this.applyVolumes();
    void this.preloadFiles();
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.sfxGain!.gain.value = storage.settings.sfxVolume;
    this.musicGain!.gain.value = storage.settings.musicVolume * 0.5;
  }

  private async preloadFiles(): Promise<void> {
    if (!this.ctx) return;
    for (const [key, url] of Object.entries(FILE_OVERRIDES)) {
      try {
        const res = await fetch(url);
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(key as SoundKey, buf);
      } catch {
        /* fall back to synth */
      }
    }
  }

  play(key: SoundKey, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || storage.settings.sfxVolume <= 0) return;
    const file = this.buffers.get(key);
    if (file) {
      const src = ctx.createBufferSource();
      src.buffer = file;
      const g = ctx.createGain();
      g.gain.value = volume;
      src.connect(g).connect(this.sfxGain);
      src.start();
      return;
    }
    this.synth(key, volume);
  }

  // --- Placeholder synthesis ------------------------------------------------

  private noiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private burst(opts: {
    volume: number;
    duration: number;
    filterFrom: number;
    filterTo: number;
    type?: BiquadFilterType;
    q?: number;
  }): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? 'lowpass';
    filter.Q.value = opts.q ?? 1;
    filter.frequency.setValueAtTime(opts.filterFrom, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.filterTo), ctx.currentTime + opts.duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.volume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + opts.duration);
    src.connect(filter).connect(g).connect(this.sfxGain!);
    src.start();
    src.stop(ctx.currentTime + opts.duration + 0.05);
  }

  private tone(opts: {
    freq: number;
    endFreq?: number;
    volume: number;
    duration: number;
    type?: OscillatorType;
    when?: number;
    dest?: GainNode;
  }): void {
    const ctx = this.ctx!;
    const start = ctx.currentTime + (opts.when ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'square';
    osc.frequency.setValueAtTime(opts.freq, start);
    if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(opts.endFreq, start + opts.duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(opts.volume, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + opts.duration);
    osc.connect(g).connect(opts.dest ?? this.sfxGain!);
    osc.start(start);
    osc.stop(start + opts.duration + 0.05);
  }

  private synth(key: SoundKey, v: number): void {
    switch (key) {
      case 'click':
        this.tone({ freq: 660, endFreq: 880, volume: 0.25 * v, duration: 0.07, type: 'triangle' });
        break;
      case 'hover':
        this.tone({ freq: 440, volume: 0.1 * v, duration: 0.04, type: 'sine' });
        break;
      case 'crack':
        this.burst({ volume: 0.9 * v, duration: 0.12, filterFrom: 4500, filterTo: 300 });
        this.tone({ freq: 180, endFreq: 60, volume: 0.5 * v, duration: 0.09, type: 'square' });
        break;
      case 'crackPerfect':
        this.burst({ volume: 1 * v, duration: 0.16, filterFrom: 6000, filterTo: 400 });
        this.tone({ freq: 220, endFreq: 70, volume: 0.6 * v, duration: 0.12, type: 'square' });
        this.tone({ freq: 880, endFreq: 1760, volume: 0.25 * v, duration: 0.3, type: 'sine', when: 0.05 });
        break;
      case 'throw':
        this.burst({ volume: 0.25 * v, duration: 0.25, filterFrom: 600, filterTo: 2400, type: 'bandpass', q: 2 });
        break;
      case 'catch':
        this.burst({ volume: 0.5 * v, duration: 0.08, filterFrom: 900, filterTo: 150 });
        break;
      case 'cheer':
        this.burst({ volume: 0.35 * v, duration: 1.2, filterFrom: 1200, filterTo: 800, type: 'bandpass', q: 0.6 });
        break;
      case 'homer':
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone({ freq: f, volume: 0.3 * v, duration: 0.22, type: 'square', when: i * 0.11 }),
        );
        this.burst({ volume: 0.4 * v, duration: 1.6, filterFrom: 1400, filterTo: 900, type: 'bandpass', q: 0.5 });
        break;
      case 'strike':
        this.tone({ freq: 300, endFreq: 150, volume: 0.35 * v, duration: 0.18, type: 'sawtooth' });
        break;
      case 'foul':
        this.tone({ freq: 240, endFreq: 200, volume: 0.3 * v, duration: 0.15, type: 'square' });
        break;
      case 'walk':
        [392, 494, 587].forEach((f, i) => this.tone({ freq: f, volume: 0.2 * v, duration: 0.12, when: i * 0.09, type: 'triangle' }));
        break;
      case 'combo':
        this.tone({ freq: 700, endFreq: 1400, volume: 0.25 * v, duration: 0.12, type: 'square' });
        break;
      case 'target':
        [880, 1175].forEach((f, i) => this.tone({ freq: f, volume: 0.25 * v, duration: 0.1, when: i * 0.07, type: 'triangle' }));
        break;
      case 'jackpot':
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
          this.tone({ freq: f, volume: 0.28 * v, duration: 0.16, type: 'square', when: i * 0.08 }),
        );
        break;
      case 'gameOver':
        [523, 440, 349, 262].forEach((f, i) =>
          this.tone({ freq: f, volume: 0.3 * v, duration: 0.3, type: 'triangle', when: i * 0.22 }),
        );
        break;
      case 'countdown':
        this.tone({ freq: 520, volume: 0.25 * v, duration: 0.09, type: 'square' });
        break;
    }
  }

  // --- Music -----------------------------------------------------------------

  /** Simple upbeat chiptune loop as placeholder ballpark music. */
  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    const bass = [131, 131, 175, 196, 131, 131, 175, 98];
    const lead = [523, 0, 659, 784, 0, 659, 523, 392];
    const stepDur = 0.24;
    const tick = (): void => {
      if (!this.ctx || !this.musicGain) return;
      if (storage.settings.musicVolume > 0) {
        const i = this.musicStep % 8;
        this.tone({ freq: bass[i], volume: 0.16, duration: stepDur * 0.9, type: 'triangle', dest: this.musicGain });
        if (lead[i] > 0 && this.musicStep % 2 === 0) {
          this.tone({ freq: lead[i], volume: 0.05, duration: stepDur * 0.6, type: 'square', dest: this.musicGain });
        }
      }
      this.musicStep += 1;
    };
    this.musicTimer = window.setInterval(tick, stepDur * 1000);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audio = new AudioManager();
