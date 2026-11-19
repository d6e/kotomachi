// The walkable town. The world is drawn as pixel art at 1x into a small canvas, scaled
// up by a whole number onto the visible canvas, and then sign lettering, furigana and
// the "Space ▶" hint are drawn crisply on top. You walk tile to tile with the arrow
// keys or WASD, or click or tap to walk somewhere; doors and the neighbour are
// interactable.

import type { Input } from '../engine/input.ts';
import { drawWorld, plate, SIGN_TEXT, type SignSpot } from './art.ts';
import {
  BUILDINGS, buildGrid, buildingFor, DIRS, doorSpot, facingTo, findPath, GROUND, isSolid, NEIGHBOUR_ROUTE, START,
  STREET_ROW, TILE, VIEW_H, VIEW_W, WORLD_W, type DoorPlace, type Facing, type TilePos,
} from './map.ts';
import { UI } from './palette.ts';
import { Buf, toCanvas } from './pixels.ts';
import { KEY, NEIGHBOUR, PLAYER, walkFrames, type CharacterArt } from './sprites.ts';

export type Interactable = { kind: 'door'; place: DoorPlace } | { kind: 'npc'; id: 'tanaka' };

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
}

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
  private readonly grid = buildGrid();
  private world: HTMLCanvasElement | null = null;
  private signs: SignSpot[] = [];
  private plates = new Map<string, { img: HTMLCanvasElement; w: number; h: number }>();
  private plateRects: { word: string; x: number; y: number; w: number; h: number }[] = [];
  private sprites = new Map<string, HTMLCanvasElement>();
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

  /** Signs change as furigana fade; they're redrawn every frame, so nothing to rebuild. */
  invalidate(): void {}

  resetPlayer(): void {
    Object.assign(this.player, actorAt(START, 'down'));
    this.path = [];
    this.then = null;
  }

  /** Stand in front of a door, or next to the neighbour (play-test helper). */
  debugGoTo(place: DoorPlace | 'tanaka'): void {
    this.path = [];
    this.then = null;
    if (place !== 'tanaka') {
      Object.assign(this.player, actorAt(doorSpot(buildingFor(place))!, 'up'));
      return;
    }
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

  private blockedForPlayer = (tx: number, ty: number): boolean => isSolid(this.grid, tx, ty) || this.neighbourOn({ tx, ty });

  private doorAt(p: TilePos): DoorPlace | null {
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
    if (this.neighbourOn(this.ahead(this.player))) return { kind: 'npc', id: 'tanaka' };
    const door = this.doorAt(me);
    if (door) return { kind: 'door', place: door };
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
    } else this.player.dir = 'up';
    this.hooks.onInteract(target);
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
    for (const s of this.signs) {
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
    }
    if (this.blockedForPlayer(to.tx, to.ty)) return;
    this.startStep(p, to);
  }

  update(dt: number, input: Input): { walked: number } {
    this.time += dt;
    if (this.paused) return { walked: 0 };
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

    this.updateNeighbour(dt);
    return { walked };
  }

  private arrive(): void {
    const then = this.then;
    if (!then) return;
    this.then = null;
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
  }

  private sprite(name: string, art: CharacterArt, a: Actor): { img: HTMLCanvasElement; lift: number } {
    // Show a stepping frame through the first half of each step, alternating feet.
    const frame = a.dest && a.t < 0.55 ? (a.steps % 2 ? 1 : 3) : 0;
    const key = `${name}:${a.dir}:${frame}`;
    const f = walkFrames(art, a.dir)[frame]!;
    let img = this.sprites.get(key);
    if (!img) {
      const b = new Buf(16, 16);
      b.sprite(f.rows, 0, 0, KEY, f.flip);
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

  render(): void {
    this.resize();
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

    // Actors, back to front.
    const actors: [string, CharacterArt, Actor][] = [['player', PLAYER, p]];
    if (this.hooks.neighborAvailable()) actors.push(['tanaka', NEIGHBOUR, this.neighbor]);
    actors.sort((a, b) => a[2].py - b[2].py);
    for (const [name, art, a] of actors) {
      const x = Math.round(a.px) - cam;
      const y = Math.round(a.py);
      g.drawImage(this.shadow(), x + 1, y + 10);
      const s = this.sprite(name, art, a);
      g.drawImage(s.img, x, y - SPRITE_LIFT - s.lift);
    }

    // Scale up, then letter the signs crisply on top.
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.low, 0, 0, VIEW_W * k, VIEW_H * k);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const s of this.signs) {
      if (s.x + s.w < cam || s.x > cam + VIEW_W) continue;
      const info = this.hooks.sign(s.word);
      const cx = (s.x + s.w / 2 - cam) * k;
      c.font = this.font(SIGN_TEXT);
      c.fillStyle = UI.ink;
      c.fillText(info.text, cx, (s.y + s.h / 2) * k);
      if (info.furigana) {
        c.font = this.font(5.5);
        const fw = c.measureText(info.furigana).width + 4 * k;
        this.pill(cx - fw / 2, (s.y - 9) * k, fw, 8 * k, UI.box, UI.ink);
        c.fillStyle = UI.ink;
        c.fillText(info.furigana, cx, (s.y - 5) * k);
      }
    }
    for (const pl of plates) {
      c.font = this.font(7);
      c.fillStyle = UI.closed;
      c.fillText(pl.text, (pl.x + pl.w / 2 - cam) * k, (pl.y + pl.h / 2 + 0.5) * k);
    }

    // Time of day.
    const hour = this.minutes / 60;
    let tint: string | null = null;
    if (hour >= 20) tint = 'rgba(28,32,92,0.36)';
    else if (hour >= 18) tint = 'rgba(56,48,128,0.22)';
    else if (hour >= 16.5) tint = 'rgba(240,128,48,0.14)';
    if (tint) {
      c.fillStyle = tint;
      c.fillRect(0, 0, VIEW_W * k, VIEW_H * k);
    }

    // What Space would do here.
    if (!this.paused) {
      const near = this.nearby();
      if (near) {
        const label = near.kind === 'npc' ? '田中さん' : this.hooks.sign(buildingFor(near.place).sign).text;
        this.bubble(`Space ▶ ${label}`, Math.round(p.px) - cam + TILE / 2, Math.round(p.py) - SPRITE_LIFT - 3);
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

