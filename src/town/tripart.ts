// Draws a trip's open-air town: 鎌倉, with its stone path, a torii, the shrine on the
// left and the souvenir shop on the right, stone lanterns, hydrangeas and the station
// platform at the bottom. Same style D pixel art as the street. All original art.

import { bench, flowerPatch, grass, signBoard, tree, windowPane, type Measure, type SignSpot } from './art.ts';
import { TILE } from './map.ts';
import type { Role } from './palette.ts';
import { Buf, hash, roundRect } from './pixels.ts';
import type { RoomArt } from './roomart.ts';
import { cellAt, ROOM_COLS, ROOM_ROWS, type RoomDef, type TripPlace } from './rooms.ts';

const W = ROOM_COLS * TILE;
const H = ROOM_ROWS * TILE;

/** The bounds, in tiles, of each block of '#' with a door in its bottom row. */
function blocks(room: RoomDef): { x: number; y: number; w: number; h: number; door: string; to: TripPlace }[] {
  const out: { x: number; y: number; w: number; h: number; door: string; to: TripPlace }[] = [];
  for (const d of room.doors ?? []) {
    let pos: { tx: number; ty: number } | null = null;
    room.rows.forEach((r, ty) => {
      const tx = r.indexOf(d.cell);
      if (tx >= 0) pos = { tx, ty };
    });
    if (!pos) continue;
    const { tx, ty } = pos as { tx: number; ty: number };
    let x0 = tx;
    let x1 = tx;
    while (cellAt(room, x0 - 1, ty) === '#') x0--;
    while (cellAt(room, x1 + 1, ty) === '#') x1++;
    let y0 = ty;
    while (cellAt(room, tx, y0 - 1) === '#' || cellAt(room, x0, y0 - 1) === '#') y0--;
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: ty - y0 + 1, door: d.cell, to: d.to });
  }
  return out;
}

function stonePath(b: Buf, tx: number, ty: number): void {
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  // Two big flagstones a tile, offset row to row.
  b.rect(x0, y0, TILE, TILE, 'dirt');
  const off = ty % 2 ? 4 : 0;
  for (const [sx, sy, sw, sh] of [[1 + off, 1, 10, 6], [off ? 0 : 9, 8, 7, 7], [off ? 9 : 0, 8, 6, 7]] as const) {
    if (sx + sw > TILE) continue;
    b.shape(x0 + sx, y0 + sy, sw, sh, roundRect(sw, sh, 2), (_x, y) => (y >= sh - 2 ? 'stoneSh' : hash(x0 + sx, y0 + sy, 3) < 0.3 ? 'tileB' : 'stone'));
  }
}

/** A stone lantern, standing on its tile and reaching up into the one above. */
function lantern(b: Buf, x: number, y: number): void {
  b.ellipseShadow(x + 8, y + 14, 6, 1.8);
  b.box(x + 3, y + 10, 10, 4, 'stone');
  b.box(x + 6, y + 2, 4, 9, 'stone');
  b.box(x + 3, y - 6, 10, 8, 'stone');
  b.rect(x + 5, y - 4, 6, 4, 'lampLight');
  b.rect(x + 7, y - 4, 2, 4, 'stoneSh');
  b.shape(x + 1, y - 11, 14, 6, (i, j) => j >= 0 && j < 6 && i >= 5 - j && i < 9 + j, (_i, j) => (j > 3 ? 'stoneSh' : 'stone'));
  b.box(x + 7, y - 13, 2, 3, 'stone');
}

/** A hydrangea bush: Kamakura is known for them in the rainy season. */
function hydrangea(b: Buf, x: number, y: number, seed: number): void {
  b.ellipseShadow(x + 8, y + 13, 7, 2);
  b.shape(x + 1, y + 3, 14, 10, roundRect(14, 10, 4), (_i, j) => (j > 6 ? 'leafSh' : 'leaf'));
  const tones: [Role, Role][] = [['roofD', 'roofDHi'], ['roofB', 'roofBHi'], ['flowerA', 'white']];
  for (let i = 0; i < 4; i++) {
    const [c, hi] = tones[Math.floor(hash(seed, i, 4) * tones.length)]!;
    const cx = x + 2 + ((i * 4 + seed) % 10);
    const cy = y + 2 + Math.floor(hash(seed, i, 5) * 5);
    b.shape(cx, cy, 5, 4, roundRect(5, 4, 2), (a, c2) => (a + c2 < 3 ? hi : c));
  }
}

