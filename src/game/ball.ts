import { BALL_RADIUS, BALL_RADIUS_BIG, BIG_BALL_RATE } from "./config";

export type BallPattern = "plain" | "star" | "stripe";
export type BallState = "float" | "scooping" | "flying" | "gone";

export interface Ball {
  /** 水流の周回角度(ラジアン) */
  angle: number;
  /** 角速度(ラジアン/秒)。ゆっくり周回する */
  speed: number;
  /** 周回軌道の半径(プール短辺に対する割合 0..1) */
  orbit: number;
  /** ぷかぷか揺れの位相 */
  bobPhase: number;
  big: boolean;
  r: number;
  color: string;
  colorDark: string;
  pattern: BallPattern;
  state: BallState;
  /** 描画座標(update で計算) */
  x: number;
  y: number;
  /** 出現時のフェードイン 0..1 */
  fade: number;
}

// パステル調のスーパーボール6色(明色, 模様用の濃色)
const COLORS: ReadonlyArray<readonly [string, string]> = [
  ["#ff9eb5", "#e2607f"], // ピンク
  ["#8fd3f4", "#4d9fc7"], // 水色
  ["#ffe08a", "#e0a83c"], // 黄
  ["#b5e48c", "#74b943"], // 黄緑
  ["#cdb4f6", "#9670d6"], // 紫
  ["#ffbe76", "#e08c3c"], // オレンジ
];

const PATTERNS: readonly BallPattern[] = ["plain", "star", "stripe"];

export function spawnBall(): Ball {
  const big = Math.random() < BIG_BALL_RATE;
  const [color, colorDark] = COLORS[Math.floor(Math.random() * COLORS.length)];
  return {
    angle: Math.random() * Math.PI * 2,
    speed: 0.12 + Math.random() * 0.1,
    orbit: 0.35 + Math.random() * 0.55,
    bobPhase: Math.random() * Math.PI * 2,
    big,
    r: big ? BALL_RADIUS_BIG : BALL_RADIUS,
    color,
    colorDark,
    pattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
    state: "float",
    x: 0,
    y: 0,
    fade: 0,
  };
}

/** 水流に沿ってボールを進め、描画座標を更新する(プール全体を使う楕円軌道) */
export function updateBall(
  ball: Ball,
  dtSec: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  if (ball.state !== "float") return;
  ball.angle += ball.speed * dtSec;
  ball.bobPhase += dtSec * 2;
  ball.fade = Math.min(1, ball.fade + dtSec * 1.5);
  ball.x = cx + Math.cos(ball.angle) * rx * ball.orbit + Math.sin(ball.bobPhase) * 3;
  ball.y = cy + Math.sin(ball.angle) * ry * ball.orbit + Math.cos(ball.bobPhase * 0.8) * 3;
}

export function drawBall(ctx: CanvasRenderingContext2D, ball: Ball): void {
  const { x, y, r } = ball;
  ctx.save();
  ctx.globalAlpha = ball.fade;

  // 水面の影
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.35, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(40, 90, 130, 0.18)";
  ctx.fill();

  // 本体(パステル色 + ハイライトのグラデーション)
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.35, ball.color);
  grad.addColorStop(1, ball.colorDark);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // 模様
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (ball.pattern === "stripe") {
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = r * 0.22;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x - r, y + i * r * 0.55 - r * 0.3);
      ctx.lineTo(x + r, y + i * r * 0.55 + r * 0.3);
      ctx.stroke();
    }
  } else if (ball.pattern === "star") {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    drawStar(ctx, x - r * 0.25, y + r * 0.1, r * 0.3);
    drawStar(ctx, x + r * 0.4, y - r * 0.35, r * 0.18);
  }
  ctx.restore();

  // つやのハイライト
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.45, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();

  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
