// The profile README's own pictures, drawn as vectors and animated with the Craft tools.
//
//   node tools/scene.mjs     writes tools/out/svg/*.svg (one per moving part), tools/out/animate.jsx (the motion,
//                            an EffectCraft script), parts.json / soft.json / keep.json for Build-Assets.ps1,
//                            and assets/stack-matrix.svg (a static vector, GitHub renders it as it is)
//
// Build-Assets.ps1 then has VectorCraft draw each part as a 2x PNG, PhotoCraft soften the glows, EffectCraft
// move everything and gif.mjs pack three GIFs: assets/hero.gif, assets/stack-orbit.gif, assets/divider.gif.
//
// Every comp is laid out at 1x; parts are exported at 2x and shown at 50% so edges stay crisp.
import { writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
const svgDir = join(out, 'svg');
const assets = join(here, '..', 'assets');
mkdirSync(svgDir, { recursive: true });
mkdirSync(assets, { recursive: true });

// -- Palette: deep void, cyan, magenta, mint ------------------------------------------------------------------------
const C = {
  bg: '#0a0a0f', bg2: '#0e1119', grid: '#141a26', gridHi: '#1b2740', panel: '#10141f',
  cyan: '#00f0ff', cyanDim: '#0a6f78', magenta: '#ff00e5', magentaDim: '#6a0a60', mint: '#00ff9c',
  text: '#e8f6ff', textMid: '#8fa3bf', textLow: '#4f6180', white: '#ffffff', black: '#000000',
};
const MONO = 'Consolas';
const HEAD = 'Bahnschrift';

const parts = [];
const soft = {};
function part(name, w, h, body, defs = '') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    (defs ? `<defs>${defs}</defs>` : '') + body + '</svg>\n';
  writeFileSync(join(svgDir, name + '.svg'), svg);
  parts.push(name);
}
// A part PhotoCraft blurs (radius in 2x pixels); the blurred PNG is used under the part's name without "-src".
function softPart(name, radius, w, h, body, defs = '') { part(name + '-src', w, h, body, defs); soft[name] = radius; }

const f = (v) => Number(v.toFixed(2));
const rect = (x, y, w, h, r, fill, extra = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${r}" fill="${fill}"${extra}/>`;
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"${extra}/>`;
const line = (x1, y1, x2, y2, stroke, w, extra = '') =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${w}"${extra}/>`;
const text = (x, y, s, size, fill, extra = '') =>
  `<text x="${f(x)}" y="${f(y)}" font-family="${MONO}" font-size="${size}" fill="${fill}"${extra}>${s}</text>`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// A regular polygon's path, drawn in place (VectorCraft ignores transform attributes, so no rotate()).
function polygon(cx, cy, r, n, rot = 0) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    d += (i ? 'L' : 'M') + f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a));
  }
  return d + 'Z';
}
// Tick marks around a circle, as short lines.
function ticks(cx, cy, r, len, n, stroke, w, every = 1) {
  let s = '';
  for (let i = 0; i < n; i++) {
    if (i % every) continue;
    const a = (i * 2 * Math.PI) / n;
    s += line(cx + r * Math.cos(a), cy + r * Math.sin(a), cx + (r + len) * Math.cos(a), cy + (r + len) * Math.sin(a), stroke, w, ' stroke-linecap="round"');
  }
  return s;
}
function brackets(w, h, m, l, stroke, sw) {
  const p = `M${m} ${m + l} V${m} H${m + l} M${w - m - l} ${m} H${w - m} V${m + l} M${w - m} ${h - m - l} V${h - m} H${w - m - l} M${m + l} ${h - m} H${m} V${h - m - l}`;
  return `<path d="${p}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="square"/>`;
}

