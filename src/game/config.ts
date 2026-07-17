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

/** カットイン演出の長さ(ぴったり判定時のみ) */
export const CUTIN_MS = 1200;
/** 通常すくい演出の長さ(まあまあ/はずれ) */
export const SCOOP_MS = 700;
/** すくわれたボールが再出現するまでの時間 */
export const RESPAWN_DELAY_MS = 1500;
