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
export type RoomCell = ' ' | '#' | '.' | 'D' | 'S' | '=' | 'h' | 'H' | 'f' | 'm' | 't' | 'c' | 'p' | 'n' | 'g' | 'k' | 'x' | 'b' | 'r' | 'w' | 'o'
  // Outdoors on a trip: 'T' tree, ',' stone path, 'L' stone lantern, 'P' a torii's post,
  // '1', '2' and '3' doors into the places there (walk onto one to go in; inside the
  // ryokan, '1' is the stairs up to your room and '2' the way to the bath).
  | 'T' | ',' | 'L' | 'P' | '1' | '2' | '3'
  // At the hot springs: 'M' the mountains behind (and Mount Fuji), '~' hot water,
  // 'u' the ryokan's little shop, 'q' a washing place in the bath.
  | 'M' | '~' | 'u' | 'q';

/** The places you can reach by train: the town you arrive in, and the places in it. */
export type TripPlace = 'kamakura' | 'shrine' | 'omiyage' | 'hakone' | 'ryokan' | 'washitsu' | 'onsen';
/** Anywhere with its own room-sized map: the insides on the street, and trip places. */
export type Scene = DoorPlace | TripPlace;

/** Things in a room you can use: the catalog at the post office, your shelf at home. */
export type ThingId = 'catalog' | 'shelf' | 'tickets' | 'baiten' | 'rest';

/** Something bought for your room, and where it goes. */
export interface DecorItem {
  id: string;
  /** On the floor (blocks walking), hung on the back wall, or laid on the rug. */
  kind: 'floor' | 'wall' | 'rug';
  spot?: TilePos;
}

const WALKABLE: ReadonlySet<string> = new Set(['.', 'D', 'r', ',', '1', '2', '3']);

export type FloorKind = 'wood' | 'tile' | 'stone' | 'tatami';