// ====================================================================================================================
// 1. HERO  1200 x 320
// ====================================================================================================================
const HW = 1200, HH = 320;
{
  let b = rect(0, 0, HW, HH, 0, C.bg);
  // a fine grid
  for (let x = 0; x <= HW; x += 40) b += line(x, 0, x, HH, C.grid, 1);
  for (let y = 0; y <= HH; y += 40) b += line(0, y, HW, y, C.grid, 1);
  // the floor: a perspective grid under a horizon, fading up to it
  const hz = 214, vpx = 600, vpy = 150;
  for (let k = -14; k <= 14; k++) {
    const xb = vpx + k * 120;
    const t = (hz - vpy) / (HH - vpy);
    const xh = vpx + (xb - vpx) * t;
    b += line(xh, hz, xb, HH, C.cyan, 1, ' opacity="0.16"');
  }
  for (let i = 1; i <= 9; i++) {
    const t = i / 9;
    const y = hz + (HH - hz) * t * t;
    b += line(0, y, HW, y, C.cyan, 1, ` opacity="${f(0.07 + 0.2 * t)}"`);
  }
  b += line(0, hz, HW, hz, C.cyan, 1.5, ' opacity="0.45"');
  // a dark veil over the floor so the text in front stays readable
  b += rect(0, hz, HW, HH - hz, 0, 'url(#veil)');
  // HUD corners and readouts
  b += brackets(HW, HH, 16, 28, C.cyan, 2);
  b += text(32, 40, 'SYS.PROFILE // v2026.10', 13, C.textLow, ' letter-spacing="2"');
  b += text(32, HH - 26, 'UPTIME: SINCE 2020', 13, C.textLow, ' letter-spacing="2"');
  b += text(HW - 32, 40, 'STATUS: ONLINE', 13, C.mint, ' letter-spacing="2" text-anchor="end"');
  b += text(HW - 32, HH - 26, 'LOC: INDONESIA', 13, C.textLow, ' letter-spacing="2" text-anchor="end"');
  // a thin data strip under the subtitle
  for (let i = 0; i < 26; i++) b += rect(70 + i * 14, 236, 8, 3, 1, i % 5 === 0 ? C.magenta : C.cyanDim, ` opacity="${i % 5 === 0 ? 0.9 : 0.6}"`);
  part('hero-bg', HW, HH, b,
    `<linearGradient id="veil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg}" stop-opacity="0.85"/><stop offset="1" stop-color="${C.bg}" stop-opacity="0.2"/></linearGradient>`);
}
softPart('hero-glow-c', 90, 700, 420, `<ellipse cx="350" cy="210" rx="260" ry="130" fill="${C.cyan}" opacity="0.28"/>`);
softPart('hero-glow-m', 90, 600, 420, `<ellipse cx="300" cy="210" rx="220" ry="140" fill="${C.magenta}" opacity="0.26"/>`);
// the name: three copies, the coloured ones only flash in the glitch
const NAME = 'RISKI ILYAS';
const nameSvg = (fill) => `<text x="4" y="92" font-family="${HEAD}" font-weight="700" font-size="96" letter-spacing="7" fill="${fill}">${NAME}</text>`;
part('hero-name', 760, 120, nameSvg(C.text));
part('hero-name-c', 760, 120, nameSvg(C.cyan));
part('hero-name-m', 760, 120, nameSvg(C.magenta));
// two slices of the name, for the glitch to shear
part('hero-name-slice', 760, 34, `<text x="4" y="52" font-family="${HEAD}" font-weight="700" font-size="96" letter-spacing="7" fill="${C.text}">${NAME}</text>`);
part('hero-sub', 760, 40, text(4, 28, esc('> SOFTWARE ENGINEER // MOBILE & WEB'), 24, C.cyan, ' letter-spacing="4"'));
part('hero-cursor', 16, 28, rect(0, 0, 14, 26, 1, C.cyan));
part('hero-tags', 760, 30,
  text(4, 20, 'FLUTTER', 15, C.text, ' letter-spacing="3"') + rect(96, 8, 2, 12, 0, C.magenta) +
  text(112, 20, 'REACT', 15, C.text, ' letter-spacing="3"') + rect(184, 8, 2, 12, 0, C.magenta) +
  text(200, 20, 'LARAVEL', 15, C.text, ' letter-spacing="3"') + rect(292, 8, 2, 12, 0, C.magenta) +
  text(308, 20, 'KOTLIN', 15, C.textMid, ' letter-spacing="3"') + rect(390, 8, 2, 12, 0, C.magenta) +
  text(406, 20, 'NODE', 15, C.textMid, ' letter-spacing="3"'));
