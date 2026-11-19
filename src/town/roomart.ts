// Draws the inside of a place: back wall, floor, furniture and the counter, in the
// same style D pixel art as the street. All original art. The counter goes on its own
// layer, drawn over the staff, so they stand behind it.

import { signBoard, windowPane, type Measure, type SignSpot } from './art.ts';
import { TILE } from './map.ts';
import type { Role } from './palette.ts';
import { Buf, hash } from './pixels.ts';
import { cellAt, ROOM_COLS, ROOM_ROWS, type RoomDef } from './rooms.ts';

export interface RoomArt {
  base: Buf;
  /** Drawn over the staff (the counter), under the player. */
  front: Buf;
  signs: SignSpot[];
}

const W = ROOM_COLS * TILE;
const H = ROOM_ROWS * TILE;

const ITEM_COLOURS: Role[] = ['roofA', 'roofB', 'roofC', 'stripe2', 'postRed', 'top2', 'flowerA', 'roofD', 'white'];

interface Theme {
  wall: Role;
  wallSh: Role;
  counterTop: Role;
  counterFront: Role;
  counterBand: Role;
}

const THEMES: Record<RoomDef['wall'], Pick<Theme, 'wall' | 'wallSh'>> = {
  wall: { wall: 'wall', wallSh: 'wallSh' },
  wall2: { wall: 'wall2', wallSh: 'wall2Sh' },
  mint: { wall: 'mint', wallSh: 'mintSh' },
  cream: { wall: 'cream', wallSh: 'creamSh' },
  stationWall: { wall: 'stationWall', wallSh: 'stationWallSh' },
};

const COUNTERS: Record<string, Pick<Theme, 'counterTop' | 'counterFront' | 'counterBand'>> = {
  cafe: { counterTop: 'woodHi', counterFront: 'wood', counterBand: 'woodSh' },
  konbini: { counterTop: 'tileA', counterFront: 'roofB', counterBand: 'white' },
  pharmacy: { counterTop: 'tileA', counterFront: 'roofC', counterBand: 'white' },
  restaurant: { counterTop: 'woodHi', counterFront: 'woodSh', counterBand: 'noren' },
  station: { counterTop: 'stone', counterFront: 'stationWallSh', counterBand: 'navy' },
  post: { counterTop: 'tileA', counterFront: 'cream', counterBand: 'postRed' },
  home: { counterTop: 'woodHi', counterFront: 'wood', counterBand: 'woodSh' },
  shrine: { counterTop: 'woodHi', counterFront: 'roofA', counterBand: 'white' },
  omiyage: { counterTop: 'woodHi', counterFront: 'wood', counterBand: 'noren' },
};

const isWall = (c: string) => c === '#';
const isOutside = (c: string) => c === ' ';

