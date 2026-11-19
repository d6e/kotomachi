// The walkable town, drawn with the Canvas 2D API. Keyboard (arrows/WASD + Space)
// or click/tap to walk; doors and the neighbor are interactable.

import { BUILDINGS, buildGrid, doorSpot, HEIGHT, isSolidAt, TILE, WIDTH, type Building, type DoorPlace, type TileKind } from './map.ts';
import type { Input } from '../engine/input.ts';

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
}

interface Actor {
  x: number;
  y: number;
  dir: 'up' | 'down' | 'left' | 'right';
  walk: number;
  moving: boolean;
}

const SPEED = 120; // px per second
const HIT_W = 16;
const HIT_H = 10;
const REACH = 34;

const PALETTE: Record<TileKind, string> = {
  void: '#3b3340',
  wall: '#000',
  sidewalk: '#c8b9a6',
  street: '#b5a48f',
  grass: '#7fae6a',
  tree: '#7fae6a',
  bench: '#7fae6a',
  vending: '#c8b9a6',
  lamp: '#c8b9a6',
  flowers: '#7fae6a',
};

export class Town {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hooks: TownHooks;
  private readonly grid = buildGrid();
  private staticLayer: HTMLCanvasElement | null = null;
  private signRects: { word: string; x: number; y: number; w: number; h: number }[] = [];
  readonly player: Actor = { x: 3 * TILE + 16, y: 7 * TILE + 20, dir: 'down', walk: 0, moving: false };
  readonly neighbor: Actor & { target: number; wait: number } = { x: 11 * TILE, y: 9 * TILE + 16, dir: 'right', walk: 0, moving: false, target: 22 * TILE, wait: 0 };
  private clickTarget: { x: number; y: number; then?: Interactable } | null = null;
  private minutes = 8 * 60;
  paused = false;
  private time = 0;

  constructor(canvas: HTMLCanvasElement, hooks: TownHooks) {
    this.canvas = canvas;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.hooks = hooks;
    canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
  }

  setMinutes(m: number): void {
    this.minutes = m;
  }

  /** Redraw buildings and signs (signs change as furigana fades). */
  invalidate(): void {
    this.staticLayer = null;
  }

  resetPlayer(): void {
    this.player.x = 3 * TILE + 16;
    this.player.y = 7 * TILE + 20;
    this.player.dir = 'down';
    this.clickTarget = null;
  }

  // ---------------------------------------------------------------- input / movement

