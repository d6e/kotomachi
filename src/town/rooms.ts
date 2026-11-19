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
 * 'x' postbox, 'b' bed, 'r' rug (walkable), 'w' low table at home.
 */
export type RoomCell = ' ' | '#' | '.' | 'D' | 'S' | '=' | 'h' | 'H' | 'f' | 'm' | 't' | 'c' | 'p' | 'n' | 'g' | 'k' | 'x' | 'b' | 'r' | 'w';

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
