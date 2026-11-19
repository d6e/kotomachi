// Art direction mockups for the main street, drawn as pixel data in code.
// One scene, four takes (A to D) that differ in palette, detail and finish.
// Everything is drawn on a 320x208 buffer of colour "roles" (outline, skin, roof...),
// then each style maps roles to its own palette and the result is scaled up 3x.
// All art here is original.

export const W = 320;
export const H = 208;
export const SCALE = 3;

// ------------------------------------------------------------------ styles

const A_SHADES = ['#e6efc4', '#a9c46c', '#5a8648', '#1f3829'];

function aPalette() {
  const [l0, l1, l2, l3] = A_SHADES;
  return {
    out: l3, skin: l0, skinSh: l1, blush: l1, hair: l2, hairHi: l1, hairSh: l3, grey: l0, greySh: l1,
    top: l2, topSh: l3, topHi: l1, top2: l1, top2Sh: l2, pants: l3, shoe: l3, eye: l3, white: l0,
    grass: l0, grassSh: l1, grassHi: l0, flowerA: l2, flowerB: l1, flowerC: l0, petalSh: l3,
    path: l1, pathSh: l2, pathHi: l0, dirt: l1, dirtSh: l2,
    leaf: l2, leafSh: l3, leafHi: l1, trunk: l3, trunkSh: l3,
    wall: l0, wallSh: l1, wallHi: l0,
    roofA: l2, roofASh: l3, roofAHi: l1, roofB: l1, roofBSh: l2, roofBHi: l0, roofC: l3, roofCSh: l2, roofCHi: l2,
    glass: l1, glassHi: l0, glassSh: l2, frame: l3, door: l2, doorSh: l3, knob: l0,
    sign: l0, signSh: l1, ink: l3, awnA: l0, awnB: l2, stripe: l2, stripe2: l1, cross: l3,
    water: l1, waterHi: l0, waterSh: l2, fence: l0, fenceSh: l1, stone: l1, stoneSh: l2,
    lamp: l3, lampLight: l0, bench: l1, benchSh: l2, planter: l2, poster: l2,
    boxBg: l0, boxBorder: l3, boxBorder2: l1, boxText: l3, boxAccent: l2,
  };
}

function bPalette() {
  const cream = '#fff7ea', peach = '#f8d2b4', pink = '#f5b3c6', butter = '#f8e4a6', mint = '#b8e4c8',
    mintDk = '#86c7a6', sky = '#b5d3f2', lilac = '#a99bc9', plum = '#55426a';
  return {
    out: plum, skin: peach, skinSh: pink, blush: pink, hair: lilac, hairHi: sky, hairSh: plum, grey: cream, greySh: lilac,
    top: pink, topSh: lilac, topHi: cream, top2: mint, top2Sh: mintDk, pants: lilac, shoe: plum, eye: plum, white: cream,
    grass: mint, grassSh: mintDk, grassHi: cream, flowerA: pink, flowerB: butter, flowerC: cream, petalSh: lilac,
    path: cream, pathSh: peach, pathHi: cream, dirt: butter, dirtSh: peach,
    leaf: mintDk, leafSh: lilac, leafHi: mint, trunk: lilac, trunkSh: plum,
    wall: cream, wallSh: butter, wallHi: cream,
    roofA: pink, roofASh: lilac, roofAHi: cream, roofB: sky, roofBSh: lilac, roofBHi: cream, roofC: mintDk, roofCSh: lilac, roofCHi: mint,
    glass: sky, glassHi: cream, glassSh: lilac, frame: lilac, door: pink, doorSh: lilac, knob: butter,
    sign: cream, signSh: butter, ink: plum, awnA: cream, awnB: pink, stripe: mintDk, stripe2: sky, cross: mintDk,
    water: sky, waterHi: cream, waterSh: lilac, fence: cream, fenceSh: lilac, stone: cream, stoneSh: lilac,
    lamp: lilac, lampLight: butter, bench: pink, benchSh: lilac, planter: peach, poster: butter,
    boxBg: cream, boxBorder: plum, boxBorder2: pink, boxText: plum, boxAccent: pink,
  };
}

function cPalette() {
  const ink = '#3a2431', cream = '#fdf0d5', skin = '#f5c6a0', terra = '#d8694a', mustard = '#eeb64b',
    leaf = '#7aa851', forest = '#3f6e4a', sky = '#86b6d6', skyDk = '#4f7fa3', brown = '#8d5a3b';
  return {
    out: ink, skin, skinSh: mustard, blush: terra, hair: brown, hairHi: mustard, hairSh: ink, grey: cream, greySh: sky,
    top: terra, topSh: brown, topHi: mustard, top2: leaf, top2Sh: forest, pants: skyDk, shoe: ink, eye: ink, white: cream,
    grass: leaf, grassSh: forest, grassHi: mustard, flowerA: terra, flowerB: mustard, flowerC: cream, petalSh: brown,
    path: cream, pathSh: mustard, pathHi: cream, dirt: mustard, dirtSh: brown,
    leaf: forest, leafSh: ink, leafHi: leaf, trunk: brown, trunkSh: ink,
    wall: cream, wallSh: mustard, wallHi: cream,
    roofA: terra, roofASh: brown, roofAHi: mustard, roofB: sky, roofBSh: skyDk, roofBHi: cream, roofC: forest, roofCSh: ink, roofCHi: leaf,
    glass: sky, glassHi: cream, glassSh: skyDk, frame: brown, door: brown, doorSh: ink, knob: mustard,
    sign: cream, signSh: mustard, ink, awnA: cream, awnB: terra, stripe: forest, stripe2: mustard, cross: forest,
    water: sky, waterHi: cream, waterSh: skyDk, fence: cream, fenceSh: brown, stone: cream, stoneSh: mustard,
    lamp: ink, lampLight: mustard, bench: brown, benchSh: ink, planter: terra, poster: mustard,
    boxBg: cream, boxBorder: brown, boxBorder2: mustard, boxText: ink, boxAccent: terra,
  };
}