// the scan beam that sweeps down the banner
part('hero-scan', HW, 36, rect(0, 0, HW, 36, 0, 'url(#beam)') + rect(0, 17, HW, 2, 0, C.cyan, ' opacity="0.9"'),
  `<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.cyan}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>`);
// the emblem on the right: hexagon rings and ticks that turn
{
  const s = 260, c = s / 2;
  part('hero-hex-outer', s, s,
    `<path d="${polygon(c, c, 112, 6, Math.PI / 6)}" fill="none" stroke="${C.cyan}" stroke-width="2" opacity="0.9"/>` +
    `<path d="${polygon(c, c, 104, 6, Math.PI / 6)}" fill="none" stroke="${C.cyan}" stroke-width="1" opacity="0.35"/>`);
  part('hero-hex-inner', s, s,
    `<path d="${polygon(c, c, 78, 6, 0)}" fill="none" stroke="${C.magenta}" stroke-width="2" opacity="0.9"/>` +
    circle(c + 78, c, 4, C.magenta) + circle(c - 78, c, 4, C.magenta));
  part('hero-ticks', s, s, ticks(c, c, 120, 8, 48, C.cyan, 1.5, 1) + ticks(c, c, 118, 14, 48, C.text, 2, 12));
  part('hero-ring', s, s, circle(c, c, 92, 'none', ` stroke="${C.cyan}" stroke-width="1.5" stroke-dasharray="40 26" opacity="0.6"`));
  part('hero-core', s, s,
    `<path d="${polygon(c, c, 56, 6, 0)}" fill="${C.panel}" stroke="${C.cyanDim}" stroke-width="1.5"/>` +
    `<text x="${c}" y="${c + 15}" font-family="${HEAD}" font-weight="700" font-size="44" letter-spacing="2" fill="${C.text}" text-anchor="middle">RI</text>`);
  softPart('hero-core-glow', 40, s, s, circle(c, c, 70, C.cyan, ' opacity="0.45"'));
}

// ====================================================================================================================
// 2. STACK ORBIT  1000 x 400 : the stack as three orbits around a core, the icons the real brand marks
// ====================================================================================================================
const OW = 1000, OH = 400, OCX = 500, OCY = 200;
const RINGS = [
  { rx: 118, ry: 44, turns: 2, icons: ['flutter', 'react', 'laravel'], label: 'L1 CORE' },
  { rx: 228, ry: 86, turns: -1, icons: ['dart', 'kotlin', 'swift', 'nextjs', 'ts', 'nodejs', 'php', 'java'], label: 'L2 LANGUAGES & RUNTIMES' },
  { rx: 345, ry: 132, turns: 1, icons: ['js', 'html', 'css', 'tailwind', 'express', 'firebase', 'mysql', 'postgres', 'git', 'docker', 'figma', 'wordpress'], label: 'L3 PLATFORM, DATA & TOOLS' },
];
{
  let b = rect(0, 0, OW, OH, 0, C.bg);
  for (let x = 0; x <= OW; x += 40) b += line(x, 0, x, OH, C.grid, 1);
  for (let y = 0; y <= OH; y += 40) b += line(0, y, OW, y, C.grid, 1);
  b += brackets(OW, OH, 14, 24, C.cyan, 2);
  for (const r of RINGS) {
    b += `<ellipse cx="${OCX}" cy="${OCY}" rx="${r.rx}" ry="${r.ry}" fill="none" stroke="${C.cyan}" stroke-width="1.2" opacity="0.28"/>`;
    b += `<ellipse cx="${OCX}" cy="${OCY}" rx="${r.rx + 3}" ry="${r.ry + 3}" fill="none" stroke="${C.cyan}" stroke-width="0.6" opacity="0.12"/>`;
  }
  b += text(28, 34, 'TECH.ARSENAL // ORBITAL VIEW', 13, C.textLow, ' letter-spacing="2"');
  b += text(OW - 28, 34, `${RINGS.reduce((n, r) => n + r.icons.length, 0)} MODULES LOADED`, 13, C.mint, ' letter-spacing="2" text-anchor="end"');
  RINGS.forEach((r, i) => {
    const y = OH - 58 + i * 16;
    b += rect(28, y - 8, 8, 8, 0, [C.magenta, C.cyan, C.mint][i]);
    b += text(44, y, esc(r.label), 12, C.textMid, ' letter-spacing="2"');
  });
  part('orbit-bg', OW, OH, b);
}
softPart('orbit-glow', 60, 400, 300, `<ellipse cx="200" cy="150" rx="150" ry="90" fill="${C.magenta}" opacity="0.30"/>` + `<ellipse cx="200" cy="150" rx="90" ry="60" fill="${C.cyan}" opacity="0.35"/>`);
{
  const s = 140, c = 70;
  part('orbit-core', s, s,
    `<path d="${polygon(c, c, 48, 6, 0)}" fill="${C.panel}" stroke="${C.cyan}" stroke-width="2"/>` +
    `<path d="${polygon(c, c, 40, 6, 0)}" fill="none" stroke="${C.magenta}" stroke-width="1" opacity="0.6"/>` +
    `<text x="${c}" y="${c + 11}" font-family="${MONO}" font-weight="700" font-size="30" fill="${C.cyan}" text-anchor="middle">${esc('</>')}</text>`);
  part('orbit-core-ring', s, s, circle(c, c, 62, 'none', ` stroke="${C.cyan}" stroke-width="1.5" stroke-dasharray="18 12" opacity="0.7"`) + ticks(c, c, 56, 5, 12, C.magenta, 2));
}
softPart('orbit-halo', 16, 120, 120, circle(60, 60, 34, C.cyan, ' opacity="0.5"'));
const icons = readdirSync(join(here, 'icons')).filter((n) => n.endsWith('.svg')).map((n) => n.slice(0, -4));