/** The shrine hall: a dark tiled roof with turned-up ends, red posts and a rope over the door. */
function shrine(b: Buf, signs: SignSpot[], measure: Measure, x: number, y: number, w: number, h: number, doorX: number): void {
  const bottom = y + h;
  // Stone base and steps.
  b.box(x + 2, bottom - 6, w - 4, 6, 'stone');
  b.rect(x + 3, bottom - 2, w - 6, 1, 'stoneSh');
  // Walls: wood boards between red posts.
  const wallTop = y + 18;
  const wallH = bottom - 6 - wallTop;
  b.box(x + 6, wallTop, w - 12, wallH, 'wood');
  for (let px = x + 6; px < x + w - 8; px += 16) b.box(px, wallTop, 3, wallH, 'roofA');
  b.box(x + w - 9, wallTop, 3, wallH, 'roofA');
  b.rect(x + 7, wallTop + 2, w - 14, 2, 'roofASh');
  // The doorway, open and dark, with a rope and white paper zigzags over it.
  b.box(doorX + 1, wallTop + 6, TILE - 2, wallH - 6, 'darkSh');
  b.rect(doorX - 4, wallTop + 5, TILE + 8, 3, 'dirt');
  b.rect(doorX - 4, wallTop + 5, TILE + 8, 1, 'dirtSh');
  for (const zx of [doorX - 1, doorX + 7, doorX + 14]) {
    b.rect(zx, wallTop + 8, 2, 2, 'white');
    b.rect(zx + 1, wallTop + 10, 2, 2, 'white');
    b.rect(zx, wallTop + 12, 2, 2, 'white');
  }
  // The roof: wide, with the ends curving up.
  const rTop = y - 4;
  const rH = 24;
  b.shape(x - 4, rTop, w + 8, rH, (i, j) => {
    const edge = j < 6 ? 10 - j : 4 - Math.min(4, Math.floor((j - 6) / 4));
    const lift = j > rH - 6 && (i < 4 || i > w + 3) ? 1 : 0;
    return j >= 0 && j < rH - lift && i >= edge && i < w + 8 - edge;
  }, (i, j) => (j < 3 ? 'roofEHi' : (j - 3) % 5 === 4 ? 'roofESh' : (i + j) % 7 === 0 ? 'roofESh' : 'roofE'));
  // A gold ridge.
  b.rect(x + 8, rTop, w - 16, 2, 'gold');
  signBoard(b, signs, measure, doorX + TILE / 2, rTop + 7, '神社');
}

/** The souvenir shop: an orange tiled roof, a shop window and a noren curtain at the door. */
function shop(b: Buf, signs: SignSpot[], measure: Measure, x: number, y: number, w: number, h: number, doorX: number): void {
  const bottom = y + h;
  const wallTop = y + 14;
  b.box(x + 2, wallTop, w - 4, bottom - wallTop, 'wall');
  b.rect(x + 3, bottom - 5, w - 6, 4, 'stone');
  b.rect(x + 3, bottom - 5, w - 6, 1, 'out');
  // Windows full of things on shelves.
  for (const wx of [x + 8, doorX + TILE + 6]) {
    if (wx + 26 > x + w - 4) continue;
    windowPane(b, wx, wallTop + 6, 26, 18, false);
    for (let i = 0; i < 4; i++) b.rect(wx + 3 + i * 6, wallTop + 16, 4, 4, (['roofA', 'stripe2', 'roofB', 'flowerA'] as Role[])[i]!);
  }
  // The doorway with a noren: three panels with a white mark.
  b.box(doorX, wallTop + 6, TILE, bottom - 5 - wallTop - 6, 'darkSh');
  for (let i = 0; i < 3; i++) {
    const nx = doorX - 2 + i * 7;
    b.box(nx, wallTop + 6, 6, 12, i % 2 ? 'norenSh' : 'noren');
    b.rect(nx + 2, wallTop + 10, 2, 2, 'white');
  }
  // Roof.
  b.shape(x - 2, y - 6, w + 4, 22, roundRect(w + 4, 22, 3), (i, j) => (j < 3 ? 'roofFHi' : (j - 3) % 5 === 4 || (i + (Math.floor(j / 5) % 2) * 3) % 6 === 0 ? 'roofFSh' : 'roofF'));
  signBoard(b, signs, measure, doorX + TILE / 2, y - 2, 'お土産');
}