function dPalette() {
  return {
    out: '#33283f', skin: '#ffdcbc', skinSh: '#f0ab86', blush: '#ff9b9b', hair: '#7a4a32', hairHi: '#b37852', hairSh: '#4a2a20',
    grey: '#ececf4', greySh: '#acaac4', top: '#f4743b', topSh: '#c4502a', topHi: '#ffa76c', top2: '#5fae6e', top2Sh: '#3d7f4f',
    pants: '#3c4f8a', shoe: '#3a2f3f', eye: '#2a2035', white: '#ffffff',
    grass: '#80c95c', grassSh: '#5ea84a', grassHi: '#aee27a', flowerA: '#ff7aa8', flowerB: '#ffd54a', flowerC: '#ffffff', petalSh: '#d84f7f',
    path: '#ead4aa', pathSh: '#c9ae84', pathHi: '#f8e9c8', dirt: '#dbb47c', dirtSh: '#b88d58',
    leaf: '#41a052', leafSh: '#2a6e3f', leafHi: '#72c962', trunk: '#8a5a3a', trunkSh: '#5e3a26',
    wall: '#fff4e0', wallSh: '#e6d2b0', wallHi: '#ffffff',
    roofA: '#e2593f', roofASh: '#a83a2e', roofAHi: '#ff8c66', roofB: '#4282da', roofBSh: '#2c58a0', roofBHi: '#7ab0f0',
    roofC: '#30b09b', roofCSh: '#1f7a6e', roofCHi: '#70ddc8',
    glass: '#92d2f0', glassHi: '#e8f9ff', glassSh: '#5c9ec9', frame: '#6a4a3a', door: '#aa663e', doorSh: '#7a4428', knob: '#ffd54a',
    sign: '#fffaf0', signSh: '#dccaa6', ink: '#3a2a3a', awnA: '#ffffff', awnB: '#e2593f', stripe: '#3fae5a', stripe2: '#ffb43c', cross: '#2fae5a',
    water: '#5cb2e8', waterHi: '#cbedff', waterSh: '#3a80c0', fence: '#ffffff', fenceSh: '#c9c1d2', stone: '#d4cfca', stoneSh: '#a39a92',
    lamp: '#4a4458', lampLight: '#ffeaa2', bench: '#c67b48', benchSh: '#8a5030', planter: '#b2613f', poster: '#ffb43c',
    boxBg: '#ffffff', boxBorder: '#3f6fc8', boxBorder2: '#a4c8ff', boxText: '#2a2035', boxAccent: '#f4743b',
  };
}

export const STYLES = {
  A: { name: 'Classic handheld', palette: aPalette(), detail: 0, shadow: 0, dither: true, frame: 'double' },
  B: { name: 'Soft pastel', palette: bPalette(), detail: 0, shadow: 0, dither: false, frame: 'round' },
  C: { name: 'Warm and detailed', palette: cPalette(), detail: 1, shadow: 0.84, dither: false, frame: 'wood' },
  D: { name: 'Later handheld, full colour', palette: dPalette(), detail: 2, shadow: 0.72, dither: false, frame: 'blue' },
};

// ------------------------------------------------------------------ buffer

const ROLES = Object.keys(aPalette());
const ROLE = Object.fromEntries(ROLES.map((r, i) => [r, i]));

class Buf {
  constructor() {
    this.px = new Int16Array(W * H).fill(-1);
    this.sh = new Uint8Array(W * H);
  }
  set(x, y, role) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = ROLE[role];
    if (i === undefined) throw new Error(`unknown role ${role}`);
    this.px[y * W + x] = i;
    // Anything drawn over a shadow sits above it.
    this.sh[y * W + x] = 0;
  }
  rect(x, y, w, h, role) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, role);
  }
  /** A filled rectangle with a 1px outline. */
  box(x, y, w, h, fill, out = 'out') {
    this.rect(x, y, w, h, out);
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }
  shadow(x, y) {
    if (x >= 0 && y >= 0 && x < W && y < H) this.sh[y * W + x] = 1;
  }
  ellipseShadow(cx, cy, rx, ry) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.shadow(x, y);
  }
  /** Fill a shape given by inside(x, y), outlining its edge. colour(x, y) picks the fill. */
  shape(x0, y0, w, h, inside, colour) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        this.set(x0 + x, y0 + y, edge ? 'out' : colour(x, y));
      }
  }
  sprite(rows, x0, y0, key) {
    rows.forEach((row, y) => {
      if (row.length !== rows[0].length) throw new Error(`sprite row ${y} is ${row.length} wide`);
      [...row].forEach((ch, x) => {
        if (ch !== '.') this.set(x0 + x, y0 + y, key[ch]);
      });
    });
  }
}