export function drawRoom(room: RoomDef, measure: Measure): RoomArt {
  const b = new Buf(W, H);
  const front = new Buf(W, H);
  const signs: SignSpot[] = [];
  const theme: Theme = { ...THEMES[room.wall], ...COUNTERS[room.place]! };
  const cell = (tx: number, ty: number) => cellAt(room, tx, ty);

  // Outside the room: dark.
  b.rect(0, 0, W, H, 'darkSh');

  // Which rows are the back wall (above the first row with any floor in it).
  let firstInside = 0;
  while (firstInside < ROOM_ROWS && ![...room.rows[firstInside]!].some((c) => !isWall(c) && !isOutside(c))) firstInside++;
  const backTop = room.rows.findIndex((r) => r.includes('#'));

  // Floor under everything inside.
  for (let ty = firstInside; ty < ROOM_ROWS; ty++)
    for (let tx = 0; tx < ROOM_COLS; tx++) {
      const c = cell(tx, ty);
      if (isWall(c) || isOutside(c)) continue;
      floorTile(b, room.floor, tx, ty);
    }

  // The back wall, seen face on: two tiles tall, with a trim on top and a skirting board.
  const wallY = backTop * TILE;
  const wallH = (firstInside - backTop) * TILE;
  for (let tx = 0; tx < ROOM_COLS; tx++) {
    if (!isWall(cell(tx, backTop))) continue;
    const x = tx * TILE;
    b.rect(x, wallY, TILE, wallH, theme.wall);
    if (room.place === 'cafe') for (let i = 0; i < TILE; i += 8) b.rect(x + i + 3, wallY + 4, 1, wallH - 8, theme.wallSh);
    if (room.place === 'post') b.rect(x, wallY + wallH - 12, TILE, 3, 'postRed');
    b.rect(x, wallY, TILE, 3, 'dark');
    b.rect(x, wallY + 3, TILE, 1, 'out');
    b.rect(x, wallY + wallH - 4, TILE, 4, theme.wallSh);
    b.rect(x, wallY + wallH - 4, TILE, 1, 'out');
  }
  // Shade on the floor along the wall's foot.
  for (let x = 0; x < W; x++) {
    b.shadow(x, firstInside * TILE);
    b.shadow(x, firstInside * TILE + 1);
  }

  // Side and front walls, seen from above as a band.
  for (let ty = firstInside; ty < ROOM_ROWS; ty++)
    for (let tx = 0; tx < ROOM_COLS; tx++) {
      if (!isWall(cell(tx, ty))) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      b.rect(x, y, TILE, TILE, 'dark');
      const insideLeft = !isWall(cell(tx + 1, ty)) && !isOutside(cell(tx + 1, ty));
      const insideRight = !isWall(cell(tx - 1, ty)) && !isOutside(cell(tx - 1, ty));
      const insideBelow = !isWall(cell(tx, ty - 1)) && !isOutside(cell(tx, ty - 1));
      if (insideLeft) b.rect(x + TILE - 1, y, 1, TILE, 'out');
      if (insideRight) b.rect(x, y, 1, TILE, 'out');
      if (insideBelow) {
        b.rect(x, y, TILE, 1, 'out');
        b.rect(x, y + 1, TILE, 3, theme.wallSh);
      }
      if (insideLeft) for (let i = 0; i < TILE; i++) b.shadow(x + TILE, y + i);
    }

  decorate(b, signs, measure, room, theme, wallY, wallH);

  // Rugs first, so what stands on them is drawn over them.
  for (let ty = 0; ty < ROOM_ROWS; ty++)
    for (let tx = 0; tx < ROOM_COLS; tx++) if (cell(tx, ty) === 'r' || cell(tx, ty) === 'w') rug(b, room, tx, ty);

  // Furniture.
  for (let ty = 0; ty < ROOM_ROWS; ty++)
    for (let tx = 0; tx < ROOM_COLS; tx++) {
      const c = cell(tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      const left = cell(tx - 1, ty);
      const right = cell(tx + 1, ty);
      switch (c) {
        case 'D':
          doormat(b, x, y);
          break;
        case 'h':
          if (room.shelf) shelfArt(b, x, y, room.shelf);
          else if (room.place === 'shrine') charmRack(b, x, y, tx);
          else wallShelf(b, x, y, tx);
          break;
        case 'H':
          if (left !== 'H') {
            let n = 1;
            while (cell(tx + n, ty) === 'H') n++;
            island(b, x, y, n, tx + ty * 7);
          }
          break;
        case 'f':
          fridge(b, x, y, tx);
          break;
        case 'm':
          if (left === '=' || right === '=') break; // a register, drawn on the counter
          if (room.place === 'station') ticketMachine(b, x, y);
          else espresso(b, x, y, left !== 'm', right !== 'm');
          break;
        case 't':
          table(b, x, y);
          break;
        case 'c':
          chair(b, x, y, right === 't' ? 'right' : 'left');
          break;
        case 'p':
          plant(b, x, y);
          break;
        case 'n':
          if (left !== 'n') {
            let n = 1;
            while (cell(tx + n, ty) === 'n') n++;
            bench(b, x, y, n);
          }
          break;
        case 'g':
          gate(b, x, y);
          break;
        case 'k':
          if (left !== 'k') desk(b, x, y, right === 'k' ? 2 : 1);
          break;
        case 'x':
          postbox(b, x, y);
          break;
        case 'b':
          if (left !== 'b' && cell(tx, ty - 1) !== 'b') bed(b, x, y);
          break;
        case 'w':
          if (left !== 'w') lowTable(b, x, y);
          break;
      }
    }

  // What you've bought for your room.
  for (const d of room.decor ?? []) {
    if (d.kind === 'floor' && d.spot) FLOOR_DECOR[d.id]?.(b, d.spot.tx * TILE, d.spot.ty * TILE);
    else if (d.kind === 'rug') RUG_DECOR[d.id]?.(b);
  }

  // Counters, on their own layer over the staff.
  for (let ty = 0; ty < ROOM_ROWS; ty++)
    for (let tx = 0; tx < ROOM_COLS; tx++) {
      const isCounter = (i: number) => cell(i, ty) === '=' || (cell(i, ty) === 'm' && (cell(i - 1, ty) === '=' || cell(i + 1, ty) === '='));
      if (!isCounter(tx) || isCounter(tx - 1)) continue;
      let n = 1;
      while (isCounter(tx + n)) n++;
      counter(front, b, tx * TILE, ty * TILE, n, theme);
      for (let i = 0; i < n; i++) if (cell(tx + i, ty) === 'm') register(front, (tx + i) * TILE, ty * TILE);
    }

  return { base: b, front, signs };
}

// ------------------------------------------------------------------ floor and walls

function floorTile(b: Buf, kind: RoomDef['floor'], tx: number, ty: number): void {
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  for (let y = y0; y < y0 + TILE; y++)
    for (let x = x0; x < x0 + TILE; x++) {
      let role: Role;
      if (kind === 'wood') {
        const row = Math.floor(y / 4);
        const seam = (x + (row % 3) * 11) % 24 === 0;
        role = y % 4 === 3 || seam ? 'woodSh' : hash(x >> 2, row, 5) < 0.12 ? 'woodHi' : 'wood';
      } else if (kind === 'tile') {
        const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2;
        role = x % 8 === 7 || y % 8 === 7 ? 'tileB' : checker ? 'tileA' : 'white';
      } else if (kind === 'stone') {
        role = x % 16 === 15 || y % 16 === 15 ? 'stoneSh' : hash(x >> 3, y >> 3, 8) < 0.2 ? 'tileB' : 'stone';
      } else {
        // Tatami: mats a tile tall and two wide, with a dark cloth edge along the long sides.
        const ly = y % 16;
        role = ly === 0 || ly === 15 ? 'tatamiEdge' : (x + y * 3) % 5 === 0 ? 'tatamiSh' : 'tatami';
        if (x % 32 === 0) role = 'tatamiSh';
      }
      b.set(x, y, role);
    }
}

function decorate(b: Buf, signs: SignSpot[], measure: Measure, room: RoomDef, theme: Theme, wallY: number, wallH: number): void {
  const mid = wallY + 4;
  const signAt = (cx: number) => room.sign && signBoard(b, signs, measure, cx, mid + 1, room.sign);
  switch (room.place) {
    case 'cafe':
      signAt(9 * TILE + 8);
      windowPane(b, 3 * TILE + 2, mid + 2, 28, 20);
      windowPane(b, 13 * TILE + 2, mid + 2, 44, 20);
      break;
    case 'konbini':
      // Bright posters for the day's deals.
      for (const [tx, role] of [[6, 'stripe2'], [12, 'flowerA']] as const) {
        b.box(tx * TILE + 2, mid + 3, 12, 14, role);
        b.rect(tx * TILE + 4, mid + 6, 8, 2, 'white');
        b.rect(tx * TILE + 4, mid + 10, 5, 1, 'white');
      }
      signAt(9 * TILE + 8);
      break;
    case 'pharmacy':
      for (const tx of [3, 15]) {
        const x = tx * TILE + 2;
        b.box(x, mid + 2, 12, 12, 'white');
        b.rect(x + 5, mid + 4, 2, 8, 'cross');
        b.rect(x + 2, mid + 7, 8, 2, 'cross');
      }
      signAt(9 * TILE + 8);
      break;
    case 'restaurant': {
      // A doorway to the kitchen behind the server, with a noren curtain.
      const x = 8 * TILE + 2;
      b.box(x, mid, 3 * TILE - 4, wallH - 8, 'darkSh');
      for (let i = 0; i < 4; i++) {
        const nx = x + 2 + i * 11;
        b.box(nx, mid + 1, 10, 14, i % 2 ? 'norenSh' : 'noren');
        b.rect(nx + 3, mid + 5, 4, 1, 'white');
      }
      for (const tx of [7, 11]) {
        const lx = tx * TILE + 5;
        b.rect(lx + 2, wallY + 4, 1, 3, 'out');
        b.box(lx, mid + 3, 6, 9, 'lantern');
        b.rect(lx + 1, mid + 4, 1, 7, 'lanternSh');
      }
      signAt(15 * TILE + 4);
      windowPane(b, 2 * TILE + 2, mid + 2, 28, 18);
      break;
    }
    case 'station':
      // Departure boards and the ticket window's sign.
      for (const tx of [4, 12]) {
        const x = tx * TILE;
        b.box(x, mid + 1, 3 * TILE - 4, 20, 'darkSh');
        for (let r = 0; r < 3; r++) {
          b.rect(x + 3, mid + 4 + r * 5, 12, 2, 'gold');
          b.rect(x + 18, mid + 4 + r * 5, 8, 2, r === 1 ? 'top' : 'gold');
          b.rect(x + 29, mid + 4 + r * 5, 11, 2, 'glassHi');
        }
      }
      signAt(9 * TILE + 8);
      break;
    case 'post': {
      signAt(9 * TILE + 8);
      for (const tx of [4, 12]) windowPane(b, tx * TILE + 2, mid + 2, 3 * TILE - 4, 18);
      break;
    }
    case 'shrine': {
      // A rope with white paper zigzags along the wall, and wooden prayer plaques.
      b.rect(2 * TILE, mid, 16 * TILE, 3, 'dirt');
      b.rect(2 * TILE, mid, 16 * TILE, 1, 'dirtSh');
      for (let x = 2 * TILE + 6; x < 18 * TILE; x += 22) {
        b.rect(x, mid + 3, 2, 2, 'white');
        b.rect(x + 1, mid + 5, 2, 2, 'white');
        b.rect(x, mid + 7, 2, 2, 'white');
      }
      for (const tx of [3, 14]) for (let i = 0; i < 3; i++) {
        const x = tx * TILE + i * 9 - 4;
        b.box(x, mid + 10, 8, 7, 'woodHi');
        b.rect(x + 2, mid + 12, 4, 1, 'ink');
        b.rect(x + 2, mid + 14, 3, 1, 'ink');
      }
      signAt(9 * TILE + 8);
      break;
    }
    case 'omiyage':
      signAt(9 * TILE + 8);
      windowPane(b, 4 * TILE + 2, mid + 2, 28, 18);
      windowPane(b, 12 * TILE + 2, mid + 2, 28, 18);
      for (const tx of [7, 11]) {
        const lx = tx * TILE + 5;
        b.rect(lx + 2, wallY + 4, 1, 3, 'out');
        b.box(lx, mid + 3, 6, 9, 'lantern');
        b.rect(lx + 1, mid + 4, 1, 7, 'lanternSh');
      }
      break;
    case 'home': {
      windowPane(b, 7 * TILE + 6, mid + 3, 30, 18);
      // A wall clock and a calendar.
      const cx = 12 * TILE + 8;
      b.shape(cx - 5, mid + 4, 11, 11, (x, y) => (x - 5) ** 2 + (y - 5) ** 2 <= 25, () => 'white');
      b.rect(cx, mid + 6, 1, 4, 'out');
      b.rect(cx, mid + 9, 3, 1, 'out');
      b.box(6 * TILE + 4, mid + 3, 10, 13, 'white');
      b.rect(6 * TILE + 5, mid + 4, 8, 3, 'roofA');
      for (const d of room.decor ?? []) if (d.kind === 'wall') WALL_DECOR[d.id]?.(b, mid);
      break;
    }
  }
  void theme;
}

// ------------------------------------------------------------------ furniture

function doormat(b: Buf, x: number, y: number): void {
  b.box(x + 1, y + 2, 14, 11, 'roofE');
  b.rect(x + 2, y + 3, 12, 1, 'roofEHi');
  // An arrow pointing out.
  b.rect(x + 7, y + 5, 2, 4, 'white');
  b.rect(x + 5, y + 8, 6, 1, 'white');
  b.rect(x + 6, y + 9, 4, 1, 'white');
}

function wallShelf(b: Buf, x: number, y: number, seed: number): void {
  b.box(x, y - 11, TILE, 26, 'woodSh');
  for (let s = 0; s < 3; s++) {
    const sy = y - 9 + s * 8;
    b.rect(x + 1, sy, TILE - 2, 7, 'wood');
    for (let i = 0; i < 4; i++) {
      const role = ITEM_COLOURS[Math.floor(hash(seed, s * 4 + i, 3) * ITEM_COLOURS.length)]!;
      const ix = x + 2 + i * 3;
      const ih = 3 + Math.floor(hash(seed, i, s) * 3);
      b.rect(ix, sy + 6 - ih, 2, ih, role);
    }
    b.rect(x + 1, sy + 6, TILE - 2, 1, 'out');
  }
  for (let i = 1; i < TILE - 1; i++) b.shadow(x + i, y + 15);
}

function island(b: Buf, x: number, y: number, n: number, seed: number): void {
  const w = n * TILE;
  b.ellipseShadow(x + w / 2, y + 14, w / 2, 2);
  b.box(x + 1, y, w - 2, 15, 'tileB');
  b.rect(x + 2, y + 1, w - 4, 5, 'white');
  // Goods along the top and on the front shelves.
  for (let i = 0; i < (w - 6) / 3; i++) {
    const role = ITEM_COLOURS[Math.floor(hash(seed, i, 4) * ITEM_COLOURS.length)]!;
    b.rect(x + 3 + i * 3, y + 2, 2, 3, role);
    const r2 = ITEM_COLOURS[Math.floor(hash(seed, i, 6) * ITEM_COLOURS.length)]!;
    b.rect(x + 3 + i * 3, y + 8, 2, 4, r2);
  }
  b.rect(x + 1, y + 6, w - 2, 1, 'out');
  b.rect(x + 1, y + 12, w - 2, 1, 'greySh');
}

function fridge(b: Buf, x: number, y: number, seed: number): void {
  b.box(x, y - 11, TILE, 26, 'grey');
  b.box(x + 2, y - 9, TILE - 4, 21, 'glass');
  for (let s = 0; s < 3; s++) {
    const sy = y - 7 + s * 6;
    for (let i = 0; i < 3; i++) {
      const role = ITEM_COLOURS[Math.floor(hash(seed, s * 3 + i, 9) * ITEM_COLOURS.length)]!;
      b.rect(x + 4 + i * 3, sy, 2, 5, role);
    }
    b.rect(x + 3, sy + 5, TILE - 6, 1, 'glassSh');
  }
  b.set(x + 4, y - 10, 'glassHi');
  b.set(x + 5, y - 9, 'glassHi');
  for (let i = 1; i < TILE - 1; i++) b.shadow(x + i, y + 15);
}

function espresso(b: Buf, x: number, y: number, leftEnd: boolean, rightEnd: boolean): void {
  // A back counter, with the coffee machine sitting on it.
  b.rect(x, y - 2, TILE, 17, 'woodSh');
  b.rect(x, y - 2, TILE, 3, 'woodHi');
  b.rect(x, y - 3, TILE, 1, 'out');
  b.rect(x, y + 14, TILE, 1, 'out');
  if (leftEnd) b.rect(x, y - 3, 1, 18, 'out');
  if (rightEnd) b.rect(x + TILE - 1, y - 3, 1, 18, 'out');
  b.rect(x + 3, y + 4, 10, 1, 'wood');
  if ((x / TILE) % 2) {
    b.box(x + 2, y - 15, 12, 13, 'grey');
    b.rect(x + 3, y - 14, 10, 2, 'greySh');
    b.rect(x + 5, y - 9, 2, 4, 'dark');
    b.rect(x + 9, y - 9, 2, 4, 'dark');
    b.box(x + 4, y - 5, 4, 3, 'white');
  } else {
    // Cups stacked up.
    for (let i = 0; i < 3; i++) b.box(x + 2 + i * 4, y - 7, 4, 5, 'white');
    b.box(x + 4, y - 11, 4, 5, 'white');
    b.box(x + 8, y - 11, 4, 5, 'white');
  }
}

function ticketMachine(b: Buf, x: number, y: number): void {
  b.box(x + 1, y - 14, 14, 29, 'stationWall');
  b.rect(x + 2, y - 13, 12, 3, 'navy');
  b.box(x + 3, y - 8, 10, 8, 'glass');
  b.set(x + 4, y - 7, 'glassHi');
  for (let i = 0; i < 3; i++) b.rect(x + 3 + i * 4, y + 2, 2, 2, i === 1 ? 'top' : 'gold');
  b.rect(x + 5, y + 7, 6, 1, 'out');
  for (let i = 2; i < TILE - 2; i++) b.shadow(x + i, y + 15);
}

function counter(front: Buf, base: Buf, x: number, y: number, n: number, t: Theme): void {
  const w = n * TILE;
  front.box(x, y - 6, w, 22, t.counterFront);
  front.rect(x + 1, y - 5, w - 2, 8, t.counterTop);
  front.rect(x + 1, y + 3, w - 2, 1, 'out');
  front.rect(x + 1, y + 6, w - 2, 2, t.counterBand);
  for (let i = 1; i < w - 1; i++) {
    base.shadow(x + i, y + 16);
    base.shadow(x + i, y + 17);
  }
}

function register(front: Buf, x: number, y: number): void {
  front.box(x + 2, y - 12, 12, 9, 'dark');
  front.rect(x + 4, y - 10, 8, 3, 'glass');
  front.rect(x + 3, y - 4, 10, 1, 'greySh');
}

function table(b: Buf, x: number, y: number): void {
  b.ellipseShadow(x + 8, y + 14, 7, 2);
  b.rect(x + 3, y + 9, 2, 6, 'woodSh');
  b.rect(x + 11, y + 9, 2, 6, 'woodSh');
  b.box(x + 1, y + 2, 14, 9, 'wood');
  b.rect(x + 2, y + 3, 12, 2, 'woodHi');
  b.box(x + 5, y + 4, 5, 4, 'white');
  b.set(x + 7, y + 5, 'frame');
}

function chair(b: Buf, x: number, y: number, facing: 'left' | 'right'): void {
  b.ellipseShadow(x + 8, y + 14, 5, 1.6);
  const bx = facing === 'right' ? x + 3 : x + 10;
  b.box(bx, y + 1, 3, 10, 'woodSh');
  b.box(x + 4, y + 7, 8, 4, 'wood');
  b.rect(x + 5, y + 11, 1, 3, 'woodSh');
  b.rect(x + 10, y + 11, 1, 3, 'woodSh');
}

function plant(b: Buf, x: number, y: number): void {
  b.ellipseShadow(x + 8, y + 15, 5, 1.5);
  b.box(x + 4, y + 8, 8, 7, 'planter');
  b.rect(x + 5, y + 9, 6, 1, 'wood');
  const inside = (px: number, py: number) => (px - 7.5) ** 2 / 36 + (py - 6) ** 2 / 30 <= 1 && py < 11;
  b.shape(x + 1, y - 3, 14, 12, inside, (px, py) => (px + py < 9 ? 'leafHi' : px + py > 15 ? 'leafSh' : 'leaf'));
}

function bench(b: Buf, x: number, y: number, n: number): void {
  const w = n * TILE;
  b.ellipseShadow(x + w / 2, y + 14, w / 2 - 1, 2);
  b.box(x + 1, y + 1, w - 2, 5, 'bench');
  b.box(x + 1, y + 6, w - 2, 4, 'benchSh');
  for (const lx of [x + 2, x + w - 5]) b.box(lx, y + 9, 3, 5, 'benchSh');
}

function gate(b: Buf, x: number, y: number): void {
  b.ellipseShadow(x + 8, y + 15, 6, 1.5);
  b.box(x + 4, y - 4, 8, 19, 'stationWallSh');
  b.rect(x + 5, y - 3, 6, 4, 'grey');
  b.rect(x + 6, y - 2, 4, 2, 'glass');
  b.rect(x + 6, y + 4, 4, 2, 'top2');
}

function desk(b: Buf, x: number, y: number, n: number): void {
  const w = n * TILE;
  b.ellipseShadow(x + w / 2, y + 14, w / 2 - 1, 2);
  for (const lx of [x + 2, x + w - 4]) b.rect(lx, y + 8, 2, 7, 'woodSh');
  b.box(x + 1, y + 1, w - 2, 9, 'wood');
  b.rect(x + 2, y + 2, w - 4, 2, 'woodHi');
  // Forms and a pen on a string.
  b.box(x + 4, y + 3, 7, 6, 'white');
  b.rect(x + 5, y + 5, 5, 1, 'greySh');
  b.box(x + w - 12, y + 3, 7, 6, 'white');
  b.rect(x + w - 11, y + 5, 5, 1, 'postRed');
  b.rect(x + w / 2, y + 4, 1, 4, 'navy');
}

function postbox(b: Buf, x: number, y: number): void {
  b.ellipseShadow(x + 8, y + 15, 5, 1.5);
  b.box(x + 3, y - 6, 10, 21, 'postRed');
  b.rect(x + 4, y - 5, 8, 2, 'roofGHi');
  b.rect(x + 5, y, 6, 1, 'out');
  b.rect(x + 5, y + 4, 6, 4, 'white');
  b.rect(x + 7, y + 5, 2, 2, 'postRed');
  b.rect(x + 4, y + 12, 8, 1, 'postRedSh');
}

function bed(b: Buf, x: number, y: number): void {
  b.box(x, y - 2, 32, 34, 'woodSh');
  b.box(x + 2, y, 28, 30, 'white');
  b.box(x + 5, y + 2, 22, 7, 'tileA');
  b.rect(x + 6, y + 3, 20, 1, 'white');
  // The quilt, folded back a little.
  b.box(x + 2, y + 11, 28, 19, 'roofB');
  b.rect(x + 3, y + 12, 26, 2, 'roofBHi');
  for (let i = 0; i < 26; i += 6) b.rect(x + 4 + i, y + 18, 3, 3, 'roofBHi');
  for (let i = 1; i < 31; i++) b.shadow(x + i, y + 32);
}

function rug(b: Buf, room: RoomDef, tx: number, ty: number): void {
  const isRug = (i: number, j: number) => cellAt(room, i, j) === 'r' || cellAt(room, i, j) === 'w';
  const x0 = tx * TILE;
  const y0 = ty * TILE;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const edge = (!isRug(tx - 1, ty) && x < 2) || (!isRug(tx + 1, ty) && x > 13) || (!isRug(tx, ty - 1) && y < 2) || (!isRug(tx, ty + 1) && y > 13);
      b.set(x0 + x, y0 + y, edge ? 'rugSh' : (x + y) % 6 === 0 ? 'flowerB' : 'rug');
    }
}