/** The mountains behind 箱根, with Mount Fuji in the distance, over the top rows. */
function mountains(b: Buf, room: RoomDef): void {
  let rows = 0;
  while (room.rows[rows]?.startsWith('M')) rows++;
  const h = rows * TILE;
  for (let y = 0; y < h; y++) b.rect(0, y, W, 1, y < h * 0.45 ? 'glass' : 'glassHi');
  // Fuji, far off on the right, with snow on top.
  const peak = Math.round(W * 0.68);
  b.shape(peak - 40, 1, 81, h - 1, (i, j) => Math.abs(i - 40) <= 5 + j * 1.5, (i, j) => (j < 6 ? 'white' : j < 8 && i % 4 < 2 ? 'white' : 'roofE'));
  // Nearer green ridges in front, and a line of trees.
  b.shape(0, Math.round(h * 0.35), Math.round(W * 0.5), h - Math.round(h * 0.35), (i, j) => j >= Math.abs(i - W * 0.22) * 0.12, (i, j) => ((i + j) % 9 === 0 ? 'leafSh' : 'leaf'));
  b.shape(Math.round(W * 0.45), Math.round(h * 0.6), Math.round(W * 0.55), h - Math.round(h * 0.6), (i, j) => j >= Math.abs(i - W * 0.3) * 0.08, () => 'leafSh');
  for (let x = 0; x < W; x += 6) b.shape(x, h - 7, 6, 7, (i, j) => Math.abs(i - 2.5) <= j * 0.5, () => (x % 12 ? 'leafSh' : 'leaf'));
}

/** The ryokan: dark wood and white plaster, a deep tiled roof, lanterns and a noren at the door. */
function ryokan(b: Buf, signs: SignSpot[], measure: Measure, x: number, y: number, w: number, h: number, doorX: number): void {
  const bottom = y + h;
  const wallTop = y + 16;
  b.box(x + 2, wallTop, w - 4, bottom - wallTop, 'wall');
  // Dark timber frame: posts and a beam.
  for (let px = x + 4; px < x + w - 4; px += 24) b.rect(px, wallTop, 3, bottom - wallTop, 'trunkSh');
  b.rect(x + 3, wallTop + 2, w - 6, 3, 'trunkSh');
  b.rect(x + 3, bottom - 5, w - 6, 4, 'stone');
  b.rect(x + 3, bottom - 5, w - 6, 1, 'out');
  // Lattice windows, lit warm.
  for (const wx of [x + 10, x + 34, doorX + TILE + 10, doorX + TILE + 34]) {
    if (wx + 18 > x + w - 6 || (wx < doorX + TILE + 6 && wx + 18 > doorX - 6)) continue;
    b.box(wx, wallTop + 8, 18, 12, 'lampLight');
    for (let i = 3; i < 18; i += 4) b.rect(wx + i, wallTop + 9, 1, 10, 'trunk');
    b.rect(wx + 1, wallTop + 14, 16, 1, 'trunk');
  }
  // The entrance, with an indigo noren and a paper lantern each side.
  b.box(doorX - 2, wallTop + 6, TILE + 4, bottom - 5 - wallTop - 6, 'darkSh');
  for (let i = 0; i < 3; i++) {
    const nx = doorX - 2 + i * 7;
    b.box(nx, wallTop + 6, 6, 11, i % 2 ? 'norenSh' : 'noren');
  }
  b.rect(doorX + 4, wallTop + 10, 1, 4, 'white');
  b.rect(doorX + 4, wallTop + 10, 7, 1, 'white');
  b.rect(doorX + 10, wallTop + 10, 1, 4, 'white');
  for (const lx of [doorX - 10, doorX + TILE + 4]) {
    b.rect(lx + 3, wallTop + 4, 1, 3, 'out');
    b.box(lx, wallTop + 7, 7, 10, 'lantern');
    b.rect(lx + 1, wallTop + 9, 5, 1, 'lanternSh');
    b.rect(lx + 1, wallTop + 13, 5, 1, 'lanternSh');
  }
  // A deep roof of dark tiles.
  b.shape(x - 4, y - 6, w + 8, 24, (i, j) => j >= 0 && i >= Math.max(0, 6 - j) && i < w + 8 - Math.max(0, 6 - j), (i, j) => (j < 3 ? 'roofEHi' : (j - 3) % 4 === 3 || (i + (Math.floor(j / 4) % 2) * 2) % 5 === 0 ? 'roofESh' : 'roofE'));
  b.rect(x, y - 6, w, 2, 'roofESh');
  signBoard(b, signs, measure, doorX + TILE / 2, y + 2, '旅館');
}