const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ------------------------------------------------------------------ sprites

const CHIBI_KEY = {
  O: 'out', S: 'skin', s: 'skinSh', P: 'blush', H: 'hair', h: 'hairHi', D: 'hairSh', E: 'eye', W: 'white',
  C: 'top', c: 'topSh', k: 'topHi', B: 'pants', F: 'shoe', G: 'grey', g: 'greySh', T: 'top2', t: 'top2Sh',
};

// The player: chestnut hair, orange hoodie. Two heads tall.
const PLAYER = [
  '......OOOO......',
  '....OOHHHHOO....',
  '...OHHhhHHHHO...',
  '..OHHhHHHHHHHO..',
  '.OHHHHHHHHHHHHO.',
  '.OHHHHHHHHHHHHO.',
  '.OHHSSHHHHSSHHO.',
  '.OHSSSSSSSSSSHO.',
  '.OHSSESSSSESSHO.',
  '.OSSSESSSSESSSO.',
  '..OSPSSSSSSPSO..',
  '...OOSSssSSOO...',
  '..OkCCCCCCCCkO..',
  '.OSOCCCcCCCCOSO.',
  '..OOcCCCCCCcOO..',
  '...OFFO..OFFO...',
];

// The neighbour, Tanaka-san: grey bun, green cardigan, smiling eyes.
const NEIGHBOUR = [
  '......OOOO......',
  '.....OGGGGO.....',
  '....OOGggGOO....',
  '..OOGGGGGGGGOO..',
  '.OGGGGGGGGGGGGO.',
  '.OGGgGGGGGGgGGO.',
  '.OGSSSSSSSSSSGO.',
  '.OSSSSSSSSSSSSO.',
  '.OSEESSSSSSEESO.',
  '.OSPSSSSSSSSPSO.',
  '..OSSSSssSSSSO..',
  '...OOSSSSSSOO...',
  '..OtTTTWWTTTtO..',
  '.OSOTTTWWTTTOSO.',
  '..OOtTTTTTTtOO..',
  '...OFFO..OFFO...',
];

const CAT = [
  '.O.....O.',
  'OGO...OGO',
  'OGGOOOGGO',
  'OGEGGGEGO',
  'OGGGPGGGO',
  '.OGGGGGO.',
  'OGGGGGGGO',
  'OGgGGGgGO',
  '.OOOOOOO.',
];

// ------------------------------------------------------------------ tiles

function grass(b, st, x0, y0, w, h) {
  b.rect(x0, y0, w, h, 'grass');
  for (let ty = y0; ty < y0 + h; ty += 8)
    for (let tx = x0; tx < x0 + w; tx += 8) {
      const r = hash(tx, ty);
      if (r < 0.45) {
        const x = tx + Math.floor(hash(tx, ty, 1) * 5), y = ty + Math.floor(hash(tx, ty, 2) * 6);
        b.set(x, y, 'grassSh'); b.set(x + 1, y + 1, 'grassSh'); b.set(x + 2, y, 'grassSh');
        if (st.detail >= 2) { b.set(x, y - 1, 'grassHi'); b.set(x + 2, y - 1, 'grassHi'); }
      } else if (st.detail >= 1 && r < 0.6) {
        b.set(tx + 3, ty + 3, 'grassHi');
      }
    }
}

function flower(b, st, x, y, petal) {
  b.set(x, y - 1, petal); b.set(x - 1, y, petal); b.set(x + 1, y, petal); b.set(x, y + 1, st.detail >= 2 ? 'petalSh' : petal);
  b.set(x, y, 'flowerC');
  if (st.dither) { b.set(x, y, 'petalSh'); }
}

function flowerPatch(b, st, x0, y0, w, h, seed = 0) {
  for (let y = y0 + 3; y < y0 + h - 1; y += 5)
    for (let x = x0 + 3; x < x0 + w - 1; x += 6) {
      const r = hash(x, y, seed + 9);
      if (r < 0.7) flower(b, st, x + ((y / 5) % 2 ? 3 : 0), y, r < 0.35 ? 'flowerA' : 'flowerB');
    }
}

function plaza(b, st, x0, y0, w, h) {
  b.rect(x0, y0, w, h, 'path');
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const lx = x - x0, ly = y - y0;
      if (st.detail === 0) {
        if (lx % 16 === 0 || ly % 16 === 0) b.set(x, y, 'pathSh');
        else if (lx % 16 === 2 && ly % 16 === 2) b.set(x, y, 'pathHi');
      } else {
        const row = Math.floor(ly / 6);
        const off = row % 2 ? 6 : 0;
        if (ly % 6 === 0 || (lx + off) % 12 === 0) b.set(x, y, 'pathSh');
        else if (st.detail >= 2 && ly % 6 === 1 && (lx + off) % 12 < 4) b.set(x, y, 'pathHi');
      }
    }
}

function dirtPath(b, st, x0, y0, w, h) {
  b.rect(x0, y0, w, h, 'dirt');
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const r = hash(x, y, 3);
      if (r < 0.03) b.set(x, y, 'dirtSh');
      else if (st.detail >= 2 && r < 0.05) b.set(x, y, 'pathHi');
    }
    // Soft, uneven edges.
    if (hash(x0, y, 4) < 0.5) b.set(x0, y, 'grass');
    if (hash(x0 + w, y, 4) < 0.5) b.set(x0 + w - 1, y, 'grass');
    if (st.detail >= 1) { b.set(x0 + 1, y, hash(x0, y, 5) < 0.3 ? 'dirtSh' : 'dirt'); }
  }
}

