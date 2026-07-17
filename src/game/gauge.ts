import { BAR_MAX, BAR_MIN, BAR_PERIOD_MS, ZONE_GOOD, ZONE_PERFECT } from "./config";

export type Zone = "perfect" | "good" | "bad";

export function judgeZone(v: number): Zone {
  const a = Math.abs(v);
  if (a <= ZONE_PERFECT) return "perfect";
  if (a <= ZONE_GOOD) return "good";
  return "bad";
}

/**
 * 目押しバー。BAR_MIN〜BAR_MAX を三角波(等速往復)で動き続ける。
 * すくい演出中は pause() で止め、タップ時点の値で判定する。
 */
export class Gauge {
  private phase = 0; // 0..1 (0.5 で +50 折り返し)
  private running = true;

  constructor(private readonly marker: HTMLElement) {
    this.render();
  }

  get value(): number {
    const range = BAR_MAX - BAR_MIN;
    return this.phase < 0.5
      ? BAR_MIN + this.phase * 2 * range
      : BAR_MAX - (this.phase - 0.5) * 2 * range;
  }

  update(dtMs: number): void {
    if (!this.running) return;
    this.phase = (this.phase + dtMs / BAR_PERIOD_MS) % 1;
    this.render();
  }

  pause(): void {
    this.running = false;
  }

  resume(): void {
    this.running = true;
  }

  reset(): void {
    this.phase = 0;
    this.running = true;
    this.render();
  }

  private render(): void {
    const range = BAR_MAX - BAR_MIN;
    this.marker.style.left = `${((this.value - BAR_MIN) / range) * 100}%`;
  }
}
