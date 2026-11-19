// The festival (祭り) on every 7th day: three stalls (屋台) in the park and a string of
// paper lanterns (提灯) along the shop fronts. Drawn once into layers the size of the
// world that go over it: the stalls' roofs and posts behind their keepers, the counters
// in front. Sign lettering is drawn crisply on top, like the shops'. All original art.

import { STALLS, TILE, WORLD_H, WORLD_W, type Stall, type StallId } from './map.ts';
import type { RoofRole } from './map.ts';
import { Buf, roundRect } from './pixels.ts';
import type { Role } from './palette.ts';
import type { Measure, SignSpot } from './art.ts';

/** Sign text size on the stalls' banners, in world pixels. */
export const STALL_TEXT = 7;
/** Where the lantern string hangs across the shop fronts. */
export const LANTERN_Y = 43;

export interface FestivalArt {
  base: Buf;
  front: Buf;
  signs: SignSpot[];
  /** Lantern centres, which glow after dark. */
  lanterns: { x: number; y: number }[];
}

const ROOF: Record<StallId, [RoofRole, Role]> = {
  kingyo: ['roofB', 'white'],
  takoyaki: ['roofA', 'white'],
  kakigoori: ['roofC', 'white'],
};

/** Where a stall's keeper stands, in world pixels (top-left of their 16x16 sprite, before the sprite lift). */
export function keeperAt(s: Stall): { x: number; y: number } {
  return { x: s.tx * TILE + 8, y: (s.ty - 1) * TILE + 3 };
}

function stall(base: Buf, front: Buf, signs: SignSpot[], measure: Measure, s: Stall): void {
  const x0 = s.tx * TILE;
  const counterY = s.ty * TILE + 1;
  const roofY = (s.ty - 1) * TILE - 6;
  const [roof, stripe] = ROOF[s.id];
  // Posts, from the roof down to the ground behind the counter.
  for (const px of [x0 + 1, x0 + 28]) base.box(px, roofY + 4, 3, counterY + 12 - roofY - 4, 'trunk');
  // The awning: stripes, with a scalloped edge.
  base.shape(x0 - 2, roofY, 36, 9, roundRect(36, 9, 2), (x, y) => (y < 2 ? `${roof}Hi` as Role : Math.floor(x / 4) % 2 ? stripe : roof));
  for (let x = 0; x < 36; x += 4) base.shape(x0 - 2 + x, roofY + 8, 4, 3, (i, j) => (i - 1.5) ** 2 + (j + 0.2) ** 2 <= 4, () => (Math.floor(x / 4) % 2 ? stripe : roof));
  // The banner on top, lettered by the town.
  const w = Math.max(24, Math.ceil(measure(s.sign) * (STALL_TEXT / 10)) + 8);
  const sx = x0 + 16 - Math.round(w / 2);
  const sy = roofY - 11;
  base.box(sx, sy, w, 11, 'sign');
  base.rect(sx + 1, sy + 9, w - 2, 1, 'signSh');
  base.rect(sx + 3, sy + 11, 1, 2, 'out');
  base.rect(sx + w - 4, sy + 11, 1, 2, 'out');
  signs.push({ word: s.sign, x: sx, y: sy, w, h: 10, size: STALL_TEXT });
  // A little lantern hanging from each corner of the awning.
  for (const lx of [x0 - 1, x0 + 30]) lantern(base, lx, roofY + 10);

  // The counter, in front of the keeper.
  front.ellipseShadow(x0 + 16, counterY + 14, 17, 2);
  front.box(x0, counterY + 2, 32, 12, 'wood');
  front.rect(x0 + 1, counterY + 3, 30, 1, 'woodHi');
  front.rect(x0 + 1, counterY + 11, 30, 2, 'woodSh');
  if (s.id === 'kingyo') {
    // A shallow tub of water with goldfish in it.
    front.shape(x0 + 3, counterY - 2, 26, 7, roundRect(26, 7, 3), (_x, y) => (y < 2 ? 'waterHi' : 'water'));
    for (const [fx, fy] of [[7, 1], [13, 2], [19, 1], [23, 3]] as const) {
      front.rect(x0 + 3 + fx, counterY - 2 + fy, 2, 1, 'top');
      front.set(x0 + 5 + fx, counterY - 2 + fy, 'topSh');
    }
    // A stack of paper scoops.
    front.rect(x0 + 24, counterY + 5, 4, 1, 'white');
    front.rect(x0 + 24, counterY + 6, 4, 1, 'greySh');
  } else if (s.id === 'takoyaki') {
    // The iron plate with rows of round takoyaki.
    front.box(x0 + 4, counterY - 1, 24, 5, 'dark');
    for (let i = 0; i < 5; i++) {
      front.rect(x0 + 6 + i * 4, counterY, 3, 2, 'roofF');
      front.set(x0 + 6 + i * 4, counterY, 'roofFHi');
    }
  } else {
    // Cups of shaved ice with red, green and yellow syrup.
    const syrup: Role[] = ['roofA', 'top2', 'flowerB'];
    syrup.forEach((c, i) => {
      const cx = x0 + 6 + i * 8;
      front.box(cx, counterY - 1, 5, 4, 'white');
      front.shape(cx - 1, counterY - 5, 7, 5, (x, y) => (x - 3) ** 2 + (y - 4) ** 2 <= 10, (_x, y) => (y < 2 ? 'white' : c));
    });
  }
}

function lantern(b: Buf, cx: number, y: number): void {
  b.rect(cx + 1, y, 1, 1, 'out');
  b.shape(cx - 1, y + 1, 5, 6, roundRect(5, 6, 2), (_x, j) => (j === 3 ? 'white' : j > 3 ? 'lanternSh' : 'lantern'));
}

export function drawFestival(measure: Measure): FestivalArt {
  const base = new Buf(WORLD_W, WORLD_H);
  const front = new Buf(WORLD_W, WORLD_H);
  const signs: SignSpot[] = [];
  const lanterns: { x: number; y: number }[] = [];
  // A string of lanterns along the whole street, sagging a little between hooks.
  const span = 48;
  for (let x = 0; x < WORLD_W; x++) {
    const t = (x % span) / span;
    base.set(x, LANTERN_Y + Math.round(Math.sin(t * Math.PI) * 3), 'out');
  }
  for (let x = 8; x < WORLD_W; x += 16) {
    const t = (x % span) / span;
    const y = LANTERN_Y + Math.round(Math.sin(t * Math.PI) * 3);
    lantern(base, x, y);
    lanterns.push({ x: x + 1.5, y: y + 4 });
  }
  for (const s of STALLS) {
    stall(base, front, signs, measure, s);
    const roofY = (s.ty - 1) * TILE - 6;
    lanterns.push({ x: s.tx * TILE + 0.5, y: roofY + 14 }, { x: s.tx * TILE + 31.5, y: roofY + 14 });
  }
  return { base, front, signs, lanterns };
}