/** A steaming footbath of hot spring water in a stone rim, with its sign on a post. */
function footbath(b: Buf, front: Buf, signs: SignSpot[], measure: Measure, room: RoomDef, tx: number, ty: number): void {
  let w = 0;
  while (cellAt(room, tx + w, ty) === '~') w++;
  let h = 0;
  while (cellAt(room, tx, ty + h) === '~') h++;
  const x = tx * TILE;
  const y = ty * TILE;
  b.ellipseShadow(x + (w * TILE) / 2, y + h * TILE, (w * TILE) / 2, 2.5);
  b.shape(x - 1, y + 2, w * TILE + 2, h * TILE - 2, roundRect(w * TILE + 2, h * TILE - 2, 5), (i, j) => (i < 4 || j < 4 || i > w * TILE - 3 || j > h * TILE - 8 ? (hash(i >> 2, j >> 2, 6) < 0.4 ? 'stoneSh' : 'stone') : 'water'));
  for (let i = 0; i < 4; i++) b.rect(x + 8 + i * 9, y + 10 + (i % 2) * 6, 5, 1, 'waterHi');
  // Steam drifting up over it.
  for (let i = 0; i < 5; i++) {
    const sx = x + 6 + i * 9;
    for (let k = 0; k < 7; k++) if ((k + i) % 3) front.set(sx + Math.round(Math.sin((k + i) * 1.1) * 2), y + 6 - k * 2, 'white');
  }
  signBoard(b, signs, measure, x - 10, y + 2, '温泉');
}

// ------------------------------------------------------------------ 秋葉原

/** Pavement: pale square slabs, with a grout line every tile. */
function pavement(b: Buf, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  b.rect(x, y, TILE, TILE, (tx + ty) % 2 ? 'tileA' : 'tileB');
  b.rect(x, y + TILE - 1, TILE, 1, 'greySh');
  b.rect(x + TILE - 1, y, 1, TILE, 'greySh');
}

/** Yellow tactile paving: the bumpy strip that guides you to the doors and the station. */
function tactile(b: Buf, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  b.rect(x + 2, y + 2, TILE - 4, TILE - 4, 'flowerB');
  for (let i = 4; i < TILE - 3; i += 4) for (let j = 4; j < TILE - 3; j += 4) b.set(x + i, y + j, 'stripe2');
}

