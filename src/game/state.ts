import { HP_MAX } from "./config";

export interface GameState {
  /** 現在の耐久度 */
  hp: number;
  /** すくった個数 */
  score: number;
  /** すくい演出中の入力ロック */
  locked: boolean;
}

export function createState(): GameState {
  return { hp: HP_MAX, score: 0, locked: false };
}
