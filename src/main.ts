import "./style.css";
import { audio } from "./audio";
import { GameScreen } from "./screens/game";
import { ResultScreen } from "./screens/result";
import { TopScreen } from "./screens/top";

type ScreenId = "top" | "game" | "result";

const sections: Record<ScreenId, HTMLElement> = {
  top: document.querySelector<HTMLElement>("#screen-top")!,
  game: document.querySelector<HTMLElement>("#screen-game")!,
  result: document.querySelector<HTMLElement>("#screen-result")!,
};

function showScreen(id: ScreenId): void {
  for (const [key, el] of Object.entries(sections)) {
    el.hidden = key !== id;
  }
}

const gameScreen = new GameScreen((score) => {
  showScreen("result");
  resultScreen.show(score);
});

const topScreen = new TopScreen(() => {
  showScreen("game");
  gameScreen.start();
});

const resultScreen = new ResultScreen(() => {
  showScreen("game");
  gameScreen.start();
});

// ミュートボタン(全画面共通)
const muteBtn = document.querySelector<HTMLElement>("#mute-btn")!;
muteBtn.textContent = audio.muted ? "🔇" : "🔊";
muteBtn.addEventListener("click", () => {
  muteBtn.textContent = audio.toggleMute() ? "🔇" : "🔊";
  audio.tap();
});

// 長押しメニューを無効化(3歳児の誤操作対策)
document.addEventListener("contextmenu", (e) => e.preventDefault());

showScreen("top");
topScreen.show();