function tree(b, st, x0, y0) {
  if (st.shadow) b.ellipseShadow(x0 + 8.5, y0 + 15, 7, 2.2);
  // Trunk.
  b.shape(x0 + 5, y0 + 10, 6, 6, (x, y) => x >= 0 && x < 6 && y >= 0 && y < 6, (x) => (x >= 3 && st.detail >= 1 ? 'trunkSh' : 'trunk'));
  // Canopy: a few overlapping circles make it round and a bit bumpy.
  const circles = [[8, 7, 6.6], [4.6, 8.4, 4.3], [11.4, 8.4, 4.3], [8, 4, 4.8]];
  const inside = (x, y) => y < 13 && circles.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
  b.shape(x0, y0, 16, 14, inside, (x, y) => {
    const d = x + y;
    if (st.detail >= 2) {
      if (circles.some(([cx, cy, r]) => (x + 0.5 - (cx - r * 0.35)) ** 2 + (y + 0.5 - (cy - r * 0.4)) ** 2 < 2.2)) return 'leafHi';
      if (d > 18 || (y > 10)) return 'leafSh';
      return 'leaf';
    }
    if (st.dither && d > 16 && (x + y) % 2 === 0) return 'leafSh';
    if (!st.dither && d > 18) return 'leafSh';
    if ((x === 5 || x === 6) && (y === 3 || y === 4)) return 'leafHi';
    if (st.detail >= 1 && ((x === 3 && y === 7) || (x === 10 && y === 6))) return 'leafHi';
    return 'leaf';
  });
}

function fence(b, st, x0, y0, w) {
  b.box(x0, y0 + 5, w, 3, 'fence');
  b.box(x0, y0 + 10, w, 3, 'fence');
  for (let x = x0; x < x0 + w; x += 8) {
    b.box(x, y0 + 2, 4, 13, 'fence');
    b.set(x, y0 + 2, 'grass'); b.set(x + 3, y0 + 2, 'grass');
    if (st.detail >= 1) b.rect(x + 1, y0 + 12, 2, 2, 'fenceSh');
  }
  if (st.shadow) for (let x = x0; x < x0 + w; x++) b.shadow(x, y0 + 15);
}

function lamp(b, st, cx, yTop, yBottom) {
  if (st.shadow) b.ellipseShadow(cx + 0.5, yBottom, 4, 1.5);
  b.box(cx - 1, yTop + 6, 3, yBottom - yTop - 6, 'lamp');
  b.box(cx - 4, yTop, 9, 8, 'lampLight');
  b.rect(cx - 4, yTop, 9, 1, 'out');
  if (st.detail >= 1) { b.set(cx - 2, yTop + 2, 'white'); }
  b.box(cx - 2, yBottom - 2, 5, 3, 'lamp');
}

function bench(b, st, x0, y0) {
  if (st.shadow) b.ellipseShadow(x0 + 8, y0 + 13, 8, 2);
  b.box(x0, y0 + 2, 16, 4, 'bench');
  b.box(x0, y0 + 6, 16, 3, st.detail >= 1 ? 'benchSh' : 'bench');
  b.box(x0 + 1, y0 + 8, 3, 5, 'benchSh');
  b.box(x0 + 12, y0 + 8, 3, 5, 'benchSh');
}

function pond(b, st, x0, y0, w, h) {
  const r = 7;
  const inside = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const cx = x < r ? r : x >= w - r ? w - r - 1 : x;
    const cy = y < r ? r : y >= h - r ? h - r - 1 : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  b.shape(x0, y0, w, h, inside, (x, y) => {
    if (st.detail >= 1 && y < 4) return 'waterSh';
    return 'water';
  });
  // Ripples.
  for (let i = 0; i < 6; i++) {
    const x = x0 + 8 + Math.floor(hash(i, 1, 7) * (w - 18)), y = y0 + 8 + Math.floor(hash(i, 2, 7) * (h - 14));
    b.rect(x, y, 3, 1, 'waterHi');
    if (st.detail >= 2) b.set(x + 1, y - 1, 'waterHi');
  }
  if (st.detail >= 1) {
    // A lily pad with a notch.
    const lx = x0 + w - 18, ly = y0 + h - 14;
    b.shape(lx, ly, 8, 6, (x, y) => (x - 3.5) ** 2 / 16 + (y - 2.5) ** 2 / 9 <= 1 && !(x >= 3 && x <= 4 && y <= 2), () => (st.detail >= 2 ? 'leafHi' : 'leaf'));
    if (st.detail >= 2) flower(b, st, lx + 2, ly + 2, 'flowerA');
  }
}

function signpost(b, st, x0, y0) {
  if (st.shadow) b.ellipseShadow(x0 + 8, y0 + 15, 5, 1.5);
  b.box(x0 + 7, y0 + 7, 3, 9, 'bench');
  b.box(x0 + 1, y0, 15, 9, 'sign');
  b.rect(x0 + 2, y0 + 7, 13, 1, 'signSh');
  // An arrow pointing to the station.
  b.rect(x0 + 4, y0 + 4, 7, 1, 'ink');
  b.set(x0 + 10, y0 + 3, 'ink'); b.set(x0 + 10, y0 + 5, 'ink'); b.set(x0 + 9, y0 + 2, 'ink'); b.set(x0 + 9, y0 + 6, 'ink');
}

