import { audio } from "../audio";
import { MAX_SCORE } from "../game/config";
import { getHighScore, setHighScore } from "../storage";

function praiseFor(score: number): string {
  if (score >= MAX_SCORE) return "すべてのボールをすくったよ！";
  if (score <= 0) return "ざんねん";
  if (score <= 3) return "すごい！";
  if (score <= 9) return "とてもじょうず！";
  return "すごすぎる！";
}

export class ResultScreen {
  private readonly countEl = document.querySelector<HTMLElement>("#result-count")!;
  private readonly praiseEl = document.querySelector<HTMLElement>("#result-praise")!;
  private readonly newRecordEl = document.querySelector<HTMLElement>("#result-newrecord")!;
  private countTimer = 0;

  constructor(onRetry: () => void) {
    document.querySelector<HTMLElement>("#retry-btn")!.addEventListener("click", () => {
      audio.tap();
      onRetry();
    });
  }

  show(score: number): void {
    this.praiseEl.textContent = praiseFor(score);

    const isNewRecord = score > getHighScore();
    if (isNewRecord) setHighScore(score);
    this.newRecordEl.hidden = !isNewRecord;

    audio.fanfare();
    this.countUp(score);
  }

  /** スコアを 0 からカウントアップして表示する */
  private countUp(score: number): void {
    clearInterval(this.countTimer);
    if (score <= 0) {
      this.countEl.textContent = "0";
      return;
    }
    const durationMs = Math.min(1200, 200 + score * 120);
    const start = performance.now();
    this.countTimer = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / durationMs);
      this.countEl.textContent = String(Math.round(p * score));
      if (p >= 1) clearInterval(this.countTimer);
    }, 50);
  }
}
