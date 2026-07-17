// すくい演出まわりの部品: ポイのスプライトシート再生と水しぶきパーティクル

/** poi.png(5×5=25コマ)のスプライトシート */
export class PoiSprite {
  static readonly COLS = 5;
  static readonly FRAMES = 25;
  private image: HTMLImageElement;
  private loaded = false;

  constructor() {
    this.image = new Image();
    this.image.src = `${import.meta.env.BASE_URL}assets/poi.png`;
    this.image.onload = () => {
      this.loaded = true;
    };
  }

  /** frame: 0..24 を (x, y) 中心・size 四方に描画 */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    frame: number,
    x: number,
    y: number,
    size: number,
  ): void {
    if (!this.loaded) return;
    const cell = this.image.width / PoiSprite.COLS;
    const f = Math.max(0, Math.min(PoiSprite.FRAMES - 1, Math.floor(frame)));
    const sx = (f % PoiSprite.COLS) * cell;
    const sy = Math.floor(f / PoiSprite.COLS) * cell;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, sx, sy, cell, cell, x - size / 2, y - size / 2, size, size);
  }
}

export interface Splash {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number; // 残り秒
  maxLife: number;
}

export function createSplashes(x: number, y: number, count: number): Splash[] {
  const out: Splash[] = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 160;
    const life = 0.4 + Math.random() * 0.4;
    out.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 120,
      r: 2 + Math.random() * 4,
      life,
      maxLife: life,
    });
  }
  return out;
}

export function updateSplashes(splashes: Splash[], dtSec: number): void {
  for (const s of splashes) {
    s.x += s.vx * dtSec;
    s.y += s.vy * dtSec;
    s.vy += 500 * dtSec; // 重力
    s.life -= dtSec;
  }
  for (let i = splashes.length - 1; i >= 0; i--) {
    if (splashes[i].life <= 0) splashes.splice(i, 1);
  }
}

export function drawSplashes(ctx: CanvasRenderingContext2D, splashes: Splash[]): void {
  for (const s of splashes) {
    const a = Math.max(0, s.life / s.maxLife);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(235, 250, 255, ${0.9 * a})`;
    ctx.fill();
  }
}