// ------------------------------------------------------------------ text as pixels (signs)

let pixelFontCache = new Map();
/** Render text with a bitmap-style font and threshold it to whole pixels. */
function pixelText(text, font) {
  const key = text + font;
  if (pixelFontCache.has(key)) return pixelFontCache.get(key);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 24;
  const ctx = c.getContext('2d');
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  ctx.fillText(text, 2, 17);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const on = [];
  let minX = 999, minY = 999, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] >= 128) {
        on.push([x, y]);
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
  const glyph = { w: maxX - minX + 1, h: maxY - minY + 1, px: on.map(([x, y]) => [x - minX, y - minY]) };
  pixelFontCache.set(key, glyph);
  return glyph;
}

const SIGN_FONT = '16px "Unifont-JP", "Unifont", monospace';

function signBoard(b, st, cx, y0, text) {
  const g = pixelText(text, SIGN_FONT);
  const w = g.w + 9, h = g.h + 6;
  const x0 = Math.round(cx - w / 2);
  if (st.detail >= 2) b.box(x0 - 1, y0 - 1, w + 2, h + 2, 'signSh');
  b.box(x0, y0, w, h, 'sign');
  if (st.detail >= 1) b.rect(x0 + 1, y0 + h - 2, w - 2, 1, 'signSh');
  // Doubled sideways for a chunkier, bolder sign.
  for (const [x, y] of g.px) { b.set(x0 + 4 + x, y0 + 3 + y, 'ink'); if (st.detail <= 1) b.set(x0 + 5 + x, y0 + 3 + y, 'ink'); }
  return { x0, w, h };
}

// ------------------------------------------------------------------ buildings

const ROOF_BOTTOM = 21;
const GROUND = 80;

function roof(b, st, x0, w, role) {
  const sh = role + 'Sh', hi = role + 'Hi';
  const rx = x0 - 2, rw = w + 4, top = 2;
  b.rect(rx, top, rw, ROOF_BOTTOM - top, role);
  for (let y = top; y < ROOF_BOTTOM; y++)
    for (let x = rx; x < rx + rw; x++) {
      const ly = y - top, lx = x - rx;
      if (st.detail === 0) {
        if (ly % 5 === 4) b.set(x, y, sh);
        else if (ly === 1) b.set(x, y, hi);
      } else {
        // Rows of round tiles.
        const row = Math.floor((ly - 2) / 4);
        const off = row % 2 ? 3 : 0;
        const tx = (lx + off) % 6, ty = (ly - 2) % 4;
        if (ly < 2) b.set(x, y, st.detail >= 2 ? sh : hi);
        else if (ty === 3 && tx >= 1 && tx <= 4) b.set(x, y, sh);
        else if (ty === 2 && (tx === 0 || tx === 5)) b.set(x, y, sh);
        else if (st.detail >= 2 && ty === 0 && (tx === 2 || tx === 3)) b.set(x, y, hi);
        if (st.detail >= 2 && ly >= ROOF_BOTTOM - top - 3 && b.px[y * W + x] === ROLE[role] && (x + y) % 2) b.set(x, y, sh);
      }
    }
  // Outline: ridge, sides, eave.
  b.rect(rx, top, rw, 1, 'out');
  b.rect(rx, top, 1, ROOF_BOTTOM - top, 'out');
  b.rect(rx + rw - 1, top, 1, ROOF_BOTTOM - top, 'out');
  b.rect(rx, ROOF_BOTTOM - 1, rw, 1, 'out');
}

function wall(b, st, x0, w) {
  b.rect(x0, ROOF_BOTTOM, w, GROUND - ROOF_BOTTOM, 'wall');
  b.rect(x0, ROOF_BOTTOM, 1, GROUND - ROOF_BOTTOM, 'out');
  b.rect(x0 + w - 1, ROOF_BOTTOM, 1, GROUND - ROOF_BOTTOM, 'out');
  // Shade under the eave.
  for (let x = x0 + 1; x < x0 + w - 1; x++) {
    if (st.shadow) { b.shadow(x, ROOF_BOTTOM); b.shadow(x, ROOF_BOTTOM + 1); }
    else if (st.dither) { b.set(x, ROOF_BOTTOM, 'wallSh'); if (x % 2) b.set(x, ROOF_BOTTOM + 1, 'wallSh'); }
    else b.set(x, ROOF_BOTTOM, 'wallSh');
  }
  // Foundation.
  b.rect(x0, GROUND - 6, w, 1, 'out');
  b.rect(x0 + 1, GROUND - 5, w - 2, 5, 'stone');
  if (st.detail >= 1) for (let x = x0 + 4; x < x0 + w - 2; x += 8) b.rect(x, GROUND - 5, 1, 5, 'stoneSh');
  b.rect(x0 + 1, GROUND - 1, w - 2, 1, 'stoneSh');
}