// ====================================================================================================================
// 3. DIVIDER  1200 x 10 : a neon rule with a pulse running along it
// ====================================================================================================================
part('div-line', 1200, 10, rect(0, 4, 1200, 2, 1, 'url(#dl)'),
  `<linearGradient id="dl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.cyan}" stop-opacity="0.8"/><stop offset="1" stop-color="${C.magenta}" stop-opacity="0"/></linearGradient>`);
part('div-pulse', 220, 10, rect(0, 3, 220, 4, 2, 'url(#dp)') + rect(90, 2, 40, 6, 3, C.white, ' opacity="0.9"'),
  `<linearGradient id="dp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>`);

// ====================================================================================================================
// 4. STACK MATRIX  a static SVG with a bar per technology; GitHub renders it, the fill animates in CSS
// ====================================================================================================================
const SKILLS = [
  ['Flutter', 92, C.cyan], ['Laravel', 90, C.magenta], ['React', 88, C.cyan], ['Dart', 90, C.cyan],
  ['Kotlin', 82, C.mint], ['TypeScript', 85, C.cyan], ['Node / Express', 82, C.mint], ['Next.js', 80, C.text],
  ['PHP', 88, C.magenta], ['Java', 78, C.mint], ['Swift', 70, C.magenta], ['MySQL', 85, C.cyan],
  ['PostgreSQL', 80, C.cyan], ['Firebase', 85, C.magenta], ['Tailwind', 85, C.cyan], ['Git', 90, C.mint],
];
{
  const W = 1200, cols = 2, rowH = 34, top = 64, left = 40, colW = (W - left * 2) / cols, barW = colW - 250;
  const rows = Math.ceil(SKILLS.length / cols);
  const H = top + rows * rowH + 40;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Consolas, 'Courier New', monospace">\n`;
  s += `<style>.bar{animation:grow 1.6s cubic-bezier(.2,.8,.2,1) both}@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}.blink{animation:bl 1.2s steps(2) infinite}@keyframes bl{to{opacity:0}}</style>\n`;
  s += `<defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${C.grid}" stroke-width="1"/></pattern></defs>\n`;
  s += rect(0, 0, W, H, 8, C.bg) + rect(0, 0, W, H, 8, 'url(#g)') + brackets(W, H, 12, 22, C.cyan, 2);
  s += text(left, 36, 'SKILL.MATRIX // PROFICIENCY SCAN', 15, C.textLow, ' letter-spacing="3"');
  s += text(W - left, 36, 'SCANNING', 15, C.mint, ' letter-spacing="3" text-anchor="end"') + `<rect class="blink" x="${W - left - 100}" y="24" width="10" height="14" fill="${C.mint}"/>`;
  SKILLS.forEach(([name, pct, col], i) => {
    const cx = left + (i % cols) * colW, y = top + Math.floor(i / cols) * rowH;
    s += text(cx, y + 18, name.toUpperCase(), 14, C.text, ' letter-spacing="2"');
    s += rect(cx + 170, y + 7, barW, 12, 2, C.bg2, ` stroke="${C.gridHi}" stroke-width="1"`);
    s += `<rect class="bar" x="${cx + 170}" y="${y + 7}" width="${f(barW * pct / 100)}" height="12" rx="2" fill="${col}" opacity="0.9" style="transform-origin:${cx + 170}px ${y + 13}px;animation-delay:${f(i * 0.07)}s"/>`;
    for (let k = 1; k < 10; k++) s += rect(cx + 170 + (barW * k) / 10, y + 7, 1, 12, 0, C.bg, ' opacity="0.7"');
    s += text(cx + 170 + barW + 14, y + 18, String(pct).padStart(3, ' ') + '%', 14, col, ' letter-spacing="1"');
  });
  s += text(left, H - 16, '> 16 MODULES // CALIBRATED 2026', 12, C.textLow, ' letter-spacing="2"');
  s += '</svg>\n';
  writeFileSync(join(assets, 'stack-matrix.svg'), s);
}

