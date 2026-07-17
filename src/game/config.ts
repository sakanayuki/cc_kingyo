// ゲームバランス調整用パラメータ(詳細設計書 §4.1)

/** 耐久度の初期値 */
export const HP_MAX = 100;

/** 目押しバーの値域 */
export const BAR_MIN = -50;
export const BAR_MAX = 50;

/** 目押しバーの往復周期(ミリ秒) */
export const BAR_PERIOD_MS = 2400;

/** |v| がこの値以下なら「ぴったり」(ダメージ0) */
export const ZONE_PERFECT = 10;
/** |v| がこの値以下なら「まあまあ」(基本ダメージ) */
export const ZONE_GOOD = 30;

/** 通常ボールの基本ダメージ */
export const DAMAGE_BASE = 12;
/** 大ボールのダメージ倍率 */
export const BIG_BALL_FACTOR = 1.5;
/** はずれゾーンのダメージ倍率 */
export const BAD_ZONE_FACTOR = 2;

/** プール内のボール数 */
export const BALL_COUNT = 10;
/** 大ボールの出現率 */
export const BIG_BALL_RATE = 0.3;
/** ボールの半径(CSSピクセル) */
export const BALL_RADIUS = 22;
export const BALL_RADIUS_BIG = 33;
/** タップ当たり判定の余裕(子ども向けに甘め) */
export const TAP_MARGIN = 8;

/** この個数をすくったら全すくい達成で強制終了 */
export const MAX_SCORE = 50;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * ぴったり判定の幅(|v| がこの値以下でぴったり)。
 * 10個までは ZONE_PERFECT のまま、10→20個で線形に狭まり 1/4 の幅になる。
 */
export function zonePerfectFor(score: number): number {
  const t = clamp01((score - 10) / 10);
  return ZONE_PERFECT * (1 - 0.75 * t);
}

/**
 * まあまあ判定の外側境界(|v| がこの値以下でまあまあ)。
 * 30個までは ZONE_GOOD のまま、30→40個でぴったり境界まで狭まり、
 * 40個以降はまあまあ判定が消滅する(ぴったり以外はすべてはずれ)。
 */
export function zoneGoodFor(score: number): number {
  const t = clamp01((score - 30) / 10);
  return ZONE_GOOD + (zonePerfectFor(score) - ZONE_GOOD) * t;
}

/**
 * 目押しバーの往復周期。20個までは BAR_PERIOD_MS のまま、
 * 20→30個で線形に短くなり、30個以降は半分の周期(2倍速)になる。
 */
export function barPeriodFor(score: number): number {
  const t = clamp01((score - 20) / 10);
  return BAR_PERIOD_MS * (1 - 0.5 * t);
}

/** カットイン演出の長さ(ぴったり判定時のみ) */
export const CUTIN_MS = 1200;
/** 通常すくい演出の長さ(まあまあ/はずれ) */
export const SCOOP_MS = 700;
/** すくわれたボールが再出現するまでの時間 */
export const RESPAWN_DELAY_MS = 1500;