function windowPane(b, st, x0, y0, w, h, { mullion = true } = {}) {
  b.box(x0, y0, w, h, 'glass');
  if (st.detail >= 1) b.rect(x0 + 1, y0 + 1, w - 2, 2, 'glassSh');
  // Reflection.
  const lines = st.detail >= 2 ? [[2, 0], [5, 0], [6, 0]] : st.detail >= 1 ? [[2, 0], [4, 0]] : [[2, 0]];
  for (const [o] of lines)
    for (let i = 0; i < Math.min(w, h); i++) {
      const x = x0 + o + i, y = y0 + h - 2 - i;
      if (x > x0 && x < x0 + w - 1 && y > y0 && y < y0 + h - 1) b.set(x, y, 'glassHi');
    }
  if (mullion) {
    b.rect(x0 + Math.floor(w / 2), y0, 1, h, st.detail >= 1 ? 'frame' : 'out');
    if (st.detail >= 1) b.rect(x0, y0 + Math.floor(h / 2), w, 1, 'frame');
  }
  b.rect(x0, y0, w, 1, 'out'); b.rect(x0, y0 + h - 1, w, 1, 'out');
}

function planterBox(b, st, x0, y0, w) {
  b.box(x0, y0 + 2, w, 5, 'planter');
  for (let x = x0 + 2; x < x0 + w - 1; x += 3) flower(b, st, x, y0 + 1, (x / 3) % 2 ? 'flowerA' : 'flowerB');
}

function door(b, st, cx, y0, kind) {
  const w = kind === 'konbini' ? 16 : 12, x0 = cx - w / 2, h = GROUND - y0;
  if (kind === 'cafe') {
    b.box(x0, y0, w, h, 'door');
    if (st.detail >= 1) b.rect(x0 + w - 3, y0 + 1, 2, h - 1, 'doorSh');
    b.box(x0 + 3, y0 + 3, w - 6, 7, 'glass');
    b.set(x0 + 4, y0 + 4, 'glassHi');
    b.set(x0 + w - 4, y0 + 14, 'knob');
  } else {
    b.box(x0, y0, w, h, 'glass');
    b.rect(cx, y0, 1, h, 'out');
    for (let i = 0; i < 5; i++) { b.set(x0 + 2 + i, y0 + h - 4 - i, 'glassHi'); b.set(cx + 2 + i, y0 + h - 4 - i, 'glassHi'); }
    if (st.detail >= 1) { b.rect(x0 + 1, y0 + 1, w - 2, 1, 'glassSh'); }
  }
  // Doormat.
  b.rect(x0 + 1, GROUND - 1, w - 2, 1, st.detail >= 1 ? 'doorSh' : 'out');
}

function cafe(b, st, x0, w) {
  roof(b, st, x0, w, 'roofA');
  wall(b, st, x0, w);
  const cx = x0 + w / 2;
  signBoard(b, st, cx, 24, 'カフェ');
  // Striped awning with a scalloped edge.
  const ay = 47;
  for (let x = x0 + 1; x < x0 + w - 1; x++) {
    const role = Math.floor((x - x0) / 4) % 2 ? 'awnB' : 'awnA';
    b.rect(x, ay, 1, 4, role);
    if ((x - x0) % 4 === 1 || (x - x0) % 4 === 2) b.set(x, ay + 4, role);
    if (st.detail >= 2) b.set(x, ay + 1, (x - x0) % 8 < 4 ? 'wallHi' : 'roofAHi');
  }
  b.rect(x0, ay - 1, w, 1, 'out');
  for (let x = x0 + 1; x < x0 + w - 1; x++) b.set(x, (x - x0) % 4 === 1 || (x - x0) % 4 === 2 ? ay + 5 : ay + 4, 'out');
  windowPane(b, st, x0 + 5, 55, 22, 15);
  windowPane(b, st, x0 + w - 27, 55, 22, 15);
  door(b, st, cx, 54, 'cafe');
  if (st.detail >= 2) { planterBox(b, st, x0 + 5, 68, 22); planterBox(b, st, x0 + w - 27, 68, 22); }
}

function konbini(b, st, x0, w) {
  roof(b, st, x0, w, 'roofB');
  wall(b, st, x0, w);
  const cx = x0 + w / 2;
  signBoard(b, st, cx, 24, 'コンビニ');
  // Colour stripes across the front.
  const sy = 46;
  b.rect(x0, sy, w, 1, 'out');
  b.rect(x0 + 1, sy + 1, w - 2, 2, 'stripe');
  b.rect(x0 + 1, sy + 3, w - 2, 2, st.detail >= 1 ? 'stripe2' : 'stripe');
  if (st.detail >= 2) b.rect(x0 + 1, sy + 5, w - 2, 1, 'roofB');
  b.rect(x0, sy + (st.detail >= 2 ? 6 : 5), w, 1, 'out');
  // Big shop windows.
  windowPane(b, st, x0 + 3, 55, cx - 8 - x0 - 4, 19, { mullion: false });
  windowPane(b, st, cx + 9, 55, x0 + w - 3 - (cx + 9), 19, { mullion: false });
  if (st.detail >= 2) {
    // Posters and shelves behind the glass.
    b.box(x0 + 6, 58, 6, 8, 'poster'); b.box(x0 + w - 13, 58, 6, 8, 'awnB');
    for (const sx of [x0 + 14, cx + 12]) { b.rect(sx, 64, 14, 1, 'glassSh'); b.rect(sx, 69, 14, 1, 'glassSh'); }
    for (let i = 0; i < 5; i++) { b.set(x0 + 15 + i * 3, 63, i % 2 ? 'flowerA' : 'flowerB'); b.set(cx + 13 + i * 3, 68, i % 2 ? 'flowerB' : 'stripe'); }
  }
  door(b, st, cx, 54, 'konbini');
}

