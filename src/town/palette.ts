// The town's colours, by role. One full-colour handheld palette ("style D"):
// a dark plum outline, soft shading and a few bright accents. All original.

export const PALETTE = {
  out: '#33283f', skin: '#ffdcbc', skinSh: '#f0ab86', blush: '#ff9b9b', hair: '#7a4a32', hairHi: '#b37852', hairSh: '#4a2a20',
  grey: '#ececf4', greySh: '#acaac4', top: '#f4743b', topSh: '#c4502a', topHi: '#ffa76c', top2: '#5fae6e', top2Sh: '#3d7f4f',
  pants: '#3c4f8a', shoe: '#3a2f3f', eye: '#2a2035', white: '#ffffff',
  grass: '#80c95c', grassSh: '#5ea84a', grassHi: '#aee27a', flowerA: '#ff7aa8', flowerB: '#ffd54a', flowerC: '#ffffff', petalSh: '#d84f7f',
  path: '#ead4aa', pathSh: '#c9ae84', pathHi: '#f8e9c8', dirt: '#dbb47c', dirtSh: '#b88d58',
  leaf: '#41a052', leafSh: '#2a6e3f', leafHi: '#72c962', trunk: '#8a5a3a', trunkSh: '#5e3a26',
  wall: '#fff4e0', wallSh: '#e6d2b0', wallHi: '#ffffff', wall2: '#f6e0d2', wall2Sh: '#dcbfae',
  roofA: '#e2593f', roofASh: '#a83a2e', roofAHi: '#ff8c66',
  roofB: '#4282da', roofBSh: '#2c58a0', roofBHi: '#7ab0f0',
  roofC: '#30b09b', roofCSh: '#1f7a6e', roofCHi: '#70ddc8',
  roofD: '#9a72cf', roofDSh: '#6a4aa0', roofDHi: '#c4a6f2',
  roofE: '#7d8aa6', roofESh: '#56607c', roofEHi: '#aab6cf',
  roofF: '#d9893a', roofFSh: '#a55e24', roofFHi: '#f6b36a',
  roofG: '#c9454f', roofGSh: '#8f2c38', roofGHi: '#ef7f84',
  glass: '#92d2f0', glassHi: '#e8f9ff', glassSh: '#5c9ec9', frame: '#6a4a3a', door: '#aa663e', doorSh: '#7a4428', knob: '#ffd54a',
  sign: '#fffaf0', signSh: '#dccaa6', ink: '#3a2a3a', awnA: '#ffffff', awnB: '#e2593f', stripe: '#3fae5a', stripe2: '#ffb43c', cross: '#2fae5a',
  water: '#5cb2e8', waterHi: '#cbedff', waterSh: '#3a80c0', fence: '#ffffff', fenceSh: '#c9c1d2', stone: '#d4cfca', stoneSh: '#a39a92',
  lamp: '#4a4458', lampLight: '#ffeaa2', bench: '#c67b48', benchSh: '#8a5030', planter: '#b2613f', poster: '#ffb43c',
  dark: '#4b4560', darkSh: '#36304a', closed: '#d8463a',
  mint: '#cdeee1', mintSh: '#9fd2c0', cream: '#fbe9c8', creamSh: '#e3c99a', stationWall: '#e2e6ef', stationWallSh: '#b7bfd0',
  wood: '#d0925a', woodSh: '#a9703f', woodHi: '#e8b07a', tileA: '#f6f4fa', tileB: '#e3e0ee', tatami: '#dcd590', tatamiSh: '#b8b064', tatamiEdge: '#4d6b4c',
  rug: '#e98e8e', rugSh: '#c76a72', hairK: '#3d3552', hairKHi: '#6b6288', hairKSh: '#28223a', navy: '#33446f', navySh: '#222e50', gold: '#ffcf4a',
  noren: '#33507f', norenSh: '#22375c', lantern: '#ff6a4a', lanternSh: '#c8402f', chalk: '#3e5446', postRed: '#e2413b', postRedSh: '#a52a2a',
} as const;

export type Role = keyof typeof PALETTE;

/** How much a shadowed pixel keeps of its colour. */
export const SHADOW = 0.72;

/** Colours for the crisp text and UI drawn over the pixels. */
export const UI = {
  ink: PALETTE.ink,
  box: '#ffffff',
  border: '#3f6fc8',
  rim: '#a4c8ff',
  accent: '#f4743b',
  closed: PALETTE.closed,
};
