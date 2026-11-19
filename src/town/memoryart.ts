// Pictures for the outings with friends: cake on ゆき's break, fireworks by the river,
// tea at 田中さん's and so on. The same size and palette as the consequence scenes, but
// everyone in them is smiling. All original.

import { Buf, roundRect } from './pixels.ts';
import type { Role } from './palette.ts';
import { SCENE_H, SCENE_W } from './scenes.ts';

export type MemoryArt = 'cake' | 'fireworks' | 'tea' | 'sakura' | 'walk' | 'exercise' | 'makanai' | 'market' | 'karaoke' | 'nabe';
export const MEMORY_ARTS: MemoryArt[] = ['cake', 'fireworks', 'tea', 'sakura', 'walk', 'exercise', 'makanai', 'market', 'karaoke', 'nabe'];

export type Who = 'me' | 'yuki' | 'tanaka' | 'mori' | 'server' | 'kobayashi';

interface Look {
  hair: Role;
  hairSh: Role;
  top: Role;
  topSh: Role;
  /** Long hair falls past the shoulders; a scarf covers the top of the head; glasses. */
  long?: boolean;
  scarf?: boolean;
  glasses?: boolean;
  apron?: Role;
}

const LOOKS: Record<Who, Look> = {
  me: { hair: 'hair', hairSh: 'hairSh', top: 'top', topSh: 'topSh' },
  yuki: { hair: 'hair', hairSh: 'hairSh', top: 'white', topSh: 'grey', long: true, apron: 'trunk' },
  tanaka: { hair: 'grey', hairSh: 'greySh', top: 'roofD', topSh: 'roofDSh' },
  mori: { hair: 'hairK', hairSh: 'hairKSh', top: 'white', topSh: 'greySh', glasses: true },
  server: { hair: 'hairK', hairSh: 'hairKSh', top: 'roofF', topSh: 'roofFSh', scarf: true },
  kobayashi: { hair: 'hair', hairSh: 'hairSh', top: 'postRed', topSh: 'postRedSh' },
};