export interface RoomDef {
  place: Scene;
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
  /** What's on the shelf, by good id (home only). */
  shelf?: string[];
  /** Drawn as an open-air area instead of a room (a trip's town). */
  outdoor?: boolean;
  /** Doors in this map to other places: walk onto the cell to go in. */
  doors?: { cell: RoomCell; to: TripPlace }[];
  /** Where the 'D' door leads: the street (unset), another trip place, or the train home. */
  exit?: TripPlace | 'train';
  /** The station's name on the platform board, outdoors on a trip. */
  station?: string;
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
    things: [{ cell: 'm', id: 'tickets' }],
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

/**
 * 鎌倉, the first trip. You step off the train at the bottom, walk up the stone path,
 * through a torii to the shrine on the left, or to the souvenir shop on the right.
 */
export const TRIP_ROOMS = {
  kamakura: {
    place: 'kamakura',
    floor: 'stone',
    wall: 'wall',
    outdoor: true,
    exit: 'train',
    doors: [{ cell: '1', to: 'shrine' }, { cell: '2', to: 'omiyage' }],
    rows: [
      'TTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTT',
      'T.#####....#######.T',
      'T.#####....#######.T',
      'T.##1##.L..###2###.T',
      'T...,.........,....T',
      'T..P,P........,..n.T',
      'T...,,,,,,,,,,,....T',
      'T.T......,......T..T',
      'T..L.....,.....L...T',
      'T........,.........T',
      'TTTTTTTTT,TTTTTTTTTT',
      '         D          ',
    ],
  },
  shrine: {
    place: 'shrine',
    floor: 'wood',
    wall: 'cream',
    sign: 'お守り',
    staff: 'takahashi',
    exit: 'kamakura',
    rows: [
      '                    ',
      '                    ',
      ' ################## ',
      ' ################## ',
      ' #p..hhh.S.hhh...p# ',
      ' #.....=====......# ',
      ' #................# ',
      ' #................# ',
      ' #nn..........nn..# ',
      ' #................# ',
      ' #p..............p# ',
      ' ########D######### ',
      '                    ',
    ],
  },
  omiyage: {
    place: 'omiyage',
    floor: 'wood',
    wall: 'wall2',
    sign: 'お土産',
    staff: 'sato',
    exit: 'kamakura',
    rows: [
      '                    ',
      '                    ',
      ' ################## ',
      ' ################## ',
      ' #hhh..hhShh...hhh# ',
      ' #.....=====......# ',
      ' #................# ',
      ' #..HHH......HHH..# ',
      ' #................# ',
      ' #..HHH......HHH..# ',
      ' #p..............p# ',
      ' ########D######### ',
      '                    ',
    ],
  },
} as Record<TripPlace, RoomDef>;

/**
 * 箱根, the overnight trip. Off the train at the bottom, up the path to the ryokan on
 * the left; a steaming footbath on the right, and the mountains and Mount Fuji behind.
 */
TRIP_ROOMS.hakone = {
  place: 'hakone',
  floor: 'stone',
  wall: 'wall',
  outdoor: true,
  exit: 'train',
  station: '箱根',
  doors: [{ cell: '3', to: 'ryokan' }],
  rows: [
    'MMMMMMMMMMMMMMMMMMMM',
    'MMMMMMMMMMMMMMMMMMMM',
    'T.##########.......T',
    'T.##########..~~~..T',
    'T.#####3####..~~~..T',
    'T......,.......n...T',
    'T..L...,....L......T',
    'T......,,,,,,,,....T',
    'T.T.........,...T..T',
    'T...........,......T',
    'T...........,......T',
    'TTTTTTTTTTTT,TTTTTTT',
    '            D       ',
  ],
};

/**
 * Inside the ryokan: the front desk where the 女将 checks you in and out, the stairs up
 * to the guest rooms on the left, the way to the big bath on the right, and a little
 * shop by the entrance.
 */
TRIP_ROOMS.ryokan = {
  place: 'ryokan',
  floor: 'wood',
  wall: 'cream',
  sign: '旅館',
  staff: 'okami',
  exit: 'hakone',
  things: [{ cell: 'u', id: 'baiten' }],
  doors: [{ cell: '1', to: 'washitsu' }, { cell: '2', to: 'onsen' }],
  rows: [
    '                    ',
    '                    ',
    ' ################## ',
    ' ################## ',
    ' #p.1....hSh....2p# ',
    ' #.......===......# ',
    ' #................# ',
    ' #................# ',
    ' #uu..........nn..# ',
    ' #................# ',
    ' #p..............p# ',
    ' ########D######### ',
    '                    ',
  ],
};

/** Your room upstairs: tatami, a low table, a scroll in the alcove and a window on the mountains. The futon goes down after dinner. */
TRIP_ROOMS.washitsu = {
  place: 'washitsu',
  floor: 'tatami',
  wall: 'cream',
  staff: 'nakai',
  exit: 'ryokan',
  things: [{ cell: 'w', id: 'rest' }],
  rows: [
    '                    ',
    '                    ',
    '   ##############   ',
    '   ##############   ',
    '   #p...S.......#   ',
    '   #....ww......#   ',
    '   #............#   ',
    '   #.......bb...#   ',
    '   #.......bb...#   ',
    '   #p...........#   ',
    '   ######D#######   ',
    '                    ',
    '                    ',
  ],
};

/** The big bath: wash at the taps first, then get in. Another guest is already soaking. */
TRIP_ROOMS.onsen = {
  place: 'onsen',
  floor: 'stone',
  wall: 'mint',
  staff: 'suzuki',
  exit: 'ryokan',
  rows: [
    '                    ',
    '                    ',
    ' ################## ',
    ' ################## ',
    ' #~~~~~~~~S~~~~~~~# ',
    ' #~~~~~~~~~~~~~~~~# ',
    ' #................# ',
    ' #................# ',
    ' #q.q.q.q.........# ',
    ' #................# ',
    ' #p.......n......p# ',
    ' ########D######### ',
    '                    ',
  ],
};

/** The guest room as it is tonight: whether someone is there to see to you, and whether the futon is down. */
export function washitsuFor(o: { attendant: boolean; futon: boolean }): RoomDef {
  const base = TRIP_ROOMS.washitsu;
  const rows = base.rows.map((r) => (o.attendant ? r : r.replace('S', '.')).replace(/b/g, o.futon ? 'b' : '.'));
  return { ...base, rows, staff: o.attendant ? base.staff : undefined };
}

/** Any place's map. */
export function roomFor(scene: Scene): RoomDef {
  return scene in ROOMS ? ROOMS[scene as DoorPlace] : TRIP_ROOMS[scene as TripPlace];
}

/** Where a door cell is in a map. */
export function doorCell(room: RoomDef, to: TripPlace): TilePos | null {
  const d = room.doors?.find((x) => x.to === to);
  return d ? find(room, d.cell) : null;
}

/** The trip place whose door is on this tile, if any. */
export function doorTo(room: RoomDef, tx: number, ty: number): TripPlace | null {
  const c = cellAt(room, tx, ty);
  return room.doors?.find((d) => d.cell === c)?.to ?? null;
}

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
export function furnish(room: RoomDef, items: DecorItem[], shelf: string[]): RoomDef {
  const rows = room.rows.map((r) => [...r]);
  const decor: DecorItem[] = [];
  for (const it of items) {
    if (it.kind === 'floor') {
      if (!it.spot || rows[it.spot.ty]?.[it.spot.tx] !== '.') continue;
      rows[it.spot.ty]![it.spot.tx] = 'o';
    }
    decor.push(it);
  }
  return { ...room, rows: rows.map((r) => r.join('')), decor, shelf };
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
