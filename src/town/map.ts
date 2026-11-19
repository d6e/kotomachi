// The town: one shopping street (商店街) with your apartment, the cafe, the konbini,
// the pharmacy, the restaurant, the post office and the station, a small park below, and
// the railway along the bottom where trains go by. The world is a grid of 16 px tiles;
// you walk from tile to tile. Pure data and logic, no DOM, so it can be tested.

export const TILE = 16;
export const COLS = 45;
export const ROWS = 13;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
/** The camera's view, in world pixels. It scrolls sideways to follow you. */
export const VIEW_W = 320;
export const VIEW_H = 208;

/** Pixel rows of the shop fronts: roofs end here, and the street starts at GROUND. */
export const ROOF_BOTTOM = 21;
export const GROUND = 80;
/** First tile row you can walk on (the street). */
export const STREET_ROW = GROUND / TILE;

export type DoorPlace = 'home' | 'cafe' | 'konbini' | 'pharmacy' | 'restaurant' | 'post' | 'station';
export type RoofRole = 'roofA' | 'roofB' | 'roofC' | 'roofD' | 'roofE' | 'roofF' | 'roofG';

export interface Building {
  id: 'home' | 'cafe' | 'konbini' | 'pharmacy' | 'restaurant' | 'post' | 'station';
  /** Left edge and width in pixels. */
  x: number;
  w: number;
  roof: RoofRole;
  /** Sign text as one dictionary word (looked up when clicked). */
  sign: string;
  /** The door's tile column; the door is in the row above the street. */
  door?: { tx: number; place: DoorPlace };
}

export const BUILDINGS: Building[] = [
  { id: 'home', x: 16, w: 80, roof: 'roofD', sign: 'アパート', door: { tx: 3, place: 'home' } },
  { id: 'cafe', x: 112, w: 80, roof: 'roofA', sign: 'カフェ', door: { tx: 9, place: 'cafe' } },
  { id: 'konbini', x: 208, w: 80, roof: 'roofB', sign: 'コンビニ', door: { tx: 15, place: 'konbini' } },
  { id: 'pharmacy', x: 304, w: 80, roof: 'roofC', sign: '薬局', door: { tx: 21, place: 'pharmacy' } },
  { id: 'restaurant', x: 400, w: 80, roof: 'roofF', sign: 'レストラン', door: { tx: 27, place: 'restaurant' } },
  { id: 'post', x: 496, w: 80, roof: 'roofG', sign: '郵便局', door: { tx: 33, place: 'post' } },
  { id: 'station', x: 600, w: 96, roof: 'roofE', sign: '駅', door: { tx: 40, place: 'station' } },
];

export type TileKind = 'block' | 'plaza' | 'grass' | 'dirt' | 'flowers' | 'fence' | 'tree' | 'bench' | 'pond' | 'signpost' | 'lamp' | 'rail' | 'stall';

export const SOLID: ReadonlySet<TileKind> = new Set(['block', 'fence', 'tree', 'bench', 'pond', 'signpost', 'lamp', 'rail', 'stall']);

/** Trees in the back row, in the gaps between buildings (tile columns). */
export const BACK_TREES = [0, 6, 12, 18, 24, 30, 36, 44];
/** Street lamps on the street's first row (tile columns). */
export const LAMPS = [12, 24, 36];
/** The park's paths: two ways in from the street, joined along the bottom. */
export const PATH_COLS = [9, 10, 26, 27, 38, 39];
export const PATH_ROW = 11;
export const POND = { tx: 13, ty: 8, tw: 5, th: 3 };
/** The railway runs along the bottom row, behind a low fence. */
export const RAIL_ROW = ROWS - 1;
/** The bench the cat naps on. */
export const CAT_BENCH = { tx: 4, ty: 9 };
/** The notice board (掲示板) stands in the gap between the apartment and the cafe; you read it from the street. */
export const BOARD = { tx: 6, ty: STREET_ROW - 1 };
export const BOARD_SPOT = { tx: 6, ty: STREET_ROW };

export type StallId = 'kingyo' | 'takoyaki' | 'kakigoori';

/** Festival stalls (屋台) in the park: a counter two tiles wide on row ty, the keeper behind it on row ty - 1. */
export interface Stall {
  id: StallId;
  tx: number;
  ty: number;
  sign: string;
}

export const STALLS: Stall[] = [
  { id: 'kingyo', tx: 6, ty: 9, sign: '金魚すくい' },
  { id: 'takoyaki', tx: 28, ty: 9, sign: 'たこ焼き' },
  { id: 'kakigoori', tx: 40, ty: 9, sign: 'かき氷' },
];

/** Where you stand to be served at a stall: just in front of the counter's left half. */
export function stallSpot(s: Stall): TilePos {
  return { tx: s.tx, ty: s.ty + 1 };
}

/** The stall whose counter or keeper is on this tile. */
export function stallAt(tx: number, ty: number): Stall | null {
  return STALLS.find((s) => tx >= s.tx && tx <= s.tx + 1 && (ty === s.ty || ty === s.ty - 1)) ?? null;
}