  private toCanvas(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * WIDTH, y: ((e.clientY - r.top) / r.height) * HEIGHT };
  }

  private onPointer(e: PointerEvent): void {
    if (this.paused) return;
    const p = this.toCanvas(e);
    for (const s of this.signRects) {
      if (p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) {
        this.hooks.onSignClick(s.word, e.clientX, e.clientY);
        return;
      }
    }
    // Clicking a building walks to its door; clicking the neighbor walks to them.
    const n = this.neighbor;
    if (this.hooks.neighborAvailable() && Math.abs(p.x - n.x) < 18 && p.y > n.y - 40 && p.y < n.y + 8) {
      this.clickTarget = { x: n.x, y: n.y + 14, then: { kind: 'npc', id: 'tanaka' } };
      return;
    }
    for (const b of BUILDINGS) {
      const spot = doorSpot(b);
      if (spot && b.door && p.x >= b.x * TILE && p.x < (b.x + b.w) * TILE && p.y >= b.y * TILE && p.y < (b.y + b.h + 1) * TILE) {
        this.clickTarget = { x: spot.x, y: spot.y - 6, then: { kind: 'door', place: b.door.place } };
        return;
      }
    }
    this.clickTarget = { x: p.x, y: p.y };
  }

  private blocked(x: number, y: number): boolean {
    const l = x - HIT_W / 2;
    const r = x + HIT_W / 2;
    const t = y - HIT_H;
    const b = y;
    return isSolidAt(this.grid, l, t) || isSolidAt(this.grid, r, t) || isSolidAt(this.grid, l, b) || isSolidAt(this.grid, r, b);
  }

  private move(a: Actor, dx: number, dy: number): boolean {
    let moved = false;
    if (dx !== 0 && !this.blocked(a.x + dx, a.y)) {
      a.x += dx;
      moved = true;
    }
    if (dy !== 0 && !this.blocked(a.x, a.y + dy)) {
      a.y += dy;
      moved = true;
    }
    if (Math.abs(dx) > Math.abs(dy)) a.dir = dx > 0 ? 'right' : 'left';
    else if (dy !== 0) a.dir = dy > 0 ? 'down' : 'up';
    return moved;
  }

  /** What the player could interact with from where they stand. */
  nearby(): Interactable | null {
    const p = this.player;
    if (this.hooks.neighborAvailable() && Math.hypot(p.x - this.neighbor.x, p.y - this.neighbor.y) < REACH + 6) {
      return { kind: 'npc', id: 'tanaka' };
    }
    for (const b of BUILDINGS) {
      const spot = doorSpot(b);
      if (spot && b.door && Math.abs(p.x - spot.x) < 22 && Math.abs(p.y - spot.y) < 22) return { kind: 'door', place: b.door.place };
    }
    return null;
  }

  update(dt: number, input: Input): { walked: number } {
    this.time += dt;
    let walked = 0;
    if (!this.paused) {
      let dx = 0;
      let dy = 0;
      if (input.down('ArrowLeft') || input.down('KeyA')) dx -= 1;
      if (input.down('ArrowRight') || input.down('KeyD')) dx += 1;
      if (input.down('ArrowUp') || input.down('KeyW')) dy -= 1;
      if (input.down('ArrowDown') || input.down('KeyS')) dy += 1;
      if (dx !== 0 || dy !== 0) this.clickTarget = null;
      else if (this.clickTarget) {
        const tx = this.clickTarget.x - this.player.x;
        const ty = this.clickTarget.y - this.player.y;
        const dist = Math.hypot(tx, ty);
        if (dist < 4) {
          const then = this.clickTarget.then;
          this.clickTarget = null;
          if (then) {
            const near = this.nearby();
            if (near && near.kind === then.kind) this.hooks.onInteract(near);
          }
        } else {
          dx = tx / dist;
          dy = ty / dist;
        }
      }
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        const step = (SPEED * dt) / len;
        const moved = this.move(this.player, dx * step, dy * step);
        this.player.moving = moved;
        if (moved) {
          this.player.walk += dt * 8;
          walked = SPEED * dt;
        } else if (this.clickTarget) {
          // Stuck against something: give up, but still interact if we're close enough.
          const then = this.clickTarget.then;
          this.clickTarget = null;
          const near = this.nearby();
          if (then && near && near.kind === then.kind) this.hooks.onInteract(near);
        }
      } else this.player.moving = false;

      if (input.pressed('Space') || input.pressed('Enter') || input.pressed('KeyE')) {
        const near = this.nearby();
        if (near) this.hooks.onInteract(near);
      }
      this.updateNeighbor(dt);
    }
    return { walked };
  }

  private updateNeighbor(dt: number): void {
    const n = this.neighbor;
    const p = this.player;
    // Stop and face the player when they come close.
    if (Math.hypot(p.x - n.x, p.y - n.y) < REACH + 20) {
      n.moving = false;
      n.dir = p.x < n.x ? 'left' : 'right';
      return;
    }
    if (n.wait > 0) {
      n.wait -= dt;
      n.moving = false;
      return;
    }
    const d = n.target - n.x;
    if (Math.abs(d) < 2) {
      n.target = n.target > 15 * TILE ? 4 * TILE : 24 * TILE;
      n.wait = 2 + Math.random() * 3;
      return;
    }
    n.moving = this.move(n, Math.sign(d) * 50 * dt, 0);
    if (n.moving) n.walk += dt * 6;
    else n.target = n.x;
  }

  // ---------------------------------------------------------------- drawing

  private drawStatic(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = WIDTH;
    c.height = HEIGHT;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    this.signRects = [];
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y]!.length; x++) {
        const k = this.grid[y]![x]!;
        if (k === 'wall') continue;
        g.fillStyle = PALETTE[k];
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
        this.drawTileDetail(g, k, x * TILE, y * TILE, x, y);
      }
    }
    for (const b of BUILDINGS) this.drawBuilding(g, b);
    return c;
  }

  private drawTileDetail(g: CanvasRenderingContext2D, k: TileKind, px: number, py: number, x: number, y: number): void {
    if (k === 'street') {
      g.fillStyle = (x + y) % 2 === 0 ? '#ad9c87' : '#b9a994';
      g.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    } else if (k === 'sidewalk' || k === 'lamp' || k === 'vending') {
      g.fillStyle = '#b9aa97';
      g.fillRect(px, py + TILE - 2, TILE, 2);
      g.fillRect(px + TILE - 2, py, 2, TILE);
    } else if (k === 'grass' || k === 'flowers') {
      g.fillStyle = '#6f9e5c';
      for (let i = 0; i < 3; i++) g.fillRect(px + ((x * 7 + i * 11) % 28), py + ((y * 5 + i * 13) % 26), 2, 4);
    } else if (k === 'void') {
      g.fillStyle = '#463d4b';
      g.fillRect(px, py + 20, TILE, 12);
    }
    if (k === 'tree') {
      g.fillStyle = '#5a3d2b';
      g.fillRect(px + 13, py + 18, 6, 12);
      g.fillStyle = '#3f7d46';
      g.beginPath();
      g.arc(px + 16, py + 14, 13, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#4e9455';
      g.beginPath();
      g.arc(px + 12, py + 10, 6, 0, Math.PI * 2);
      g.fill();
    } else if (k === 'flowers') {
      const cols = ['#e86f8a', '#f2c94c', '#ffffff'];
      for (let i = 0; i < 5; i++) {
        g.fillStyle = cols[i % 3]!;
        g.fillRect(px + 4 + i * 5, py + 10 + ((i * 7) % 12), 3, 3);
      }
    } else if (k === 'bench') {
      g.fillStyle = '#8a5a3b';
      g.fillRect(px + 2, py + 12, 28, 6);
      g.fillRect(px + 2, py + 6, 28, 3);
      g.fillStyle = '#4a3528';
      g.fillRect(px + 4, py + 18, 3, 8);
      g.fillRect(px + 25, py + 18, 3, 8);
    } else if (k === 'vending') {
      g.fillStyle = '#d9473f';
      g.fillRect(px + 6, py - 14, 20, 42);
      g.fillStyle = '#f5f0e6';
      g.fillRect(px + 9, py - 10, 14, 16);
      g.fillStyle = '#2b2b2b';
      g.fillRect(px + 9, py + 14, 14, 6);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = ['#3d7ad9', '#3d9a54', '#f2c94c'][i]!;
        g.fillRect(px + 10 + i * 4, py - 8, 3, 6);
      }
    } else if (k === 'lamp') {
      g.fillStyle = '#3c3d3f';
      g.fillRect(px + 15, py - 18, 3, 46);
      g.fillStyle = '#f7e3a1';
      g.fillRect(px + 11, py - 24, 11, 8);
    }
  }

  private drawBuilding(g: CanvasRenderingContext2D, b: Building): void {
    const x = b.x * TILE;
    const y = b.y * TILE;
    const w = b.w * TILE;
    const h = b.h * TILE;
    // Roof band
    g.fillStyle = b.roof;
    g.fillRect(x - 4, y - 6, w + 8, 34);
    g.fillStyle = b.trim;
    g.fillRect(x - 4, y + 26, w + 8, 4);
    // Wall
    g.fillStyle = b.wall;
    g.fillRect(x, y + 30, w, h - 30);
    // Windows
    g.fillStyle = '#9cc3d5';
    if (b.id === 'home') {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.fillRect(x + 14 + i * 96, y + 44 + j * 40, 26, 22);
      g.fillStyle = b.trim;
      g.fillRect(x, y + 98, w, 4);
    } else if (b.id === 'station') {
      g.fillRect(x + 10, y + 50, w - 20, 40);
      g.fillStyle = '#3c3d3f';
      g.fillRect(x + 10, y + 110, w - 20, h - 110);
      g.fillStyle = '#f2c94c';
      g.fillRect(x + 12, y + 140, w - 24, 4);
    } else {
      g.fillRect(x + 8, y + 76, 40, 52);
      g.fillRect(x + w - 48, y + 76, 40, 52);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x + 10, y + 78, 8, 48);
      g.fillRect(x + w - 46, y + 78, 8, 48);
    }
    // Awning
    if (b.awning) {
      for (let i = 0; i < b.w * 2; i++) {
        g.fillStyle = i % 2 === 0 ? b.awning : '#f7f3ea';
        g.fillRect(x + i * 16, y + 66, 16, 10);
      }
    }
    // Door
    if (b.door) {
      const dx = b.door.x * TILE;
      g.fillStyle = b.trim;
      g.fillRect(dx + 2, y + h - 46, TILE - 4, 46);
      g.fillStyle = b.id === 'home' ? '#8a6a52' : '#bcd9e4';
      g.fillRect(dx + 5, y + h - 42, TILE - 10, 42);
      g.fillStyle = '#e9d9a6';
      g.fillRect(dx + TILE - 11, y + h - 22, 3, 3);
    }
    // Sign board
    const info = this.hooks.sign(b.sign);
    const font = '"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic","Meiryo",sans-serif';
    g.font = `bold 18px ${font}`;
    const tw = g.measureText(info.text).width;
    const bw = Math.max(tw + 20, 48);
    const bx = x + w / 2 - bw / 2;
    const by = y + 34;
    g.fillStyle = '#fbf6ea';
    g.fillRect(bx, by, bw, 26);
    g.strokeStyle = b.trim;
    g.lineWidth = 2;
    g.strokeRect(bx + 1, by + 1, bw - 2, 24);
    g.fillStyle = '#2b2522';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(info.text, x + w / 2, by + 14);
    if (info.furigana) {
      g.font = `bold 10px ${font}`;
      g.fillStyle = '#fbf6ea';
      const fw = g.measureText(info.furigana).width + 8;
      g.fillRect(x + w / 2 - fw / 2, by - 13, fw, 13);
      g.fillStyle = '#2b2522';
      g.fillText(info.furigana, x + w / 2, by - 6);
    }
    this.signRects.push({ word: b.sign, x: bx, y: by - 14, w: bw, h: 40 });
  }

  private drawPerson(a: Actor, colors: { hair: string; shirt: string; pants: string; skin?: string }): void {
    const g = this.ctx;
    const x = Math.round(a.x);
    const y = Math.round(a.y);
    const step = a.moving ? Math.sin(a.walk) : 0;
    const skin = colors.skin ?? '#f2d2b6';
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath();
    g.ellipse(x, y + 1, 9, 3, 0, 0, Math.PI * 2);
    g.fill();
    // legs
    g.fillStyle = colors.pants;
    g.fillRect(x - 6, y - 10, 5, 10 + Math.round(step * 2));
    g.fillRect(x + 1, y - 10, 5, 10 - Math.round(step * 2));
    // body
    g.fillStyle = colors.shirt;
    g.fillRect(x - 8, y - 24, 16, 15);
    // arms
    g.fillRect(x - 10, y - 22 + Math.round(step), 3, 10);
    g.fillRect(x + 7, y - 22 - Math.round(step), 3, 10);
    // head
    g.fillStyle = skin;
    g.fillRect(x - 7, y - 37, 14, 13);
    g.fillStyle = colors.hair;
    g.fillRect(x - 8, y - 40, 16, 6);
    if (a.dir === 'up') g.fillRect(x - 8, y - 36, 16, 10);
    else if (a.dir === 'left') g.fillRect(x + 2, y - 36, 6, 8);
    else if (a.dir === 'right') g.fillRect(x - 8, y - 36, 6, 8);
    else g.fillRect(x - 8, y - 36, 3, 6), g.fillRect(x + 5, y - 36, 3, 6);
    // eyes
    if (a.dir !== 'up') {
      g.fillStyle = '#2b2522';
      const off = a.dir === 'left' ? -3 : a.dir === 'right' ? 3 : 0;
      g.fillRect(x - 4 + off, y - 31, 2, 3);
      g.fillRect(x + 2 + off, y - 31, 2, 3);
    }
  }

  private drawBubble(text: string, x: number, y: number): void {
    const g = this.ctx;
    g.font = 'bold 13px "Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif';
    const w = g.measureText(text).width + 16;
    const bx = Math.max(4, Math.min(WIDTH - w - 4, x - w / 2));
    g.fillStyle = 'rgba(30,26,34,0.85)';
    g.fillRect(bx, y - 24, w, 22);
    g.fillStyle = '#fff';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(text, bx + 8, y - 13);
  }

  render(): void {
    const g = this.ctx;
    if (!this.staticLayer) this.staticLayer = this.drawStatic();
    g.imageSmoothingEnabled = false;
    g.drawImage(this.staticLayer, 0, 0);

    // Closed plates on shop doors.
    for (const b of BUILDINGS) {
      if (!b.door || b.door.place === 'home') continue;
      if (!this.hooks.isOpen(b.door.place)) {
        const info = this.hooks.sign('準備中');
        const dx = b.door.x * TILE;
        const dy = (b.y + b.h) * TILE - 40;
        g.fillStyle = '#fbf6ea';
        g.fillRect(dx - 10, dy, TILE + 20, 16);
        g.fillStyle = '#b23b3b';
        g.font = 'bold 11px "Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(info.text, dx + TILE / 2, dy + 8);
      }
    }

    // Actors, drawn back to front.
    const actors: [Actor, Parameters<Town['drawPerson']>[1]][] = [[this.player, { hair: '#2b2522', shirt: '#e07a4f', pants: '#3b4a6b' }]];
    if (this.hooks.neighborAvailable()) actors.push([this.neighbor, { hair: '#8a8a8a', shirt: '#6b8f71', pants: '#5a4a3b' }]);
    actors.sort((a, b) => a[0].y - b[0].y);
    for (const [a, c] of actors) this.drawPerson(a, c);

    // Time of day.
    const h = this.minutes / 60;
    let tint: string | null = null;
    if (h >= 20) tint = 'rgba(20,30,80,0.38)';
    else if (h >= 18) tint = 'rgba(40,40,110,0.22)';
    else if (h >= 16.5) tint = 'rgba(230,120,40,0.13)';
    if (tint) {
      g.fillStyle = tint;
      g.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Interaction hint.
    if (!this.paused) {
      const near = this.nearby();
      if (near) {
        const label =
          near.kind === 'npc' ? 'Space ▶ 田中さん' : `Space ▶ ${this.hooks.sign(BUILDINGS.find((b) => b.door?.place === near.place)!.sign).text}`;
        this.drawBubble(label, this.player.x, this.player.y - 44);
      }
    }
  }
}