/** The road, with a white line down the middle and a zebra crossing. */
function road(b: Buf, room: RoomDef, tx: number, ty: number, crossing: boolean): void {
  const x = tx * TILE;
  const y = ty * TILE;
  b.rect(x, y, TILE, TILE, 'dark');
  if (hash(tx, ty, 2) < 0.4) b.set(x + 5, y + 9, 'darkSh');
  if (crossing) {
    for (let i = 1; i < TILE; i += 5) b.rect(x + i, y + 1, 3, TILE - 2, 'white');
    return;
  }
  // The centre line, between the two rows of road.
  if (cellAt(room, tx, ty + 1) === 'R' && tx % 2 === 0) b.rect(x + 2, y + TILE - 1, 10, 2, 'white');
  // Kerbs.
  if (!'Rz'.includes(cellAt(room, tx, ty - 1))) b.rect(x, y, TILE, 2, 'stoneSh');
  if (!'Rz'.includes(cellAt(room, tx, ty + 1))) b.rect(x, y + TILE - 2, TILE, 2, 'stoneSh');
}

/** Tall buildings behind the street, each with rows of lit windows and a sign down its side. */
function skyline(b: Buf, room: RoomDef): void {
  let rows = 0;
  while (room.rows[rows + 1]?.includes('B')) rows++;
  const h = (rows + 1) * TILE;
  b.rect(0, 0, W, h, 'glassHi');
  const tones: Role[] = ['roofE', 'stationWallSh', 'roofESh', 'greySh'];
  for (let x = 0, i = 0; x < W; i++) {
    const w = 18 + Math.floor(hash(i, 1, 7) * 22);
    const top = Math.floor(hash(i, 2, 7) * 8);
    b.box(x, top, w + 1, h - top, tones[i % tones.length]!);
    for (let wy = top + 4; wy < h - 4; wy += 6)
      for (let wx = x + 3; wx < x + w - 3; wx += 5) b.rect(wx, wy, 3, 3, hash(wx, wy, 8) < 0.5 ? 'lampLight' : 'glass');
    if (hash(i, 3, 7) < 0.5) {
      const sx = x + w - 6;
      const role = (['roofG', 'roofB', 'roofD', 'stripe2'] as Role[])[i % 4]!;
      b.box(sx, top + 6, 5, Math.min(30, h - top - 10), role);
      for (let k = top + 9; k < top + 6 + Math.min(30, h - top - 10) - 3; k += 4) b.rect(sx + 2, k, 1, 2, 'white');
    }
    x += w;
  }
}

/** The electronics shop: a tall block in blue, its sign lit up, TVs and phones in the window. */
function electronics(b: Buf, signs: SignSpot[], measure: Measure, x: number, y: number, w: number, h: number, doorX: number): void {
  const bottom = y + h;
  b.box(x, y, w, h, 'roofB');
  // Floors of windows above the shop.
  for (let fy = y + 4; fy < bottom - 30; fy += 9)
    for (let fx = x + 4; fx < x + w - 6; fx += 9) b.box(fx, fy, 7, 6, 'glass');
  // A band of lights under the sign.
  for (let lx = x + 2; lx < x + w - 2; lx += 3) b.set(lx, bottom - 28, (lx / 3) % 2 ? 'gold' : 'white');
  // Shop windows full of screens.
  for (const wx of [x + 4, doorX + TILE + 3]) {
    if (wx + 20 > x + w - 2 || (wx < doorX + TILE && wx + 20 > doorX)) continue;
    b.box(wx, bottom - 20, 20, 15, 'darkSh');
    for (let i = 0; i < 3; i++) b.box(wx + 2 + i * 6, bottom - 18 + (i % 2) * 3, 5, 6, (['glass', 'roofC', 'flowerA'] as Role[])[i]!);
  }
  b.box(doorX + 1, bottom - 20, TILE - 2, 20, 'glassSh');
  b.rect(doorX + TILE / 2, bottom - 19, 1, 18, 'out');
  signBoard(b, signs, measure, doorX + TILE / 2, bottom - 36, '電気屋');
}

