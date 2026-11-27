// Chibi sprites, two heads tall, 16x16, for four directions with walk frames.
// Right-facing frames are the left-facing ones mirrored. All original pixel art.

import type { Role } from './palette.ts';

export const KEY: Record<string, Role> = {
  O: 'out', S: 'skin', s: 'skinSh', P: 'blush', H: 'hair', h: 'hairHi', D: 'hairSh', E: 'eye', W: 'white',
  C: 'top', c: 'topSh', k: 'topHi', B: 'pants', F: 'shoe', G: 'grey', g: 'greySh', T: 'top2', t: 'top2Sh',
  // A yukata (light blue cotton) and its sash.
  Y: 'roofBHi', y: 'roofB', N: 'navy',
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

/** The player in the ryokan's yukata: left side over right, tied with a navy sash. */
export const PLAYER_YUKATA: CharacterArt = {
  front: [...PLAYER.front.slice(0, 12), '..OYYYWSSWYYYO..', '.OSONNNNNNNNOSO.', '..OOYYYWYYYYOO..', '...OFFO..OFFO...'],
  back: [...PLAYER.back.slice(0, 12), '..OyYYYYYYYYyO..', '.OSONNNNNNNNOSO.', '..OOyYYYYYYyOO..', '...OFFO..OFFO...'],
  side: [...PLAYER.side.slice(0, 12), '....OYWYYYYO....', '....ONSSNNNO....', '....OYYYYYyO....', '....OFFOFFO.....'],
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
const HEADBAND = [
  '......OOOO......',
  '....OOHHHHOO....',
  '...OHHhhHHHHO...',
  '..OWWWWWWWWWWO..',
  '.OHHHHHHHHHHHHO.',
  '.OHHHHHHHHHHHHO.',
];
/** A festival coat (法被) over the body, with white trim. */
const HAPPI = ['..OkCCCCCCCCkO..', '.OSOCkCcCCkCOSO.', '..OOcCCCCCCcOO..', '...OFFO..OFFO...'];
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
  // 高橋さん at the shrine's charm counter in 鎌倉: black hair tied back, a white robe
  // crossed at the front, and pale blue trousers.
  takahashi: {
    rows: [
      '......OOOO......',
      '....OOHHHHOO....',
      '...OHHhhHHHHO...',
      '..OHHhHHHHHHHO..',
      '.OHHHHHHHHHHHHO.',
      '.OHHHHHHHHHHHHO.',
      ...FACE,
      '..OCCkCCCCkCCO..',
      '.OSOCCCkkCCCOSO.',
      '..OOddddddddOO..',
      '...OddO..OddO...',
    ],
    key: staffKey({ H: 'hairK', h: 'hairKHi', D: 'hairKSh', C: 'white', c: 'greySh', k: 'greySh', d: 'roofBHi' }),
  },
  // 佐藤さん at the souvenir shop: grey hair and a green apron with a pocket.
  sato: {
    rows: [...SHORT_HAIR, ...FACE, '..OkCCCCCCCCkO..', '.OSOCCkkkkCCOSO.', '..OOcCCCCCCcOO..', BODY[3]!],
    key: staffKey({ H: 'grey', h: 'white', D: 'greySh', C: 'top2', c: 'top2Sh', k: 'white' }),
  },
  // 山本 さん at the goldfish stall: a white headband over short black hair, a navy festival coat.
  yamamoto: {
    rows: [...HEADBAND, ...FACE, ...HAPPI],
    key: staffKey({ H: 'hairK', h: 'hairKHi', D: 'hairKSh', C: 'navy', c: 'navySh', k: 'white' }),
  },
  // The 女将 at the ryokan: hair up in a bun, a plum kimono with a gold sash.
  okami: {
    rows: [
      '......OOOO......',
      '.....OHHhHO.....',
      '....OOHHHHOO....',
      '..OOHHhHHHHHOO..',
      '.OHHHHHHHHHHHHO.',
      '.OHHHHHHHHHHHHO.',
      ...FACE,
      '..OCCCWSSWCCCO..',
      '.OSONNNNNNNNOSO.',
      '..OOcCCCCCCcOO..',
      BODY[3]!,
    ],
    key: staffKey({ H: 'hairK', h: 'hairKHi', D: 'hairKSh', C: 'roofD', c: 'roofDSh', N: 'gold', W: 'white' }),
  },
  // The 仲居 who looks after the rooms: black hair tied back, a green kimono and a white sash.
  nakai: {
    rows: [...SHORT_HAIR, ...FACE, '..OCCCWSSWCCCO..', '.OSONNNNNNNNOSO.', '..OOcCCCCCCcOO..', BODY[3]!],
    key: staffKey({ H: 'hairK', h: 'hairKHi', D: 'hairKSh', C: 'top2', c: 'top2Sh', N: 'white', W: 'white' }),
  },
  // 鈴木さん, soaking in the bath with a folded towel on their head. The water hides the rest.
  suzuki: {
    rows: [
      '....OOOOOOOO....',
      '...OWWWWWWWWO...',
      '...OggggggggO...',
      '..OHHHHHHHHHHO..',
      '.OHHHHHHHHHHHHO.',
      '.OHHHHHHHHHHHHO.',
      ...FACE,
      '..OSSSSSSSSSSO..',
      '.OSSSSSSSSSSSSO.',
      '..OOSSSSSSSSOO..',
      '...OSSO..OSSO...',
    ],
    key: staffKey({ H: 'greySh', h: 'grey', D: 'roofESh' }),
  },
  // The other stalls' keepers: a red coat at the takoyaki, a blue one at the shaved ice.
  takoyaki: {
    rows: [...HEADBAND, ...FACE, ...HAPPI],
    key: staffKey({ H: 'hair', h: 'hairHi', D: 'hairSh', C: 'roofA', c: 'roofASh', k: 'white' }),
  },
  kakigoori: {
    rows: [...SHORT_HAIR, ...FACE, ...HAPPI],
    key: staffKey({ H: 'trunk', h: 'hairHi', D: 'trunkSh', C: 'roofB', c: 'roofBSh', k: 'white' }),
  },
  // 中村さん at the electronics shop in 秋葉原: short black hair, the shop's blue polo and a name badge.
  nakamura: {
    rows: [...SHORT_HAIR, ...FACE, '..OkCCCCCCCCkO..', '.OSOCCCCCKKCOSO.', '..OOcCCCCCCcOO..', BODY[3]!],
    key: staffKey({ H: 'hairK', h: 'hairKHi', D: 'hairKSh', C: 'roofB', c: 'roofBSh', k: 'roofBHi', K: 'gold' }),
  },
  // はな at the maid cafe: long brown hair with a white frilled headband, a navy dress and a white apron.
  hana: {
    rows: [
      ...SHORT_HAIR.slice(0, 3),
      '..OWWWWWWWWWWO..',
      '.OHHHHHHHHhHHHO.',
      '.OHHHHHHHHHHHHO.',
      '.OHHSSHHHHSSHHO.',
      '.OHSSSSSSSSSSHO.',
      '.OHSSESSSSESSHO.',
      '.OHSSESSSSESSHO.',
      '.OHSPSSSSSSPSHO.',
      '.OHOOSSssSSOOHO.',
      '.OHCWWkkkkWWCHO.',
      '.OSOCWWWWWWCOSO.',
      '..OOcWWWWWWcOO..',
      '...OFFO..OFFO...',
    ],
    key: staffKey({ C: 'navy', c: 'navySh', k: 'flowerA', W: 'white' }),
  },
  // 加藤さん at the arcade: short brown hair, a red staff vest over a white shirt.
  kato: {
    rows: [...SHORT_HAIR, ...FACE, '..OkkCCCCCCkkO..', '.OSOCCCKCCCCOSO.', '..OOcCCCCCCcOO..', BODY[3]!],
    key: staffKey({ H: 'trunk', h: 'hairHi', D: 'trunkSh', C: 'roofG', c: 'roofGSh', k: 'white', K: 'gold' }),
  },
};

/** Passers-by: the player's and the neighbour's shapes in other clothes and hair. */
export const PASSERS: { art: CharacterArt; key: Record<string, Role> }[] = [
  { art: PLAYER, key: { ...KEY, H: 'hairK', h: 'hairKHi', D: 'hairKSh', C: 'roofB', c: 'roofBSh', k: 'roofBHi' } },
  { art: PLAYER, key: { ...KEY, H: 'trunk', h: 'hairHi', D: 'trunkSh', C: 'roofC', c: 'roofCSh', k: 'roofCHi' } },
  { art: NEIGHBOUR, key: { ...KEY, T: 'roofD', t: 'roofDSh' } },
  { art: PLAYER, key: { ...KEY, H: 'dark', h: 'lamp', D: 'darkSh', C: 'roofG', c: 'roofGSh', k: 'roofGHi' } },
  { art: NEIGHBOUR, key: { ...KEY, G: 'hair', g: 'hairSh', T: 'roofF', t: 'roofFSh' } },
];

/** A sparrow on the ground (facing left), and with its wings up. */
export const BIRD = [
  '.OO.....',
  'OhEO....',
  'yhhhOOO.',
  '.OhhhhhO',
  '..OWWhO.',
  '...O.O..',
];
export const BIRD_FLY = [
  '...O.O..',
  '.OOhOhO.',
  'OhEhhhO.',
  'yhhhhhOO',
  '.OWWWhO.',
  '..OOOO..',
];
export const BIRD_KEY: Record<string, Role> = { O: 'out', h: 'hairHi', E: 'eye', y: 'knob', W: 'white' };