function lowTable(b: Buf, x: number, y: number): void {
  b.ellipseShadow(x + 16, y + 13, 14, 2.5);
  b.shape(x + 2, y + 1, 28, 12, (px, py) => (px - 13.5) ** 2 / 196 + (py - 5.5) ** 2 / 36 <= 1, (_px, py) => (py > 8 ? 'woodSh' : 'wood'));
  // A teapot and two cups.
  b.box(x + 13, y + 3, 6, 5, 'top2');
  b.box(x + 8, y + 5, 3, 3, 'white');
  b.box(x + 21, y + 5, 3, 3, 'white');
}

// ------------------------------------------------------------------ your room

/** Rows of charms on red cloth, at the shrine's counter. */
function charmRack(b: Buf, x: number, y: number, seed: number): void {
  b.box(x, y - 11, TILE, 26, 'woodSh');
  b.rect(x + 1, y - 10, TILE - 2, 24, 'roofA');
  const colours: Role[] = ['white', 'roofB', 'gold', 'roofC', 'flowerA', 'roofD'];
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 3; i++) {
      const cx = x + 2 + i * 4;
      const cy = y - 8 + r * 8;
      b.box(cx, cy, 3, 5, colours[Math.floor(hash(seed, r * 3 + i, 6) * colours.length)]!);
      b.set(cx + 1, cy + 2, 'gold');
    }
}