/** The maid cafe: a pink front, a striped awning, hearts in the window and a sign over the door. */
function maidCafe(b: Buf, signs: SignSpot[], measure: Measure, x: number, y: number, w: number, h: number, doorX: number): void {
  const bottom = y + h;
  b.box(x, y, w, h, 'wall2');
  for (let fy = y + 4; fy < bottom - 32; fy += 9)
    for (let fx = x + 5; fx < x + w - 7; fx += 10) b.box(fx, fy, 7, 6, 'glass');
  // The awning: pink and white stripes with a scalloped edge.
  const ay = bottom - 26;
  for (let i = 0; i < w - 4; i++) b.rect(x + 2 + i, ay, 1, 6, Math.floor(i / 4) % 2 ? 'white' : 'flowerA');
  for (let i = 0; i < w - 4; i += 4) b.rect(x + 3 + i, ay + 6, 2, 1, 'petalSh');
  b.rect(x + 2, ay, w - 4, 1, 'out');
  // Windows with a heart in each.
  for (const wx of [x + 5, doorX + TILE + 4]) {
    if (wx + 16 > x + w - 2 || (wx < doorX + TILE && wx + 16 > doorX)) continue;
    windowPane(b, wx, bottom - 18, 16, 12, false);
    heart(b, wx + 5, bottom - 15);
  }
  b.box(doorX + 1, bottom - 18, TILE - 2, 18, 'door');
  b.rect(doorX + TILE - 5, bottom - 10, 2, 2, 'knob');
  heart(b, doorX + 5, bottom - 15);
  signBoard(b, signs, measure, doorX + TILE / 2, bottom - 38, 'メイドカフェ');
}

function heart(b: Buf, x: number, y: number): void {
  b.rect(x, y, 2, 2, 'flowerA');
  b.rect(x + 3, y, 2, 2, 'flowerA');
  b.rect(x, y + 1, 5, 2, 'flowerA');
  b.rect(x + 1, y + 3, 3, 1, 'flowerA');
  b.set(x + 2, y + 4, 'flowerA');
}

/** The arcade: a red front ringed with chaser lights, a crane game in the window. */
function arcadeFront(b: Buf, signs: SignSpot[], measure: Measure, x: number, y: number, w: number, h: number, doorX: number): void {
  const bottom = y + h;
  b.box(x, y, w, h, 'roofG');
  for (let i = x + 2; i < x + w - 2; i += 3) {
    b.set(i, y + 2, i % 2 ? 'gold' : 'white');
    b.set(i, bottom - 24, i % 2 ? 'white' : 'gold');
  }
  for (let fy = y + 6; fy < bottom - 32; fy += 9)
    for (let fx = x + 5; fx < x + w - 7; fx += 10) b.box(fx, fy, 7, 6, 'roofDHi');
  // A crane game in the window: a glass case of plushies with the claw over them.
  const cx = doorX - 20 > x + 2 ? doorX - 20 : doorX + TILE + 3;
  b.box(cx, bottom - 21, 16, 21, 'roofD');
  b.box(cx + 2, bottom - 19, 12, 11, 'glass');
  b.rect(cx + 7, bottom - 18, 1, 3, 'out');
  b.rect(cx + 5, bottom - 15, 5, 1, 'gold');
  for (const [px, role] of [[cx + 3, 'flowerB'], [cx + 7, 'white'], [cx + 10, 'flowerA']] as const) b.rect(px, bottom - 11, 3, 3, role);
  b.box(doorX + 1, bottom - 20, TILE - 2, 20, 'darkSh');
  for (let i = 0; i < 3; i++) b.set(doorX + 4 + i * 4, bottom - 14, 'gold');
  signBoard(b, signs, measure, doorX + TILE / 2, bottom - 38, 'ゲームセンター');
}

