// Packs EffectCraft's PNG frames into a small looping GIF.
//
//   node tools/gif.mjs <frames dir> <out.gif> <fps> [keep.json]
//
// The GIF encoders at hand (EffectCraft's, FilmCraft's) dither every frame on its own palette, so no two frames share
// a pixel and 140 frames came to 8 MB. Here: one palette for all of them (median cut), no dithering - what does not
// move stays the same index - and each frame stores only the rectangle that changed, the rest transparent over the
// frame before it (disposal "leave"). The theme's own colours are kept exactly in the palette, and soft gradients get
// an ordered (Bayer) dither: it depends on the pixel's place, not the frame, so a still area stays still. Browsers compose it the same way.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const [dir, outFile, fpsArg, keepFile] = process.argv.slice(2);
const fps = Number(fpsArg || 20);
const TRANSPARENT = 255;

// The picture's flat colours - the theme's tokens, white and black - kept exactly, however few pixels use them:
// scene.mjs writes them to keep.json; without one, a default dark set.
const KEEP = (keepFile ? JSON.parse(readFileSync(keepFile, 'utf8')) : ['#0B121F', '#111A2B', '#1A2540', '#141D31', '#0F1728',
  '#26334F', '#E3EAF7', '#9FB2D4', '#768DB4', '#7C93FF', '#6D8EFF', '#33478F', '#1C2A5C', '#4FC3F7', '#34D399', '#0E3A2C',
  '#FBBF24', '#43320D', '#05080F', '#FFFFFF', '#000000'])
  .map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
const SPREAD = 7;

// -- PNG: 8-bit RGB or RGBA, not interlaced (what EffectCraft writes) -------------------------------------------------
function readPng(file) {
  const b = readFileSync(file);
  let pos = 8, width = 0, height = 0, type = 0;
  const idat = [];
  while (pos < b.length) {
    const len = b.readUInt32BE(pos), kind = b.toString('latin1', pos + 4, pos + 8);
    const data = b.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error(file + ': only 8-bit, non-interlaced PNG');
      type = data[9];
    } else if (kind === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const ch = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!ch) throw new Error(file + ': only RGB or RGBA PNG');
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch, rgb = new Uint8Array(width * height * 3), line = new Uint8Array(stride), prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, up = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = src[i];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      line[i] = v & 255;
    }
    for (let x = 0; x < width; x++) for (let k = 0; k < 3; k++) rgb[(y * width + x) * 3 + k] = line[x * ch + k];
    prev.set(line);
  }
  return { width, height, rgb };
}

// -- One palette for every frame: median cut over a 5-bit histogram ---------------------------------------------------
function palette(frames, size) {
  const hist = new Map();
  for (const f of frames) {
    for (let i = 0; i < f.rgb.length; i += 3) {
      const key = ((f.rgb[i] >> 3) << 10) | ((f.rgb[i + 1] >> 3) << 5) | (f.rgb[i + 2] >> 3);
      hist.set(key, (hist.get(key) || 0) + 1);
    }
  }
  const colours = [...hist].map(([k, n]) => ({ c: [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4], n }));
  let boxes = [colours];
  while (boxes.length < size) {
    // split the box with the widest channel, weighted by how much of the picture it covers
    let best = -1, bestScore = -1, bestCh = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      let total = 0;
      for (const e of box) total += e.n;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255, hi = 0;
        for (const e of box) { lo = Math.min(lo, e.c[ch]); hi = Math.max(hi, e.c[ch]); }
        const score = (hi - lo) * Math.sqrt(total);
        if (score > bestScore) { bestScore = score; best = i; bestCh = ch; }
      }
    });
    if (best < 0) break;
    const box = boxes[best].sort((p, q) => p.c[bestCh] - q.c[bestCh]);
    let total = 0, run = 0, cut = 1;
    for (const e of box) total += e.n;
    for (let i = 0; i < box.length - 1; i++) { run += box[i].n; if (run >= total / 2) { cut = i + 1; break; } }
    boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
  }
  return boxes.map((box) => {
    let n = 0, r = 0, g = 0, b = 0;
    for (const e of box) { n += e.n; r += e.c[0] * e.n; g += e.c[1] * e.n; b += e.c[2] * e.n; }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

function mapper(pal) {
  const cache = new Int16Array(1 << 18).fill(-1);
  return (r, g, b) => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let v = cache[key];
    if (v >= 0) return v;
    let best = 0, dist = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const dr = pal[i][0] - r, dg = pal[i][1] - g, db = pal[i][2] - b;
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < dist) { dist = d; best = i; }
    }
    cache[key] = best;
    return best;
  };
}

