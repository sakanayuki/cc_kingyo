import { BALL_RADIUS, BALL_RADIUS_BIG, BIG_BALL_RATE } from "./config";

export type BallPattern = "plain" | "star" | "stripe";
export type BallState = "float" | "scooping" | "flying" | "gone";

export interface Ball {
  /** 好みの周回半径(プール半径に対する割合 0..1)。水流がこの半径へ緩く引き戻す */
  orbit: number;
  /** 水流に乗って進む速さ(ピクセル/秒) */
  flowSpeed: number;
  /** ぷかぷか揺れの位相 */
  bobPhase: number;
  big: boolean;
  r: number;
  color: string;
  colorDark: string;
  pattern: BallPattern;
  state: BallState;
  /** 現在座標(水流 + 衝突分離で更新される) */
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
    orbit: 0.35 + Math.random() * 0.55,
    flowSpeed: 16 + Math.random() * 14,
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

/**
 * 水流に沿ってボールを進める。座標そのものが状態なので、
 * 衝突分離で押しのけられてもそこから自然に流れ続ける。
 */
export function updateBall(
  ball: Ball,
  dtSec: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  if (ball.state !== "float") return;
  ball.bobPhase += dtSec * 2;
  ball.fade = Math.min(1, ball.fade + dtSec * 1.5);

  // プールを単位円とみなした座標系で接線(反時計回り)方向を求める
  const ux = (ball.x - cx) / rx;
  const uy = (ball.y - cy) / ry;
  const ur = Math.max(Math.hypot(ux, uy), 1e-4);
  let tx = (-uy / ur) * rx;
  let ty = (ux / ur) * ry;
  const tLen = Math.max(Math.hypot(tx, ty), 1e-4);
  tx /= tLen;
  ty /= tLen;

  // 好みの周回半径へ緩く引き戻す径方向の速度
  const radial = (ball.orbit - ur) * 40;
  const nx = (ux / ur) * rx;
  const ny = (uy / ur) * ry;
  const nLen = Math.max(Math.hypot(nx, ny), 1e-4);

  ball.x += (tx * ball.flowSpeed + (nx / nLen) * radial) * dtSec;
  ball.y += (ty * ball.flowSpeed + (ny / nLen) * radial) * dtSec;

  // ぷかぷか揺れ(速度として加えるので分離結果を壊さない)
  ball.x += Math.cos(ball.bobPhase) * 2.5 * dtSec;
  ball.y += Math.sin(ball.bobPhase * 0.8) * 2.5 * dtSec;

  // プールの外へは出さない
  clampToPool(ball, cx, cy, rx, ry);
}

/** プール(楕円)の内側にとどめる */
export function clampToPool(ball: Ball, cx: number, cy: number, rx: number, ry: number): void {
  const ux = (ball.x - cx) / rx;
  const uy = (ball.y - cy) / ry;
  const ur = Math.hypot(ux, uy);
  if (ur > 0.97) {
    const k = 0.97 / ur;
    ball.x = cx + ux * k * rx;
    ball.y = cy + uy * k * ry;
  }
}

/**
 * ボール同士の重なりを解消する(浮いているボールのみ)。
 * 重なった分だけ互いを押しのける位置ベースの分離を反復して安定させる。
 */
export function separateBalls(
  balls: Ball[],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  const floats = balls.filter((b) => b.state === "float");
  const GAP = 3; // ボール間に最低限あける隙間
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (let i = 0; i < floats.length; i++) {
      for (let j = i + 1; j < floats.length; j++) {
        const a = floats[i];
        const b = floats[j];
        const minD = a.r + b.r + GAP;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d >= minD) continue;
        if (d < 1e-3) {
          // 完全に重なったらランダム方向に離す
          const ang = Math.random() * Math.PI * 2;
          dx = Math.cos(ang);
          dy = Math.sin(ang);
          d = 1;
        }
        const push = (minD - d) / 2;
        a.x += (dx / d) * push;
        a.y += (dy / d) * push;
        b.x -= (dx / d) * push;
        b.y -= (dy / d) * push;
        moved = true;
      }
    }
    if (moved) {
      for (const b of floats) clampToPool(b, cx, cy, rx, ry);
    } else {
      break;
    }
  }
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