function pharmacy(b, st, x0, w) {
  roof(b, st, x0, w, 'roofC');
  wall(b, st, x0, w);
  const cx = x0 + w / 2;
  const s = signBoard(b, st, cx - 6, 24, '薬局');
  // Green cross panel.
  const px = s.x0 + s.w + 3, py = 25;
  b.box(px, py, 15, 15, 'sign');
  b.rect(px + 6, py + 3, 3, 9, 'cross');
  b.rect(px + 3, py + 6, 9, 3, 'cross');
  if (st.detail >= 2) { b.set(px + 6, py + 3, 'roofCHi'); b.set(px + 3, py + 6, 'roofCHi'); }
  windowPane(b, st, x0 + 5, 52, 22, 18, { mullion: false });
  windowPane(b, st, x0 + w - 27, 52, 22, 18, { mullion: false });
  if (st.detail >= 1) {
    for (const wx of [x0 + 6, x0 + w - 26]) {
      b.rect(wx, 58, 20, 1, 'frame'); b.rect(wx, 64, 20, 1, 'frame');
      if (st.detail >= 2) for (let i = 0; i < 6; i++) { b.rect(wx + 1 + i * 3, 56, 2, 2, ['flowerA', 'white', 'cross'][i % 3]); b.rect(wx + 2 + i * 3, 62, 2, 2, ['white', 'flowerB', 'flowerA'][i % 3]); }
    }
  }
  door(b, st, cx, 52, 'pharmacy');
  if (st.detail >= 2) { planterBox(b, st, x0 + 5, 70, 22); planterBox(b, st, x0 + w - 27, 70, 22); }
}

// ------------------------------------------------------------------ scene

function character(b, st, rows, x, y) {
  if (st.shadow) b.ellipseShadow(x + 8, y + 15.5, 6, 1.8);
  b.sprite(rows, x, y, CHIBI_KEY);
}

export function drawStreet(st) {
  const b = new Buf();
  // Back row: grass with trees and flowers between the shops.
  grass(b, st, 0, 0, W, GROUND);
  for (const [x, y] of [[0, 4], [0, 34], [96, 6], [192, 6], [292, 2], [304, 30], [288, 46]]) tree(b, st, x, y);
  flowerPatch(b, st, 96, 46, 16, 32, 1);
  flowerPatch(b, st, 192, 46, 16, 32, 2);
  flowerPatch(b, st, 0, 56, 16, 22, 3);

  cafe(b, st, 16, 80);
  konbini(b, st, 112, 80);
  pharmacy(b, st, 208, 80);

  // The street: a brick plaza in front of the shops.
  plaza(b, st, 0, GROUND, W, 32);
  if (st.shadow) for (let x = 16; x < 288; x++) if (!(x >= 96 && x < 112) && !(x >= 192 && x < 208)) b.shadow(x, GROUND);
  lamp(b, st, 103, 64, 96);
  lamp(b, st, 199, 64, 96);

  // The park below.
  grass(b, st, 0, 112, W, H - 112);
  dirtPath(b, st, 144, 112, 32, H - 112);
  fence(b, st, 8, 112, 128);
  fence(b, st, 184, 112, 120);
  flowerPatch(b, st, 24, 132, 40, 18, 4);
  flowerPatch(b, st, 184, 132, 30, 16, 5);
  pond(b, st, 222, 154, 70, 46);
  for (const [x, y] of [[2, 138], [0, 176], [104, 150], [118, 184], [196, 176], [300, 140], [304, 186]]) tree(b, st, x, y);
  bench(b, st, 64, 160);
  b.sprite(CAT, 68, 154, { O: 'out', G: 'grey', g: 'greySh', E: 'eye', P: 'blush' });
  signpost(b, st, 128, 132);

  character(b, st, NEIGHBOUR, 68, 88);
  character(b, st, PLAYER, 144, 92);
  return b;
}

// ------------------------------------------------------------------ dialogue frame

function frame(b, st, x0, y0, w, h) {
  const kind = st.frame;
  if (kind === 'double') {
    // Thick outer line, a gap, a thin inner line; the corners are left open.
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
        if (corner) continue;
        const d = Math.min(x, y, w - 1 - x, h - 1 - y);
        b.set(x0 + x, y0 + y, d <= 1 || d === 3 ? 'boxBorder' : 'boxBg');
      }
  } else {
    const r = kind === 'round' ? 5 : kind === 'blue' ? 6 : 2;
    const inside = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      const cx = x < r ? r : x >= w - r ? w - r - 1 : x;
      const cy = y < r ? r : y >= h - r ? h - r - 1 : y;
      return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    };
    if (kind === 'blue') for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) b.shadow(x0 + x + 2, y0 + y + 3);
    const border = kind === 'wood' || kind === 'blue' ? 3 : 2;
    const ring = (x, y) => {
      for (let i = 1; i <= border; i++) if (!inside(x - i, y) || !inside(x + i, y) || !inside(x, y - i) || !inside(x, y + i)) return true;
      return false;
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        let role = edge ? 'out' : ring(x, y) ? 'boxBorder' : 'boxBg';
        if (kind === 'round' && edge) role = 'boxBorder';
        if (kind === 'blue' && !edge && ring(x, y)) {
          // Deep blue band with a light inner rim.
          let d = 1;
          while (d < border && inside(x - d, y) && inside(x + d, y) && inside(x, y - d) && inside(x, y + d)) d++;
          role = d === border ? 'boxBorder2' : 'boxBorder';
        }
        if (kind === 'wood' && !edge && ring(x, y) && (x + y) % 5 === 0) role = 'boxBorder2';
        b.set(x0 + x, y0 + y, role);
      }
    if (kind === 'wood') for (const [cx, cy] of [[x0 + 2, y0 + 2], [x0 + w - 3, y0 + 2], [x0 + 2, y0 + h - 3], [x0 + w - 3, y0 + h - 3]]) b.set(cx, cy, 'boxBorder2');
  }
}

