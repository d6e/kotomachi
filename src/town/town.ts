// The walkable town, and the insides of its places. The world is drawn as pixel art at
// 1x into a small canvas, scaled up by a whole number onto the visible canvas, and then
// sign lettering, furigana and the "Space ▶" hint are drawn crisply on top. You walk
// tile to tile with the arrow keys or WASD, or click or tap to walk somewhere. Walking
// into a door takes you inside; inside, you talk to the staff across the counter and
// walk back out through the door.

import type { Input } from '../engine/input.ts';
import { drawWorld, plate, SIGN_TEXT, type Lit, type SignSpot } from './art.ts';
import { drawFestival, keeperAt } from './festart.ts';
import { CAR_W, StreetLife, TRAIN_CARS, TRAIN_LEN, type Walker } from './life.ts';
import {
  BOARD, BOARD_SPOT, BUILDINGS, buildGrid, buildingFor, CAT_BENCH, DIRS, doorSpot, facingTo, festivalGrid, findPath, GROUND, isSolid, LAMPS,
  NEIGHBOUR_ROUTE, RAIL_ROW, stallAt, STALLS, stallSpot, START, STREET_ROW, TILE, VIEW_H, VIEW_W, WORLD_W,
  type DoorPlace, type Facing, type Grid, type StallId, type TilePos,
} from './map.ts';
import { PALETTE, UI, type Role } from './palette.ts';
import { Buf, roundRect, toCanvas } from './pixels.ts';
import { drawRoom } from './roomart.ts';
import { drawArea } from './tripart.ts';
import { bedSpot, bedTiles, cellAt, doorCell, doorTo, roomDoor, roomEntrance, roomFor, ROOMS, roomSolid, staffSpot, talkSpot, thingAt, thingNear, thingSpot, type RoomDef, type Scene, type ThingId } from './rooms.ts';
import { BIRD, BIRD_FLY, BIRD_KEY, KEY, NEIGHBOUR, PASSERS, PLAYER, STAFF, walkFrames, type CharacterArt } from './sprites.ts';

export type Interactable =
  | { kind: 'door'; place: DoorPlace }
  | { kind: 'npc'; id: 'tanaka' }
  | { kind: 'staff'; place: Scene }
  | { kind: 'bed' }
  | { kind: 'thing'; id: ThingId }
  /** Walking back onto the platform on a trip: the train home. */
  | { kind: 'train' }
  /** The notice board on the street. */
  | { kind: 'board' }
  /** A stall at the festival. */
  | { kind: 'stall'; id: StallId }
  /** The cat asleep on the bench. */
  | { kind: 'cat' };

/** A word in a speech bubble: its pieces with any furigana, and whether it's due for review. */
export interface SaidWord {
  parts: { text: string; rt?: string }[];
  lemma: string | null;
  due: boolean;
}

/** Something said in a speech bubble over someone's head. */
export interface Said {
  words: SaidWord[];
  en: string;
}

export type Weather = 'hare' | 'kumori' | 'ame';

export interface SignInfo {
  text: string;
  /** Furigana to draw above the sign, or null when the word's written form is known. */
  furigana: string | null;
}

export interface TownHooks {
  isOpen(place: DoorPlace): boolean;
  sign(word: string): SignInfo;
  onInteract(target: Interactable): void;
  onSignClick(word: string, clientX: number, clientY: number): void;
  /** Whether the neighbor can be talked to right now. */
  neighborAvailable(): boolean;
  /** Something else has the player's attention (a conversation, the notebook, a popup). */
  busy(): boolean;
  /** The name of whoever works at a place (an NPC id), for the hint over your head. */
  staffName(npc: string): string;
  /** What to call a usable thing in the hint over your head. */
  thingName(id: ThingId): string;
  /** A line for someone in town to say: a passer-by ('street'), the cat, or a stall's keeper ('stall:<id>'). */
  chatter(who: string): Said | null;
}

interface Bubble {
  said: Said;
  /** Seconds left on screen. */
  t: number;
  life: number;
  /** World pixels just above the speaker's head. */
  at: () => { x: number; y: number };
  /** Who's talking, so they don't talk over themselves. */
  who: string;
}

const STILL = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
/** How long a speech bubble stays up, in seconds. */
const SAY_FOR = 3.6;

export interface Actor {
  /** The tile the actor stands on (or is leaving). */
  tx: number;
  ty: number;
  /** Top-left of the actor's tile in world pixels, moving smoothly between tiles. */
  px: number;
  py: number;
  dir: Facing;
  /** Where a step is heading, while moving. */
  dest: TilePos | null;
  /** 0 to 1 through the current step. */
  t: number;
  /** Counts steps, to alternate feet. */
  steps: number;
}

/** Seconds per tile. */
const PLAYER_STEP = 0.19;
const NEIGHBOUR_STEP = 0.34;
/** A tap of a new direction only turns you; holding it this long walks. */
const TURN_HOLD = 0.08;
/** Sprites stand a little up into the tile above, so they look like they're on the ground. */
const SPRITE_LIFT = 4;
/** Seconds the screen takes to fade in after going through a door. */
const FADE = 0.28;
const FONT = '"Hiragino Maru Gothic ProN", "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", "IPAPGothic", "Meiryo", sans-serif';

const KEYS: [Facing, string[]][] = [
  ['up', ['ArrowUp', 'KeyW']],
  ['down', ['ArrowDown', 'KeyS']],
  ['left', ['ArrowLeft', 'KeyA']],
  ['right', ['ArrowRight', 'KeyD']],
];

function actorAt(p: TilePos, dir: Facing): Actor {
  return { tx: p.tx, ty: p.ty, px: p.tx * TILE, py: p.ty * TILE, dir, dest: null, t: 0, steps: 0 };
}

const same = (a: TilePos, b: TilePos) => a.tx === b.tx && a.ty === b.ty;

export class Town {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly low: HTMLCanvasElement;
  private readonly lctx: CanvasRenderingContext2D;
  private readonly hooks: TownHooks;
  private readonly baseGrid = buildGrid();
  private grid: Grid = this.baseGrid;
  private readonly life = new StreetLife(this.baseGrid);
  private weather: Weather = 'hare';
  private festival = false;
  private fest: { base: HTMLCanvasElement; front: HTMLCanvasElement; signs: SignSpot[]; lanterns: { x: number; y: number }[] } | null = null;
  private windows: Lit[] = [];
  private bubbles: Bubble[] = [];
  private bubbleRects: { lemma: string; x: number; y: number; w: number; h: number }[] = [];
  private trainImg: HTMLCanvasElement | null = null;
  private glowImg: { k: number; img: HTMLCanvasElement } | null = null;
  private umbrellas = new Map<string, HTMLCanvasElement>();
  private world: HTMLCanvasElement | null = null;
  private signs: SignSpot[] = [];
  private plates = new Map<string, { img: HTMLCanvasElement; w: number; h: number }>();
  private plateRects: { word: string; x: number; y: number; w: number; h: number }[] = [];
  private sprites = new Map<string, HTMLCanvasElement>();
  private rooms = new Map<Scene, { base: HTMLCanvasElement; front: HTMLCanvasElement; signs: SignSpot[] }>();
  /** The place you're inside (or on a trip), or null on the street. */
  scene: Scene | null = null;
  private fade = 0;
  private shadowImg: HTMLCanvasElement | null = null;
  /** Whole-number zoom from world pixels to canvas pixels. */
  private k = 3;
  private camX = 0;

