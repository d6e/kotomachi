// The insides of the places on the street. Each room is a 20 x 13 tile grid, the same
// size as the camera's view, so it fits the screen without scrolling. You come in at
// the door in the bottom wall, talk to the staff across the counter, and walk back out
// through the door. Pure data and logic, no DOM, so it can be tested.

import type { DoorPlace, TilePos } from './map.ts';

export const ROOM_COLS = 20;
export const ROOM_ROWS = 13;

/**
 * What each character in a room's map is:
 * ' ' outside the room, '#' wall, '.' floor, 'D' the door out,
 * 'S' where the staff stand, '=' counter, 'h' shelf against the wall,
 * 'H' a shelf you can walk round, 'f' fridge, 'm' machine (coffee, register, ticket),
 * 't' table, 'c' chair, 'p' plant, 'n' bench, 'g' ticket gate, 'k' writing desk,
 * 'x' postbox, 'b' bed, 'r' rug (walkable), 'w' low table at home, 'o' something you
 * bought for your room (drawn from the room's decor list).
 */
export type RoomCell = ' ' | '#' | '.' | 'D' | 'S' | '=' | 'h' | 'H' | 'f' | 'm' | 't' | 'c' | 'p' | 'n' | 'g' | 'k' | 'x' | 'b' | 'r' | 'w' | 'o';

/** Things in a room you can use: the catalog at the post office, your shelf at home. */
export type ThingId = 'catalog' | 'shelf' | 'tickets';

/** Something bought for your room, and where it goes. */
export interface DecorItem {
  id: string;
  /** On the floor (blocks walking), hung on the back wall, or laid on the rug. */
  kind: 'floor' | 'wall' | 'rug';
  spot?: TilePos;
}

const WALKABLE: ReadonlySet<string> = new Set(['.', 'D', 'r']);

export type FloorKind = 'wood' | 'tile' | 'stone' | 'tatami';

export interface RoomDef {
  place: DoorPlace;
  rows: string[];
  floor: FloorKind;
  /** The back wall's colour roles: fill and its shadow. */
  wall: 'wall' | 'wall2' | 'mint' | 'cream' | 'stationWall';
  /** A word on a board on the back wall, looked up when clicked. */
  sign?: string;
  /** Who works here (an NPC id), standing at 'S'. */
  staff?: string;
  /** Where a new day starts (at home). */
  start?: TilePos;
  /** Furniture you can use, by the cell it stands on. */
  things?: { cell: RoomCell; id: ThingId }[];
  /** What you've bought for the room (home only). */
  decor?: DecorItem[];
  /** Keepsake ids, shown on the shelf (home only). */
  keepsakes?: string[];
}

export const ROOMS: Record<DoorPlace, RoomDef> = {
  cafe: {
    place: 'cafe',
    floor: 'wood',
    wall: 'wall2',
    sign: 'メニュー',
    staff: 'yuki',
    rows: [
      '                    ',
      '                    ',
      ' ################## ',
      ' ################## ',
      ' #p..hmmmSmmh...hp# ',
      ' #....=======.....# ',
      ' #................# ',
      ' #..ctc....ctc....# ',
      ' #................# ',
      ' #..ctc....ctc...p# ',
      ' #p..............p# ',
      ' ########D######### ',
      '                    ',
    ],
  },
  konbini: {
    place: 'konbini',
    floor: 'tile',
    wall: 'wall',
    sign: 'レジ',
    staff: 'clerk',
    rows: [
      '                    ',
      '                    ',
      ' ################## ',
      ' ################## ',
      ' #ffff.hhShh..ffff# ',
      ' #.....=m===......# ',
      ' #................# ',
      ' #..HHHH....HHHH..# ',
      ' #................# ',
      ' #..HHHH....HHHH..# ',
      ' #p...............# ',
      ' ########D######### ',
      '                    ',
    ],
  },
  pharmacy: {
    place: 'pharmacy',
    floor: 'tile',
    wall: 'mint',
    sign: '薬',
    staff: 'mori',
    rows: [
      '                    ',
      '                    ',
      ' ################## ',
      ' ################## ',
      ' #hhhh.hhShh..hhhh# ',
      ' #.....=====......# ',
      ' #................# ',
      ' #..HHH......HHH..# ',
      ' #................# ',
      ' #..HHH......HHH..# ',
      ' #nn............pp# ',
      ' ########D######### ',
      '                    ',
    ],
  },
  restaurant: {
    place: 'restaurant',
    floor: 'wood',
    wall: 'cream',
    sign: 'おすすめ',
    staff: 'server',
    rows: [
      '                    ',
      '                    ',
      ' ################## ',
      ' ################## ',
      ' #p..hh..S..hh...p# ',
      ' #.....=====......# ',
      ' #................# ',
      ' #.ctc..ctc..ctc..# ',
      ' #................# ',
      ' #.ctc..ctc..ctc..# ',
      ' #p..............p# ',
      ' ########D######### ',
      '                    ',
    ],
  },
  station: {
    place: 'station',
    floor: 'stone',
    wall: 'stationWall',
    sign: '切符',
    staff: 'ekiin',
    rows: [
      '                    ',
      '                    ',
      ' ################## ',
      ' ################## ',
      ' #mm....=S=....mm.# ',
      ' #......===.......# ',
      ' #................# ',
      ' #................# ',
      ' #nnn........g.g.g# ',
      ' #...........g.g.g# ',
      ' #p..............p# ',
      ' ########D######### ',
      '                    ',
    ],
  },
  post: {
    place: 'post',
    floor: 'tile',
    wall: 'cream',
    sign: '切手',
    staff: 'kobayashi',
    things: [{ cell: 'k', id: 'catalog' }],
    rows: [
      '                    ',
      '                    ',
      ' ################## ',
      ' ################## ',
      ' #hh....hShh....hh# ',
      ' #.....=====......# ',
      ' #................# ',
      ' #................# ',
      ' #..kk......nnn...# ',
      ' #................# ',
      ' #x..............p# ',
      ' ########D######### ',
      '                    ',
    ],
  },
  home: {
    place: 'home',
    floor: 'tatami',
    start: { tx: 10, ty: 5 },
    things: [{ cell: 'h', id: 'shelf' }],
    wall: 'wall',
    rows: [
      '                    ',
      '                    ',
      '     ##########     ',
      '     ##########     ',
      '     #bb..h..p#     ',
      '     #bb......#     ',
      '     #..rrrr..#     ',
      '     #..rwwr..#     ',
      '     #..rrrr..#     ',
      '     #p.......#     ',
      '     ###D######     ',
      '                    ',
      '                    ',
    ],
  },
};