/** One capsule-toy machine: a clear case of coloured capsules over a coin slot and a handle. */
function gachaMachine(b: Buf, x: number, y: number, seed: number): void {
  b.ellipseShadow(x + 8, y + 15, 7, 1.6);
  const body = (['roofB', 'roofG', 'roofC', 'roofD'] as Role[])[seed % 4]!;
  b.box(x + 1, y - 12, 14, 27, body);
  b.box(x + 3, y - 10, 10, 11, 'glassHi');
  for (let i = 0; i < 6; i++) {
    const role = ITEM_ROLES[Math.floor(hash(seed, i, 5) * ITEM_ROLES.length)]!;
    b.rect(x + 4 + (i % 3) * 3, y - 6 + Math.floor(i / 3) * 3, 2, 2, role);
  }
  b.rect(x + 4, y + 3, 8, 3, 'white');
  b.box(x + 6, y + 6, 5, 5, 'grey');
  b.rect(x + 7, y + 8, 3, 1, 'out');
  b.rect(x + 4, y + 12, 3, 2, 'darkSh');
}
const ITEM_ROLES: Role[] = ['roofA', 'flowerB', 'roofC', 'flowerA', 'white', 'roofB'];

/** The station's front along the bottom, with the exit's name over the way out. */
function stationFront(b: Buf, signs: SignSpot[], measure: Measure, room: RoomDef, ty: number): void {
  const y = ty * TILE;
  for (let tx = 0; tx < ROOM_COLS; tx++) {
    if (cellAt(room, tx, ty) !== 'E') continue;
    const x = tx * TILE;
    b.rect(x, y, TILE, TILE, 'stationWall');
    b.rect(x, y, TILE, 3, 'navy');
    b.rect(x, y + 3, TILE, 1, 'out');
    b.rect(x + 3, y + 6, TILE - 6, 6, 'glass');
    b.rect(x, y + TILE - 1, TILE, 1, 'stationWallSh');
  }
  const gap = room.rows[ty]!.indexOf(',');
  if (gap >= 0) signBoard(b, signs, measure, gap * TILE - 34, y + 1, '電気街口');
}

/** A street planter: a box with a little tree in it. */
function planter(b: Buf, x: number, y: number): void {
  b.ellipseShadow(x + 8, y + 14, 6, 1.6);
  b.box(x + 2, y + 7, 12, 8, 'stone');
  b.shape(x + 2, y - 4, 12, 12, roundRect(12, 12, 5), (i, j) => (i + j < 9 ? 'leafHi' : j > 7 ? 'leafSh' : 'leaf'));
}

/** The posts of a torii stand on the base; the beams over the path go on top. */
function torii(b: Buf, front: Buf, lx: number, rx: number, y: number): void {
  for (const px of [lx, rx]) {
    b.ellipseShadow(px + 8, y + 14, 4, 1.5);
    b.box(px + 5, y - 12, 6, 26, 'roofA');
    b.rect(px + 9, y - 11, 1, 24, 'roofASh');
    b.box(px + 4, y + 10, 8, 4, 'dark');
  }
  // The lower beam, then the top beam, curving up at the ends.
  const x0 = lx - 2;
  const x1 = rx + TILE + 2;
  front.box(x0 + 3, y - 10, x1 - x0 - 6, 4, 'roofA');
  front.shape(x0 - 3, y - 22, x1 - x0 + 6, 9, (i, j) => {
    const span = x1 - x0 + 6;
    const up = i < 4 || i >= span - 4 ? 0 : 2;
    return j >= up && j < 9 && (j < 6 || (i > 2 && i < span - 3));
  }, (_i, j) => (j < 3 ? 'dark' : j < 6 ? 'roofA' : 'roofASh'));
  front.box(x0 + (x1 - x0) / 2 - 3, y - 16, 6, 7, 'dark');
}

