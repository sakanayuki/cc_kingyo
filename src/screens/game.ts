import { audio } from "../audio";
import { Ball } from "../game/ball";
import {
  BAD_ZONE_FACTOR,
  BAR_MAX,
  BAR_MIN,
  barPeriodFor,
  BIG_BALL_FACTOR,
  CUTIN_MS,
  DAMAGE_BASE,
  HP_MAX,
  MAX_SCORE,
  SCOOP_MS,
  zoneGoodFor,
  zonePerfectFor,
} from "../game/config";
import { Gauge, judgeZone, Zone } from "../game/gauge";
import { Pool } from "../game/pool";
import { PoiSprite } from "../game/scoop";
import { createState, GameState } from "../game/state";

function $(sel: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`element not found: ${sel}`);
  return el;
}

const JUDGE_LABEL: Record<Zone, string> = {
  perfect: "ぴったり！",
  good: "まあまあ",
  bad: "はずれ…",
};

function damageFor(zone: Zone, big: boolean): number {
  const zoneFactor = zone === "perfect" ? 0 : zone === "good" ? 1 : BAD_ZONE_FACTOR;
  const sizeFactor = big ? BIG_BALL_FACTOR : 1;
  return Math.round(DAMAGE_BASE * zoneFactor * sizeFactor);
}

export class GameScreen {
  private state: GameState = createState();
  private readonly pool: Pool;
  private readonly gauge: Gauge;
  private readonly cutinSprite = new PoiSprite();

  private rafId = 0;
  private lastTime = 0;
  private running = false;

  private readonly hpFill = $("#hp-fill");
  private readonly poiIcon = $("#poi-icon");
  private readonly scoreDisplay = $("#score-display");
  private readonly judgement = $("#judgement");
  private readonly cutin = $("#cutin");
  private readonly cutinCanvas = document.querySelector<HTMLCanvasElement>("#cutin-canvas")!;
  private readonly zoneEls = Array.from(
    document.querySelectorAll<HTMLElement>("#screen-game .gauge-track .zone"),
  );
  private judgementTimer = 0;

  constructor(private readonly onEnd: (score: number) => void) {
    this.pool = new Pool(
      document.querySelector<HTMLCanvasElement>("#pool-canvas")!,
      (ball) => void this.handleTap(ball),
    );
    this.gauge = new Gauge($("#gauge-marker"));
    this.poiIcon.style.backgroundImage = `url(${import.meta.env.BASE_URL}assets/poi.png)`;

    $("#give-up-btn").addEventListener("click", () => {
      if (!this.running || this.state.locked) return;
      audio.tap();
      this.finish();
    });
  }

  start(): void {
    this.state = createState();
    this.pool.reset();
    this.gauge.reset();
    this.cutin.hidden = true;
    this.judgement.hidden = true;
    this.updateHud();
    this.applyDifficulty();
    this.running = true;
    this.lastTime = performance.now();
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(100, now - this.lastTime);
    this.lastTime = now;
    this.gauge.update(dt);
    this.pool.update(dt);
    this.pool.draw();
    this.rafId = requestAnimationFrame(this.tick);
  };

  /** ボールタップ → 判定 → すくい演出 → ダメージ適用(演出中は入力ロック) */
  private async handleTap(ball: Ball): Promise<void> {
    if (!this.running || this.state.locked || ball.state !== "float") return;
    this.state.locked = true;
    this.gauge.pause();

    const zone = judgeZone(this.gauge.value, this.state.score);
    audio.splash();
    this.showJudgement(zone, ball);

    const isPerfect = zone === "perfect";
    if (isPerfect) {
      audio.perfect();
      void this.playCutin();
    }
    await this.pool.scoopBall(ball, isPerfect ? CUTIN_MS : SCOOP_MS);

    this.state.score++;
    const dmg = damageFor(zone, ball.big);
    if (dmg > 0) {
      audio.damage();
      this.state.hp = Math.max(0, this.state.hp - dmg);
    }
    this.updateHud();
    this.applyDifficulty();

    // 全ボールすくい達成で強制終了
    if (this.state.score >= MAX_SCORE) {
      audio.fanfare();
      await delay(600);
      this.finish();
      return;
    }

    if (this.state.hp <= 0) {
      audio.tear();
      this.poiIcon.classList.add("torn");
      await delay(900);
      this.finish();
      return;
    }
    this.gauge.resume();
    this.state.locked = false;
  }

  /** スコアに応じた難易度をバー周期とゾーン表示幅に反映する */
  private applyDifficulty(): void {
    const score = this.state.score;
    this.gauge.setPeriod(barPeriodFor(score));

    // ゾーンの表示幅を判定と一致させる(バー全体 = BAR_MIN..BAR_MAX)
    const range = BAR_MAX - BAR_MIN;
    const perfectW = (zonePerfectFor(score) * 2 * 100) / range;
    const goodW = ((zoneGoodFor(score) - zonePerfectFor(score)) * 100) / range;
    const badW = 50 - goodW - perfectW / 2;
    const widths = [badW, goodW, perfectW, goodW, badW];
    this.zoneEls.forEach((el, i) => {
      el.style.flexBasis = `${widths[i]}%`;
    });
  }

  private finish(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.onEnd(this.state.score);
  }

  private updateHud(): void {
    const ratio = this.state.hp / HP_MAX;
    this.hpFill.style.width = `${ratio * 100}%`;
    this.hpFill.classList.toggle("hp-mid", ratio <= 0.6 && ratio > 0.3);
    this.hpFill.classList.toggle("hp-low", ratio <= 0.3);

    // ポイのアイコンは和紙の破れが進む3段階
    const stage = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
    this.poiIcon.className = `poi-icon stage-${stage}${this.state.hp <= 0 ? " torn" : ""}`;

    this.scoreDisplay.textContent = `×${this.state.score}`;
    this.scoreDisplay.classList.remove("pop");
    if (this.state.score > 0) {
      // reflow を挟んでアニメーションを再トリガー
      void this.scoreDisplay.offsetWidth;
      this.scoreDisplay.classList.add("pop");
    }
  }

  private showJudgement(zone: Zone, ball: Ball): void {
    const el = this.judgement;
    el.textContent = JUDGE_LABEL[zone];
    el.className = `judgement ${zone}`;
    const wrap = el.parentElement!.getBoundingClientRect();
    el.style.left = `${Math.min(Math.max(ball.x, 70), wrap.width - 70)}px`;
    el.style.top = `${Math.max(ball.y - ball.r - 26, 24)}px`;
    el.hidden = false;
    clearTimeout(this.judgementTimer);
    this.judgementTimer = window.setTimeout(() => {
      el.hidden = true;
    }, 850);
  }

  /** ぴったり判定のときだけのカットイン演出 */
  private async playCutin(): Promise<void> {
    const ctx = this.cutinCanvas.getContext("2d")!;
    this.cutin.hidden = false;
    const start = performance.now();
    const animMs = CUTIN_MS * 0.8;
    const size = this.cutinCanvas.width;
    const step = (now: number): void => {
      const p = Math.min(1, (now - start) / animMs);
      ctx.clearRect(0, 0, size, size);
      this.cutinSprite.drawFrame(ctx, p * (PoiSprite.FRAMES - 1), size / 2, size / 2, size * 0.92);
      if (p < 1 && !this.cutin.hidden) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    await delay(CUTIN_MS);
    this.cutin.hidden = true;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
