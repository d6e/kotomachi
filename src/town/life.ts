// What goes on in the street while you walk about: passers-by going from one end to the
// other (and stopping to say something when they pass you), sparrows hopping about that
// fly off when you come close, and a train along the railway now and then. Pure state
// and logic with no DOM, so it can be tested; the town draws it.

import { COLS, isSolid, RAIL_ROW, STREET_ROW, TILE, WORLD_W, type Facing, type Grid, type TilePos } from './map.ts';
import { PASSERS } from './sprites.ts';

export interface Walker {
  id: number;
  /** Which of the PASSERS they look like. */
  look: number;
  tx: number;
  ty: number;
  px: number;
  py: number;
  dir: Facing;
  dest: TilePos | null;
  t: number;
  steps: number;
  /** Which way along the street they're going. */
  heading: 1 | -1;
  /** Seconds to stand still (talking, or waiting for someone to move). */
  wait: number;
  /** Seconds stuck behind someone. */
  stuck: number;
  /** Whether they've said something to you yet. */
  talked: boolean;
}

export interface Bird {
  x: number;
  y: number;
  /** Facing left (false) or right. */
  flip: boolean;
  state: 'sit' | 'fly' | 'gone';
  /** Seconds until the next hop, or until it comes back while gone. */
  t: number;
  /** Height of the current hop, in pixels. */
  hop: number;
  vx: number;
  vy: number;
}

export interface Train {
  x: number;
  dir: 1 | -1;
}

export interface LifeInput {
  player: TilePos;
  neighbour: TilePos | null;
  minutes: number;
  rain: boolean;
  festival: boolean;
  /** prefers-reduced-motion: no hops, no flying, no trains. */
  still: boolean;
}

/** Seconds per tile for someone out for a stroll. */
export const PASSER_STEP = 0.36;
/** The street's two rows; passers keep to them. */
export const LANES = [STREET_ROW, STREET_ROW + 1];
export const TRAIN_CARS = 3;
export const CAR_W = 46;
export const TRAIN_LEN = TRAIN_CARS * CAR_W + (TRAIN_CARS - 1) * 2;
export const TRAIN_SPEED = 120;
/** Birds take off when you come this close (world pixels). */
export const SCARE = 26;

export class StreetLife {
  passers: Walker[] = [];
  birds: Bird[] = [];
  train: Train | null = null;
  private nextPasser = 1.5;
  private nextTrain = 12;
  private nextId = 1;
  private trainDir: 1 | -1 = 1;

  private grid: Grid;
  private readonly rnd: () => number;

  constructor(grid: Grid, rnd: () => number = Math.random) {
    this.grid = grid;
    this.rnd = rnd;
  }

  setGrid(g: Grid): void {
    this.grid = g;
  }

  /** Clear the street, for a new day or coming back out of a building. */
  reset(): void {
    this.passers = [];
    this.birds = [];
    this.train = null;
    this.nextPasser = 1;
  }

  /** How many people are about at this hour. */
  static crowd(minutes: number, festival: boolean, rain: boolean): number {
    const h = minutes / 60;
    if (h < 7 || h >= 22) return 0;
    let n = h >= 20 ? 1 : 2;
    if (festival) n += 1;
    if (rain) n = Math.max(1, n - 1);
    return n;
  }

  update(dt: number, w: LifeInput): void {
    this.updatePassers(dt, w);
    this.updateBirds(dt, w);
    this.updateTrain(dt, w);
  }

  // ---------------------------------------------------------------- passers-by

  private taken(p: TilePos, me: Walker | null, w: LifeInput): boolean {
    const on = (a: TilePos | null) => !!a && a.tx === p.tx && a.ty === p.ty;
    if (on(w.player) || on(w.neighbour)) return true;
    return this.passers.some((o) => o !== me && (on({ tx: o.tx, ty: o.ty }) || on(o.dest)));
  }

  /** A passer can walk here: on the street (past either end too), and not into a lamp. */
  private open(p: TilePos): boolean {
    if (!LANES.includes(p.ty)) return false;
    if (p.tx < 0 || p.tx >= COLS) return true;
    return !isSolid(this.grid, p.tx, p.ty);
  }

  private spawn(w: LifeInput): void {
    const heading: 1 | -1 = this.rnd() < 0.5 ? 1 : -1;
    const tx = heading === 1 ? -1 : COLS;
    const lanes = LANES.filter((ty) => !this.taken({ tx, ty }, null, w) && !this.taken({ tx: tx + heading, ty }, null, w));
    if (!lanes.length) return;
    const ty = lanes[Math.floor(this.rnd() * lanes.length)]!;
    this.passers.push({
      id: this.nextId++, look: Math.floor(this.rnd() * PASSERS.length), tx, ty, px: tx * TILE, py: ty * TILE,
      dir: heading === 1 ? 'right' : 'left', dest: null, t: 0, steps: 0, heading, wait: 0, stuck: 0, talked: false,
    });
  }