// -- GIF LZW ---------------------------------------------------------------------------------------------------------
function lzw(indices, minCode) {
  const clear = 1 << minCode, eoi = clear + 1, out = [];
  let size = minCode + 1, next = eoi + 1, bits = 0, acc = 0;
  const emit = (code) => {
    acc |= code << bits; bits += size;
    while (bits >= 8) { out.push(acc & 255); acc >>>= 8; bits -= 8; }
  };
  let dict = new Map();
  emit(clear);
  let w = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = w * 256 + k, hit = dict.get(key);
    if (hit !== undefined) { w = hit; continue; }
    emit(w);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > (1 << size) && size < 12) size++;
    } else {
      emit(clear);
      dict = new Map(); size = minCode + 1; next = eoi + 1;
    }
    w = k;
  }
  emit(w); emit(eoi);
  if (bits > 0) out.push(acc & 255);
  return out;
}

const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
if (!files.length) throw new Error('No frames in ' + dir);
const frames = files.map((f) => readPng(join(dir, f)));
const { width, height } = frames[0];
const pal = KEEP.concat(palette(frames, 255 - KEEP.length));
while (pal.length < 256) pal.push([0, 0, 0]);
const nearest = mapper(pal.slice(0, 255));

const bytes = [];
const u16 = (v) => { bytes.push(v & 255, v >> 8); };
bytes.push(...Buffer.from('GIF89a'));
u16(width); u16(height);
bytes.push(0xF7, 0, 0);                                   // global table of 256, 8 bits a channel
for (const c of pal) bytes.push(c[0], c[1], c[2]);
bytes.push(0x21, 0xFF, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0);   // loop forever

const delay = Math.round(100 / fps);
let shown = null;                                          // the indices on screen after the frame before
const blocks = [];
for (const f of frames) {
  const idx = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < idx.length; p++, i += 3) {
    // A colour the palette has (near enough) is taken as it is: flat surfaces and thin bars stay clean, and only what
    // falls between the palette's colours - the soft gradients - is dithered.
    const r = f.rgb[i], g = f.rgb[i + 1], b = f.rgb[i + 2];
    const plain = nearest(r, g, b), q = pal[plain];
    if (Math.abs(q[0] - r) + Math.abs(q[1] - g) + Math.abs(q[2] - b) <= 6) { idx[p] = plain; continue; }
    const t = BAYER[((p / width | 0) & 3) * 4 + (p % width & 3)] * SPREAD;
    const c = (v) => Math.max(0, Math.min(255, Math.round(v + t)));
    idx[p] = nearest(c(r), c(g), c(b));
  }
  let x0 = 0, y0 = 0, x1 = width - 1, y1 = height - 1;
  if (shown) {
    x0 = width; y0 = height; x1 = -1; y1 = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (idx[p] !== shown[p]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) { blocks[blocks.length - 1].delay += delay; continue; }   // nothing moved: the last frame stays longer
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, sub = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y0 + y) * width + x0 + x;
    sub[y * w + x] = shown && idx[p] === shown[p] ? TRANSPARENT : idx[p];
  }
  blocks.push({ x0, y0, w, h, data: lzw(sub, 8), delay });
  shown = idx;
}
for (const b of blocks) {
  bytes.push(0x21, 0xF9, 4, (1 << 2) | 1, b.delay & 255, b.delay >> 8, TRANSPARENT, 0);   // leave it, index 255 clear
  bytes.push(0x2C); u16(b.x0); u16(b.y0); u16(b.w); u16(b.h); bytes.push(0);
  bytes.push(8);
  for (let i = 0; i < b.data.length; i += 255) {
    const chunk = b.data.slice(i, i + 255);
    bytes.push(chunk.length, ...chunk);
  }
  bytes.push(0);
}
bytes.push(0x3B);
writeFileSync(outFile, Buffer.from(bytes));
console.log(`${files.length} frames -> ${blocks.length} GIF frames, ${width}x${height}, ${Math.round(bytes.length / 1024)} KB`);
