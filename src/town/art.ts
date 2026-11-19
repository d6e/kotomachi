// Draws the whole town into one pixel buffer: grass, trees, flowers, the shop fronts,
// the street and the park. Ported from the art mockups (style D). All original art.
// Sign lettering isn't drawn here: each board is left blank and its text is drawn
// crisply on top by the town, so it stays readable at any size.

import { BACK_TREES, BUILDINGS, buildGrid, GROUND, LAMPS, POND, ROOF_BOTTOM, ROWS, TILE, WORLD_H, WORLD_W, type Building, type Grid, type RoofRole } from './map.ts';
import type { Role } from './palette.ts';
import { Buf, hash, roundRect } from './pixels.ts';
import { CAT, KEY } from './sprites.ts';

/** Font size of sign text, in world pixels. */
export const SIGN_TEXT = 10;
const SIGN_H = 15;

/** A sign board whose text the town draws on top. World pixels. */
export interface SignSpot {
  word: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Measures text at SIGN_TEXT px in world pixels (the browser's canvas does this). */
export type Measure = (text: string) => number;

// ------------------------------------------------------------------ ground

function grass(b: Buf, x0: number, y0: number, w: number, h: number): void {
  b.rect(x0, y0, w, h, 'grass');
  for (let ty = y0; ty < y0 + h; ty += 8)
    for (let tx = x0; tx < x0 + w; tx += 8) {
      const r = hash(tx, ty);
      if (r < 0.45) {
        const x = tx + Math.floor(hash(tx, ty, 1) * 5);
        const y = ty + Math.floor(hash(tx, ty, 2) * 6);
        b.set(x, y, 'grassSh');
        b.set(x + 1, y + 1, 'grassSh');
        b.set(x + 2, y, 'grassSh');
        b.set(x, y - 1, 'grassHi');
        b.set(x + 2, y - 1, 'grassHi');
      } else if (r < 0.6) b.set(tx + 3, ty + 3, 'grassHi');
    }
}

function flower(b: Buf, x: number, y: number, petal: Role): void {
  b.set(x, y - 1, petal);
  b.set(x - 1, y, petal);
  b.set(x + 1, y, petal);
  b.set(x, y + 1, 'petalSh');
  b.set(x, y, 'flowerC');
}

function flowerPatch(b: Buf, x0: number, y0: number, w: number, h: number, seed = 0): void {
  for (let y = y0 + 3; y < y0 + h - 1; y += 5)
    for (let x = x0 + 3; x < x0 + w - 1; x += 6) {
      const r = hash(x, y, seed + 9);
      if (r < 0.7) flower(b, x + ((y / 5) % 2 ? 3 : 0), y, r < 0.35 ? 'flowerA' : 'flowerB');
    }
}

function plaza(b: Buf, x0: number, y0: number, w: number, h: number): void {
  b.rect(x0, y0, w, h, 'path');
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const lx = x - x0;
      const ly = y - y0;
      const off = Math.floor(ly / 6) % 2 ? 6 : 0;
      if (ly % 6 === 0 || (lx + off) % 12 === 0) b.set(x, y, 'pathSh');
      else if (ly % 6 === 1 && (lx + off) % 12 < 4) b.set(x, y, 'pathHi');
    }
}

function dirtTile(b: Buf, grid: Grid, tx: number, ty: number): void {
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  const isDirt = (x: number, y: number) => grid[y]?.[x] === 'dirt' || (y === ty - 1 && grid[y]?.[x] === 'plaza');
  for (let y = y0; y < y0 + TILE; y++)
    for (let x = x0; x < x0 + TILE; x++) {
      const r = hash(x, y, 3);
      b.set(x, y, r < 0.03 ? 'dirtSh' : r < 0.05 ? 'pathHi' : 'dirt');
    }
  // Soft, uneven edges where the path meets grass.
  for (let i = 0; i < TILE; i++) {
    if (!isDirt(tx - 1, ty) && hash(x0, y0 + i, 4) < 0.5) b.set(x0, y0 + i, 'grass');
    if (!isDirt(tx + 1, ty) && hash(x0 + 16, y0 + i, 4) < 0.5) b.set(x0 + TILE - 1, y0 + i, 'grass');
    if (!isDirt(tx, ty - 1) && hash(x0 + i, y0, 6) < 0.5) b.set(x0 + i, y0, 'grass');
    if (!isDirt(tx, ty + 1) && ty + 1 < ROWS && hash(x0 + i, y0 + 16, 6) < 0.5) b.set(x0 + i, y0 + TILE - 1, 'grass');
  }
}

function tree(b: Buf, x0: number, y0: number): void {
  b.ellipseShadow(x0 + 8.5, y0 + 15, 7, 2.2);
  b.shape(x0 + 5, y0 + 10, 6, 6, (x, y) => x >= 0 && x < 6 && y >= 0 && y < 6, (x) => (x >= 3 ? 'trunkSh' : 'trunk'));
  // A few overlapping circles make the canopy round and a bit bumpy.
  const circles = [[8, 7, 6.6], [4.6, 8.4, 4.3], [11.4, 8.4, 4.3], [8, 4, 4.8]] as const;
  const inside = (x: number, y: number) => y < 13 && circles.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
  b.shape(x0, y0, 16, 14, inside, (x, y) => {
    if (circles.some(([cx, cy, r]) => (x + 0.5 - (cx - r * 0.35)) ** 2 + (y + 0.5 - (cy - r * 0.4)) ** 2 < 2.2)) return 'leafHi';
    if (x + y > 18 || y > 10) return 'leafSh';
    return 'leaf';
  });
}

function fence(b: Buf, x0: number, y0: number, w: number): void {
  b.box(x0, y0 + 5, w, 3, 'fence');
  b.box(x0, y0 + 10, w, 3, 'fence');
  for (let x = x0; x < x0 + w; x += 8) {
    b.box(x, y0 + 2, 4, 13, 'fence');
    b.set(x, y0 + 2, 'path');
    b.set(x + 3, y0 + 2, 'path');
    b.rect(x + 1, y0 + 12, 2, 2, 'fenceSh');
  }
  for (let x = x0; x < x0 + w; x++) b.shadow(x, y0 + 15);
}

function lamp(b: Buf, cx: number, yTop: number, yBottom: number): void {
  b.ellipseShadow(cx + 0.5, yBottom, 4, 1.5);
  b.box(cx - 1, yTop + 6, 3, yBottom - yTop - 6, 'lamp');
  b.box(cx - 4, yTop, 9, 8, 'lampLight');
  b.rect(cx - 4, yTop, 9, 1, 'out');
  b.set(cx - 2, yTop + 2, 'white');
  b.box(cx - 2, yBottom - 2, 5, 3, 'lamp');
}

function bench(b: Buf, x0: number, y0: number): void {
  b.ellipseShadow(x0 + 8, y0 + 13, 8, 2);
  b.box(x0, y0 + 2, 16, 4, 'bench');
  b.box(x0, y0 + 6, 16, 3, 'benchSh');
  b.box(x0 + 1, y0 + 8, 3, 5, 'benchSh');
  b.box(x0 + 12, y0 + 8, 3, 5, 'benchSh');
}

function pond(b: Buf, x0: number, y0: number, w: number, h: number): void {
  const inside = roundRect(w, h, 7);
  b.shape(x0, y0, w, h, inside, (_x, y) => (y < 4 ? 'waterSh' : 'water'));
  for (let i = 0; i < 6; i++) {
    const x = x0 + 8 + Math.floor(hash(i, 1, 7) * (w - 18));
    const y = y0 + 8 + Math.floor(hash(i, 2, 7) * (h - 14));
    b.rect(x, y, 3, 1, 'waterHi');
    b.set(x + 1, y - 1, 'waterHi');
  }
  // A lily pad with a notch, and a flower on it.
  const lx = x0 + w - 18;
  const ly = y0 + h - 14;
  b.shape(lx, ly, 8, 6, (x, y) => (x - 3.5) ** 2 / 16 + (y - 2.5) ** 2 / 9 <= 1 && !(x >= 3 && x <= 4 && y <= 2), () => 'leafHi');
  flower(b, lx + 2, ly + 2, 'flowerA');
}

function signpost(b: Buf, x0: number, y0: number): void {
  b.ellipseShadow(x0 + 8, y0 + 15, 5, 1.5);
  b.box(x0 + 7, y0 + 7, 3, 9, 'bench');
  b.box(x0 + 1, y0, 15, 9, 'sign');
  b.rect(x0 + 2, y0 + 7, 13, 1, 'signSh');
  // An arrow pointing to the station.
  b.rect(x0 + 4, y0 + 4, 7, 1, 'ink');
  b.set(x0 + 10, y0 + 3, 'ink');
  b.set(x0 + 10, y0 + 5, 'ink');
  b.set(x0 + 9, y0 + 2, 'ink');
  b.set(x0 + 9, y0 + 6, 'ink');
}

// ------------------------------------------------------------------ buildings

function signBoard(b: Buf, signs: SignSpot[], measure: Measure, cx: number, y0: number, word: string): SignSpot {
  const w = Math.max(16, Math.ceil(measure(word)) + 10);
  const x0 = Math.round(cx - w / 2);
  b.box(x0 - 1, y0 - 1, w + 2, SIGN_H + 2, 'signSh');
  b.box(x0, y0, w, SIGN_H, 'sign');
  b.rect(x0 + 1, y0 + SIGN_H - 2, w - 2, 1, 'signSh');
  const s = { word, x: x0, y: y0, w, h: SIGN_H };
  signs.push(s);
  return s;
}

function roof(b: Buf, x0: number, w: number, role: RoofRole): void {
  const sh = `${role}Sh` as Role;
  const hi = `${role}Hi` as Role;
  const rx = x0 - 2;
  const rw = w + 4;
  const top = 2;
  b.rect(rx, top, rw, ROOF_BOTTOM - top, role);
  for (let y = top; y < ROOF_BOTTOM; y++)
    for (let x = rx; x < rx + rw; x++) {
      const ly = y - top;
      const lx = x - rx;
      // Rows of round tiles.
      const off = Math.floor((ly - 2) / 4) % 2 ? 3 : 0;
      const tx = (lx + off) % 6;
      const ty = (ly - 2) % 4;
      if (ly < 2) b.set(x, y, sh);
      else if (ty === 3 && tx >= 1 && tx <= 4) b.set(x, y, sh);
      else if (ty === 2 && (tx === 0 || tx === 5)) b.set(x, y, sh);
      else if (ty === 0 && (tx === 2 || tx === 3)) b.set(x, y, hi);
      if (ly >= ROOF_BOTTOM - top - 3 && b.is(x, y, role) && (x + y) % 2) b.set(x, y, sh);
    }
  b.rect(rx, top, rw, 1, 'out');
  b.rect(rx, top, 1, ROOF_BOTTOM - top, 'out');
  b.rect(rx + rw - 1, top, 1, ROOF_BOTTOM - top, 'out');
  b.rect(rx, ROOF_BOTTOM - 1, rw, 1, 'out');
}

function wall(b: Buf, x0: number, w: number, role: Role = 'wall'): void {
  b.rect(x0, ROOF_BOTTOM, w, GROUND - ROOF_BOTTOM, role);
  b.rect(x0, ROOF_BOTTOM, 1, GROUND - ROOF_BOTTOM, 'out');
  b.rect(x0 + w - 1, ROOF_BOTTOM, 1, GROUND - ROOF_BOTTOM, 'out');
  // Shade under the eave.
  for (let x = x0 + 1; x < x0 + w - 1; x++) {
    b.shadow(x, ROOF_BOTTOM);
    b.shadow(x, ROOF_BOTTOM + 1);
  }
  // Foundation.
  b.rect(x0, GROUND - 6, w, 1, 'out');
  b.rect(x0 + 1, GROUND - 5, w - 2, 5, 'stone');
  for (let x = x0 + 4; x < x0 + w - 2; x += 8) b.rect(x, GROUND - 5, 1, 5, 'stoneSh');
  b.rect(x0 + 1, GROUND - 1, w - 2, 1, 'stoneSh');
}

function windowPane(b: Buf, x0: number, y0: number, w: number, h: number, mullion = true): void {
  b.box(x0, y0, w, h, 'glass');
  b.rect(x0 + 1, y0 + 1, w - 2, 2, 'glassSh');
  for (const o of [2, 5, 6])
    for (let i = 0; i < Math.min(w, h); i++) {
      const x = x0 + o + i;
      const y = y0 + h - 2 - i;
      if (x > x0 && x < x0 + w - 1 && y > y0 && y < y0 + h - 1) b.set(x, y, 'glassHi');
    }
  if (mullion) {
    b.rect(x0 + Math.floor(w / 2), y0, 1, h, 'frame');
    b.rect(x0, y0 + Math.floor(h / 2), w, 1, 'frame');
  }
  b.rect(x0, y0, w, 1, 'out');
  b.rect(x0, y0 + h - 1, w, 1, 'out');
}

function planterBox(b: Buf, x0: number, y0: number, w: number): void {
  b.box(x0, y0 + 2, w, 5, 'planter');
  for (let x = x0 + 2; x < x0 + w - 1; x += 3) flower(b, x, y0 + 1, (x / 3) % 2 ? 'flowerA' : 'flowerB');
}

function door(b: Buf, cx: number, y0: number, kind: 'wood' | 'glass' | 'wide'): void {
  const w = kind === 'wide' ? 16 : 12;
  const x0 = cx - w / 2;
  const h = GROUND - y0;
  if (kind === 'wood') {
    b.box(x0, y0, w, h, 'door');
    b.rect(x0 + w - 3, y0 + 1, 2, h - 1, 'doorSh');
    b.box(x0 + 3, y0 + 3, w - 6, 7, 'glass');
    b.set(x0 + 4, y0 + 4, 'glassHi');
    b.set(x0 + w - 4, y0 + 14, 'knob');
  } else {
    b.box(x0, y0, w, h, 'glass');
    b.rect(cx, y0, 1, h, 'out');
    for (let i = 0; i < 5; i++) {
      b.set(x0 + 2 + i, y0 + h - 4 - i, 'glassHi');
      b.set(cx + 2 + i, y0 + h - 4 - i, 'glassHi');
    }
    b.rect(x0 + 1, y0 + 1, w - 2, 1, 'glassSh');
  }
  b.rect(x0 + 1, GROUND - 1, w - 2, 1, 'doorSh');
}

type Ctx = { b: Buf; signs: SignSpot[]; measure: Measure };

function home({ b, signs, measure }: Ctx, x0: number, w: number, bd: Building): void {
  roof(b, x0, w, bd.roof);
  wall(b, x0, w, 'wall2');
  const cx = x0 + w / 2;
  signBoard(b, signs, measure, cx, 24, bd.sign);
  // Upstairs windows with a little balcony rail.
  for (const wx of [x0 + 5, x0 + w - 23]) {
    windowPane(b, wx, 42, 18, 12);
    b.rect(wx - 1, 53, 20, 1, 'out');
    b.rect(wx - 1, 56, 20, 1, 'out');
    for (let x = wx; x < wx + 19; x += 3) b.rect(x, 54, 1, 2, 'out');
    for (let x = wx - 1; x < wx + 19; x++) b.shadow(x, 57);
  }
  b.rect(x0 + 1, 58, w - 2, 1, 'wall2Sh');
  // Downstairs: two small windows, the front door, a pot plant and a mailbox.
  windowPane(b, x0 + 7, 61, 14, 10);
  windowPane(b, x0 + w - 21, 61, 14, 10);
  door(b, cx, 59, 'wood');
  b.box(cx + 9, 66, 7, 8, 'planter');
  for (const [dx, dy] of [[1, -2], [3, -4], [5, -2], [2, -1], [4, -1]] as const) b.set(cx + 9 + dx, 66 + dy, dy < -1 ? 'leafHi' : 'leaf');
  b.box(cx - 15, 63, 6, 5, 'roofD');
  b.rect(cx - 13, 68, 2, 6, 'lamp');
}

function cafe({ b, signs, measure }: Ctx, x0: number, w: number, bd: Building): void {
  roof(b, x0, w, bd.roof);
  wall(b, x0, w);
  const cx = x0 + w / 2;
  signBoard(b, signs, measure, cx, 24, bd.sign);
  // Striped awning with a scalloped edge.
  const ay = 47;
  for (let x = x0 + 1; x < x0 + w - 1; x++) {
    const role: Role = Math.floor((x - x0) / 4) % 2 ? 'awnB' : 'awnA';
    b.rect(x, ay, 1, 4, role);
    if ((x - x0) % 4 === 1 || (x - x0) % 4 === 2) b.set(x, ay + 4, role);
    b.set(x, ay + 1, (x - x0) % 8 < 4 ? 'wallHi' : 'roofAHi');
  }
  b.rect(x0, ay - 1, w, 1, 'out');
  for (let x = x0 + 1; x < x0 + w - 1; x++) b.set(x, (x - x0) % 4 === 1 || (x - x0) % 4 === 2 ? ay + 5 : ay + 4, 'out');
  windowPane(b, x0 + 5, 55, 22, 15);
  windowPane(b, x0 + w - 27, 55, 22, 15);
  door(b, cx, 54, 'wood');
  planterBox(b, x0 + 5, 68, 22);
  planterBox(b, x0 + w - 27, 68, 22);
}

function konbini({ b, signs, measure }: Ctx, x0: number, w: number, bd: Building): void {
  roof(b, x0, w, bd.roof);
  wall(b, x0, w);
  const cx = x0 + w / 2;
  signBoard(b, signs, measure, cx, 24, bd.sign);
  const sy = 46;
  b.rect(x0, sy, w, 1, 'out');
  b.rect(x0 + 1, sy + 1, w - 2, 2, 'stripe');
  b.rect(x0 + 1, sy + 3, w - 2, 2, 'stripe2');
  b.rect(x0 + 1, sy + 5, w - 2, 1, 'roofB');
  b.rect(x0, sy + 6, w, 1, 'out');
  windowPane(b, x0 + 3, 55, cx - 8 - x0 - 4, 19, false);
  windowPane(b, cx + 9, 55, x0 + w - 3 - (cx + 9), 19, false);
  // Posters and shelves behind the glass.
  b.box(x0 + 6, 58, 6, 8, 'poster');
  b.box(x0 + w - 13, 58, 6, 8, 'awnB');
  for (const sx of [x0 + 14, cx + 12]) {
    b.rect(sx, 64, 14, 1, 'glassSh');
    b.rect(sx, 69, 14, 1, 'glassSh');
  }
  for (let i = 0; i < 5; i++) {
    b.set(x0 + 15 + i * 3, 63, i % 2 ? 'flowerA' : 'flowerB');
    b.set(cx + 13 + i * 3, 68, i % 2 ? 'flowerB' : 'stripe');
  }
  door(b, cx, 54, 'wide');
}

function pharmacy({ b, signs, measure }: Ctx, x0: number, w: number, bd: Building): void {
  roof(b, x0, w, bd.roof);
  wall(b, x0, w);
  const cx = x0 + w / 2;
  const s = signBoard(b, signs, measure, cx - 9, 24, bd.sign);
  // Green cross panel.
  const px = s.x + s.w + 3;
  const py = 24;
  b.box(px, py, 15, 15, 'sign');
  b.rect(px + 6, py + 3, 3, 9, 'cross');
  b.rect(px + 3, py + 6, 9, 3, 'cross');
  b.set(px + 6, py + 3, 'roofCHi');
  b.set(px + 3, py + 6, 'roofCHi');
  windowPane(b, x0 + 5, 52, 22, 18, false);
  windowPane(b, x0 + w - 27, 52, 22, 18, false);
  for (const wx of [x0 + 6, x0 + w - 26]) {
    b.rect(wx, 58, 20, 1, 'frame');
    b.rect(wx, 64, 20, 1, 'frame');
    for (let i = 0; i < 6; i++) {
      b.rect(wx + 1 + i * 3, 56, 2, 2, (['flowerA', 'white', 'cross'] as const)[i % 3]);
      b.rect(wx + 2 + i * 3, 62, 2, 2, (['white', 'flowerB', 'flowerA'] as const)[i % 3]);
    }
  }
  door(b, cx, 52, 'glass');
  planterBox(b, x0 + 5, 70, 22);
  planterBox(b, x0 + w - 27, 70, 22);
}

function station({ b, signs, measure }: Ctx, x0: number, w: number, bd: Building): void {
  roof(b, x0, w, bd.roof);
  wall(b, x0, w);
  const cx = x0 + w / 2;
  const s = signBoard(b, signs, measure, cx - 8, 24, bd.sign);
  // A round clock beside the sign.
  const ccx = s.x + s.w + 10;
  b.shape(ccx - 6, 25, 13, 13, (x, y) => (x - 6) ** 2 + (y - 6) ** 2 <= 36, () => 'white');
  b.rect(ccx, 27, 1, 5, 'ink');
  b.rect(ccx, 31, 4, 1, 'ink');
  // A canopy over a wide entrance, with ticket gates inside.
  b.rect(x0 + 18, 44, w - 36, 1, 'out');
  b.rect(x0 + 19, 45, w - 38, 2, 'roofE');
  b.rect(x0 + 19, 47, w - 38, 1, 'roofESh');
  b.rect(x0 + 18, 48, w - 36, 1, 'out');
  const ex = x0 + 24;
  const ew = w - 48;
  b.box(ex, 49, ew, GROUND - 49 - 5, 'dark');
  b.rect(ex + 1, 50, ew - 2, 4, 'darkSh');
  for (let i = 0; i < 4; i++) {
    const gx = ex + 4 + i * 11;
    b.box(gx, 62, 6, 12, 'stone');
    b.set(gx + 2, 64, i % 2 ? 'cross' : 'flowerB');
  }
  for (const wx of [x0 + 5, x0 + w - 19]) windowPane(b, wx, 52, 14, 16);
}

function restaurant({ b, signs, measure }: Ctx, x0: number, w: number, bd: Building): void {
  roof(b, x0, w, bd.roof);
  wall(b, x0, w, 'wall2');
  const cx = x0 + w / 2;
  signBoard(b, signs, measure, cx, 24, bd.sign);
  // A paper lantern hanging at each end of the sign.
  for (const lx of [x0 + 4, x0 + w - 11]) {
    b.rect(lx + 3, 22, 1, 3, 'out');
    b.shape(lx, 25, 7, 10, (x, y) => ((x - 3) / 3.5) ** 2 + ((y - 4.5) / 5) ** 2 <= 1, (x, y) => (y === 2 || y === 7 ? 'lanternSh' : x >= 4 ? 'lanternSh' : 'lantern'));
    b.rect(lx + 1, 25, 5, 1, 'out');
    b.rect(lx + 1, 34, 5, 1, 'out');
    b.set(lx + 2, 28, 'flowerB');
  }
  // Big windows with warm light and tables behind them.
  for (const wx of [x0 + 4, x0 + w - 26]) {
    windowPane(b, wx, 48, 22, 18, false);
    b.rect(wx + 1, 49, 20, 3, 'lampLight');
    for (const tx of [wx + 4, wx + 13]) {
      b.rect(tx, 59, 6, 1, 'frame');
      b.rect(tx + 2, 60, 2, 5, 'frame');
      b.set(tx + 1, 58, 'white');
    }
  }
  // Wooden door with a noren curtain split in three.
  door(b, cx, 50, 'wood');
  b.rect(cx - 8, 48, 16, 1, 'out');
  for (let i = 0; i < 3; i++) {
    const nx = cx - 7 + i * 5;
    b.box(nx, 49, 4, 9, 'noren');
    b.rect(nx + 1, 56, 2, 1, 'norenSh');
  }
  b.rect(cx - 2, 51, 4, 1, 'white');
  // A chalk menu board on the step.
  const mx = cx + 9;
  b.box(mx, 64, 9, 11, 'bench');
  b.box(mx + 1, 65, 7, 7, 'chalk');
  b.rect(mx + 2, 67, 5, 1, 'white');
  b.rect(mx + 2, 69, 3, 1, 'flowerB');
  b.rect(mx + 1, 75, 1, 3, 'benchSh');
  b.rect(mx + 7, 75, 1, 3, 'benchSh');
  planterBox(b, x0 + 4, 70, 22);
}

/** The post office: a red 〒 panel, a glass door and a round red postbox out front. */
function post({ b, signs, measure }: Ctx, x0: number, w: number, bd: Building): void {
  roof(b, x0, w, bd.roof);
  wall(b, x0, w);
  const cx = x0 + w / 2;
  const s = signBoard(b, signs, measure, cx + 9, 24, bd.sign);
  // The 〒 mark on a white panel.
  const px = s.x - 18;
  const py = 24;
  b.box(px, py, 15, 15, 'sign');
  b.rect(px + 3, py + 3, 9, 2, 'postRed');
  b.rect(px + 3, py + 6, 9, 2, 'postRed');
  b.rect(px + 6, py + 8, 3, 5, 'postRed');
  b.rect(px + 3, py + 3, 9, 1, 'roofGHi');
  // A band in the post office's red across the front.
  b.rect(x0, 44, w, 1, 'out');
  b.rect(x0 + 1, 45, w - 2, 3, 'postRed');
  b.rect(x0 + 1, 47, w - 2, 1, 'postRedSh');
  b.rect(x0, 48, w, 1, 'out');
  windowPane(b, x0 + 5, 53, 22, 17);
  windowPane(b, x0 + w - 27, 53, 22, 17);
  door(b, cx, 52, 'glass');
  // The postbox, standing on the street side of the right window.
  const bx = x0 + w - 13;
  b.ellipseShadow(bx + 4.5, GROUND + 1, 6, 1.6);
  b.shape(bx, 61, 10, 19, (x, y) => y > 1 || (x > 0 && x < 9), (x, y) => (y < 3 ? 'roofGHi' : x >= 7 ? 'postRedSh' : 'postRed'));
  b.rect(bx, 61, 10, 1, 'out');
  b.rect(bx + 2, 66, 6, 1, 'out');
  b.rect(bx + 2, 70, 6, 3, 'white');
  b.rect(bx + 4, 70, 2, 3, 'postRed');
  b.rect(bx, 79, 10, 1, 'out');
}

const BUILD = { home, cafe, konbini, pharmacy, restaurant, post, station } as const;

// ------------------------------------------------------------------ world

export interface World {
  buf: Buf;
  signs: SignSpot[];
}

export function drawWorld(measure: Measure, grid: Grid = buildGrid()): World {
  const b = new Buf(WORLD_W, WORLD_H);
  const signs: SignSpot[] = [];
  // Back row: grass, with trees and flowers between the buildings.
  grass(b, 0, 0, WORLD_W, GROUND);
  for (const t of BACK_TREES) {
    const x = t * TILE;
    tree(b, x, 4);
    if (t === 0 || t === BACK_TREES[BACK_TREES.length - 1]) tree(b, x, 30);
    flowerPatch(b, x, 46, 16, 32, t);
  }
  for (const bd of BUILDINGS) BUILD[bd.id]({ b, signs, measure }, bd.x, bd.w, bd);

  // The street: a brick plaza in front of the shops, with the buildings' shade along it.
  plaza(b, 0, GROUND, WORLD_W, 2 * TILE);
  for (const bd of BUILDINGS) for (let x = bd.x; x < bd.x + bd.w; x++) b.shadow(x, GROUND);
  for (const t of LAMPS) lamp(b, t * TILE + 7, GROUND - 16, GROUND + 16);

  // The park.
  const parkTop = GROUND + 2 * TILE;
  grass(b, 0, parkTop, WORLD_W, WORLD_H - parkTop);
  for (let ty = 0; ty < grid.length; ty++)
    for (let tx = 0; tx < grid[ty]!.length; tx++) if (grid[ty]![tx] === 'dirt') dirtTile(b, grid, tx, ty);
  // Fence runs along the park's top row, broken by the paths.
  const fenceRow = grid[parkTop / TILE]!;
  for (let tx = 0; tx < fenceRow.length; ) {
    if (fenceRow[tx] !== 'fence') {
      tx++;
      continue;
    }
    let end = tx;
    while (fenceRow[end] === 'fence') end++;
    fence(b, tx * TILE, parkTop, (end - tx) * TILE);
    tx = end;
  }
  pond(b, POND.tx * TILE, POND.ty * TILE, POND.tw * TILE, POND.th * TILE);
  for (let ty = 0; ty < grid.length; ty++)
    for (let tx = 0; tx < grid[ty]!.length; tx++) {
      const k = grid[ty]![tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (k === 'flowers') flowerPatch(b, x, y, TILE, TILE, tx * 31 + ty);
      else if (k === 'tree') tree(b, x, y);
      else if (k === 'signpost') signpost(b, x, y);
      else if (k === 'bench') {
        bench(b, x, y);
        // A cat naps on the first bench.
        if (tx === 4) b.sprite(CAT, x + 4, y - 6, { ...KEY, G: 'grey', g: 'greySh', E: 'eye', P: 'blush' });
      }
    }
  return { buf: b, signs };
}

/** A small plate hung on a closed shop's door, sized for its text. */
export function plate(textWidth: number): { buf: Buf; w: number; h: number } {
  const w = Math.ceil(textWidth) + 8;
  const h = 11;
  const b = new Buf(w + 1, h + 4);
  // The string it hangs from.
  b.set(Math.floor(w / 2) - 3, 0, 'out');
  b.set(Math.floor(w / 2) + 3, 0, 'out');
  b.set(Math.floor(w / 2) - 2, 1, 'out');
  b.set(Math.floor(w / 2) + 2, 1, 'out');
  for (let x = 0; x < w; x++) b.shadow(x + 1, h + 2);
  b.shape(0, 2, w, h, roundRect(w, h, 2), (_x, y) => (y >= h - 3 ? 'signSh' : 'sign'));
  b.rect(1, 3, w - 2, 1, 'closed');
  return { buf: b, w, h };
}
