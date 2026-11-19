// The town: one shopping street (商店街) with your apartment, the cafe, the konbini,
// the pharmacy and the station. Collision is a tile grid; buildings are drawn from
// their rectangles.

export const TILE = 32;
export const COLS = 30;
export const ROWS = 17;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;

export type DoorPlace = 'home' | 'cafe' | 'konbini' | 'pharmacy';

export interface Building {
  id: string;
  /** Tile rectangle. */
  x: number;
  y: number;
  w: number;
  h: number;
  wall: string;
  roof: string;
  trim: string;
  /** Sign text as one dictionary word (looked up when clicked). */
  sign: string;
  door?: { x: number; place: DoorPlace };
  awning?: string;
}

export const BUILDINGS: Building[] = [
  { id: 'home', x: 1, y: 2, w: 5, h: 5, wall: '#d9c7a7', roof: '#7a5a48', trim: '#5c4235', sign: 'アパート', door: { x: 3, place: 'home' } },
  { id: 'cafe', x: 7, y: 2, w: 6, h: 5, wall: '#f1e3c8', roof: '#8c4a3a', trim: '#5a3127', sign: 'カフェ', door: { x: 9, place: 'cafe' }, awning: '#2f6b5a' },
  { id: 'konbini', x: 14, y: 2, w: 6, h: 5, wall: '#f4f6f6', roof: '#3d6fb0', trim: '#2a4f80', sign: 'コンビニ', door: { x: 16, place: 'konbini' }, awning: '#3d9a54' },
  { id: 'pharmacy', x: 21, y: 2, w: 5, h: 5, wall: '#e7eef0', roof: '#4f8a8b', trim: '#2f5d5e', sign: '薬局', door: { x: 23, place: 'pharmacy' }, awning: '#d8e6e7' },
  { id: 'station', x: 27, y: 1, w: 3, h: 6, wall: '#c9c3b8', roof: '#58595b', trim: '#3c3d3f', sign: '駅' },
];

// Bottom half of town, row by row from row 13. Legend:
//   . path   , grass   T tree   B bench   V vending machine   L lamp   F flowers
const PARK = [
  'T,,,,T,,,F,,,,,,T,,,,F,,,,T,,,T',
  ',,B,,,,,,,,T,,,,,,,,,,,,B,,,,,,',
  'T,,,,,,F,,,,,,,,,T,,,,,,,,,,F,,T',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

export type TileKind = 'void' | 'wall' | 'sidewalk' | 'street' | 'grass' | 'tree' | 'bench' | 'vending' | 'lamp' | 'flowers';

export function buildGrid(): TileKind[][] {
  const g: TileKind[][] = [];
  for (let y = 0; y < ROWS; y++) {
    const row: TileKind[] = [];
    for (let x = 0; x < COLS; x++) {
      let k: TileKind = 'street';
      if (y <= 1) k = 'void';
      else if (y === 7 || y === 12) k = 'sidewalk';
      else if (y >= 8 && y <= 11) k = 'street';
      else if (y >= 13) {
        const ch = PARK[y - 13]?.[x] ?? ',';
        k = ch === 'T' ? 'tree' : ch === 'B' ? 'bench' : ch === 'F' ? 'flowers' : 'grass';
      } else k = 'void';
      row.push(k);
    }
    g.push(row);
  }
  for (const b of BUILDINGS) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) g[y]![x] = 'wall';
  }
  // Street furniture on the far sidewalk.
  g[12]![6] = 'lamp';
  g[12]![13] = 'vending';
  g[12]![20] = 'lamp';
  g[12]![26] = 'vending';
  return g;
}

export const SOLID: ReadonlySet<TileKind> = new Set(['void', 'wall', 'tree', 'bench', 'vending', 'lamp']);

export function isSolidAt(grid: TileKind[][], px: number, py: number): boolean {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return SOLID.has(grid[ty]![tx]!);
}

/** Pixel position just in front of a door, where the player stands to go in. */
export function doorSpot(b: Building): { x: number; y: number } | null {
  if (!b.door) return null;
  return { x: b.door.x * TILE + TILE / 2, y: (b.y + b.h) * TILE + TILE / 2 };
}
