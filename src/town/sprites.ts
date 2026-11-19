// Chibi sprites, two heads tall, 16x16, for four directions with walk frames.
// Right-facing frames are the left-facing ones mirrored. All original pixel art.

import type { Role } from './palette.ts';

export const KEY: Record<string, Role> = {
  O: 'out', S: 'skin', s: 'skinSh', P: 'blush', H: 'hair', h: 'hairHi', D: 'hairSh', E: 'eye', W: 'white',
  C: 'top', c: 'topSh', k: 'topHi', B: 'pants', F: 'shoe', G: 'grey', g: 'greySh', T: 'top2', t: 'top2Sh',
};

export type Dir = 'down' | 'up' | 'left' | 'right';

/** One character: a head and a body for each of front, back and side (facing left). */
export interface CharacterArt {
  front: string[];
  back: string[];
  side: string[];
}

// The player: chestnut hair, orange hoodie.
export const PLAYER: CharacterArt = {
  front: [
    '......OOOO......',
    '....OOHHHHOO....',
    '...OHHhhHHHHO...',
    '..OHHhHHHHHHHO..',
    '.OHHHHHHHHHHHHO.',
    '.OHHHHHHHHHHHHO.',
    '.OHHSSHHHHSSHHO.',
    '.OHSSSSSSSSSSHO.',
    '.OHSSESSSSESSHO.',
    '.OSSSESSSSESSSO.',
    '..OSPSSSSSSPSO..',
    '...OOSSssSSOO...',
    '..OkCCCCCCCCkO..',
    '.OSOCCCcCCCCOSO.',
    '..OOcCCCCCCcOO..',
    '...OFFO..OFFO...',
  ],
  back: [
    '......OOOO......',
    '....OOHHHHOO....',
    '...OHHhhHHHHO...',
    '..OHHhHHHHHHHO..',
    '.OHHHHHHHHHHHHO.',
    '.OHHHhHHHHHHHHO.',
    '.OHHHHHHHHHHHHO.',
    '.OHHHHHHHHHHHHO.',
    '.OHHHHHHHHHHHHO.',
    '.ODHHHHHHHHHHDO.',
    '..ODDHHHHHHDDO..',
    '...OOSSSSSSOO...',
    '..OcCCCCCCCCcO..',
    '.OSOCCCCCCCCOSO.',
    '..OOcCCCCCCcOO..',
    '...OFFO..OFFO...',
  ],
  side: [
    '......OOOO......',
    '....OOHHHHOO....',
    '...OHHhhHHHHO...',
    '..OHHhHHHHHHHO..',
    '.OHHHHHHHHHHHHO.',
    '.OHHHHHHHHHHHHO.',
    '.OSSHHHHHHHHHHO.',
    '.OSSSSSHHHHHHHO.',
    '.OSESSSSHHHHHHO.',
    '.OSESSSSSHHHHDO.',
    '..OPSSSSSSHHDO..',
    '...OOSSSssOOO...',
    '....OkCCCCCO....',
    '....OCSSCCcO....',
    '....OcCCCCcO....',
    '....OFFOFFO.....',
  ],
};

// The neighbour, Tanaka-san: grey bun, green cardigan, smiling eyes.
export const NEIGHBOUR: CharacterArt = {
  front: [
    '......OOOO......',
    '.....OGGGGO.....',
    '....OOGggGOO....',
    '..OOGGGGGGGGOO..',
    '.OGGGGGGGGGGGGO.',
    '.OGGgGGGGGGgGGO.',
    '.OGSSSSSSSSSSGO.',
    '.OSSSSSSSSSSSSO.',
    '.OSEESSSSSSEESO.',
    '.OSPSSSSSSSSPSO.',
    '..OSSSSssSSSSO..',
    '...OOSSSSSSOO...',
    '..OtTTTWWTTTtO..',
    '.OSOTTTWWTTTOSO.',
    '..OOtTTTTTTtOO..',
    '...OFFO..OFFO...',
  ],
  back: [
    '......OOOO......',
    '.....OGGGGO.....',
    '....OOGggGOO....',
    '..OOGGGGGGGGOO..',
    '.OGGGGGGGGGGGGO.',
    '.OGGgGGGGGGgGGO.',
    '.OGGGGGGGGGGGGO.',
    '.OGGGGGgGGGGGGO.',
    '.OGGGGGGGGGGGGO.',
    '.OgGGGGGGGGGGgO.',
    '..OgGGGGGGGGgO..',
    '...OOSSSSSSOO...',
    '..OtTTTTTTTTtO..',
    '.OSOTTTTTTTTOSO.',
    '..OOtTTTTTTtOO..',
    '...OFFO..OFFO...',
  ],
  side: [
    '......OOOO......',
    '.....OGGGGO.....',
    '....OOGggGOO....',
    '..OOGGGGGGGGOO..',
    '.OGGGGGGGGGGGGO.',
    '.OGGGGGGGGGGgGO.',
    '.OSSSSGGGGGGGGO.',
    '.OSSSSSSGGGGGGO.',
    '.OSEESSSSGGGGGO.',
    '.OSSSSSSSSGGGgO.',
    '..OPSSSSSSSGgO..',
    '...OOSSSssOOO...',
    '....OTTTTTtO....',
    '....OTSSTTtO....',
    '....OtTTTTtO....',
    '....OFFOFFO.....',
  ],
};

export const CAT = [
  '.O.....O.',
  'OGO...OGO',
  'OGGOOOGGO',
  'OGEGGGEGO',
  'OGGGPGGGO',
  '.OGGGGGO.',
  'OGGGGGGGO',
  'OGgGGGgGO',
  '.OOOOOOO.',
];

const replaceRow = (rows: string[], i: number, row: string) => rows.map((r, k) => (k === i ? row : r));

/**
 * Walk cycle for one facing: stand, step, stand, other step. Steps change the feet
 * (and, side on, the arm); the sprite also hops up a pixel on each step.
 */
export function walkFrames(art: CharacterArt, dir: Dir): { rows: string[]; flip: boolean; lift: number }[] {
  if (dir === 'down' || dir === 'up') {
    const base = dir === 'down' ? art.front : art.back;
    const a = replaceRow(base, 15, '...OFFO...OO....');
    const b = replaceRow(base, 15, '....OO...OFFO...');
    return [
      { rows: base, flip: false, lift: 0 },
      { rows: a, flip: false, lift: 1 },
      { rows: base, flip: false, lift: 0 },
      { rows: b, flip: false, lift: 1 },
    ];
  }
  const base = art.side;
  const flip = dir === 'right';
  const apart = replaceRow(base, 15, '...OFFO.OFFO....');
  // The hand swings from the front of the body to the back.
  const arm = [...base[13]!];
  const body = arm[5]!;
  arm[6] = body;
  arm[7] = body;
  arm[8] = 'S';
  arm[9] = 'S';
  const swing = replaceRow(replaceRow(base, 13, arm.join('')), 15, '...OFFO.OFFO....');
  return [
    { rows: base, flip, lift: 0 },
    { rows: apart, flip, lift: 1 },
    { rows: base, flip, lift: 0 },
    { rows: swing, flip, lift: 1 },
  ];
}