  readonly player: Actor = actorAt(START, 'down');
  readonly neighbor: Actor & { goal: number; wait: number } = {
    ...actorAt({ tx: NEIGHBOUR_ROUTE.start, ty: NEIGHBOUR_ROUTE.ty }, 'right'),
    goal: NEIGHBOUR_ROUTE.to,
    wait: 1,
  };
  private path: TilePos[] = [];
  private then: Interactable | null = null;
  private retries = 0;
  private waitPath = 0;
  private turnHold = 0;
  private justStepped = false;
  private minutes = 8 * 60;
  private time = 0;

  constructor(canvas: HTMLCanvasElement, hooks: TownHooks) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.low = document.createElement('canvas');
    this.low.width = VIEW_W;
    this.low.height = VIEW_H;
    this.lctx = this.low.getContext('2d')!;
    this.hooks = hooks;
    this.resize();
    canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
  }

  /** Whether the town ignores input right now. Asked live, so a click right after a popup closes still counts. */
  get paused(): boolean {
    return this.hooks.busy();
  }

  setMinutes(m: number): void {
    this.minutes = m;
  }

  /** Today's weather, and whether the festival is on (its stalls stand in the park). */
  setDay(d: { weather: Weather; festival: boolean }): void {
    this.weather = d.weather;
    if (d.festival !== this.festival) {
      this.festival = d.festival;
      this.grid = d.festival ? festivalGrid(this.baseGrid) : this.baseGrid;
      this.life.setGrid(this.grid);
    }
    this.life.reset();
    this.bubbles = [];
  }

  get today(): { weather: Weather; festival: boolean } {
    return { weather: this.weather, festival: this.festival };
  }

  private get still(): boolean {
    return !!STILL?.matches;
  }

  /** Signs change as furigana fade; they're redrawn every frame, so nothing to rebuild. */
  invalidate(): void {}

  /** A new day starts at home, by the bed. */
  resetPlayer(): void {
    this.scene = 'home';
    Object.assign(this.player, actorAt(ROOMS.home.start ?? roomEntrance(ROOMS.home), 'down'));
    this.path = [];
    this.then = null;
    this.fade = FADE;
  }

  /** Your room, with whatever you've bought in it. */
  private home: RoomDef = ROOMS.home;

  setHome(room: RoomDef): void {
    this.home = room;
    this.rooms.delete('home');
  }

  private def(place: Scene): RoomDef {
    return place === 'home' ? this.home : roomFor(place);
  }

  private get room(): RoomDef | null {
    return this.scene ? this.def(this.scene) : null;
  }

  /** Go inside a place, just inside its door (or somewhere else in it). */
  enter(place: Scene, at?: TilePos, dir: Facing = 'up'): void {
    this.scene = place;
    Object.assign(this.player, actorAt(at ?? roomEntrance(this.def(place)), dir));
    this.path = [];
    this.then = null;
    this.fade = FADE;
  }

  /** Walk out onto the street, in front of the door. */
  leave(): void {
    const place = this.scene;
    if (!place) return;
    const exit = this.def(place).exit;
    if (exit === 'train') {
      // Back to the platform: the game takes you home by train.
      this.path = [];
      this.then = null;
      this.hooks.onInteract({ kind: 'train' });
      return;
    }
    if (exit) {
      // Out of a trip place, onto the path in front of its door.
      const d = doorCell(this.def(exit), place as Exclude<Scene, DoorPlace>);
      this.enter(exit, d ? { tx: d.tx, ty: d.ty + 1 } : undefined, 'down');
      return;
    }
    this.scene = null;
    Object.assign(this.player, actorAt(doorSpot(buildingFor(place as DoorPlace))!, 'down'));
    this.path = [];
    this.then = null;
    this.fade = FADE;
  }

  /** Stand at the counter inside a place (by the bed at home), or next to the neighbour (play-test helper). */
  debugGoTo(place: Scene | 'tanaka'): void {
    this.path = [];
    this.then = null;
    if (place !== 'tanaka') {
      this.enter(place);
      const room = this.def(place);
      Object.assign(this.player, actorAt(talkSpot(room) ?? bedSpot(room) ?? roomEntrance(room), 'up'));
      this.fade = 0;
      return;
    }
    this.scene = null;
    const n = this.neighbourTile();
    for (const d of Object.values(DIRS)) {
      const p = { tx: n.tx + d.dx, ty: n.ty + d.dy };
      if (!isSolid(this.grid, p.tx, p.ty)) {
        Object.assign(this.player, actorAt(p, facingTo(p, n)));
        return;
      }
    }
  }

  // ---------------------------------------------------------------- helpers

  private tileOf(a: Actor): TilePos {
    return { tx: a.tx, ty: a.ty };
  }

  /** The neighbour's tile, or where they're stepping to. */
  private neighbourTile(): TilePos {
    return this.neighbor.dest ?? this.tileOf(this.neighbor);
  }

  private neighbourOn(p: TilePos): boolean {
    if (!this.hooks.neighborAvailable()) return false;
    return same(this.tileOf(this.neighbor), p) || (this.neighbor.dest !== null && same(this.neighbor.dest, p));
  }

  private playerOn(p: TilePos): boolean {
    return same(this.tileOf(this.player), p) || (this.player.dest !== null && same(this.player.dest, p));
  }

  private blockedForPlayer = (tx: number, ty: number): boolean => {
    const room = this.room;
    if (room) return roomSolid(room, tx, ty);
    return isSolid(this.grid, tx, ty) || this.neighbourOn({ tx, ty });
  };

  /** Stand anywhere on the street, facing some way (play-test helper). */
  debugStreet(tx: number, ty: number, dir: Facing): void {
    this.scene = null;
    this.path = [];
    this.then = null;
    this.fade = 0;
    Object.assign(this.player, actorAt({ tx, ty }, dir));
  }

  /** Stand in front of a door on the street (play-test helper). */
  debugTownDoor(place: DoorPlace): void {
    this.scene = null;
    this.path = [];
    this.then = null;
    this.fade = 0;
    Object.assign(this.player, actorAt(doorSpot(buildingFor(place))!, 'up'));
  }

  private doorAt(p: TilePos): DoorPlace | null {
    if (this.scene) return null;
    for (const b of BUILDINGS) {
      const s = doorSpot(b);
      if (s && same(s, p)) return b.door!.place;
    }
    return null;
  }

  private ahead(a: Actor): TilePos {
    const d = DIRS[a.dir];
    return { tx: a.tx + d.dx, ty: a.ty + d.dy };
  }

  /** What the player could interact with from where they stand. */
  nearby(): Interactable | null {
    if (this.player.dest) return null;
    const me = this.tileOf(this.player);
    const room = this.room;
    if (room) {
      const talk = talkSpot(room);
      if (talk && same(talk, me)) return { kind: 'staff', place: room.place };
      if (bedTiles(room).some((b) => Math.abs(b.tx - me.tx) + Math.abs(b.ty - me.ty) === 1)) return { kind: 'bed' };
      const thing = thingNear(room, me);
      if (thing) return { kind: 'thing', id: thing };
      return null;
    }
    const ahead = this.ahead(this.player);
    if (this.neighbourOn(ahead)) return { kind: 'npc', id: 'tanaka' };
    const door = this.doorAt(me);
    if (door) return { kind: 'door', place: door };
    if (same(me, BOARD_SPOT)) return { kind: 'board' };
    const stall = this.festival ? stallAt(ahead.tx, ahead.ty) : null;
    if (stall) return { kind: 'stall', id: stall.id };
    if (same(ahead, CAT_BENCH)) return { kind: 'cat' };
    if (this.hooks.neighborAvailable() && !this.neighbor.dest) {
      const n = this.tileOf(this.neighbor);
      if (Math.abs(n.tx - me.tx) + Math.abs(n.ty - me.ty) === 1) return { kind: 'npc', id: 'tanaka' };
    }
    return null;
  }

  private interact(target: Interactable): void {
    this.path = [];
    this.then = null;
    if (target.kind === 'npc') {
      const n = this.tileOf(this.neighbor);
      this.player.dir = facingTo(this.tileOf(this.player), n);
      this.neighbor.dir = facingTo(n, this.tileOf(this.player));
    } else if (target.kind === 'bed') {
      const me = this.tileOf(this.player);
      const b = bedTiles(this.room!).find((t) => Math.abs(t.tx - me.tx) + Math.abs(t.ty - me.ty) === 1);
      if (b) this.player.dir = facingTo(me, b);
    } else if (target.kind === 'thing') {
      const me = this.tileOf(this.player);
      const room = this.room!;
      for (const d of Object.values(DIRS)) {
        if (thingAt(room, me.tx + d.dx, me.ty + d.dy) === target.id) this.player.dir = facingTo(me, { tx: me.tx + d.dx, ty: me.ty + d.dy });
      }
    } else if (target.kind === 'cat') {
      this.player.dir = facingTo(this.tileOf(this.player), CAT_BENCH);
      this.say('cat', () => ({ x: CAT_BENCH.tx * TILE + 8, y: CAT_BENCH.ty * TILE - 8 }));
      return;
    } else this.player.dir = 'up';
    if (target.kind === 'stall' && target.id !== 'kingyo') {
      // The other stalls just call out to you.
      const s = STALLS.find((x) => x.id === target.id)!;
      const k = keeperAt(s);
      this.say(`stall:${s.id}`, () => ({ x: k.x + 8, y: k.y - 6 }));
      return;
    }
    this.hooks.onInteract(target);
  }

  /** Put up a speech bubble over someone, if they have something to say. */
  private say(who: string, at: () => { x: number; y: number }, line?: Said | null): boolean {
    const said = line ?? this.hooks.chatter(who.startsWith('passer:') ? 'street' : who);
    if (!said) return false;
    this.bubbles = this.bubbles.filter((b) => b.who !== who && !(who.startsWith('passer:') && b.who.startsWith('passer:')));
    this.bubbles.push({ said, t: SAY_FOR, life: SAY_FOR, at, who });
    if (this.bubbles.length > 2) this.bubbles.shift();
    return true;
  }

  private passerSays(a: Walker): void {
    if (this.say(`passer:${a.id}`, () => ({ x: a.px + 8, y: a.py - SPRITE_LIFT - 2 }))) this.life.stopFor(a, this.tileOf(this.player), 2.2);
    else a.talked = true;
  }

  // ---------------------------------------------------------------- input

  private toWorld(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * VIEW_W + this.camX, y: ((e.clientY - r.top) / r.height) * VIEW_H };
  }

  private onPointer(e: PointerEvent): void {
    if (this.paused) return;
    const p = this.toWorld(e);
    const hit = (s: { x: number; y: number; w: number; h: number }, above = 0) =>
      p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y - above && p.y <= s.y + s.h;
    if (this.room) {
      this.onRoomPointer(p, e, hit);
      return;
    }
    // A word in someone's speech bubble looks it up.
    for (const r of this.bubbleRects) {
      if (hit(r, 2)) {
        this.hooks.onSignClick(r.lemma, e.clientX, e.clientY);
        return;
      }
    }
    for (const s of [...this.signs, ...(this.festival && this.fest ? this.fest.signs : [])]) {
      if (hit(s, 10)) {
        this.hooks.onSignClick(s.word, e.clientX, e.clientY);
        return;
      }
    }
    for (const s of this.plateRects) {
      if (hit(s)) {
        this.hooks.onSignClick(s.word, e.clientX, e.clientY);
        return;
      }
    }
    // Clicking the neighbour walks up to them and says hello.
    const n = this.neighbor;
    if (this.hooks.neighborAvailable() && p.x >= n.px - 2 && p.x <= n.px + TILE + 2 && p.y >= n.py - SPRITE_LIFT - 2 && p.y <= n.py + TILE) {
      this.retries = 0;
      this.goTalk();
      return;
    }
    // Tapping a passer-by: they say something.
    for (const a of this.life.passers) {
      if (p.x >= a.px - 1 && p.x <= a.px + TILE + 1 && p.y >= a.py - SPRITE_LIFT - 2 && p.y <= a.py + TILE) {
        this.life.stopFor(a, this.tileOf(this.player), 2.2);
        this.say(`passer:${a.id}`, () => ({ x: a.px + 8, y: a.py - SPRITE_LIFT - 2 }));
        return;
      }
    }
    // The cat on the bench: walk over and look.
    const cat = { x: CAT_BENCH.tx * TILE, y: CAT_BENCH.ty * TILE - 8, w: TILE, h: TILE + 4 };
    if (hit(cat)) {
      this.walkBeside(CAT_BENCH, { kind: 'cat' });
      return;
    }
    // A festival stall: walk up to its counter.
    if (this.festival) {
      const st = stallAt(Math.floor(p.x / TILE), Math.floor((p.y + SPRITE_LIFT) / TILE)) ?? stallAt(Math.floor(p.x / TILE), Math.floor((p.y + 20) / TILE));
      if (st) {
        this.walkTo(stallSpot(st), { kind: 'stall', id: st.id });
        return;
      }
    }
    // The notice board, in the gap by the apartment.
    if (p.y < GROUND && p.y > GROUND - 30 && Math.floor(p.x / TILE) === BOARD.tx) {
      this.walkTo(BOARD_SPOT, { kind: 'board' });
      return;
    }
    // Clicking a building walks to its door and goes in.
    if (p.y < GROUND) {
      const b = BUILDINGS.find((bd) => p.x >= bd.x && p.x < bd.x + bd.w);
      if (b?.door) {
        this.walkTo(doorSpot(b)!, { kind: 'door', place: b.door.place });
        return;
      }
      this.walkTo({ tx: Math.floor(p.x / TILE), ty: STREET_ROW });
      return;
    }
    this.walkTo({ tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE) });
  }

  private onRoomPointer(p: { x: number; y: number }, e: PointerEvent, hit: (s: { x: number; y: number; w: number; h: number }, above?: number) => boolean): void {
    const room = this.room!;
    for (const s of this.roomArt(room.place).signs) {
      if (hit(s, 10)) {
        this.hooks.onSignClick(s.word, e.clientX, e.clientY);
        return;
      }
    }
    // Staff sprites stand up into the tile above theirs, so count a tap a little higher.
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor((p.y + SPRITE_LIFT) / TILE);
    const at = cellAt(room, tx, Math.floor(p.y / TILE));
    const staff = staffSpot(room);
    const onStaff = staff && Math.abs(tx - staff.tx) <= 1 && (ty === staff.ty || ty === staff.ty + 1) && (at === 'S' || at === '=' || at === 'm' || at === 'h');
    if (staff && onStaff) {
      this.walkTo(talkSpot(room)!, { kind: 'staff', place: room.place });
      return;
    }
    if (at === 'b') {
      const spot = bedSpot(room);
      if (spot) this.walkTo(spot, { kind: 'bed' });
      return;
    }
    const thing = thingAt(room, tx, Math.floor(p.y / TILE)) ?? thingAt(room, tx, ty);
    if (thing) {
      const spot = thingSpot(room, thing);
      if (spot) this.walkTo(spot, { kind: 'thing', id: thing });
      return;
    }
    // On a trip, tapping a building walks to its door, which goes in.
    if (room.doors && at === '#') {
      const ty0 = Math.floor(p.y / TILE);
      let best: TilePos | null = null;
      for (const d of room.doors) {
        const c = doorCell(room, d.to);
        if (c && c.ty >= ty0 && (!best || Math.abs(c.tx - tx) < Math.abs(best.tx - tx))) best = c;
      }
      if (best) {
        this.walkTo(best);
        return;
      }
    }
    // The door, or the wall either side of it, walks out.
    const door = roomDoor(room);
    if (Math.floor(p.y / TILE) >= door.ty && Math.abs(tx - door.tx) <= 1) {
      this.walkTo(door);
      return;
    }
    this.walkTo({ tx, ty: Math.floor(p.y / TILE) });
  }

  private walkTo(target: TilePos, then: Interactable | null = null): boolean {
    const path = findPath(this.blockedForPlayer, this.player.dest ?? this.tileOf(this.player), target);
    if (!path) return false;
    this.path = path;
    this.then = then;
    this.waitPath = 0;
    return true;
  }

  private goTalk(): void {
    const n = this.neighbourTile();
    const me = this.player.dest ?? this.tileOf(this.player);
    let best: TilePos[] | null = null;
    for (const d of Object.values(DIRS)) {
      const spot = { tx: n.tx + d.dx, ty: n.ty + d.dy };
      const path = same(spot, me) ? [] : findPath(this.blockedForPlayer, me, spot);
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) return;
    this.path = best;
    this.then = { kind: 'npc', id: 'tanaka' };
  }

  /** Walk to the nearest free tile next to something, then use it. */
  private walkBeside(t: TilePos, then: Interactable): void {
    const me = this.player.dest ?? this.tileOf(this.player);
    let best: TilePos[] | null = null;
    for (const d of Object.values(DIRS)) {
      const spot = { tx: t.tx + d.dx, ty: t.ty + d.dy };
      const path = same(spot, me) ? [] : findPath(this.blockedForPlayer, me, spot);
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) return;
    this.path = best;
    this.then = then;
    if (!best.length) this.arrive();
  }

  // ---------------------------------------------------------------- movement

  private startStep(a: Actor, to: TilePos): void {
    a.dir = facingTo(this.tileOf(a), to);
    a.dest = to;
    a.t = 0;
    a.steps++;
  }

  /** Advance a step; returns world pixels moved. */
  private advance(a: Actor, dt: number, stepTime: number): number {
    if (!a.dest) return 0;
    a.t = Math.min(1, a.t + dt / stepTime);
    const ox = a.px;
    const oy = a.py;
    a.px = (a.tx + (a.dest.tx - a.tx) * a.t) * TILE;
    a.py = (a.ty + (a.dest.ty - a.ty) * a.t) * TILE;
    if (a.t >= 1) {
      a.tx = a.dest.tx;
      a.ty = a.dest.ty;
      a.dest = null;
    }
    return Math.abs(a.px - ox) + Math.abs(a.py - oy);
  }

  /** Try to walk one tile; bumping into a door goes in. */
  private tryStep(dir: Facing): void {
    const p = this.player;
    p.dir = dir;
    const to = this.ahead(p);
    if (dir === 'up') {
      const door = this.doorAt(this.tileOf(p));
      if (door) {
        this.interact({ kind: 'door', place: door });
        return;
      }
      if (!this.scene && same(this.tileOf(p), BOARD_SPOT)) {
        this.interact({ kind: 'board' });
        return;
      }
    }
    if (this.blockedForPlayer(to.tx, to.ty)) return;
    this.startStep(p, to);
  }

  update(dt: number, input: Input): { walked: number } {
    this.time += dt;
    if (this.paused) return { walked: 0 };
    this.updateLife(dt);
    const p = this.player;
    let walked = 0;

    // A key pressed and let go between two frames still counts as a tap.
    const keyDir = KEYS.find(([, codes]) => codes.some((c) => input.down(c) || input.pressed(c)))?.[0] ?? null;
    if (keyDir) {
      this.path = [];
      this.then = null;
    }

    if (!p.dest && (input.pressed('Space') || input.pressed('Enter') || input.pressed('KeyE'))) {
      const near = this.nearby();
      if (near) {
        this.interact(near);
        return { walked: 0 };
      }
    }

    // Finish the current step, then maybe start the next in the same frame, so walking
    // a long way doesn't stutter at each tile.
    let left = dt;
    for (let guard = 0; guard < 3 && left > 0; guard++) {
      if (p.dest) {
        const before = p.t;
        walked += this.advance(p, left, PLAYER_STEP);
        left -= (p.t - before) * PLAYER_STEP;
        if (p.dest) break;
        this.justStepped = true;
        if (this.room && same(this.tileOf(p), roomDoor(this.room))) {
          this.leave();
          return { walked };
        }
        const into = this.room ? doorTo(this.room, p.tx, p.ty) : null;
        if (into) {
          this.enter(into);
          return { walked };
        }
        continue;
      }
      if (keyDir) {
        if (keyDir !== p.dir && !this.justStepped) {
          p.dir = keyDir;
          this.turnHold = TURN_HOLD;
          break;
        }
        if (this.turnHold > 0) {
          this.turnHold -= left;
          break;
        }
        this.tryStep(keyDir);
        if (!p.dest) break;
      } else if (this.path.length) {
        // The neighbour keeps walking: aim for where they are now.
        const end = this.path[this.path.length - 1]!;
        const n = this.neighbourTile();
        if (this.then?.kind === 'npc' && Math.abs(end.tx - n.tx) + Math.abs(end.ty - n.ty) !== 1) this.goTalk();
        const next = this.path[0];
        if (!next) continue;
        if (this.blockedForPlayer(next.tx, next.ty)) {
          // The neighbour wandered into the way: find another way round, or wait a moment.
          this.waitPath += left;
          if (!this.walkTo(this.path[this.path.length - 1]!, this.then) && this.waitPath > 1.5) this.path = [];
          break;
        }
        this.path.shift();
        this.startStep(p, next);
      } else {
        this.arrive();
        break;
      }
    }
    if (!keyDir) this.turnHold = 0;
    if (!p.dest && !keyDir) this.justStepped = false;
    if (keyDir && !p.dest) this.justStepped = false;

    if (!this.scene) this.updateNeighbour(dt);
    return { walked };
  }

  /** The street goes on around you: passers-by, birds, trains, and whoever's talking. */
  private updateLife(dt: number): void {
    for (const b of this.bubbles) b.t -= dt;
    this.bubbles = this.bubbles.filter((b) => b.t > 0);
    if (this.scene) return;
    const me = this.player.dest ?? this.tileOf(this.player);
    this.life.update(dt, {
      player: me,
      neighbour: this.hooks.neighborAvailable() ? this.neighbourTile() : null,
      minutes: this.minutes,
      rain: this.weather === 'ame',
      festival: this.festival,
      still: this.still,
    });
    // Someone passing close by says something (one at a time).
    if (!this.bubbles.some((b) => b.who.startsWith('passer:'))) {
      const a = this.life.passers.find((w) => !w.talked && !w.dest && Math.abs(w.tx - me.tx) <= 2 && Math.abs(w.ty - me.ty) <= 1 && w.tx >= 0 && w.tx < WORLD_W / TILE);
      if (a) this.passerSays(a);
    }
  }

  private arrive(): void {
    const then = this.then;
    if (!then) return;
    this.then = null;
    if (then.kind === 'cat') {
      this.player.dir = facingTo(this.tileOf(this.player), CAT_BENCH);
      this.interact(then);
      return;
    }
    if (then.kind === 'stall' || then.kind === 'board') {
      this.player.dir = 'up';
      const near = this.nearby();
      if (near?.kind === then.kind) this.interact(near);
      return;
    }
    if (then.kind === 'staff' || then.kind === 'bed' || then.kind === 'thing') {
      const near = this.nearby();
      if (near?.kind === then.kind) this.interact(near);
      return;
    }
    if (then.kind === 'door') {
      if (this.doorAt(this.tileOf(this.player)) === then.place) this.interact(then);
      return;
    }
    const near = this.nearby();
    if (near?.kind === 'npc') {
      this.retries = 0;
      this.interact(near);
    } else if (this.retries++ < 4) this.goTalk();
  }

  private updateNeighbour(dt: number): void {
    const n = this.neighbor;
    if (!this.hooks.neighborAvailable()) return;
    this.advance(n, dt, NEIGHBOUR_STEP);
    if (n.dest) return;
    const me = this.tileOf(this.player);
    const here = this.tileOf(n);
    // Stop and face the player when they come close.
    if (Math.abs(me.tx - here.tx) + Math.abs(me.ty - here.ty) <= 2) {
      n.dir = facingTo(here, me);
      return;
    }
    if (n.wait > 0) {
      n.wait -= dt;
      return;
    }
    if (here.tx === n.goal) {
      n.goal = n.goal === NEIGHBOUR_ROUTE.to ? NEIGHBOUR_ROUTE.from : NEIGHBOUR_ROUTE.to;
      n.wait = 2 + Math.random() * 3;
      n.dir = 'down';
      return;
    }
    const to = { tx: here.tx + Math.sign(n.goal - here.tx), ty: here.ty };
    if (isSolid(this.grid, to.tx, to.ty) || this.playerOn(to)) {
      n.wait = 0.5;
      return;
    }
    this.startStep(n, to);
  }

  // ---------------------------------------------------------------- drawing

  /** Pick a whole-number zoom that fills the canvas's on-screen size. */
  private resize(): void {
    const css = this.canvas.clientWidth || VIEW_W * 3;
    const dpr = globalThis.devicePixelRatio || 1;
    const k = Math.max(1, Math.round((css * dpr) / VIEW_W));
    if (k !== this.k || this.canvas.width !== VIEW_W * k) {
      this.k = k;
      this.canvas.width = VIEW_W * k;
      this.canvas.height = VIEW_H * k;
    }
  }

  private font(px: number): string {
    return `bold ${Math.round(px * this.k)}px ${FONT}`;
  }

  private measure = (text: string, px = SIGN_TEXT): number => {
    const g = this.lctx;
    g.font = `bold ${px * 8}px ${FONT}`;
    return g.measureText(text).width / 8;
  };

  private buildWorld(): void {
    const w = drawWorld((t) => this.measure(t));
    this.world = toCanvas(w.buf);
    this.signs = w.signs;
    this.windows = w.windows;
  }

  private festArt(): NonNullable<Town['fest']> {
    if (!this.fest) {
      const f = drawFestival((t) => this.measure(t));
      this.fest = { base: toCanvas(f.base), front: toCanvas(f.front), signs: f.signs, lanterns: f.lanterns };
    }
    return this.fest;
  }

  private sprite(name: string, art: CharacterArt, a: Actor, skin: Record<string, Role> = KEY): { img: HTMLCanvasElement; lift: number } {
    // Show a stepping frame through the first half of each step, alternating feet.
    const frame = a.dest && a.t < 0.55 ? (a.steps % 2 ? 1 : 3) : 0;
    const key = `${name}:${a.dir}:${frame}`;
    const f = walkFrames(art, a.dir)[frame]!;
    let img = this.sprites.get(key);
    if (!img) {
      const b = new Buf(16, 16);
      b.sprite(f.rows, 0, 0, skin, f.flip);
      img = toCanvas(b);
      this.sprites.set(key, img);
    }
    return { img, lift: f.lift };
  }

  private shadow(): HTMLCanvasElement {
    if (!this.shadowImg) {
      const b = new Buf(14, 5);
      b.ellipseShadow(7, 2.5, 6, 1.9);
      this.shadowImg = toCanvas(b);
    }
    return this.shadowImg;
  }

  private plateFor(word: string): { img: HTMLCanvasElement; w: number; h: number } {
    let p = this.plates.get(word);
    if (!p) {
      const made = plate(this.measure(word, 7));
      p = { img: toCanvas(made.buf), w: made.w, h: made.h };
      this.plates.set(word, p);
    }
    return p;
  }

  private roomArt(place: Scene): { base: HTMLCanvasElement; front: HTMLCanvasElement; signs: SignSpot[] } {
    let r = this.rooms.get(place);
    if (!r) {
      const def = this.def(place);
      const art = (def.outdoor ? drawArea : drawRoom)(def, (t) => this.measure(t));
      r = { base: toCanvas(art.base), front: toCanvas(art.front), signs: art.signs };
      this.rooms.set(place, r);
    }
    return r;
  }

  private staffSprite(npc: string): HTMLCanvasElement | null {
    const art = STAFF[npc];
    if (!art) return null;
    const key = `staff:${npc}`;
    let img = this.sprites.get(key);
    if (!img) {
      const b = new Buf(16, 16);
      b.sprite(art.rows, 0, 0, art.key);
      img = toCanvas(b);
      this.sprites.set(key, img);
    }
    return img;
  }

  render(dt = 0): void {
    this.resize();
    this.fade = Math.max(0, this.fade - dt);
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    // The shake moves the whole canvas a few screen pixels, signs and all.
    const [sx, sy] = this.shakeOffset();
    const shook = sx || sy ? `translate(${sx * 2}px, ${sy * 2}px)` : '';
    if (this.canvas.style.transform !== shook) this.canvas.style.transform = shook;
    if (this.room) {
      this.renderRoom(this.room);
      return;
    }
    if (!this.world) this.buildWorld();
    const g = this.lctx;
    const k = this.k;
    const p = this.player;
    this.camX = Math.round(Math.max(0, Math.min(WORLD_W - VIEW_W, p.px + TILE / 2 - VIEW_W / 2)));
    const cam = this.camX;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.world!, -cam, 0);

    // Closed plates on shop doors.
    const plates: { text: string; x: number; y: number; w: number; h: number }[] = [];
    this.plateRects = [];
    for (const b of BUILDINGS) {
      if (!b.door || b.door.place === 'home' || this.hooks.isOpen(b.door.place)) continue;
      const word = '準備中';
      const pl = this.plateFor(word);
      const x = b.door.tx * TILE + TILE / 2 - Math.floor(pl.w / 2);
      const y = 54;
      g.drawImage(pl.img, x - cam, y);
      plates.push({ text: this.hooks.sign(word).text, x, y: y + 2, w: pl.w, h: pl.h });
      this.plateRects.push({ word, x, y: y + 2, w: pl.w, h: pl.h });
    }

    // The festival's stalls, with their keepers behind the counters.
    const fest = this.festival ? this.festArt() : null;
    if (fest) {
      g.drawImage(fest.base, -cam, 0);
      for (const st of STALLS) {
        const img = this.staffSprite(st.id === 'kingyo' ? 'yamamoto' : st.id);
        const at = keeperAt(st);
        const bob = Math.sin(this.time * 2.1 + st.tx) > 0.9 && !this.still ? 1 : 0;
        if (img) g.drawImage(img, at.x - cam, at.y - SPRITE_LIFT - bob);
      }
      g.drawImage(fest.front, -cam, 0);
    }
    this.drawTrain(cam);
    this.drawBirds(cam);
    this.drawCatZ(cam);

    // Actors, back to front.
    const rain = this.weather === 'ame';
    const actors: [string, CharacterArt, Actor, Record<string, Role>, Role][] = [['player', PLAYER, p, KEY, 'top']];
    if (this.hooks.neighborAvailable()) actors.push(['tanaka', NEIGHBOUR, this.neighbor, KEY, 'roofC']);
    for (const w of this.life.passers) {
      const look = PASSERS[w.look]!;
      actors.push([`passer${w.look}`, look.art, w, look.key, (['roofB', 'flowerB', 'roofD', 'roofG', 'top2'] as Role[])[w.look]!]);
    }
    actors.sort((a, b) => a[2].py - b[2].py);
    for (const [name, art, a, skin, brolly] of actors) {
      const x = Math.round(a.px) - cam;
      if (x < -TILE || x > VIEW_W) continue;
      const y = Math.round(a.py);
      g.drawImage(this.shadow(), x + 1, y + 10);
      const s = this.sprite(name, art, a, skin);
      g.drawImage(s.img, x, y - SPRITE_LIFT - s.lift);
      if (rain) g.drawImage(this.umbrella(brolly), x - 2, y - SPRITE_LIFT - s.lift - 7);
    }
    if (rain) this.drawRain(g);

    // Scale up, then letter the signs crisply on top.
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.low, 0, 0, VIEW_W * k, VIEW_H * k);
    this.letterSigns(this.signs, cam);
    if (fest) this.letterSigns(fest.signs, cam);
    for (const pl of plates) {
      c.font = this.font(7);
      c.fillStyle = UI.closed;
      c.fillText(pl.text, (pl.x + pl.w / 2 - cam) * k, (pl.y + pl.h / 2 + 0.5) * k);
    }

    this.tint();
    this.lights(cam);
    this.drawBubbles(cam);
    this.hint(cam);
    this.drawFade();
  }

  // ---------------------------------------------------------------- the street's life

  private drawTrain(cam: number): void {
    const t = this.life.train;
    if (!t) return;
    if (!this.trainImg) {
      const b = new Buf(TRAIN_LEN, 18);
      for (let i = 0; i < TRAIN_CARS; i++) {
        const x0 = i * (CAR_W + 2);
        const front = i === 0 || i === TRAIN_CARS - 1;
        b.shape(x0, 0, CAR_W, 15, roundRect(CAR_W, 15, front ? 4 : 2), (_x, y) => (y >= 9 && y <= 10 ? 'white' : y > 10 ? 'roofBSh' : y < 2 ? 'roofBHi' : 'roofB'));
        for (let wx = x0 + 5; wx + 6 < x0 + CAR_W - 3; wx += 9) {
          b.box(wx, 3, 6, 5, 'glass');
          b.set(wx + 1, 4, 'glassHi');
        }
        b.rect(x0 + 4, 15, 4, 2, 'out');
        b.rect(x0 + CAR_W - 8, 15, 4, 2, 'out');
        if (i < TRAIN_CARS - 1) b.rect(x0 + CAR_W, 6, 2, 5, 'dark');
      }
      this.trainImg = toCanvas(b);
    }
    const x = Math.round(t.x) - cam;
    if (x > VIEW_W || x + TRAIN_LEN < 0) return;
    this.lctx.drawImage(this.trainImg, x, RAIL_ROW * TILE - 3);
  }

  private birdImgs: HTMLCanvasElement[] = [];

  private drawBirds(cam: number): void {
    if (!this.birdImgs.length) {
      for (const rows of [BIRD, BIRD_FLY]) for (const flip of [false, true]) {
        const b = new Buf(8, 6);
        b.sprite(rows, 0, 0, BIRD_KEY, flip);
        this.birdImgs.push(toCanvas(b));
      }
    }
    for (const b of this.life.birds) {
      if (b.state === 'gone') continue;
      const fly = b.state === 'fly' ? 2 : 0;
      const flap = b.state === 'fly' && Math.floor(this.time * 10) % 2 ? 0 : fly;
      const img = this.birdImgs[flap + (b.flip ? 1 : 0)]!;
      const x = Math.round(b.x) - cam - 4;
      if (x < -8 || x > VIEW_W) continue;
      const y = Math.round(b.y - b.hop) - 6;
      if (b.state === 'sit') this.lctx.fillStyle = 'rgba(30,20,40,0.18)', this.lctx.fillRect(x + 2, Math.round(b.y), 4, 1);
      this.lctx.drawImage(img, x, y);
    }
  }

  /** Little z's rising off the cat asleep on the bench. */
  private drawCatZ(cam: number): void {
    const g = this.lctx;
    const x0 = CAT_BENCH.tx * TILE + 11 - cam;
    const y0 = CAT_BENCH.ty * TILE - 9;
    if (x0 < -10 || x0 > VIEW_W) return;
    g.fillStyle = UI.ink;
    const z = (x: number, y: number, a: number) => {
      g.globalAlpha = a;
      g.fillRect(x, y, 4, 1);
      g.fillRect(x + 2, y + 1, 1, 1);
      g.fillRect(x + 1, y + 2, 1, 1);
      g.fillRect(x, y + 3, 4, 1);
    };
    if (this.still) z(x0, y0 - 4, 0.8);
    else
      for (const off of [0, 1.2]) {
        const t = ((this.time + off) % 2.4) / 2.4;
        z(Math.round(x0 + t * 5), Math.round(y0 - t * 10), t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8);
      }
    g.globalAlpha = 1;
  }

  private drawRain(g: CanvasRenderingContext2D): void {
    const t = this.still ? 0 : this.time;
    g.fillStyle = 'rgba(214,230,255,0.7)';
    for (let i = 0; i < 70; i++) {
      const sx = (i * 97) % (VIEW_W + 40);
      const sy = (i * 53) % VIEW_H;
      const y = ((sy + t * 210) % (VIEW_H + 12)) - 6;
      const x = ((sx - t * 35 - (y * 0.15)) % (VIEW_W + 40) + VIEW_W + 40) % (VIEW_W + 40) - 20;
      g.fillRect(Math.round(x), Math.round(y), 1, 4);
    }
    // Splashes on the ground.
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 12; i++) {
      const phase = this.still ? 0.5 : (t * 1.7 + i * 0.37) % 1;
      if (phase > 0.4) continue;
      const x = (i * 131 + Math.floor(t * 1.7 + i * 0.37) * 57) % VIEW_W;
      const y = GROUND + 4 + ((i * 71) % (VIEW_H - GROUND - 8));
      g.fillRect(x, y, 3, 1);
    }
  }

  private umbrella(role: Role): HTMLCanvasElement {
    let img = this.umbrellas.get(role);
    if (!img) {
      const b = new Buf(20, 9);
      b.shape(0, 0, 20, 7, (x, y) => (x - 9.5) ** 2 / 100 + (y - 7) ** 2 / 49 <= 1 && y < 7, (x, y) => (y < 2 ? (`${role}Hi` in PALETTE ? (`${role}Hi` as Role) : 'white') : x % 6 < 3 ? role : (`${role}Sh` in PALETTE ? (`${role}Sh` as Role) : role)));
      b.rect(9, 6, 1, 3, 'out');
      img = toCanvas(b);
      this.umbrellas.set(role, img);
    }
    return img;
  }

  /** A soft round glow, drawn once and reused for lamps, windows and lanterns. */
  private glow(): HTMLCanvasElement {
    const k = this.k;
    if (!this.glowImg || this.glowImg.k !== k) {
      const r = 16 * k;
      const c = document.createElement('canvas');
      c.width = c.height = r * 2;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, 'rgba(255,214,130,0.55)');
      grad.addColorStop(0.45, 'rgba(255,196,110,0.22)');
      grad.addColorStop(1, 'rgba(255,190,100,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, r * 2, r * 2);
      this.glowImg = { k, img: c };
    }
    return this.glowImg.img;
  }

  /** After dark: windows lit where someone's in, the street lamps on, and the festival lanterns glowing. */
  private lights(cam: number): void {
    const hour = this.minutes / 60;
    if (hour < 17.5) return;
    const c = this.ctx;
    const k = this.k;
    const night = hour >= 19;
    c.fillStyle = night ? 'rgba(255,214,120,0.62)' : 'rgba(255,214,120,0.32)';
    for (const w of this.windows) {
      if (w.x + w.w < cam || w.x > cam + VIEW_W) continue;
      if (w.building !== 'home' && !this.hooks.isOpen(w.building)) continue;
      c.fillRect((w.x - cam) * k, w.y * k, w.w * k, w.h * k);
    }
    if (hour < 18) return;
    const glow = this.glow();
    const at = (x: number, y: number, size: number) => {
      if (x < cam - 20 || x > cam + VIEW_W + 20) return;
      const s = size * k;
      c.drawImage(glow, (x - cam) * k - s / 2, y * k - s / 2, s, s);
    };
    for (const t of LAMPS) at(t * TILE + 7.5, GROUND - 12, 40);
    if (this.festival && this.fest) for (const l of this.fest.lanterns) at(l.x, l.y, 16);
  }

  /** Speech bubbles: the line in crisp text with furigana where it's still shown, due words in orange. */
  private drawBubbles(cam: number): void {
    this.bubbleRects = [];
    const c = this.ctx;
    const k = this.k;
    for (const b of this.bubbles) {
      const at = b.at();
      const ax = at.x - cam;
      if (ax < -40 || ax > VIEW_W + 40) continue;
      const ruby = b.said.words.some((w) => w.parts.some((p) => p.rt));
      const main = 7;
      c.font = this.font(main);
      const widths = b.said.words.map((w) => w.parts.reduce((n, p) => n + c.measureText(p.text).width, 0));
      const textW = widths.reduce((a, n) => a + n, 0);
      const pad = 5 * k;
      const w = textW + pad * 2;
      const h = (ruby ? 18 : 12) * k;
      const bx = Math.max(2 * k, Math.min(VIEW_W * k - w - 2 * k, ax * k - w / 2));
      const by = at.y * k - h - 4 * k;
      const fadeIn = Math.min(1, (b.life - b.t) / 0.15);
      const fadeOut = Math.min(1, b.t / 0.3);
      c.globalAlpha = Math.min(fadeIn, fadeOut);
      c.beginPath();
      c.roundRect(bx, by, w, h, 4 * k);
      c.fillStyle = UI.box;
      c.fill();
      c.lineWidth = 1.5 * k;
      c.strokeStyle = UI.border;
      c.stroke();
      const tip = Math.max(bx + 5 * k, Math.min(bx + w - 5 * k, ax * k));
      c.beginPath();
      c.moveTo(tip - 3 * k, by + h);
      c.lineTo(tip + 3 * k, by + h);
      c.lineTo(tip, by + h + 3.5 * k);
      c.closePath();
      c.fillStyle = UI.border;
      c.fill();
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      const baseY = by + h - 6 * k;
      let x = bx + pad;
      b.said.words.forEach((word, i) => {
        const colour = word.due ? UI.accent : UI.ink;
        const x0 = x;
        for (const part of word.parts) {
          c.font = this.font(main);
          const pw = c.measureText(part.text).width;
          c.fillStyle = colour;
          c.fillText(part.text, x, baseY + 0.5 * k);
          if (part.rt) {
            c.font = this.font(4.2);
            c.textAlign = 'center';
            c.fillText(part.rt, x + pw / 2, baseY - 6.6 * k);
            c.textAlign = 'left';
          }
          x += pw;
        }
        if (word.due) {
          // A dotted underline marks a word that's due for review.
          c.fillStyle = UI.accent;
          for (let ux = x0; ux < x - k; ux += 2 * k) c.fillRect(ux, baseY + 4.6 * k, k, 0.8 * k);
        }
        if (word.lemma) this.bubbleRects.push({ lemma: word.lemma, x: x0 / k + cam, y: by / k, w: widths[i]! / k, h: h / k });
      });
      c.globalAlpha = 1;
    }
  }

  /** Grey for clouds and rain, then evening and night outdoors. */
  private tint(): void {
    const hour = this.minutes / 60;
    const c = this.ctx;
    const sky = this.weather === 'ame' ? 'rgba(58,74,118,0.22)' : this.weather === 'kumori' ? 'rgba(96,100,128,0.13)' : null;
    if (sky) {
      c.fillStyle = sky;
      c.fillRect(0, 0, VIEW_W * this.k, VIEW_H * this.k);
    }
    let tint: string | null = null;
    if (hour >= 20) tint = 'rgba(28,32,92,0.36)';
    else if (hour >= 18) tint = 'rgba(56,48,128,0.22)';
    else if (hour >= 16.5) tint = 'rgba(240,128,48,0.14)';
    if (!tint) return;
    c.fillStyle = tint;
    c.fillRect(0, 0, VIEW_W * this.k, VIEW_H * this.k);
  }

  /** What Space would do here, in a bubble over your head. */
  private hint(cam: number): void {
    if (this.paused) return;
    const near = this.nearby();
    if (!near) return;
    const p = this.player;
    let label: string;
    if (near.kind === 'npc') label = '田中さん';
    else if (near.kind === 'bed') label = 'Sleep';
    else if (near.kind === 'staff') label = this.hooks.staffName(this.def(near.place).staff ?? '');
    else if (near.kind === 'thing') label = this.hooks.thingName(near.id);
    else if (near.kind === 'door') label = this.hooks.sign(buildingFor(near.place).sign).text;
    else if (near.kind === 'board') label = this.hooks.sign('掲示板').text;
    else if (near.kind === 'stall') label = this.hooks.sign(STALLS.find((x) => x.id === near.id)!.sign).text;
    else if (near.kind === 'cat') label = this.hooks.sign('猫').text;
    else return;
    this.bubble(`Space ▶ ${label}`, Math.round(p.px) - cam + TILE / 2, Math.round(p.py) - SPRITE_LIFT - 3);
  }

  private drawFade(): void {
    const c = this.ctx;
    if (this.flashT > 0) {
      c.fillStyle = `rgba(255,248,226,${(0.55 * this.flashT / this.flashLen).toFixed(3)})`;
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.fade <= 0) return;
    c.fillStyle = `rgba(36,28,48,${(this.fade / FADE).toFixed(3)})`;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private shakeT = 0;
  private shakeLen = 1;
  private shakePower = 0;
  private flashT = 0;
  private flashLen = 1;

  /** Shake the camera for a moment (a promotion, a finished day). Skipped with reduced motion. */
  shake(power = 2, secs = 0.35): void {
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.shakePower = power;
    this.shakeT = this.shakeLen = secs;
  }

  /** A soft flash of light over the scene that fades out. */
  flash(secs = 0.35): void {
    this.flashT = this.flashLen = secs;
  }

  private shakeOffset(): [number, number] {
    if (this.shakeT <= 0) return [0, 0];
    const p = this.shakePower * (this.shakeT / this.shakeLen);
    return [Math.round((Math.random() * 2 - 1) * p), Math.round((Math.random() * 2 - 1) * p)];
  }

  private renderRoom(room: RoomDef): void {
    const g = this.lctx;
    const k = this.k;
    const art = this.roomArt(room.place);
    this.camX = 0;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    g.drawImage(art.base, 0, 0);
    const staff = staffSpot(room);
    const img = staff && room.staff ? this.staffSprite(room.staff) : null;
    if (staff && img) {
      // A small breath every couple of seconds, so they look alive.
      const bob = Math.sin(this.time * 2.4) > 0.92 ? 1 : 0;
      g.drawImage(img, staff.tx * TILE, staff.ty * TILE - SPRITE_LIFT - bob);
    }
    g.drawImage(art.front, 0, 0);
    const p = this.player;
    const x = Math.round(p.px);
    const y = Math.round(p.py);
    g.drawImage(this.shadow(), x + 1, y + 10);
    const s = this.sprite('player', PLAYER, p);
    g.drawImage(s.img, x, y - SPRITE_LIFT - s.lift);
    if (room.outdoor && this.weather === 'ame') {
      g.drawImage(this.umbrella('top'), x - 2, y - SPRITE_LIFT - s.lift - 7);
      this.drawRain(g);
    }

    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.low, 0, 0, VIEW_W * k, VIEW_H * k);
    this.letterSigns(art.signs, 0);
    if (room.outdoor) this.tint();
    this.hint(0);
    this.drawFade();
  }

  private letterSigns(signs: SignSpot[], cam: number): void {
    const c = this.ctx;
    const k = this.k;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const s of signs) {
      if (s.x + s.w < cam || s.x > cam + VIEW_W) continue;
      const info = this.hooks.sign(s.word);
      const cx = (s.x + s.w / 2 - cam) * k;
      const small = (s.size ?? SIGN_TEXT) < SIGN_TEXT;
      c.font = this.font(s.size ?? SIGN_TEXT);
      c.fillStyle = UI.ink;
      c.fillText(info.text, cx, (s.y + s.h / 2) * k);
      if (info.furigana) {
        c.font = this.font(small ? 4.5 : 5.5);
        const fw = c.measureText(info.furigana).width + 4 * k;
        const ph = small ? 6.5 : 8;
        this.pill(cx - fw / 2, (s.y - ph - 1) * k, fw, ph * k, UI.box, UI.ink);
        c.fillStyle = UI.ink;
        c.fillText(info.furigana, cx, (s.y - 1 - ph / 2) * k);
      }
    }
  }

  private pill(x: number, y: number, w: number, h: number, fill: string, stroke: string): void {
    const c = this.ctx;
    c.beginPath();
    c.roundRect(x, y, w, h, h / 2);
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = Math.max(1, this.k / 2);
    c.strokeStyle = stroke;
    c.stroke();
  }

  /** A small rounded box in the dialogue frame's colours, pointing down at (x, y). */
  private bubble(text: string, x: number, y: number): void {
    const c = this.ctx;
    const k = this.k;
    c.font = this.font(7);
    const w = c.measureText(text).width + 10 * k;
    const h = 12 * k;
    const bx = Math.max(2 * k, Math.min(VIEW_W * k - w - 2 * k, x * k - w / 2));
    const by = y * k - h - 3 * k;
    c.beginPath();
    c.roundRect(bx, by, w, h, 3 * k);
    c.fillStyle = UI.box;
    c.fill();
    c.lineWidth = 1.5 * k;
    c.strokeStyle = UI.border;
    c.stroke();
    c.beginPath();
    c.moveTo(x * k - 3 * k, by + h);
    c.lineTo(x * k + 3 * k, by + h);
    c.lineTo(x * k, by + h + 3 * k);
    c.closePath();
    c.fillStyle = UI.border;
    c.fill();
    c.fillStyle = UI.ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, bx + w / 2, by + h / 2 + 0.5 * k);
  }
}