/** Your shelf at home, with a little picture of each thing you've put on it. */
function shelfArt(b: Buf, x: number, y: number, shelf: string[]): void {
  b.box(x - 2, y - 11, TILE + 4, 26, 'woodSh');
  for (let s = 0; s < 3; s++) {
    const sy = y - 9 + s * 8;
    b.rect(x - 1, sy, TILE + 2, 7, 'wood');
    b.rect(x - 1, sy + 6, TILE + 2, 1, 'out');
  }
  // Three to a shelf, top shelf first.
  shelf.slice(0, 9).forEach((id, i) => {
    const sx = x - 1 + (i % 3) * 6;
    const sy = y - 9 + Math.floor(i / 3) * 8;
    (KEEPSAKE_ART[id] ?? genericKeepsake)(b, sx, sy + 6);
  });
  for (let i = -1; i < TILE + 1; i++) b.shadow(x + i, y + 15);
}

type Mini = (b: Buf, x: number, base: number) => void;
const genericKeepsake: Mini = (b, x, base) => b.box(x + 1, base - 5, 5, 5, 'gold');
/** Things for the shelf are 6px wide (7 at most) and stand on a shelf line at y = base. Keepsakes first, then everyday things. */
export const KEEPSAKE_ART: Record<string, Mini> = {
  mug: (b, x, base) => {
    b.box(x + 1, base - 5, 4, 5, 'white');
    b.rect(x + 5, base - 4, 1, 2, 'out');
    b.rect(x + 2, base - 4, 2, 1, 'top');
  },
  plant: (b, x, base) => {
    b.box(x + 1, base - 3, 5, 3, 'planter');
    b.rect(x + 1, base - 6, 5, 3, 'leaf');
    b.set(x + 2, base - 6, 'leafHi');
  },
  recipe: (b, x, base) => {
    b.box(x, base - 6, 6, 6, 'sign');
    b.rect(x + 1, base - 4, 4, 1, 'ink');
    b.rect(x + 1, base - 2, 3, 1, 'ink');
  },
  stamp: (b, x, base) => {
    b.box(x, base - 6, 6, 6, 'white');
    b.rect(x + 1, base - 5, 4, 4, 'postRed');
    b.set(x + 2, base - 4, 'gold');
  },
  daibutsu: (b, x, base) => {
    b.box(x + 1, base - 3, 5, 3, 'roofC');
    b.box(x + 2, base - 6, 3, 3, 'roofC');
    b.set(x + 3, base - 5, 'roofCHi');
  },
  omamori: (b, x, base) => {
    b.box(x + 1, base - 6, 4, 6, 'roofG');
    b.rect(x + 2, base - 4, 2, 1, 'gold');
  },
  // A picture postcard of the sea, leaning against the back.
  ehagaki: (b, x, base) => {
    b.box(x, base - 5, 7, 5, 'white');
    b.rect(x + 1, base - 4, 5, 1, 'glass');
    b.rect(x + 1, base - 3, 5, 1, 'water');
    b.set(x + 4, base - 4, 'flowerB');
  },
  // A round glass bowl with the goldfish from the festival in it.
  kingyo: (b, x, base) => {
    b.shape(x, base - 6, 7, 6, (i, j) => (i - 3) ** 2 + (j - 3.2) ** 2 <= 10.5, (_i, j) => (j < 2 ? 'glassHi' : 'water'));
    b.rect(x + 2, base - 3, 2, 1, 'top');
    b.set(x + 4, base - 3, 'topSh');
  },
  // From the cafe: cups to go, each with its own sleeve.
  coffee: cup('trunk'),
  latte: cup('cream'),
  koucha: cup('roofA'),
  cocoa: cup('hairSh'),
  // From the konbini.
  onigiri: (b, x, base) => {
    const half = [1, 2, 2, 3, 3, 3];
    b.shape(x, base - 6, 7, 6, (i, j) => j >= 0 && j < 6 && Math.abs(i - 3) <= half[j]!, (i, j) => (j === 1 && i === 2 ? 'grey' : 'white'));
    b.rect(x + 2, base - 2, 3, 1, 'dark');
  },
  ocha: bottle('top2', 'top2Sh'),
  mizu: bottle('roofB', 'glassHi'),
  gyunyu: (b, x, base) => {
    b.box(x + 1, base - 5, 5, 5, 'white');
    b.rect(x + 2, base - 3, 3, 1, 'roofB');
    b.rect(x + 2, base - 6, 3, 1, 'out');
  },
  bento: (b, x, base) => {
    b.box(x, base - 4, 7, 4, 'white');
    b.rect(x + 1, base - 3, 2, 2, 'roofA');
    b.rect(x + 4, base - 3, 2, 2, 'leaf');
    b.rect(x, base - 5, 7, 1, 'out');
  },
  aisu: (b, x, base) => {
    b.rect(x + 2, base - 3, 3, 1, 'roofF');
    b.rect(x + 2, base - 2, 3, 1, 'roofFSh');
    b.set(x + 3, base - 2, 'roofF');
    b.set(x + 3, base - 1, 'roofFSh');
    b.shape(x + 1, base - 7, 5, 4, (i, j) => (i - 2) ** 2 + (j - 2.5) ** 2 <= 5.5, (i, j) => (j < 1 || (j === 1 && i < 2) ? 'white' : 'flowerA'));
  },
  // An open umbrella, propped up.
  kasa: (b, x, base) => {
    b.rect(x + 2, base - 7, 3, 1, 'out');
    b.set(x + 1, base - 6, 'out');
    b.rect(x + 2, base - 6, 3, 1, 'roofB');
    b.set(x + 2, base - 6, 'roofBHi');
    b.set(x + 5, base - 6, 'out');
    b.set(x, base - 5, 'out');
    b.rect(x + 1, base - 5, 5, 1, 'roofB');
    b.set(x + 1, base - 5, 'roofBHi');
    b.set(x + 6, base - 5, 'out');
    b.rect(x, base - 4, 7, 1, 'out');
    b.rect(x + 3, base - 3, 1, 3, 'out');
    b.set(x + 2, base - 1, 'out');
  },
  denchi: (b, x, base) => {
    for (const dx of [1, 4]) {
      b.box(x + dx, base - 5, 2, 5, 'dark');
      b.set(x + dx, base - 6, 'gold');
      b.rect(x + dx, base - 3, 2, 1, 'gold');
    }
  },
  nikuman: (b, x, base) => {
    b.shape(x, base - 5, 7, 5, (i, j) => (i - 3) ** 2 / 12 + (j - 5) ** 2 / 25 <= 1, (_i, j) => (j < 1 ? 'grey' : 'white'));
    b.set(x + 3, base - 5, 'greySh');
    b.rect(x + 1, base - 1, 5, 1, 'greySh');
  },
  // From the pharmacy: boxes in their own colours, and a little bottle of eye drops.
  kazegusuri: medBox('roofB'),
  zutsuyaku: medBox('roofD'),
  ichoyaku: medBox('top2'),
  sekidome: medBox('roofC'),
  genetsuzai: medBox('roofA'),
  megusuri: (b, x, base) => {
    b.box(x + 2, base - 5, 3, 5, 'glass');
    b.rect(x + 2, base - 6, 3, 1, 'roofB');
    b.set(x + 3, base - 7, 'roofB');
  },
  // From the post office and the station.
  kitte: (b, x, base) => {
    b.box(x, base - 6, 7, 6, 'white');
    const c: Role[] = ['postRed', 'roofB', 'top2', 'gold'];
    c.forEach((r, i) => b.rect(x + 1 + (i % 2) * 3, base - 5 + Math.floor(i / 2) * 2, 2, 1, r));
  },
  nimotsu: (b, x, base) => {
    b.box(x, base - 5, 7, 5, 'dirt');
    b.rect(x + 3, base - 4, 1, 3, 'pathHi');
    b.rect(x + 1, base - 2, 5, 1, 'dirtSh');
  },
  kippu: (b, x, base) => {
    b.box(x, base - 4, 7, 4, 'stationWall');
    b.rect(x + 1, base - 3, 5, 1, 'roofB');
    b.set(x + 5, base - 2, 'ink');
  },
  // From the souvenir shop in 鎌倉: a box of sweets tied with a ribbon.
  okashi: (b, x, base) => {
    b.box(x, base - 4, 7, 4, 'roofG');
    b.rect(x + 3, base - 4, 1, 4, 'gold');
    b.rect(x + 2, base - 5, 3, 1, 'gold');
  },
};

