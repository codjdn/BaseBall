/**
 * One-Euro filter (Casiez et al. 2012): adaptive low-pass filtering that
 * suppresses jitter at low speeds while keeping latency low during fast
 * motion — ideal for hand-tracking driven gameplay.
 */

class LowPass {
  private initialized = false;
  private value = 0;

  filter(x: number, alpha: number): number {
    if (!this.initialized) {
      this.initialized = true;
      this.value = x;
      return x;
    }
    this.value = alpha * x + (1 - alpha) * this.value;
    return this.value;
  }

  last(): number {
    return this.value;
  }

  reset(): void {
    this.initialized = false;
  }
}

export class OneEuroFilter {
  private readonly xFilter = new LowPass();
  private readonly dxFilter = new LowPass();
  private lastTime: number | null = null;

  constructor(
    /** Minimum cutoff frequency (Hz). Lower = smoother but laggier at rest. */
    private minCutoff = 1.2,
    /** Speed coefficient. Higher = snappier during fast movement. */
    private beta = 0.012,
    private dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(x: number, timestampMs: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestampMs;
      this.dxFilter.filter(0, 1);
      return this.xFilter.filter(x, 1);
    }
    const dt = Math.max(1e-3, (timestampMs - this.lastTime) / 1000);
    this.lastTime = timestampMs;

    const dx = (x - this.xFilter.last()) / dt;
    const edx = this.dxFilter.filter(dx, OneEuroFilter.alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(x, OneEuroFilter.alpha(cutoff, dt));
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}

/** Convenience pair for filtering 2D points. */
export class OneEuroFilter2D {
  readonly fx: OneEuroFilter;
  readonly fy: OneEuroFilter;

  constructor(minCutoff = 1.2, beta = 0.012) {
    this.fx = new OneEuroFilter(minCutoff, beta);
    this.fy = new OneEuroFilter(minCutoff, beta);
  }

  filter(x: number, y: number, tMs: number): { x: number; y: number } {
    return { x: this.fx.filter(x, tMs), y: this.fy.filter(y, tMs) };
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }
}
