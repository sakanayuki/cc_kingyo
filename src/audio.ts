// Web Audio API で合成する効果音(音声ファイル不使用)
import { getMuted, setMuted } from "./storage";

class AudioFx {
  private ctx: AudioContext | null = null;
  muted = getMuted();

  toggleMute(): boolean {
    this.muted = !this.muted;
    setMuted(this.muted);
    return this.muted;
  }

  /** モバイルの自動再生制限対策: ユーザー操作を起点に AudioContext を用意する */
  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    freq: number,
    durSec: number,
    type: OscillatorType = "sine",
    gain = 0.12,
    delaySec = 0,
  ): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + durSec);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durSec);
  }

  private noise(durSec: number, filterFreq: number, gain = 0.2, delaySec = 0): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delaySec;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * durSec), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFreq, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + durSec);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t0);
  }

  /** ボタンのタップ音 */
  tap(): void {
    this.tone(660, 0.08, "square", 0.06);
  }

  /** 水しぶき「ちゃぷん」 */
  splash(): void {
    this.noise(0.35, 1800, 0.25);
    this.tone(300, 0.12, "sine", 0.08);
  }

  /** ぴったり判定のキラキラ音 */
  perfect(): void {
    this.tone(880, 0.18, "triangle", 0.12);
    this.tone(1108, 0.18, "triangle", 0.12, 0.09);
    this.tone(1318, 0.3, "triangle", 0.12, 0.18);
  }

  /** 和紙がダメージを受けた音 */
  damage(): void {
    this.tone(150, 0.16, "sawtooth", 0.1);
    this.noise(0.1, 900, 0.12);
  }

  /** 和紙が破れた音 */
  tear(): void {
    this.noise(0.5, 3200, 0.3);
    this.tone(110, 0.4, "sawtooth", 0.12);
  }

  /** リザルトのファンファーレ */
  fanfare(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this.tone(f, 0.25, "triangle", 0.12, i * 0.14));
  }
}

export const audio = new AudioFx();