function cup(sleeve: Role): Mini {
  return (b, x, base) => {
    b.box(x + 1, base - 5, 5, 5, 'white');
    b.rect(x + 2, base - 3, 3, 2, sleeve);
    b.rect(x + 1, base - 6, 5, 1, 'out');
    b.set(x + 3, base - 7, 'out');
  };
}

function bottle(cap: Role, label: Role): Mini {
  return (b, x, base) => {
    b.box(x + 1, base - 5, 5, 5, 'glass');
    b.set(x + 2, base - 4, 'glassHi');
    b.rect(x + 2, base - 3, 3, 1, label);
    b.rect(x + 2, base - 6, 3, 1, 'out');
    b.rect(x + 2, base - 7, 3, 1, cap);
  };
}

function medBox(colour: Role): Mini {
  return (b, x, base) => {
    b.box(x, base - 6, 7, 6, 'white');
    b.rect(x + 1, base - 5, 5, 3, colour);
    b.set(x + 3, base - 5, 'white');
    b.rect(x + 2, base - 4, 3, 1, 'white');
    b.set(x + 3, base - 3, 'white');
  };
}

type Piece = (b: Buf, x: number, y: number) => void;
/** Furniture that stands on the floor, on its own tile at (x, y). */
export const FLOOR_DECOR: Record<string, Piece> = {
  hondana: (b, x, y) => {
    b.ellipseShadow(x + 8, y + 15, 7, 1.5);
    b.box(x, y - 8, TILE, 23, 'woodSh');
    const spines: Role[] = ['roofB', 'roofA', 'top2', 'stripe2', 'roofD', 'white', 'navy'];
    for (let s = 0; s < 3; s++) {
      const sy = y - 6 + s * 7;
      b.rect(x + 1, sy, TILE - 2, 6, 'wood');
      for (let i = 0; i < 6; i++) {
        const h = 3 + Math.floor(hash(x + i, s, 9) * 3);
        b.rect(x + 2 + i * 2, sy + 6 - h, 2, h, spines[(i + s * 3) % spines.length]!);
      }
      b.rect(x + 1, sy + 6, TILE - 2, 1, 'out');
    }
  },
  kingyo: (b, x, y) => {
    b.ellipseShadow(x + 8, y + 15, 6, 1.5);
    b.box(x + 3, y + 7, 10, 8, 'wood');
    b.rect(x + 4, y + 8, 8, 1, 'woodHi');
    b.shape(x + 2, y - 5, 12, 12, (px, py) => (px - 5.5) ** 2 + (py - 6) ** 2 <= 30 && py > 1, (px, py) => (py < 4 ? 'glassHi' : px + py < 9 ? 'waterHi' : 'water'));
    b.rect(x + 5, y + 1, 3, 2, 'lantern');
    b.set(x + 8, y + 2, 'lantern');
    b.set(x + 9, y - 1, 'waterHi');
  },
  lamp: (b, x, y) => {
    b.ellipseShadow(x + 8, y + 15, 5, 1.5);
    b.box(x + 4, y + 11, 8, 4, 'woodSh');
    b.rect(x + 7, y - 2, 2, 13, 'lamp');
    b.shape(x + 2, y - 10, 12, 9, (px, py) => px >= Math.max(0, 3 - py / 2) && px <= Math.min(11, 8 + py / 2) && py >= 0 && py < 9, (_px, py) => (py < 3 ? 'lampLight' : 'cream'));
  },
  guitar: (b, x, y) => {
    b.ellipseShadow(x + 8, y + 15, 5, 1.5);
    b.rect(x + 9, y - 10, 2, 14, 'trunkSh');
    b.rect(x + 8, y - 12, 4, 3, 'out');
    b.shape(x + 3, y + 1, 12, 14, (px, py) => ((px - 5.5) / 5.5) ** 2 + ((py - (py < 6 ? 4 : 8.5)) / (py < 6 ? 4 : 5)) ** 2 <= 1, (px) => (px < 4 ? 'roofFHi' : 'roofF'));
    b.rect(x + 7, y + 7, 3, 3, 'out');
    b.rect(x + 7, y + 12, 3, 1, 'trunkSh');
  },
  tv: (b, x, y) => {
    b.ellipseShadow(x + 8, y + 15, 7, 1.5);
    b.box(x + 1, y + 6, 14, 9, 'wood');
    b.rect(x + 2, y + 7, 12, 1, 'woodHi');
    b.box(x, y - 7, TILE, 13, 'dark');
    b.rect(x + 2, y - 5, 12, 9, 'glassSh');
    b.rect(x + 3, y - 4, 4, 2, 'glassHi');
    b.rect(x + 7, y + 6, 2, 1, 'out');
  },
};

