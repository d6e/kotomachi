// A small pixel buffer of colour "roles" (outline, skin, roof...) plus a shadow mask.
// Art is drawn into it at 1x with whole pixels, then turned into a canvas once,
// with each role mapped to the palette and shadowed pixels darkened.

import { PALETTE, SHADOW, type Role } from './palette.ts';

const ROLES = Object.keys(PALETTE) as Role[];
const ROLE_INDEX = new Map<Role, number>(ROLES.map((r, i) => [r, i]));

export type Inside = (x: number, y: number) => boolean;

export class Buf {
  readonly w: number;
  readonly h: number;
  readonly px: Int16Array;
  readonly sh: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Int16Array(w * h).fill(-1);
    this.sh = new Uint8Array(w * h);
  }

  set(x: number, y: number, role: Role): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = ROLE_INDEX.get(role)!;
    // Anything drawn over a shadow sits above it.
    this.sh[y * this.w + x] = 0;
  }

  is(x: number, y: number, role: Role): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.px[y * this.w + x] === ROLE_INDEX.get(role);
  }

  rect(x: number, y: number, w: number, h: number, role: Role): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, role);
  }

  /** A filled rectangle with a 1px outline. */
  box(x: number, y: number, w: number, h: number, fill: Role, out: Role = 'out'): void {
    this.rect(x, y, w, h, out);
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }

  shadow(x: number, y: number): void {
    x |= 0;
    y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.sh[y * this.w + x] = 1;
  }

  ellipseShadow(cx: number, cy: number, rx: number, ry: number): void {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.shadow(x, y);
  }

  /** Fill a shape given by inside(x, y), outlining its edge. colour(x, y) picks the fill. */
  shape(x0: number, y0: number, w: number, h: number, inside: Inside, colour: (x: number, y: number) => Role): void {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        this.set(x0 + x, y0 + y, edge ? 'out' : colour(x, y));
      }
  }

  /** Draw a sprite given as rows of characters; '.' is transparent. */
  sprite(rows: readonly string[], x0: number, y0: number, key: Record<string, Role>, flip = false): void {
    rows.forEach((row, y) => {
      const n = row.length;
      for (let x = 0; x < n; x++) {
        const ch = row[flip ? n - 1 - x : x]!;
        if (ch !== '.') this.set(x0 + x, y0 + y, key[ch]!);
      }
    });
  }
}

/** A rounded rectangle test, for ponds, frames and plates. */
export function roundRect(w: number, h: number, r: number): Inside {
  return (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const cx = x < r ? r : x >= w - r ? w - r - 1 : x;
    const cy = y < r ? r : y >= h - r ? h - r - 1 : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
}

/** Stable per-position noise in [0, 1). */
export function hash(x: number, y: number, s = 0): number {
  let v = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const COLOURS = ROLES.map((r) => hexRgb(PALETTE[r]));

/** RGBA pixels for a buffer: unset pixels are transparent, shadowed ones darkened. */
export function toRgba(b: Buf): Uint8ClampedArray {
  const out = new Uint8ClampedArray(b.w * b.h * 4);
  for (let i = 0; i < b.w * b.h; i++) {
    const role = b.px[i]!;
    if (role < 0) {
      // A shadow on nothing (cast onto whatever is behind) is a translucent dark pixel.
      if (b.sh[i]) out.set([0, 0, 0, Math.round(255 * (1 - SHADOW))], i * 4);
      continue;
    }
    const [r, g, bl] = COLOURS[role]!;
    const k = b.sh[i] ? SHADOW : 1;
    out.set([r * k, g * k, bl * k, 255], i * 4);
  }
  return out;
}

export function toCanvas(b: Buf): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = b.w;
  c.height = b.h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(b.w, b.h);
  img.data.set(toRgba(b));
  ctx.putImageData(img, 0, 0);
  return c;
}
