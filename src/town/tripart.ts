// Draws a trip's open-air town: 鎌倉, with its stone path, a torii, the shrine on the
// left and the souvenir shop on the right, stone lanterns, hydrangeas and the station
// platform at the bottom. Same style D pixel art as the street. All original art.

import { bench, flowerPatch, grass, signBoard, tree, windowPane, type Measure, type SignSpot } from './art.ts';
import { TILE } from './map.ts';
import type { Role } from './palette.ts';
import { Buf, hash, roundRect } from './pixels.ts';
import type { RoomArt } from './roomart.ts';
import { cellAt, ROOM_COLS, ROOM_ROWS, type RoomDef } from './rooms.ts';

const W = ROOM_COLS * TILE;
const H = ROOM_ROWS * TILE;

/** The bounds, in tiles, of each block of '#' with a door in its bottom row. */
function blocks(room: RoomDef): { x: number; y: number; w: number; h: number; door: string }[] {
  const out: { x: number; y: number; w: number; h: number; door: string }[] = [];
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
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: ty - y0 + 1, door: d.cell });
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

  grass(b, 0, 0, W, H);
  flowerPatch(b, 6 * TILE, 9 * TILE + 4, 2 * TILE, TILE - 6, 3);
  flowerPatch(b, 11 * TILE, 10 * TILE + 2, 2 * TILE, TILE - 6, 5);
  for (let ty = 0; ty < ROOM_ROWS; ty++)
    for (let tx = 0; tx < ROOM_COLS; tx++) if (cell(tx, ty) === ',' || cell(tx, ty) === '1' || cell(tx, ty) === '2') stonePath(b, tx, ty);

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
    if (bl.door === '1') shrine(...args);
    else shop(...args);
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
      }
    }
  if (posts.length === 2) torii(b, front, posts[0]!, posts[1]!, postsY);

  // The station's name board, as on every platform.
  signBoard(b, signs, measure, 14 * TILE, 10 * TILE + 1, '鎌倉');
  b.box(14 * TILE - 1, 11 * TILE, 3, 5, 'dark');

  return { base: b, front, signs };
}