/** Hung on the back wall; mid is the wall's upper band. */
export const WALL_DECOR: Record<string, (b: Buf, mid: number) => void> = {
  furin: (b, mid) => {
    const x = 9 * TILE;
    b.rect(x + 1, mid + 1, 1, 4, 'out');
    b.shape(x - 2, mid + 4, 7, 5, (px, py) => py < 5 && Math.abs(px - 3) <= 1 + py, (px) => (px < 3 ? 'glassHi' : 'glass'));
    b.rect(x + 1, mid + 9, 1, 2, 'out');
    b.box(x, mid + 11, 3, 6, 'flowerA');
  },
  kakejiku: (b, mid) => {
    const x = 11 * TILE + 3;
    b.rect(x - 1, mid - 1, 12, 2, 'trunkSh');
    b.box(x, mid + 1, 10, 22, 'sign');
    b.rect(x + 4, mid + 4, 2, 9, 'ink');
    b.rect(x + 3, mid + 7, 4, 1, 'ink');
    b.rect(x + 3, mid + 15, 2, 2, 'postRed');
    b.rect(x - 1, mid + 22, 12, 2, 'trunkSh');
  },
};

/** Laid on the rug around the low table. */
export const RUG_DECOR: Record<string, (b: Buf) => void> = {
  zabuton: (b) => {
    for (const [x, y] of [[9 * TILE + 3, 6 * TILE + 5], [10 * TILE + 3, 8 * TILE + 1]] as const) {
      b.box(x, y, 11, 9, 'roofD');
      b.rect(x + 1, y + 1, 9, 2, 'roofDHi');
      b.set(x + 5, y + 4, 'gold');
    }
  },
};