// ====================================================================================================================
// The motion: an EffectCraft script. Three comps: hero, stack-orbit, divider.
// ====================================================================================================================
const png = (name) => join(out, 'png', name + '.png').replace(/\\/g, '/');
const glow = (name) => join(out, 'glow', name + '.png').replace(/\\/g, '/');
const FPS = 15, OFPS = 12;
const HERO_DUR = 8, ORBIT_DUR = 10, DIV_DUR = 3;

// Orbit: positions per frame, so the paths are ellipses and the icons stay upright; the back of the orbit is smaller
// and dimmer than the front. Each list loops exactly: the last key equals the first.
function orbitKeys(ring, index) {
  const n = ring.icons.length, frames = ORBIT_DUR * OFPS;
  const pos = [], scale = [], opac = [];
  for (let fr = 0; fr <= frames; fr++) {
    const t = fr / OFPS;
    const th = (index / n) * 2 * Math.PI + (ring.turns * 2 * Math.PI * fr) / frames;
    const d = (Math.sin(th) + 1) / 2;
    pos.push([f(t), [f(OCX + ring.rx * Math.cos(th)), f(OCY + ring.ry * Math.sin(th))]]);
    const sc = f(29 + 14 * d);
    scale.push([f(t), [sc, sc]]);
    opac.push([f(t), f(40 + 60 * d)]);
  }
  return { pos, scale, opac };
}
let orbitScript = '', orbitFront = '';
RINGS.forEach((ring, ri) => {
  ring.icons.forEach((name, i) => {
    if (!icons.includes(name)) throw new Error('No icon downloaded for ' + name);
    const k = orbitKeys(ring, i);
    if (false) orbitScript += `
{ var halo = put(orbit, "${glow('orbit-halo')}", 0, 0, 50);
  keys(halo, "Position", ${JSON.stringify(k.pos)}, false);
  keys(halo, "Scale", ${JSON.stringify(k.scale.map(([t, [s]]) => [t, [f(s * 1.5), f(s * 1.5)]]))}, false);
  keys(halo, "Opacity", ${JSON.stringify(k.opac.map(([t, o]) => [t, f(o * 0.5)]))}, false);
  halo.blendingMode = BlendingMode.ADD; }`;
    const layer = (opac) => `
{ var ic = put(orbit, "${png('icon-' + name)}", 0, 0, 50);
  keys(ic, "Position", ${JSON.stringify(k.pos)}, false);
  keys(ic, "Scale", ${JSON.stringify(k.scale)}, false);
  keys(ic, "Opacity", ${JSON.stringify(opac)}, false); }`;
    if (ri === 0) {
      // behind the core while on the far side (y above the centre), in front of it on the near side
      orbitScript += layer(k.opac.map(([t, o], j) => [t, k.pos[j][1][1] < OCY ? o : 0]));
      orbitFront += layer(k.opac.map(([t, o], j) => [t, k.pos[j][1][1] < OCY ? 0 : o]));
    } else orbitScript += layer(k.opac);
  });
});