const circle = (r: number) => (x: number, y: number) => (x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= r * r;

function sky(b: Buf, top: Role, ground: Role, horizon: number): void {
  b.rect(0, 0, SCENE_W, horizon, top);
  b.rect(0, horizon, SCENE_W, SCENE_H - horizon, ground);
}

/** Someone smiling, from the waist up: 13 wide, about 24 tall. Arms up for the exercises. */
function person(b: Buf, x: number, y: number, who: Who, arms: 'down' | 'up' = 'down'): void {
  const l = LOOKS[who];
  if (l.long) b.rect(x, y + 6, 13, 12, l.hairSh);
  b.shape(x + 1, y + 11, 11, 13, roundRect(11, 13, 3), (_i, j) => (j > 9 ? l.topSh : l.top));
  if (l.apron) b.rect(x + 3, y + 15, 7, 9, l.apron);
  if (arms === 'up') {
    b.rect(x - 1, y + 2, 2, 11, l.top);
    b.rect(x + 12, y + 2, 2, 11, l.top);
    b.rect(x - 1, y, 2, 2, 'skin');
    b.rect(x + 12, y, 2, 2, 'skin');
  }
  b.shape(x, y, 13, 13, circle(6.5), (i, j) => {
    if (l.scarf && j < 4) return 'white';
    return j < 4 || (j < 8 && (i < 2 || i > 10)) ? l.hair : 'skin';
  });
  if (l.scarf) b.rect(x + 1, y + 3, 11, 1, 'greySh');
  // Happy eyes, like little upside-down Us, and a smile.
  for (const ex of [x + 3, x + 8]) {
    b.rect(ex, y + 7, 2, 1, 'eye');
    b.set(ex - 1, y + 8, 'eye');
    b.set(ex + 2, y + 8, 'eye');
  }
  if (l.glasses) {
    b.rect(x + 2, y + 6, 4, 1, 'ink');
    b.rect(x + 7, y + 6, 4, 1, 'ink');
    b.rect(x + 6, y + 7, 1, 1, 'ink');
  }
  b.rect(x + 5, y + 10, 3, 1, 'closed');
  b.rect(x + 2, y + 9, 2, 1, 'blush');
  b.rect(x + 9, y + 9, 2, 1, 'blush');
}

/** A heart floating over two people who get on. */
function heart(b: Buf, x: number, y: number): void {
  b.rect(x, y, 2, 2, 'flowerA');
  b.rect(x + 3, y, 2, 2, 'flowerA');
  b.rect(x, y + 1, 5, 2, 'flowerA');
  b.rect(x + 1, y + 3, 3, 1, 'flowerA');
  b.set(x + 2, y + 4, 'flowerA');
  b.set(x + 1, y, 'white');
}

function table(b: Buf, y: number, role: Role = 'wood', sh: Role = 'woodSh'): void {
  b.rect(0, y, SCENE_W, 3, role);
  b.rect(0, y + 3, SCENE_W, SCENE_H - y - 3, sh);
}

function cup(b: Buf, x: number, y: number, role: Role): void {
  b.box(x, y, 6, 6, 'white');
  b.rect(x + 1, y + 1, 4, 1, role);
  b.rect(x + 6, y + 2, 1, 2, 'out');
}

function steam(b: Buf, x: number, y: number, h: number): void {
  for (let j = 0; j < h; j++) b.set(x + (Math.floor(j / 2) % 2), y + j, 'grey');
}

function drawCake(b: Buf, friend: Who): void {
  sky(b, 'cream', 'cream', 40);
  // The cafe's window behind them.
  b.box(30, 4, 36, 16, 'glass');
  b.rect(31, 5, 10, 2, 'glassHi');
  b.rect(47, 5, 1, 14, 'frame');
  person(b, 18, 16, friend);
  person(b, 64, 16, 'me');
  heart(b, 46, 22);
  table(b, 38);
  // A slice of strawberry shortcake to share, and two cups.
  b.shape(38, 30, 20, 9, (i, j) => j >= 0 && i <= j * 2 + 4, (_i, j) => (j < 2 ? 'white' : j === 4 ? 'flowerA' : 'cream'));
  b.shape(40, 26, 5, 5, circle(2.5), () => 'closed');
  b.set(42, 25, 'leaf');
  cup(b, 26, 33, 'trunk');
  cup(b, 66, 33, 'hairSh');
}

function drawFireworks(b: Buf, friend: Who): void {
  sky(b, 'navySh', 'navy', 38);
  // Bursts over the river.
  for (const [cx, cy, r, c1, c2] of [[22, 12, 9, 'flowerA', 'flowerB'], [58, 9, 8, 'gold', 'glassHi'], [80, 18, 6, 'roofCHi', 'flowerA']] as const) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      for (let s = 2; s <= r; s += 2) b.set(Math.round(cx + Math.cos(ang) * s), Math.round(cy + Math.sin(ang) * s), s > r - 3 ? c2 : c1);
    }
    b.set(cx, cy, 'white');
  }
  // The river, with the light on it.
  b.rect(0, 38, SCENE_W, 6, 'waterSh');
  for (let x = 4; x < SCENE_W; x += 9) b.rect(x, 40, 4, 1, x % 2 ? 'gold' : 'flowerA');
  b.rect(0, 44, SCENE_W, SCENE_H - 44, 'grassSh');
  person(b, 30, 30, friend);
  person(b, 52, 30, 'me');
}

function drawTea(b: Buf, friend: Who): void {
  sky(b, 'wall', 'tatami', 36);
  for (let x = 0; x < SCENE_W; x += 24) b.rect(x, 36, 1, 20, 'tatamiEdge');
  // The garden through the open door, full of flowers.
  b.box(34, 3, 30, 20, 'grass');
  b.rect(35, 4, 28, 7, 'glassHi');
  for (const [fx, fy, c] of [[38, 15, 'flowerA'], [44, 18, 'flowerB'], [50, 14, 'flowerC'], [56, 17, 'flowerA'], [60, 13, 'flowerB']] as const) {
    b.rect(fx, fy, 2, 2, c);
    b.set(fx, fy + 2, 'leaf');
  }
  person(b, 14, 14, friend);
  person(b, 68, 14, 'me');
  // A low table with the teapot and two cups.
  b.rect(24, 40, 48, 3, 'trunk');
  b.rect(26, 43, 3, 6, 'trunkSh');
  b.rect(67, 43, 3, 6, 'trunkSh');
  b.shape(40, 31, 12, 9, circle(5), () => 'roofC');
  b.rect(52, 34, 3, 1, 'roofC');
  b.rect(44, 30, 4, 1, 'roofCSh');
  steam(b, 46, 24, 5);
  b.box(31, 35, 5, 5, 'tatami');
  b.box(58, 35, 5, 5, 'tatami');
}