function crop(src: Buf, x0: number, y0: number, w: number, h: number): Buf {
  const out = new Buf(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = x0 + x;
      const sy = y0 + y;
      if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
      out.px[y * w + x] = src.px[sy * src.w + sx]!;
      out.sh[y * w + x] = src.sh[sy * src.w + sx]!;
    }
  return out;
}

/** A small picture of a catalog item, or of something you have, for the catalog, the shelf and your things. */
export function itemIcon(id: string, kind: 'floor' | 'wall' | 'rug' | 'keepsake'): Buf {
  const big = new Buf(W, H);
  if (kind === 'floor') {
    FLOOR_DECOR[id]?.(big, 4, 14);
    return crop(big, 0, 0, 24, 32);
  }
  if (kind === 'wall') {
    WALL_DECOR[id]?.(big, 6);
    return id === 'furin' ? crop(big, 9 * TILE - 10, 0, 24, 32) : crop(big, 11 * TILE - 4, 0, 24, 32);
  }
  if (kind === 'rug') {
    RUG_DECOR[id]?.(big);
    return crop(big, 9 * TILE - 3, 6 * TILE - 6, 24, 32);
  }
  (KEEPSAKE_ART[id] ?? genericKeepsake)(big, 3, 10);
  return crop(big, 0, 0, 12, 12);
}