function nameTag(b, st, x0, y0, w) {
  if (st.frame === 'double') { b.rect(x0, y0, w, 13, 'boxBorder'); b.rect(x0 + 2, y0 + 2, w - 4, 11, 'boxBg'); return; }
  const fill = st.frame === 'blue' || st.frame === 'round' ? 'boxAccent' : 'boxBorder2';
  b.box(x0, y0, w, 13, fill);
}

function cursor(b, st, x0, y0) {
  // A small right-pointing triangle.
  const role = st.frame === 'blue' ? 'boxAccent' : 'boxText';
  for (let i = 0; i < 4; i++) b.rect(x0 + i, y0 + i, 1, 7 - i * 2, role);
}

export const DIALOGUE = {
  box: { x: 6, y: 150, w: 308, h: 54 },
  tag: { x: 14, y: 138, w: 30 },
  menu: { x: 186, y: 76, w: 128, h: 64 },
};

export function drawDialogue(st) {
  const b = drawStreet(st);
  const { box, tag, menu } = DIALOGUE;
  frame(b, st, menu.x, menu.y, menu.w, menu.h);
  cursor(b, st, menu.x + 8, menu.y + 12);
  nameTag(b, st, tag.x, tag.y, tag.w);
  frame(b, st, box.x, box.y, box.w, box.h);
  // The "more" arrow at the bottom right of the text box.
  const ax = box.x + box.w - 14, ay = box.y + box.h - 10;
  for (let i = 0; i < 4; i++) b.rect(ax + i, ay + i, 7 - i * 2, 1, st.frame === 'blue' ? 'boxAccent' : 'boxText');
  return b;
}

// ------------------------------------------------------------------ output

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Paint the buffer into a canvas at SCALE x, crisp. */
export function paint(b, st, canvas) {
  const small = document.createElement('canvas');
  small.width = W; small.height = H;
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(W, H);
  const colours = ROLES.map((r) => hexRgb(st.palette[r]));
  for (let i = 0; i < W * H; i++) {
    const role = b.px[i];
    let [r, g, bl] = role < 0 ? [255, 0, 255] : colours[role];
    if (b.sh[i] && st.shadow) { r *= st.shadow; g *= st.shadow; bl *= st.shadow; }
    img.data.set([r, g, bl, 255], i * 4);
  }
  sctx.putImageData(img, 0, 0);
  canvas.width = W * SCALE; canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, W * SCALE, H * SCALE);
  return ctx;
}

const TEXT_FONT = '"IPAPGothic", "Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif';

/** Draw a line of [text, reading?] segments with furigana, at screen pixels. */
function rubyLine(ctx, segs, x, baseY, size, colour) {
  const rubySize = Math.round(size * 0.45);
  ctx.fillStyle = colour;
  ctx.textBaseline = 'alphabetic';
  for (const [text, reading] of segs) {
    ctx.font = `bold ${size}px ${TEXT_FONT}`;
    const w = ctx.measureText(text).width;
    ctx.fillText(text, x, baseY);
    if (reading) {
      ctx.font = `bold ${rubySize}px ${TEXT_FONT}`;
      const rw = ctx.measureText(reading).width;
      ctx.fillText(reading, x + (w - rw) / 2, baseY - size - 2);
    }
    x += w;
  }
}

export function writeDialogueText(ctx, st) {
  const { box, tag, menu } = DIALOGUE;
  const S = SCALE;
  const colour = st.palette.boxText;
  const tagColour = st.frame === 'blue' || st.frame === 'round' ? '#ffffff' : colour;
  ctx.font = `bold ${22}px ${TEXT_FONT}`;
  ctx.fillStyle = st.frame === 'round' ? st.palette.out : tagColour;
  ctx.fillText('ゆき', (tag.x + 6) * S, (tag.y + 10) * S - 3);
  rubyLine(ctx, [['いらっしゃいませ！　ご', null], ['注文', 'ちゅうもん'], ['は？', null]], (box.x + 12) * S, (box.y + 34) * S, 34, colour);
  const opts = [
    [['ラテを お', null], ['願', 'ねが'], ['いします。', null]],
    [['ごちそうさまでした。', null]],
    [['ラテだ。', null]],
  ];
  opts.forEach((segs, i) => rubyLine(ctx, segs, (menu.x + 17) * S, (menu.y + 20 + i * 17) * S, 26, colour));
}