function drawSakura(b: Buf, friend: Who): void {
  sky(b, 'glassHi', 'grass', 34);
  // A cherry tree in full bloom.
  b.rect(70, 14, 5, 22, 'trunk');
  b.shape(46, 0, 50, 22, (i, j) => (i - 25) ** 2 / 600 + (j - 8) ** 2 / 150 <= 1, (i, j) => ((i + j) % 7 === 0 ? 'white' : (i * 3 + j) % 5 === 0 ? 'petalSh' : 'flowerA'));
  for (const [px, py] of [[20, 8], [34, 14], [12, 20], [40, 4], [28, 26]] as const) b.rect(px, py, 2, 1, 'flowerA');
  // A blue picnic mat, and bento between them.
  b.rect(8, 44, 80, 10, 'roofB');
  b.rect(8, 44, 80, 1, 'roofBHi');
  person(b, 20, 22, friend);
  person(b, 54, 22, 'me');
  b.box(38, 42, 14, 7, 'roofA');
  b.rect(40, 44, 4, 3, 'white');
  b.rect(45, 44, 5, 3, 'flowerB');
}

function drawWalk(b: Buf, friend: Who): void {
  sky(b, 'glassHi', 'grass', 30);
  // Trees along the park path.
  for (const tx of [6, 78]) {
    b.rect(tx + 6, 14, 3, 18, 'trunk');
    b.shape(tx, 2, 15, 15, circle(7.5), (i, j) => (j < 5 && i < 7 ? 'leafHi' : 'leaf'));
  }
  b.shape(20, 30, 56, 26, (i, j) => Math.abs(i - 28) <= 8 + j, () => 'path');
  person(b, 30, 22, friend);
  person(b, 50, 22, 'me');
  heart(b, 45, 14);
  for (const [fx, fy] of [[10, 40], [16, 48], [82, 44], [88, 50]] as const) b.rect(fx, fy, 2, 2, 'flowerB');
}

function drawExercise(b: Buf, friend: Who): void {
  sky(b, 'cream', 'grass', 36);
  // The morning sun coming up.
  b.shape(40, 2, 16, 16, circle(8), () => 'flowerB');
  for (const [rx, ry] of [[36, 9], [58, 9], [47, 0], [38, 2], [56, 2]] as const) b.rect(rx, ry, 2, 1, 'gold');
  // The radio on a stool.
  b.rect(44, 44, 8, 6, 'trunk');
  b.box(42, 38, 12, 7, 'roofE');
  b.shape(44, 40, 4, 4, circle(2), () => 'out');
  person(b, 20, 20, friend, 'up');
  person(b, 64, 20, 'me', 'up');
}

function drawMakanai(b: Buf, friend: Who): void {
  sky(b, 'cream', 'cream', 38);
  // The noren over the kitchen door.
  b.rect(30, 0, 36, 12, 'noren');
  for (let x = 38; x < 66; x += 9) b.rect(x, 0, 1, 12, 'norenSh');
  person(b, 16, 16, friend);
  person(b, 66, 16, 'me');
  table(b, 38);
  // Two plates of curry rice.
  for (const px of [28, 50]) {
    b.shape(px, 32, 18, 8, (i, j) => (i - 9) ** 2 / 81 + (j - 4) ** 2 / 16 <= 1, () => 'white');
    b.shape(px + 2, 33, 7, 5, circle(3), () => 'wallHi');
    b.shape(px + 8, 33, 8, 5, (i, j) => (i - 4) ** 2 / 16 + (j - 2.5) ** 2 / 6 <= 1, (i) => (i % 3 === 0 ? 'roofF' : 'roofFSh'));
  }
  steam(b, 36, 24, 6);
  steam(b, 58, 25, 5);
}

