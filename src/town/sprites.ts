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

// ------------------------------------------------------------------ staff
// The people who work in the shops. They stand behind a counter facing you, so only
// their front is drawn. Each is a hair or hat, the shared face, and a uniform.

const FACE = [
  '.OHHSSHHHHSSHHO.',
  '.OHSSSSSSSSSSHO.',
  '.OHSSESSSSESSHO.',
  '.OSSSESSSSESSSO.',
  '..OSPSSSSSSPSO..',
  '...OOSSssSSOO...',
];
const BODY = [
  '..OkCCCCCCCCkO..',
  '.OSOCCCcCCCCOSO.',
  '..OOcCCCCCCcOO..',
  '...OFFO..OFFO...',
];
const SHORT_HAIR = [
  '......OOOO......',
  '....OOHHHHOO....',
  '...OHHhhHHHHO...',
  '..OHHhHHHHHHHO..',
  '.OHHHHHHHHHHHHO.',
  '.OHHHHHHHHHHHHO.',
];

export interface StaffArt {
  rows: string[];
  key: Record<string, Role>;
}

const staffKey = (over: Record<string, Role>): Record<string, Role> => ({ ...KEY, ...over });

export const STAFF: Record<string, StaffArt> = {
  // ゆき at the cafe: long brown hair, a brown apron over a white shirt.
  yuki: {
    rows: [
      ...SHORT_HAIR.slice(0, 4),
      '.OHHHHHHHHhHHHO.',
      '.OHHHHHHHHHHHHO.',
      '.OHHSSHHHHSSHHO.',
      '.OHSSSSSSSSSSHO.',
      '.OHSSESSSSESSHO.',
      '.OHSSESSSSESSHO.',
      '.OHSPSSSSSSPSHO.',
      '.OHOOSSssSSOOHO.',
      '.OHkCCCCCCCCkHO.',
      '.OSOCCCcCCCCOSO.',
      '..OOcCCCCCCcOO..',
      '...OFFO..OFFO...',
    ],
    key: staffKey({ C: 'frame', c: 'doorSh', k: 'white' }),
  },
  // The konbini clerk: short black hair, a blue striped uniform.
  clerk: {
    rows: [...SHORT_HAIR, ...FACE, '..OkCCCCCCCCkO..', '.OSOCkCCkCCCOSO.', '..OOcCCCCCCcOO..', BODY[3]!],
    key: staffKey({ H: 'hairK', h: 'hairKHi', D: 'hairKSh', C: 'roofB', c: 'roofBSh', k: 'white' }),
  },
  // 森さん at the pharmacy: a black bob, glasses and a white coat.
  mori: {
    rows: [
      ...SHORT_HAIR.slice(0, 6),
      '.OHHSSHHHHSSHHO.',
      '.OHSOOOSSOOOSHO.',
      '.OHSOEOOOOEOSHO.',
      '.OHSOEOSSOEOSHO.',
      '.OHSOOOSSOOOSHO.',
      '.OHOOSSssSSOOHO.',
      '..OkCCkkkkCCkO..',
      '.OSOCCCcCCCCOSO.',
      '..OOcCCCCCCcOO..',
      BODY[3]!,
    ],
    key: staffKey({ H: 'hairK', h: 'hairKHi', D: 'hairKSh', C: 'grey', c: 'greySh', k: 'cross' }),
  },
  // 山田さん at the restaurant: a white headscarf and a navy apron.
  server: {
    rows: [
      '......OOOO......',
      '....OOWWWWOO....',
      '...OWWWWWWWWO...',
      '..OWWWWWWWWWWO..',
      '.OWWWWWWWWWWWWO.',
      '.OggggggggggggO.',
      ...FACE,
      '..OkCCCCCCCCkO..',
      '.OSOCCCcCCCCOSO.',
      '..OOcCCCCCCcOO..',
      BODY[3]!,
    ],
    key: staffKey({ H: 'hairK', h: 'hairKHi', g: 'greySh', C: 'noren', c: 'norenSh', k: 'white' }),
  },
  // The station attendant: a navy cap with a gold badge, and a navy jacket.
  ekiin: {
    rows: [
      '....OOOOOOOO....',
      '...OddddddddO...',
      '..OdddddKKdddO..',
      '..OddddddddddO..',
      '.OOOOOOOOOOOOOO.',
      '.OHHHHHHHHHHHHO.',
      ...FACE,
      '..OCkkCCCCkkCO..',
      '.OSOCCCKCCCCOSO.',
      '..OOcCCCCCCcOO..',
      BODY[3]!,
    ],
    key: staffKey({ H: 'hairK', h: 'hairKHi', d: 'navy', K: 'gold', C: 'navy', c: 'navySh', k: 'white' }),
  },
  // 小林さん at the post office: short brown hair and a red vest.
  kobayashi: {
    rows: [...SHORT_HAIR, ...FACE, '..OkkCCCCCCkkO..', '.OSOCCCcCCCCOSO.', '..OOcCCCCCCcOO..', BODY[3]!],
    key: staffKey({ C: 'postRed', c: 'postRedSh', k: 'white' }),
  },
};
