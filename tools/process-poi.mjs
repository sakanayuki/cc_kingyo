// ユーザー提供のポイ画像(tools/original/sukui_poi.png, 5×5=25コマ)を
// ゲーム用スプライトシートに加工するスクリプト。
//   - 背景・コマ番号・罫線を透過にする(赤い枠で囲まれた和紙の内側は残す)
//   - 出力は public/assets/poi.png(RGBA・背景透過)
// 依存ライブラリなし(Node標準のzlibでPNGをデコード/エンコード)。
//
// 使い方: node tools/process-poi.mjs

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(import.meta.dirname, "original", "sukui_poi.png");
const DEST = path.join(import.meta.dirname, "..", "public", "assets", "poi.png");
const COLS = 5;
const ROWS = 5;

// --- PNGデコード(8-bit RGB/RGBA, 非インターレースのみ対応) ---
function decodePng(buf) {
  let pos = 8; // シグネチャをスキップ
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9];
      const interlace = data[12];
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
        throw new Error(`unsupported png: depth=${bitDepth} color=${colorType} interlace=${interlace}`);
      }
    } else if (type === "IDAT") {
      idat.push(data);
    }
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(line); // 復元先
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      switch (filter) {
        case 0:
          break;
        case 1:
          cur[i] = (cur[i] + a) & 0xff;
          break;
        case 2:
          cur[i] = (cur[i] + b) & 0xff;
          break;
        case 3:
          cur[i] = (cur[i] + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          cur[i] = (cur[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default:
          throw new Error(`unknown filter ${filter}`);
      }
    }
    prev = cur;
    for (let x = 0; x < width; x++) {
      const s = x * bpp;
      const d = (y * width + x) * 4;
      out[d] = cur[s];
      out[d + 1] = cur[s + 1];
      out[d + 2] = cur[s + 2];
      out[d + 3] = bpp === 4 ? cur[s + 3] : 255;
    }
  }
  return { width, height, pixels: out };
}

// --- PNGエンコード(RGBA8, フィルタなし) ---
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(b) {
  let c = -1;
  for (const v of b) c = CRC_TABLE[(c ^ v) & 0xff] ^ (c >>> 8);
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
function encodePng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    Buffer.from(pixels.buffer, y * width * 4, width * 4).copy(raw, y * (1 + width * 4) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- 加工本体 ---
const { width, height, pixels } = decodePng(fs.readFileSync(SRC));

/** ポイの赤(枠・柄)かどうか。フラッドフィルはここで堰き止められる */
function isReddish(i) {
  const r = pixels[i];
  const g = pixels[i + 1];
  const b = pixels[i + 2];
  return r > 120 && r - Math.max(g, b) > 18;
}

// コマごとに、外周から「赤以外」の画素をフラッドフィルして透過にする。
// 赤い枠で囲まれた和紙の内側は外周とつながらないため残る。
// 背景・罫線・コマ番号(グレー)はすべて外周とつながっているので消える。
const cellW = width / COLS;
const cellH = height / ROWS;
const remove = new Uint8Array(width * height);

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const x0 = Math.round(col * cellW);
    const y0 = Math.round(row * cellH);
    const x1 = Math.round((col + 1) * cellW) - 1;
    const y1 = Math.round((row + 1) * cellH) - 1;
    const stack = [];
    const push = (x, y) => {
      const idx = y * width + x;
      if (!remove[idx] && !isReddish(idx * 4)) {
        remove[idx] = 1;
        stack.push(idx);
      }
    };
    for (let x = x0; x <= x1; x++) {
      push(x, y0);
      push(x, y1);
    }
    for (let y = y0; y <= y1; y++) {
      push(x0, y);
      push(x1, y);
    }
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % width;
      const y = (idx / width) | 0;
      if (x > x0) push(x - 1, y);
      if (x < x1) push(x + 1, y);
      if (y > y0) push(x, y - 1);
      if (y < y1) push(x, y + 1);
    }
  }
}

let removed = 0;
for (let i = 0; i < width * height; i++) {
  if (remove[i]) {
    pixels[i * 4 + 3] = 0;
    removed++;
  }
}

fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.writeFileSync(DEST, encodePng(width, height, pixels));
console.log(
  `wrote ${DEST} (${width}x${height}, 透過化 ${((removed / (width * height)) * 100).toFixed(1)}%)`,
);