function drawMarket(b: Buf, friend: Who): void {
  sky(b, 'stationWall', 'stone', 40);
  // A striped awning over the stall.
  for (let x = 0; x < SCENE_W; x += 8) b.rect(x, 0, 4, 8, 'awnB');
  b.rect(0, 8, SCENE_W, 1, 'out');
  person(b, 22, 16, friend);
  person(b, 60, 16, 'me');
  // Crates of fish on ice.
  for (const cx of [4, 36, 68]) {
    b.box(cx, 38, 26, 12, 'roofB');
    b.rect(cx + 1, 39, 24, 3, 'waterHi');
    for (let fx = cx + 3; fx < cx + 22; fx += 8) {
      b.shape(fx, 40, 7, 3, (i, j) => Math.abs(j - 1) <= (i < 5 ? 1 : 0.4), (i) => (i === 1 ? 'eye' : 'roofE'));
    }
  }
  // A price tag stuck in the ice.
  b.box(46, 30, 10, 7, 'sign');
  b.rect(48, 32, 6, 1, 'closed');
}

function drawKaraoke(b: Buf, friend: Who): void {
  sky(b, 'darkSh', 'dark', 40);
  // The screen with the words scrolling, and coloured lights.
  b.box(32, 3, 32, 18, 'roofD');
  b.rect(34, 8, 20, 2, 'glassHi');
  b.rect(34, 13, 26, 2, 'flowerB');
  for (const [lx, c] of [[8, 'flowerA'], [20, 'gold'], [76, 'roofCHi'], [88, 'flowerA']] as const) b.rect(lx, 2, 2, 2, c);
  person(b, 18, 20, friend);
  person(b, 64, 20, 'me');
  // A microphone in your hand, and notes in the air.
  b.rect(62, 34, 2, 6, 'roofE');
  b.shape(61, 30, 4, 4, circle(2), () => 'grey');
  for (const [nx, ny] of [[52, 18], [80, 14], [44, 28]] as const) {
    b.rect(nx + 2, ny, 1, 5, 'flowerB');
    b.rect(nx, ny + 4, 3, 2, 'flowerB');
  }
  b.rect(0, 46, SCENE_W, 10, 'roofG');
}

function drawNabe(b: Buf, friend: Who): void {
  sky(b, 'wall2', 'wall2', 38);
  // A lamp over the table.
  b.rect(47, 0, 2, 4, 'lamp');
  b.shape(40, 4, 16, 6, (i, j) => Math.abs(i - 8) <= 3 + j, () => 'lampLight');
  person(b, 8, 16, friend);
  person(b, 40, 12, 'yuki');
  person(b, 74, 16, 'me');
  table(b, 40);
  // The hot pot in the middle, bubbling.
  b.shape(30, 32, 36, 12, (i, j) => (i - 18) ** 2 / 324 + (j - 3) ** 2 / 81 <= 1 && j >= 2, (_i, j) => (j < 4 ? 'roofASh' : 'dark'));
  b.rect(33, 33, 30, 2, 'cream');
  for (const [vx, c] of [[36, 'leaf'], [44, 'white'], [52, 'roofF'], [58, 'leaf']] as const) b.rect(vx, 33, 3, 1, c);
  steam(b, 40, 22, 8);
  steam(b, 54, 24, 6);
}

const DRAW: Record<MemoryArt, (b: Buf, friend: Who) => void> = {
  cake: drawCake, fireworks: drawFireworks, tea: drawTea, sakura: drawSakura, walk: drawWalk,
  exercise: drawExercise, makanai: drawMakanai, market: drawMarket, karaoke: drawKaraoke, nabe: drawNabe,
};

export function isMemoryArt(art: string): art is MemoryArt {
  return art in DRAW;
}

export function drawMemory(art: MemoryArt, friend: Who): Buf {
  const b = new Buf(SCENE_W, SCENE_H);
  DRAW[art](b, friend);
  return b;
}

/** The photo from the first outing, for the shelf: a small frame with the two of you in it. 7 wide, 6 tall. */
export function photoMini(friend: Who): (b: Buf, x: number, base: number) => void {
  const l = LOOKS[friend];
  return (b, x, base) => {
    b.box(x, base - 6, 7, 6, 'woodHi', 'woodSh');
    b.rect(x + 1, base - 5, 5, 4, 'glassHi');
    b.set(x + 2, base - 4, l.hair);
    b.set(x + 2, base - 3, l.top);
    b.set(x + 4, base - 4, 'hair');
    b.set(x + 4, base - 3, 'top');
    b.rect(x + 1, base - 2, 5, 1, 'grass');
  };
}