/** The town on a festival day: the same, with the stalls up in the park. */
export function festivalGrid(grid: Grid): Grid {
  const g = grid.map((r) => [...r]);
  for (const s of STALLS)
    for (const [x, y] of [[s.tx, s.ty], [s.tx + 1, s.ty], [s.tx, s.ty - 1], [s.tx + 1, s.ty - 1]] as const) {
      if (g[y]![x] !== 'grass') throw new Error(`stall ${s.id} at ${x},${y} overlaps ${g[y]![x]}`);
      g[y]![x] = 'stall';
    }
  return g;
}

// Things in the park, as [column, row, kind].
const PARK: [number, number, TileKind][] = [
  [0, 8, 'tree'], [1, 8, 'flowers'], [2, 8, 'flowers'], [3, 8, 'flowers'], [12, 8, 'signpost'], [21, 8, 'bench'], [30, 8, 'tree'], [34, 8, 'flowers'], [35, 8, 'flowers'], [42, 8, 'tree'],
  [4, 9, 'bench'], [23, 9, 'flowers'], [24, 9, 'flowers'], [44, 9, 'tree'],
  [1, 10, 'flowers'], [2, 10, 'flowers'], [19, 10, 'tree'], [31, 10, 'tree'], [33, 9, 'bench'], [41, 10, 'flowers'], [42, 10, 'flowers'],
  [2, 11, 'tree'], [5, 11, 'flowers'], [6, 11, 'flowers'], [41, 11, 'flowers'], [43, 11, 'tree'], [44, 11, 'tree'],
];

export type Grid = TileKind[][];

export function buildGrid(): Grid {
  const g: Grid = [];
  for (let y = 0; y < ROWS; y++) {
    const row: TileKind[] = [];
    for (let x = 0; x < COLS; x++) {
      let k: TileKind = 'grass';
      if (y < STREET_ROW) k = 'block';
      else if (y < STREET_ROW + 2) k = 'plaza';
      else if (y === STREET_ROW + 2) k = PATH_COLS.includes(x) ? 'dirt' : 'fence';
      else if (y === RAIL_ROW) k = 'rail';
      else if (PATH_COLS.includes(x) || (y === PATH_ROW && x >= PATH_COLS[0]! && x <= PATH_COLS[PATH_COLS.length - 1]!)) k = 'dirt';
      row.push(k);
    }
    g.push(row);
  }
  for (const x of LAMPS) g[STREET_ROW]![x] = 'lamp';
  for (let y = POND.ty; y < POND.ty + POND.th; y++) for (let x = POND.tx; x < POND.tx + POND.tw; x++) g[y]![x] = 'pond';
  for (const [x, y, k] of PARK) {
    if (g[y]![x] !== 'grass') throw new Error(`park item ${k} at ${x},${y} overlaps ${g[y]![x]}`);
    g[y]![x] = k;
  }
  return g;
}

export function isSolid(grid: Grid, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return SOLID.has(grid[ty]![tx]!);
}

export interface TilePos {
  tx: number;
  ty: number;
}

/** The tile you stand on to go in through a building's door. */
export function doorSpot(b: Building): TilePos | null {
  return b.door ? { tx: b.door.tx, ty: STREET_ROW } : null;
}

export function buildingFor(place: DoorPlace): Building {
  return BUILDINGS.find((b) => b.door?.place === place)!;
}

export const START: TilePos = { tx: 3, ty: STREET_ROW };

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
} as const;

export type Facing = keyof typeof DIRS;

export function facingTo(from: TilePos, to: TilePos): Facing {
  const dx = to.tx - from.tx;
  const dy = to.ty - from.ty;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/**
 * Shortest walk from one tile to another (4-way), as the tiles to step on in order,
 * not counting the start. Null when there's no way there.
 */
export function findPath(blocked: (tx: number, ty: number) => boolean, from: TilePos, to: TilePos): TilePos[] | null {
  if (from.tx === to.tx && from.ty === to.ty) return [];
  if (blocked(to.tx, to.ty)) return null;
  const key = (x: number, y: number) => y * COLS + x;
  const prev = new Map<number, number>([[key(from.tx, from.ty), -1]]);
  const queue: TilePos[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!;
    for (const d of Object.values(DIRS)) {
      const nx = cur.tx + d.dx;
      const ny = cur.ty + d.dy;
      const k = key(nx, ny);
      if (prev.has(k) || blocked(nx, ny)) continue;
      prev.set(k, key(cur.tx, cur.ty));
      if (nx === to.tx && ny === to.ty) {
        const path: TilePos[] = [];
        for (let at = k; at !== key(from.tx, from.ty); at = prev.get(at)!) path.push({ tx: at % COLS, ty: Math.floor(at / COLS) });
        return path.reverse();
      }
      queue.push({ tx: nx, ty: ny });
    }
  }
  return null;
}

/** The neighbour walks the street's second row between these columns. */
export const NEIGHBOUR_ROUTE = { ty: STREET_ROW + 1, from: 2, to: 22, start: 6 };
