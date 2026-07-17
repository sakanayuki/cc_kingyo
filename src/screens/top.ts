import { audio } from "../audio";
import { getHighScore } from "../storage";

export class TopScreen {
  private readonly highscoreEl = document.querySelector<HTMLElement>("#top-highscore")!;

  constructor(onStart: () => void) {
    document.querySelector<HTMLElement>("#start-btn")!.addEventListener("click", () => {
      audio.tap();
      onStart();
    });
  }

  show(): void {
    const hs = getHighScore();
    this.highscoreEl.hidden = hs <= 0;
    this.highscoreEl.textContent = `さいこうきろく: ${hs}こ`;
  }
}