const jsx = `// Generated by scene.mjs - the profile README's motion. Parts are 2x PNGs shown at 50%.
function imp(path) { return app.project.importFile(new ImportOptions(new File(path))); }
function ease(prop) {
  for (var k = 1; k <= prop.numKeys; k++) {
    try { prop.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER); } catch (e) {}
    try { prop.setTemporalEaseAtKey(k, [new KeyframeEase(0, 70)], [new KeyframeEase(0, 70)]); } catch (e) {}
  }
}
function keys(layer, name, list, smooth) {
  var p = layer.property("Transform").property(name);
  for (var i = 0; i < list.length; i++) p.setValueAtTime(list[i][0], list[i][1]);
  if (smooth !== false) ease(p);
  return p;
}
function put(comp, path, x, y, scale) {
  var l = comp.layers.add(imp(path));
  l.property("Transform").property("Position").setValue([x, y]);
  var s = (scale === undefined) ? 50 : scale;
  l.property("Transform").property("Scale").setValue([s, s]);
  return l;
}
// A step: on at t for d seconds (no easing; the frame before and after hold the old value).
function flash(layer, times, d, on, off) {
  var ko = [[0, off]];
  for (var i = 0; i < times.length; i++) { var t = times[i]; ko.push([t - 0.04, off]); ko.push([t, on]); ko.push([t + d, on]); ko.push([t + d + 0.04, off]); }
  keys(layer, "Opacity", ko, false);
}

// ---------------------------------------------------------------- HERO
var hero = app.project.items.addComp("hero", ${HW}, ${HH}, 1, ${HERO_DUR}, ${FPS});
put(hero, "${png('hero-bg')}", ${HW / 2}, ${HH / 2});
var gc = put(hero, "${glow('hero-glow-c')}", 300, 150); gc.blendingMode = BlendingMode.ADD;
var gm = put(hero, "${glow('hero-glow-m')}", 1010, 170); gm.blendingMode = BlendingMode.ADD;
// the glows stay still: a breathing gradient re-dithers a large area every frame and the GIF balloons
keys(gc, "Opacity", [[0, 75]]);
keys(gm, "Opacity", [[0, 70]]);
// the name, its glitch copies, the shear slice
var nm = put(hero, "${png('hero-name')}", 450, 120);
var nc = put(hero, "${png('hero-name-c')}", 455, 120); nc.blendingMode = BlendingMode.ADD;
var nmg = put(hero, "${png('hero-name-m')}", 445, 120); nmg.blendingMode = BlendingMode.ADD;
var sl = put(hero, "${png('hero-name-slice')}", 464, 120);
var G = [1.9, 2.05, 4.7, 6.3, 6.42];
flash(nc, G, 0.1, 90, 0); flash(nmg, G, 0.1, 90, 0); flash(sl, G, 0.1, 100, 0);
keys(nm, "Opacity", [[0, 100], [1.86, 100], [1.9, 70], [2.0, 70], [2.04, 100], [4.66, 100], [4.7, 70], [4.8, 70], [4.84, 100], [6.26, 100], [6.3, 70], [6.4, 70], [6.44, 100]], false);
// the subtitle types itself: a mask would be cleaner, a wipe of its own copy is what we have - so it slides in
var sub = put(hero, "${png('hero-sub')}", 450, 198);
keys(sub, "Opacity", [[0, 0], [0.5, 0], [0.9, 100], [7.6, 100], [7.95, 0]]);
keys(sub, "Position", [[0.5, [432, 198]], [0.9, [450, 198]]]);
var cur = put(hero, "${png('hero-cursor')}", 686, 198);
var blink = [];
for (var c = 0; c < ${HERO_DUR * 2}; c++) { blink.push([c * 0.5, c % 2 ? 0 : 100]); blink.push([c * 0.5 + 0.46, c % 2 ? 0 : 100]); }
keys(cur, "Opacity", blink, false);
var tags = put(hero, "${png('hero-tags')}", 450, 262);
keys(tags, "Opacity", [[0, 0], [1.0, 0], [1.4, 100], [7.6, 100], [7.95, 0]]);
keys(tags, "Position", [[1.0, [450, 270]], [1.4, [450, 262]]]);
// the emblem: rings turn by one symmetry each loop, so the loop is seamless
var EX = 1010, EY = 160;
var cg = put(hero, "${glow('hero-core-glow')}", EX, EY); cg.blendingMode = BlendingMode.ADD;
keys(cg, "Opacity", [[0, 80]]);
var tk = put(hero, "${png('hero-ticks')}", EX, EY); keys(tk, "Rotation", [[0, 0], [${HERO_DUR}, 30]], false);
var rg = put(hero, "${png('hero-ring')}", EX, EY); keys(rg, "Rotation", [[0, 0], [${HERO_DUR}, -360]], false);
var ho = put(hero, "${png('hero-hex-outer')}", EX, EY); keys(ho, "Rotation", [[0, 0], [${HERO_DUR}, 60]], false);
var hi = put(hero, "${png('hero-hex-inner')}", EX, EY); keys(hi, "Rotation", [[0, 0], [${HERO_DUR}, -60]], false);
var core = put(hero, "${png('hero-core')}", EX, EY);

// the scan beam: two sweeps a loop
var scan = put(hero, "${png('hero-scan')}", ${HW / 2}, -20); scan.blendingMode = BlendingMode.ADD;
keys(scan, "Position", [[0, [${HW / 2}, -20]], [3.2, [${HW / 2}, ${HH + 20}]], [3.21, [${HW / 2}, -20]], [4.0, [${HW / 2}, -20]], [7.2, [${HW / 2}, ${HH + 20}]], [7.21, [${HW / 2}, -20]]], false);
keys(scan, "Opacity", [[0, 70], [3.2, 70], [3.21, 0], [4.0, 0], [4.01, 70], [7.2, 70], [7.21, 0]], false);

// ---------------------------------------------------------------- STACK ORBIT
var orbit = app.project.items.addComp("stack-orbit", ${OW}, ${OH}, 1, ${ORBIT_DUR}, ${OFPS});
put(orbit, "${png('orbit-bg')}", ${OCX}, ${OCY});
var og = put(orbit, "${glow('orbit-glow')}", ${OCX}, ${OCY}); og.blendingMode = BlendingMode.ADD;
keys(og, "Opacity", [[0, 85]]);
// the icons on the far side are drawn before the core, the near side after: split by a second pass
${orbitScript}
var ocr = put(orbit, "${png('orbit-core-ring')}", ${OCX}, ${OCY}); keys(ocr, "Rotation", [[0, 0], [${ORBIT_DUR}, 360]], false);
var oc = put(orbit, "${png('orbit-core')}", ${OCX}, ${OCY}); keys(oc, "Rotation", [[0, 0], [${ORBIT_DUR}, -60]], false);
${orbitFront}


// ---------------------------------------------------------------- DIVIDER
var dv = app.project.items.addComp("divider", 1200, 10, 1, ${DIV_DUR}, 20);
put(dv, "${png('div-line')}", 600, 5);
var pl = put(dv, "${png('div-pulse')}", -120, 5); pl.blendingMode = BlendingMode.ADD;
keys(pl, "Position", [[0, [-120, 5]], [${DIV_DUR}, [1320, 5]]], false);

writeLn("hero " + hero.numLayers + " layers, orbit " + orbit.numLayers + ", divider " + dv.numLayers);
`;
writeFileSync(join(out, 'animate.jsx'), jsx);
writeFileSync(join(out, 'parts.json'), JSON.stringify(parts));
writeFileSync(join(out, 'icons.json'), JSON.stringify(icons));
writeFileSync(join(out, 'soft.json'), JSON.stringify(soft));
writeFileSync(join(out, 'fps.json'), JSON.stringify({ hero: FPS, 'stack-orbit': OFPS, divider: 20 }));
writeFileSync(join(out, 'keep.json'), JSON.stringify([...new Set(Object.values(C))]));
console.log(`parts: ${parts.length}, icons: ${icons.length}, soft: ${Object.keys(soft).length}`);
