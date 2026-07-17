import { Ball, drawBall, separateBalls, spawnBall, updateBall } from "./ball";
import { BALL_COUNT, RESPAWN_DELAY_MS, TAP_MARGIN } from "./config";
import {
  createSplashes,
  drawSplashes,
  PoiSprite,
  Splash,
  updateSplashes,
} from "./scoop";

interface ScoopAnim {
  ball: Ball;
  elapsed: number; // 秒
  duration: number; // 秒
  fromX: number;
  fromY: number;
  splashed: boolean;
  resolve: () => void;
}

/**
 * ビニールプール。ボールの周回・描画・タップ判定・すくい演出(ポイのスプライト
 * アニメ+水しぶき+お椀への移動)を canvas 上で管理する。
 */
export class Pool {
  private ctx: CanvasRenderingContext2D;
  private width = 0; // CSSピクセル
  private height = 0;
  private balls: Ball[] = [];
  private splashes: Splash[] = [];
  private anims: ScoopAnim[] = [];
  private respawnTimers: number[] = [];
  private sprite = new PoiSprite();
  private time = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onBallTap: (ball: Ball) => void,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    this.ctx = ctx;

    const wrap = canvas.parentElement!;
    new ResizeObserver(() => this.resize()).observe(wrap);
    this.resize();

    canvas.addEventListener("pointerdown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const ball = this.hitTest(x, y);
      if (ball) this.onBallTap(ball);
    });
  }

  reset(): void {
    for (const t of this.respawnTimers) clearTimeout(t);
    this.respawnTimers = [];
    this.splashes = [];
    this.anims = [];
    this.balls = [];
    for (let i = 0; i < BALL_COUNT; i++) {
      const b = spawnBall();
      b.fade = 1;
      this.placeBall(b);
      this.balls.push(b);
    }
  }

  /** 他のボールと重ならない位置に配置する */
  private placeBall(ball: Ball): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const rx = Math.max(this.width / 2 - 45, 40);
    const ry = Math.max(this.height / 2 - 55, 40);
    for (let attempt = 0; attempt < 30; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const ur = ball.orbit * (0.8 + Math.random() * 0.3);
      ball.x = cx + Math.cos(ang) * rx * ur;
      ball.y = cy + Math.sin(ang) * ry * ur;
      const overlapping = this.balls.some(
        (other) =>
          other !== ball &&
          other.state === "float" &&
          Math.hypot(other.x - ball.x, other.y - ball.y) < other.r + ball.r + 6,
      );
      if (!overlapping) return;
    }
    // 空きが見つからなくても配置は諦めない(分離処理が徐々に押し広げる)
  }

  /** すくい演出を開始する。演出完了で resolve する Promise を返す */
  scoopBall(ball: Ball, durationMs: number): Promise<void> {
    ball.state = "scooping";
    return new Promise((resolve) => {
      this.anims.push({
        ball,
        elapsed: 0,
        duration: durationMs / 1000,
        fromX: ball.x,
        fromY: ball.y,
        splashed: false,
        resolve,
      });
    });
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    this.time += dt;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const rx = Math.max(this.width / 2 - 45, 40);
    const ry = Math.max(this.height / 2 - 55, 40);

    for (const b of this.balls) updateBall(b, dt, cx, cy, rx, ry);
    separateBalls(this.balls, cx, cy, rx, ry);
    updateSplashes(this.splashes, dt);

    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.elapsed += dt;
      const p = a.elapsed / a.duration;
      if (!a.splashed && p >= 0.3) {
        a.splashed = true;
        this.splashes.push(...createSplashes(a.fromX, a.fromY, a.ball.big ? 26 : 18));
      }
      if (p >= 0.55 && a.ball.state === "scooping") a.ball.state = "flying";
      if (a.ball.state === "flying") {
        // すくい後、放物線を描いてお椀へ飛んでいく
        const t = Math.min(1, (p - 0.55) / 0.45);
        const [bx, by] = this.bowlPos();
        a.ball.x = a.fromX + (bx - a.fromX) * t;
        a.ball.y = a.fromY + (by - a.fromY) * t - Math.sin(t * Math.PI) * 70;
        a.ball.fade = 1 - t * 0.4;
      }
      if (p >= 1) {
        a.ball.state = "gone";
        a.resolve();
        this.anims.splice(i, 1);
        this.scheduleRespawn(a.ball);
      }
    }
  }

  draw(): void {
    const { ctx, width: w, height: h } = this;
    ctx.clearRect(0, 0, w, h);

    this.drawWater();
    this.drawBowl();

    const visible = this.balls
      .filter((b) => b.state !== "gone")
      .sort((a, b) => a.y - b.y);
    for (const b of visible) drawBall(ctx, b);

    // すくい中はボールの上にポイのスプライトアニメを重ねる
    for (const a of this.anims) {
      const p = Math.min(1, a.elapsed / (a.duration * 0.7));
      const frame = p * (PoiSprite.FRAMES - 1);
      if (p < 1) {
        this.sprite.drawFrame(ctx, frame, a.fromX + 6, a.fromY + 4, a.ball.r * 4.6);
      }
    }

    drawSplashes(ctx, this.splashes);
  }

  private hitTest(x: number, y: number): Ball | null {
    // 手前(描画が上)のボールを優先
    const candidates = this.balls
      .filter((b) => b.state === "float")
      .sort((a, b) => b.y - a.y);
    for (const b of candidates) {
      if (Math.hypot(b.x - x, b.y - y) <= b.r + TAP_MARGIN) return b;
    }
    return null;
  }

  private scheduleRespawn(ball: Ball): void {
    const timer = window.setTimeout(() => {
      const i = this.balls.indexOf(ball);
      if (i >= 0) {
        const fresh = spawnBall();
        this.placeBall(fresh);
        this.balls[i] = fresh;
      }
    }, RESPAWN_DELAY_MS);
    this.respawnTimers.push(timer);
  }

  private bowlPos(): [number, number] {
    return [this.width - 52, this.height - 42];
  }

  private drawWater(): void {
    const { ctx, width: w, height: h } = this;
    // 水面のゆらゆらしたハイライト
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const y = ((i + 0.5) / 7) * h + Math.sin(this.time * 0.8 + i * 2.1) * 8;
      const x = (((i * 137 + this.time * 18) % (w + 160)) + w + 160) % (w + 160) - 80;
      const len = 40 + (i % 3) * 22;
      ctx.beginPath();
      ctx.moveTo(x - len / 2, y);
      ctx.quadraticCurveTo(x, y + 4, x + len / 2, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBowl(): void {
    const { ctx } = this;
    const [x, y] = this.bowlPos();
    ctx.save();
    // お椀(赤いおわん)
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 34, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(40, 90, 130, 0.2)";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y, 32, 20, 0, 0, Math.PI);
    ctx.fillStyle = "#c0392b";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y, 32, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#e8604f";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y, 25, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#8e2418";
    ctx.fill();
    ctx.restore();
  }

  private resize(): void {
    const wrap = this.canvas.parentElement!;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}
