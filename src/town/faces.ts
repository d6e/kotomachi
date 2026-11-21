// Faces for the conversation header: the head of whoever you're talking to, drawn
// from their sprite, with an expression that reacts to how your answer landed.

import { Buf, toCanvas } from './pixels.ts';
import type { Role } from './palette.ts';
import { KEY, NEIGHBOUR, STAFF } from './sprites.ts';

export type Expression = 'neutral' | 'happy' | 'confused' | 'frown';

/** The head is the top twelve rows of a 16x16 sprite. */
export const HEAD_ROWS = 12;
const SKIN = new Set(['S', 's', 'P']);

export function headArt(npc: string): { rows: string[]; key: Record<string, Role> } | null {
  if (npc === 'tanaka') return { rows: NEIGHBOUR.front.slice(0, HEAD_ROWS), key: KEY };
  const art = STAFF[npc];
  if (!art) return null;
  return { rows: art.rows.slice(0, HEAD_ROWS), key: art.key ?? KEY };
}

interface Eye { x0: number; x1: number; y0: number; y1: number }

/** The eyes, left then right: runs of E pixels in the face rows, split down the middle. */
function findEyes(g: string[][]): Eye[] {
  const eyes: Eye[] = [];
  for (const half of [[0, 8], [8, 16]] as const) {
    let e: Eye | null = null;
    for (let y = 5; y < HEAD_ROWS; y++) {
      for (let x = half[0]; x < half[1]; x++) {
        if (g[y]![x] !== 'E') continue;
        e = e ? { x0: Math.min(e.x0, x), x1: Math.max(e.x1, x), y0: Math.min(e.y0, y), y1: Math.max(e.y1, y) } : { x0: x, x1: x, y0: y, y1: y };
      }
    }
    if (e) eyes.push(e);
  }
  return eyes;
}

/** Where the mouth goes: the shaded pixels under the eyes, or two rows below them. */
function findMouth(g: string[][], eyes: Eye[]): { y: number; x0: number; x1: number } {
  const below = eyes.length ? Math.max(...eyes.map((e) => e.y1)) + 1 : 9;
  for (let y = below; y < HEAD_ROWS; y++) {
    const xs = [6, 7, 8, 9].filter((x) => g[y]![x] === 's');
    if (xs.length) return { y, x0: Math.min(...xs), x1: Math.max(...xs) };
  }
  return { y: Math.min(HEAD_ROWS - 1, below + 1), x0: 7, x1: 8 };
}

/** The head rows with a different expression drawn on. Only skin pixels are painted over. */
export function withExpression(rows: readonly string[], expr: Expression): string[] {
  const g = rows.map((r) => [...r]);
  if (expr === 'neutral') return rows.slice();
  const put = (x: number, y: number, ch: string) => {
    const row = g[y];
    if (row && x >= 0 && x < row.length && (SKIN.has(row[x]!) || row[x] === 'E')) row[x] = ch;
  };
  const eyes = findEyes(g);
  const mouth = findMouth(g, eyes);
  const clearEye = (e: Eye) => {
    for (let y = e.y0; y <= e.y1; y++) for (let x = e.x0; x <= e.x1; x++) g[y]![x] = 'S';
  };
  const midX = (mouth.x0 + mouth.x1) / 2;
  // A curved mouth needs bare skin in the row above it (glasses can be in the way).
  const roomAbove = () => {
    for (let x = mouth.x0 - 1; x <= mouth.x1 + 1; x++) if (!SKIN.has(g[mouth.y - 1]?.[x] ?? '')) return false;
    return true;
  };
  if (expr === 'happy') {
    // ^ ^ eyes and a smile.
    for (const e of eyes) {
      clearEye(e);
      const low = Math.max(e.y1, e.y0 + 1);
      for (let x = e.x0; x <= e.x1; x++) put(x, e.y0, 'E');
      put(e.x0 - 1, low, 'E');
      put(e.x1 + 1, low, 'E');
    }
    if (roomAbove()) {
      for (let x = mouth.x0; x <= mouth.x1; x++) put(x, mouth.y, 'O');
      put(Math.floor(midX) - 1, mouth.y - 1, 'O');
      put(Math.ceil(midX) + 1, mouth.y - 1, 'O');
    } else for (let x = mouth.x0; x <= mouth.x1; x++) put(x, mouth.y, 'P'); // an open, laughing mouth
  } else if (expr === 'confused') {
    // One eye squints, the mouth goes crooked.
    const right = eyes[1];
    if (right) {
      clearEye(right);
      put(right.x0 - 1, right.y1, 'E');
      put(right.x0, right.y1, 'E');
    }
    put(mouth.x0, mouth.y, 'O');
    put(mouth.x1, mouth.y, 'O');
    put(mouth.x1 + 1, mouth.y - 1, 'O');
  } else {
    // A frown: eyes half shut under sloping brows, the mouth turned down.
    for (const [i, e] of eyes.entries()) {
      clearEye(e);
      const low = Math.max(e.y1, e.y0 + 1);
      for (let x = e.x0; x <= e.x1; x++) put(x, low, 'E');
      // The inner end of each brow lifts: a worried, unhappy look.
      put(i === 0 ? e.x1 + 1 : e.x0 - 1, e.y0 - 1, 'E');
    }
    if (roomAbove()) {
      for (let x = mouth.x0; x <= mouth.x1; x++) put(x, mouth.y - 1, 'O');
      put(Math.floor(midX) - 1, mouth.y, 'O');
      put(Math.ceil(midX) + 1, mouth.y, 'O');
    } else for (let x = mouth.x0 - 1; x <= mouth.x1 + 1; x++) put(x, mouth.y, 'O');
  }
  return g.map((r) => r.join(''));
}

const cache = new Map<string, HTMLCanvasElement>();

/** A 16x12 canvas of their head with that expression, or null for someone with no sprite. */
export function faceCanvas(npc: string, expr: Expression): HTMLCanvasElement | null {
  const key = `${npc}:${expr}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const art = headArt(npc);
  if (!art) return null;
  const b = new Buf(16, HEAD_ROWS);
  b.sprite(withExpression(art.rows, expr), 0, 0, art.key);
  const c = toCanvas(b);
  cache.set(key, c);
  return c;
}