  private updatePassers(dt: number, w: LifeInput): void {
    const want = StreetLife.crowd(w.minutes, w.festival, w.rain);
    this.nextPasser -= dt;
    if (this.nextPasser <= 0) {
      if (this.passers.length < want) this.spawn(w);
      this.nextPasser = 4 + this.rnd() * 6;
    }
    for (const a of this.passers) {
      if (a.dest) {
        a.t = Math.min(1, a.t + dt / PASSER_STEP);
        a.px = (a.tx + (a.dest.tx - a.tx) * a.t) * TILE;
        a.py = (a.ty + (a.dest.ty - a.ty) * a.t) * TILE;
        if (a.t >= 1) {
          a.tx = a.dest.tx;
          a.ty = a.dest.ty;
          a.dest = null;
        }
        continue;
      }
      if (a.wait > 0) {
        a.wait -= dt;
        continue;
      }
      const ahead = { tx: a.tx + a.heading, ty: a.ty };
      let to: TilePos | null = null;
      if (this.open(ahead) && !this.taken(ahead, a, w)) to = ahead;
      else {
        // Step into the other lane to get round a lamp or someone standing there.
        const side = { tx: a.tx, ty: a.ty === LANES[0] ? LANES[1]! : LANES[0]! };
        if (this.open(side) && !this.taken(side, a, w)) to = side;
      }
      if (!to) {
        a.stuck += dt;
        a.dir = a.heading === 1 ? 'right' : 'left';
        // Someone standing in the way for a while: say excuse me and go round them.
        if (a.stuck > 2.5 && this.open(ahead) && !this.taken(ahead, a, { ...w, player: { tx: -9, ty: -9 } })) to = ahead;
        else continue;
      }
      a.stuck = 0;
      a.dir = to.ty !== a.ty ? (to.ty < a.ty ? 'up' : 'down') : a.heading === 1 ? 'right' : 'left';
      a.dest = to;
      a.t = 0;
      a.steps++;
    }
    // Off the end of the street: gone.
    this.passers = this.passers.filter((a) => a.dest || a.tx !== (a.heading === 1 ? COLS : -1));
  }

  /** Stop and face someone to talk to them. */
  stopFor(a: Walker, at: TilePos, secs: number): void {
    a.wait = Math.max(a.wait, secs);
    const dx = at.tx - a.tx;
    const dy = at.ty - a.ty;
    a.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    a.talked = true;
  }

  // ---------------------------------------------------------------- birds

  private birdSpot(w: LifeInput): { x: number; y: number } | null {
    for (let tries = 0; tries < 12; tries++) {
      const tx = Math.floor(this.rnd() * COLS);
      const ty = STREET_ROW + 1 + Math.floor(this.rnd() * (RAIL_ROW - STREET_ROW - 1));
      if (isSolid(this.grid, tx, ty) || this.grid[ty]![tx] === 'flowers') continue;
      const x = tx * TILE + 3 + Math.floor(this.rnd() * 6);
      const y = ty * TILE + 6 + Math.floor(this.rnd() * 4);
      if (Math.hypot(x - (w.player.tx * TILE + 8), y - (w.player.ty * TILE + 8)) < SCARE * 2.5) continue;
      return { x, y };
    }
    return null;
  }

  private updateBirds(dt: number, w: LifeInput): void {
    const h = w.minutes / 60;
    const want = w.rain || h < 6 || h >= 19.5 ? 0 : 4;
    while (this.birds.length < want) this.birds.push({ x: 0, y: 0, flip: false, state: 'gone', t: this.rnd() * 3, hop: 0, vx: 0, vy: 0 });
    if (this.birds.length > want) this.birds = this.birds.filter((b) => b.state === 'fly');
    const px = w.player.tx * TILE + 8;
    const py = w.player.ty * TILE + 8;
    for (const b of this.birds) {
      if (b.state === 'gone') {
        b.t -= dt;
        if (b.t <= 0 && want > 0) {
          const at = this.birdSpot(w);
          if (at) Object.assign(b, at, { state: 'sit', t: 0.5 + this.rnd() * 2, flip: this.rnd() < 0.5, hop: 0 });
          else b.t = 2;
        }
        continue;
      }
      if (b.state === 'fly') {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vy -= 40 * dt;
        if (b.y < -10 || b.x < -10 || b.x > WORLD_W + 10) Object.assign(b, { state: 'gone', t: 8 + this.rnd() * 10 });
        continue;
      }
      if (Math.hypot(b.x - px, b.y - py) < SCARE) {
        if (w.still) Object.assign(b, { state: 'gone', t: 8 + this.rnd() * 10 });
        else {
          const away = b.x < px ? -1 : 1;
          Object.assign(b, { state: 'fly', flip: away > 0, vx: away * (70 + this.rnd() * 40), vy: -60 - this.rnd() * 30, hop: 0 });
        }
        continue;
      }
      if (w.still) continue;
      // Peck about: a little hop now and then, sometimes turning round.
      b.t -= dt;
      b.hop = Math.max(0, b.hop - dt * 12);
      if (b.t <= 0) {
        b.t = 0.6 + this.rnd() * 2.2;
        if (this.rnd() < 0.3) b.flip = !b.flip;
        else {
          const nx = b.x + (b.flip ? 3 : -3);
          const tx = Math.floor(nx / TILE);
          const ty = Math.floor(b.y / TILE);
          if (!isSolid(this.grid, tx, ty)) {
            b.x = nx;
            b.hop = 2;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- the train

  private updateTrain(dt: number, w: LifeInput): void {
    if (w.still) {
      this.train = null;
      return;
    }
    if (this.train) {
      this.train.x += this.train.dir * TRAIN_SPEED * dt;
      if (this.train.x > WORLD_W + 10 || this.train.x < -TRAIN_LEN - 10) this.train = null;
      return;
    }
    this.nextTrain -= dt;
    const h = w.minutes / 60;
    if (this.nextTrain <= 0 && h >= 5 && h < 24) {
      this.train = { x: this.trainDir === 1 ? -TRAIN_LEN : WORLD_W, dir: this.trainDir };
      this.trainDir = this.trainDir === 1 ? -1 : 1;
      this.nextTrain = 35 + this.rnd() * 30;
    }
  }
}