export function drawArea(room: RoomDef, measure: Measure): RoomArt {
  const b = new Buf(W, H);
  const front = new Buf(W, H);
  const signs: SignSpot[] = [];
  const cell = (tx: number, ty: number) => cellAt(room, tx, ty);

  const city = room.rows.some((row) => row.includes('B'));
  if (city) {
    // A city street: pavement, the road, and tall buildings behind.
    for (let ty = 0; ty < ROOM_ROWS; ty++)
      for (let tx = 0; tx < ROOM_COLS; tx++) {
        const c = cell(tx, ty);
        if (c === 'R' || c === 'z') road(b, room, tx, ty, c === 'z');
        else pavement(b, tx, ty);
        if (c === ',') tactile(b, tx, ty);
      }
    skyline(b, room);
  } else {
    grass(b, 0, 0, W, H);
    flowerPatch(b, 6 * TILE, 9 * TILE + 4, 2 * TILE, TILE - 6, 3);
    flowerPatch(b, 11 * TILE, 10 * TILE + 2, 2 * TILE, TILE - 6, 5);
    for (let ty = 0; ty < ROOM_ROWS; ty++)
      for (let tx = 0; tx < ROOM_COLS; tx++) if (cell(tx, ty) === ',' || cell(tx, ty) === '1' || cell(tx, ty) === '2' || cell(tx, ty) === '3') stonePath(b, tx, ty);
  }
  if (room.rows.some((row) => row.includes('M'))) mountains(b, room);

  // The station platform you arrived on, along the bottom.
  const py = 12 * TILE;
  b.rect(0, py, W, TILE, 'stone');
  b.rect(0, py, W, 1, 'out');
  for (let x = 0; x < W; x += 4) b.rect(x, py + 3, 3, 3, 'flowerB');
  b.rect(0, py + 10, W, 6, 'stoneSh');
  for (let x = 6; x < W; x += 12) b.rect(x, py + 12, 6, 2, 'trunkSh');
  const d = room.rows[12]!.indexOf('D');
  if (d >= 0) {
    // An arrow on the platform: this way to the train home.
    b.rect(d * TILE + 7, py + 1, 2, 6, 'white');
    b.rect(d * TILE + 5, py + 5, 6, 1, 'white');
    b.rect(d * TILE + 6, py + 6, 4, 1, 'white');
  }

  // Buildings.
  for (const bl of blocks(room)) {
    const doorX = room.rows[bl.y + bl.h - 1]!.indexOf(bl.door) * TILE;
    const args = [b, signs, measure, bl.x * TILE, bl.y * TILE, bl.w * TILE, bl.h * TILE, doorX] as const;
    const draw = { shrine, ryokan, denki: electronics, maidcafe: maidCafe, arcade: arcadeFront }[bl.to as string] ?? shop;
    draw(...args);
  }

  // Things standing on the grass, top to bottom so lower ones overlap.
  const posts: number[] = [];
  let postsY = 0;
  for (let ty = 0; ty < ROOM_ROWS; ty++)
    for (let tx = 0; tx < ROOM_COLS; tx++) {
      const x = tx * TILE;
      const y = ty * TILE;
      switch (cell(tx, ty)) {
        case 'T':
          if (hash(tx, ty, 9) < 0.35 && ty > 0 && ty < 11) hydrangea(b, x, y, tx * 7 + ty);
          else tree(b, x, y);
          break;
        case 'L':
          lantern(b, x, y);
          break;
        case 'n':
          bench(b, x, y);
          break;
        case 'P':
          posts.push(x);
          postsY = y;
          break;
        case '~':
          if (cell(tx - 1, ty) !== '~' && cell(tx, ty - 1) !== '~') footbath(b, front, signs, measure, room, tx, ty);
          break;
        case 'G':
          gachaMachine(b, x, y, tx);
          break;
        case 'p':
          planter(b, x, y);
          break;
      }
    }
  if (posts.length === 2) torii(b, front, posts[0]!, posts[1]!, postsY);

  const front0 = room.rows.findIndex((row) => row.includes('E'));
  if (front0 >= 0) stationFront(b, signs, measure, room, front0);

  // The station's name board, as on every platform.
  signBoard(b, signs, measure, 14 * TILE, 10 * TILE + 1, room.station ?? '鎌倉');
  b.box(14 * TILE - 1, 11 * TILE, 3, 5, 'dark');

  return { base: b, front, signs };
}
