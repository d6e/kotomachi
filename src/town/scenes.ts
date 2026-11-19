// Little pictures for the consequence scenes: the wrong train, the train that left,
// the worried phone call, the extra-hot ramen. Drawn into a role buffer like the town,
// in the same palette, so they look like part of it. All original.

import { Buf, roundRect } from './pixels.ts';
import type { Role } from './palette.ts';

export const SCENE_W = 96;
export const SCENE_H = 56;

export type SceneArt = 'train' | 'clock' | 'phone' | 'ramen';

const circle = (r: number) => (x: number, y: number) => (x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= r * r;

function sky(b: Buf, top: Role, ground: Role, horizon: number): void {
  b.rect(0, 0, SCENE_W, horizon, top);
  b.rect(0, horizon, SCENE_W, SCENE_H - horizon, ground);
}

/** A small face looking puzzled, with a ? or a sweat drop. */
function face(b: Buf, x: number, y: number, mark: '?' | '!' | 'sweat'): void {
  b.shape(x + 1, y + 11, 11, 7, roundRect(11, 9, 3), (_i, j) => (j > 4 ? 'topSh' : 'top'));
  b.shape(x, y, 13, 13, circle(6.5), (i, j) => (j < 5 || (j < 9 && (i < 2 || i > 10)) ? 'hair' : 'skin'));
  b.rect(x + 4, y + 7, 1, 2, 'eye');
  b.rect(x + 8, y + 7, 1, 2, 'eye');
  b.rect(x + 3, y + 10, 2, 1, 'blush');
  b.rect(x + 8, y + 10, 2, 1, 'blush');
  if (mark === '?') {
    // A chunky question mark beside the head.
    const qx = x + 15;
    const qy = y - 6;
    b.rect(qx, qy, 5, 2, 'out');
    b.rect(qx + 4, qy + 1, 2, 3, 'out');
    b.rect(qx + 2, qy + 4, 3, 2, 'out');
    b.rect(qx + 2, qy + 6, 2, 1, 'out');
    b.rect(qx + 2, qy + 8, 2, 2, 'out');
  } else if (mark === '!') {
    b.rect(x + 16, y - 6, 2, 6, 'closed');
    b.rect(x + 16, y + 2, 2, 2, 'closed');
  } else {
    b.rect(x + 12, y + 1, 2, 3, 'water');
    b.rect(x + 11, y + 3, 4, 2, 'water');
    b.set(x + 12, y + 3, 'waterHi');
  }
}

function train(b: Buf, x: number, y: number, len: number): void {
  b.shape(x, y, len, 18, roundRect(len, 18, 4), (i, j) => (j >= 11 && j <= 12 ? 'white' : j > 12 ? 'roofBSh' : 'roofB'));
  for (let wx = x + 5; wx + 7 < x + len - 3; wx += 11) {
    b.box(wx, y + 3, 8, 6, 'glass');
    b.rect(wx + 1, y + 4, 3, 1, 'glassHi');
  }
  b.rect(x + 4, y + 18, 5, 3, 'out');
  b.rect(x + len - 9, y + 18, 5, 3, 'out');
}

function drawTrain(b: Buf): void {
  sky(b, 'glassHi', 'grass', 30);
  // Faraway hills and the sea: the end of the line.
  b.shape(0, 18, 60, 14, (i, j) => j > 10 - Math.sin(i / 9) * 6, () => 'grassSh');
  b.rect(52, 26, 44, 4, 'water');
  b.rect(58, 27, 6, 1, 'waterHi');
  b.rect(74, 28, 8, 1, 'waterHi');
  // Track and a train heading off.
  b.rect(0, 44, SCENE_W, 2, 'stoneSh');
  for (let sx = 2; sx < SCENE_W; sx += 7) b.rect(sx, 46, 4, 2, 'trunk');
  train(b, 46, 25, 48);
  // A sign with a big number nobody expected.
  b.box(10, 30, 22, 12, 'sign');
  b.rect(20, 42, 2, 4, 'out');
  b.rect(14, 33, 14, 2, 'ink');
  b.rect(14, 37, 9, 2, 'ink');
  face(b, 24, 6, '?');
}

function drawClock(b: Buf): void {
  sky(b, 'stationWall', 'stone', 38);
  b.rect(0, 38, SCENE_W, 1, 'stationWallSh');
  // The station clock.
  b.shape(8, 6, 26, 26, circle(13), (x, y) => ((x - 13) ** 2 + (y - 13) ** 2 > 100 ? 'navy' : 'white'));
  b.rect(20, 11, 2, 9, 'ink');
  b.rect(21, 19, 8, 2, 'ink');
  b.rect(20, 18, 3, 3, 'closed');
  // The tail end of the train, already going.
  train(b, 70, 22, 40);
  for (const [px, py] of [[62, 40], [56, 43], [64, 46]] as const) b.shape(px, py, 7, 5, roundRect(7, 5, 2), () => 'grey');
  face(b, 42, 24, '!');
}

function drawPhone(b: Buf): void {
  sky(b, 'cream', 'wood', 34);
  b.rect(0, 34, SCENE_W, 2, 'woodSh');
  // The note with the wrong times on it.
  b.box(8, 22, 24, 20, 'sign');
  for (let ly = 26; ly < 40; ly += 4) b.rect(11, ly, 15 - (ly % 8), 1, 'ink');
  b.rect(11, 38, 14, 1, 'closed');
  // A medicine bag with its cross.
  b.box(36, 18, 18, 24, 'white');
  b.rect(43, 24, 4, 10, 'cross');
  b.rect(40, 27, 10, 4, 'cross');
  // The phone, ringing.
  b.shape(62, 20, 16, 24, roundRect(16, 24, 3), (_x, y) => (y > 38 ? 'roofGSh' : 'roofG'));
  b.box(65, 23, 10, 12, 'glassHi');
  for (const [lx, ly, w, hh] of [[81, 18, 2, 6], [84, 16, 2, 10], [57, 18, 2, 6], [54, 16, 2, 10]] as const) b.rect(lx, ly, w, hh, 'gold');
  face(b, 76, 2, 'sweat');
}

function drawRamen(b: Buf): void {
  sky(b, 'cream', 'wood', 36);
  b.rect(0, 36, SCENE_W, 2, 'woodSh');
  // The bowl, full of something very red.
  b.shape(22, 26, 46, 22, (x, y) => x >= 0 && x < 46 && y >= 0 && (y < 4 || (x - 23) ** 2 / 529 + (y - 2) ** 2 / 400 <= 1), (x, y) => (y < 2 ? 'roofAHi' : y < 4 ? 'roofA' : y > 16 ? 'greySh' : 'white'));
  b.rect(24, 28, 42, 2, 'closed');
  for (let nx = 27; nx < 62; nx += 5) b.rect(nx, 28, 2, 1, 'flowerB');
  b.rect(52, 26, 5, 2, 'leaf');
  // Heat coming off it.
  for (const [fx, fy, hh] of [[30, 12, 10], [40, 6, 16], [50, 9, 13], [60, 14, 8]] as const) {
    // Wavy, like heat shimmer.
    for (let j = 0; j < hh; j++) {
      const wx = fx + (Math.floor(j / 3) % 2);
      b.rect(wx, fy + j, 3, 1, j < 2 ? 'flowerB' : 'lantern');
      if (j > 2 && j < hh - 2) b.set(wx + 1, fy + j, 'flowerB');
    }
  }
  // Chopsticks resting on the side.
  b.rect(66, 20, 2, 18, 'trunk');
  b.rect(69, 20, 2, 18, 'trunk');
  face(b, 76, 6, 'sweat');
}

export function drawScene(art: SceneArt): Buf {
  const b = new Buf(SCENE_W, SCENE_H);
  if (art === 'train') drawTrain(b);
  else if (art === 'clock') drawClock(b);
  else if (art === 'phone') drawPhone(b);
  else drawRamen(b);
  return b;
}
