// ポイ(すくい道具)の25コマスプライトシート生成スクリプト
// 5×5グリッド、左上→右→次の行の順で、立ち姿→水平→立ち姿へ回転するアニメーション。
// 依存ライブラリなし(Node標準のzlibでPNGを直接エンコード)。
//
// 使い方: node tools/generate-poi.mjs
// 出力:   public/assets/poi.png (1440×1440, 1コマ288×288, 背景透過)

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const COLS = 5;
const ROWS = 5;
const CELL = 96; // 論理解像度(ドット絵の粒度)
const SCALE = 3; // 最近傍拡大率 → 出力1コマ 288px

// 各コマの (縦つぶれ率 sy, 傾き tilt°)。sy=1が正面、syが小さいほど水平に寝る。
const FRAMES = [
  { sy: 1.0, tilt: 0 }, { sy: 1.0, tilt: 0 }, { sy: 1.0, tilt: 0 }, { sy: 1.0, tilt: 0 }, { sy: 1.0, tilt: 0 },
  { sy: 0.72, tilt: -20 }, { sy: 0.55, tilt: -22 }, { sy: 0.38, tilt: -18 }, { sy: 0.22, tilt: -10 }, { sy: 0.10, tilt: -5 },
  { sy: 0.07, tilt: 0 }, { sy: 0.07, tilt: 0 }, { sy: 0.07, tilt: 0 }, { sy: 0.07, tilt: 0 }, { sy: 0.28, tilt: -14 },
  { sy: 0.34, tilt: -16 }, { sy: 0.42, tilt: -15 }, { sy: 0.55, tilt: -12 }, { sy: 0.72, tilt: -8 }, { sy: 1.0, tilt: 0 },
  { sy: 1.0, tilt: 0 }, { sy: 1.0, tilt: 0 }, { sy: 1.0, tilt: 0 }, { sy: 1.0, tilt: 0 }, { sy: 1.0, tilt: 0 },
];

const RIM = [224, 58, 46, 255];    // 枠・柄の赤
const PAPER = [255, 255, 255, 255]; // 和紙の白
const TEX = [228, 228, 232, 255];   // 和紙の繊維テクスチャ

// ポイの形状(セル中心基準のローカル座標)
const HEAD_X = -8, HEAD_Y = -6;   // 円形ヘッドの中心
const HEAD_R = 27;                 // ヘッド半径
const RIM_W = 3.5;                 // 赤枠の太さ
const HANDLE_ANGLE = (38 * Math.PI) / 180; // 柄の向き(右下)
const HANDLE_LEN = 26;             // 柄の長さ(ヘッド縁から)
const HANDLE_HW = 3.6;             // 柄の半幅

const W = COLS * CELL;
const H = ROWS * CELL;
const logical = new Uint8Array(W * H * 4); // 透過RGBA

// 1サンプル点をポイのローカル座標で判定して色を返す(nullは透明)
function samplePoi(sx, sy) {
  const d = Math.hypot(sx - HEAD_X, sy - HEAD_Y);
  if (d <= HEAD_R) {
    if (d >= HEAD_R - RIM_W) return RIM;
    // 和紙: 薄いクロスハッチで繊維感を出す
    const u = sx - HEAD_X + 100;
    const v = sy - HEAD_Y + 100;
    if ((u + v * 1.7) % 13 < 1.4 || (u * 1.6 - v + 200) % 15 < 1.4) return TEX;
    return PAPER;
  }
  // 柄(カプセル形)
  const ax = HEAD_X + Math.cos(HANDLE_ANGLE) * (HEAD_R - 1);
  const ay = HEAD_Y + Math.sin(HANDLE_ANGLE) * (HEAD_R - 1);
  const bx = ax + Math.cos(HANDLE_ANGLE) * HANDLE_LEN;
  const by = ay + Math.sin(HANDLE_ANGLE) * HANDLE_LEN;
  const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
  const t = Math.max(0, Math.min(1, ((sx - ax) * (bx - ax) + (sy - ay) * (by - ay)) / len2));
  const qx = ax + t * (bx - ax);
  const qy = ay + t * (by - ay);
  if (Math.hypot(sx - qx, sy - qy) <= HANDLE_HW) return RIM;
  return null;
}

function drawFrame(frameIndex, originX, originY) {
  const { sy, tilt } = FRAMES[frameIndex];
  const rad = (tilt * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = CELL / 2;
  const cy = CELL / 2 + 2;
  const SUB = 4; // 4×4スーパーサンプリング(赤優先で、寝た状態でも枠線が消えないようにする)

  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      let hitRim = 0, hitPaper = 0, hitTex = 0;
      for (let sy2 = 0; sy2 < SUB; sy2++) {
        for (let sx2 = 0; sx2 < SUB; sx2++) {
          const px = x + (sx2 + 0.5) / SUB - cx;
          const py = y + (sy2 + 0.5) / SUB - cy;
          // 画面座標 → ポイのローカル座標(傾きの逆回転 → 縦つぶれの逆変換)
          const rx = px * cos + py * sin;
          const ry = (-px * sin + py * cos) / sy;
          const c = samplePoi(rx, ry);
          if (c === RIM) hitRim++;
          else if (c === PAPER) hitPaper++;
          else if (c === TEX) hitTex++;
        }
      }
      let col = null;
      if (hitRim >= 2) col = RIM;
      else if (hitPaper + hitTex > 0) col = hitTex > hitPaper ? TEX : PAPER;
      if (col) {
        const i = ((originY + y) * W + originX + x) * 4;
        logical[i] = col[0];
        logical[i + 1] = col[1];
        logical[i + 2] = col[2];
        logical[i + 3] = col[3];
      }
    }
  }
}

for (let f = 0; f < FRAMES.length; f++) {
  const col = f % COLS;
  const row = Math.floor(f / COLS);
  drawFrame(f, col * CELL, row * CELL);
}

// 最近傍拡大でドット絵らしいエッジのまま出力解像度へ
const OW = W * SCALE;
const OH = H * SCALE;
const out = new Uint8Array(OW * OH * 4);
for (let y = 0; y < OH; y++) {
  const sy = Math.floor(y / SCALE);
  for (let x = 0; x < OW; x++) {
    const sx = Math.floor(x / SCALE);
    const si = (sy * W + sx) * 4;
    const di = (y * OW + x) * 4;
    out[di] = logical[si];
    out[di + 1] = logical[si + 1];
    out[di + 2] = logical[si + 2];
    out[di + 3] = logical[si + 3];
  }
}

// --- PNGエンコード(RGBA8, フィルタなし) ---
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(OW, 0);
ihdr.writeUInt32BE(OH, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type: RGBA
const raw = Buffer.alloc(OH * (1 + OW * 4));
for (let y = 0; y < OH; y++) {
  raw[y * (1 + OW * 4)] = 0; // filter: none
  Buffer.from(out.buffer, y * OW * 4, OW * 4).copy(raw, y * (1 + OW * 4) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const dest = path.join(import.meta.dirname, "..", "public", "assets", "poi.png");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, png);
console.log(`wrote ${dest} (${OW}x${OH}, ${png.length} bytes)`);
