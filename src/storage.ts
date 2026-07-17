// localStorage の読み書き(ハイスコア・ミュート設定)
const KEY_HIGHSCORE = "superball-highscore";
const KEY_MUTED = "superball-muted";

export function getHighScore(): number {
  try {
    const v = Number(localStorage.getItem(KEY_HIGHSCORE));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function setHighScore(score: number): void {
  try {
    localStorage.setItem(KEY_HIGHSCORE, String(score));
  } catch {
    // プライベートモード等で保存できなくてもゲームは続行できる
  }
}

export function getMuted(): boolean {
  try {
    return localStorage.getItem(KEY_MUTED) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(KEY_MUTED, muted ? "1" : "0");
  } catch {
    // 保存失敗は無視
  }
}