export const ROOM_PLACES = Object.keys(ROOMS) as DoorPlace[];

export function cellAt(room: RoomDef, tx: number, ty: number): RoomCell {
  return (room.rows[ty]?.[tx] ?? ' ') as RoomCell;
}

export function roomSolid(room: RoomDef, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= ROOM_COLS || ty >= ROOM_ROWS) return true;
  return !WALKABLE.has(cellAt(room, tx, ty));
}

function find(room: RoomDef, ch: RoomCell): TilePos | null {
  for (let ty = 0; ty < room.rows.length; ty++) {
    const tx = room.rows[ty]!.indexOf(ch);
    if (tx >= 0) return { tx, ty };
  }
  return null;
}

/** The door out, in the bottom wall. */
export function roomDoor(room: RoomDef): TilePos {
  return find(room, 'D')!;
}

/** Where you stand when you've just come in: just inside the door. */
export function roomEntrance(room: RoomDef): TilePos {
  const d = roomDoor(room);
  return { tx: d.tx, ty: d.ty - 1 };
}

/** Where the staff stand, behind the counter. */
export function staffSpot(room: RoomDef): TilePos | null {
  return room.staff ? find(room, 'S') : null;
}

/** Where you stand to talk to the staff: across the counter from them. */
export function talkSpot(room: RoomDef): TilePos | null {
  const s = staffSpot(room);
  return s ? { tx: s.tx, ty: s.ty + 2 } : null;
}

/** The bed's tiles, at home. */
export function bedTiles(room: RoomDef): TilePos[] {
  const out: TilePos[] = [];
  room.rows.forEach((row, ty) => [...row].forEach((ch, tx) => ch === 'b' && out.push({ tx, ty })));
  return out;
}

/** Where you stand to go to bed: the floor tile next to the bed, nearest the door. */
export function bedSpot(room: RoomDef): TilePos | null {
  const bed = bedTiles(room);
  if (!bed.length) return null;
  let best: TilePos | null = null;
  for (const b of bed)
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      const p = { tx: b.tx + dx, ty: b.ty + dy };
      if (roomSolid(room, p.tx, p.ty)) continue;
      if (!best || p.ty > best.ty || (p.ty === best.ty && p.tx < best.tx)) best = p;
    }
  return best;
}

const ADJ = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

/** Your room with what you've bought in it: floor pieces take their tile. */
export function furnish(room: RoomDef, items: DecorItem[], keepsakes: string[]): RoomDef {
  const rows = room.rows.map((r) => [...r]);
  const decor: DecorItem[] = [];
  for (const it of items) {
    if (it.kind === 'floor') {
      if (!it.spot || rows[it.spot.ty]?.[it.spot.tx] !== '.') continue;
      rows[it.spot.ty]![it.spot.tx] = 'o';
    }
    decor.push(it);
  }
  return { ...room, rows: rows.map((r) => r.join('')), decor, keepsakes };
}

/** Which usable thing stands on this tile, if any. */
export function thingAt(room: RoomDef, tx: number, ty: number): ThingId | null {
  const c = cellAt(room, tx, ty);
  return room.things?.find((t) => t.cell === c)?.id ?? null;
}

/** The usable thing right next to where you stand. */
export function thingNear(room: RoomDef, at: TilePos): ThingId | null {
  for (const [dx, dy] of ADJ) {
    const id = thingAt(room, at.tx + dx, at.ty + dy);
    if (id) return id;
  }
  return null;
}

/** Where to stand to use a thing: the free tile beside it nearest the door. */
export function thingSpot(room: RoomDef, id: ThingId): TilePos | null {
  const t = room.things?.find((x) => x.id === id);
  if (!t) return null;
  const door = roomDoor(room);
  let best: TilePos | null = null;
  let bestD = Infinity;
  room.rows.forEach((row, ty) => [...row].forEach((ch, tx) => {
    if (ch !== t.cell) return;
    for (const [dx, dy] of ADJ) {
      const p = { tx: tx + dx, ty: ty + dy };
      if (roomSolid(room, p.tx, p.ty)) continue;
      const d = Math.abs(p.tx - door.tx) + Math.abs(p.ty - door.ty);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
  }));
  return best;
}
