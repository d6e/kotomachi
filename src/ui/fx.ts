// Little effects that make answering feel good: pops, shakes, sparkles, confetti,
// floating numbers and counting up. Particles go on one fixed canvas over the page
// that ignores the pointer and only animates while something is on it. With
// prefers-reduced-motion, particles, pops and shakes are skipped; fades stay.

import { h } from './dom.ts';

export const reducedMotion = (): boolean => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Restart a CSS animation class on an element, and take it off when it ends. */
export function play(el: Element | null | undefined, cls: string): void {
  if (!el || reducedMotion()) return;
  el.classList.remove(cls);
  // Reading layout restarts the animation when the class goes straight back on.
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

// ------------------------------------------------------------------ particles

type Kind = 'confetti' | 'sparkle' | 'coin' | 'ember';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  colour: string;
  spin: number;
  angle: number;
}

// Style D accents: the orange, the frame blue, mint, pink, yellow.
const CONFETTI = ['#f4743b', '#3f6fc8', '#30b09b', '#ff7aa8', '#ffd54a', '#9a72cf'];
const SPARKLE = ['#ffffff', '#ffe58a', '#ffd54a'];
const EMBER = ['#ffd54a', '#ff9b3c', '#f4743b', '#e2413b'];
const MAX = 220;

class Layer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private parts: Particle[] = [];
  private raf = 0;
  private last = 0;

  private ensure(): CanvasRenderingContext2D {
    if (!this.canvas) {
      this.canvas = h('canvas', { class: 'fx-layer', 'aria-hidden': 'true' }) as HTMLCanvasElement;
      document.body.append(this.canvas);
      this.ctx = this.canvas.getContext('2d');
    }
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = Math.round(innerWidth * dpr);
    const hgt = Math.round(innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== hgt) {
      this.canvas.width = w;
      this.canvas.height = hgt;
    }
    return this.ctx!;
  }

  add(ps: Particle[]): void {
    if (reducedMotion() || !this.ensureOk()) return;
    this.parts.push(...ps);
    if (this.parts.length > MAX) this.parts.splice(0, this.parts.length - MAX);
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.frame(t));
    }
  }

  private ensureOk(): boolean {
    try {
      this.ensure();
      return true;
    } catch {
      return false;
    }
  }

  private frame(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const g = this.ensure();
    const dpr = this.canvas!.width / innerWidth;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    this.parts = this.parts.filter((p) => (p.age += dt) < p.life);
    for (const p of this.parts) {
      const gravity = p.kind === 'confetti' ? 520 : p.kind === 'coin' ? 900 : p.kind === 'ember' ? -60 : 40;
      p.vy += gravity * dt;
      p.vx *= p.kind === 'confetti' ? 0.985 : 0.97;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      const t = p.age / p.life;
      g.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      g.fillStyle = p.colour;
      g.save();
      g.translate(Math.round(p.x), Math.round(p.y));
      if (p.kind === 'confetti') {
        g.rotate(p.angle);
        // Squash with the spin, like a paper flake turning over.
        g.fillRect(-p.size / 2, (-p.size / 4) * Math.abs(Math.cos(p.angle * 1.7)), p.size, (p.size / 2) * Math.max(0.25, Math.abs(Math.cos(p.angle * 1.7))));
      } else if (p.kind === 'sparkle') {
        // A chunky four-point star.
        const s = Math.round(p.size * (1 - t * 0.6));
        g.fillRect(-s, -1, s * 2, 2);
        g.fillRect(-1, -s, 2, s * 2);
        g.fillRect(-1.5, -1.5, 3, 3);
      } else if (p.kind === 'coin') {
        const w = Math.max(1.5, p.size * Math.abs(Math.cos(p.angle)));
        g.fillStyle = '#c98a1a';
        g.fillRect(-w / 2 - 1, -p.size / 2 - 1, w + 2, p.size + 2);
        g.fillStyle = p.colour;
        g.fillRect(-w / 2, -p.size / 2, w, p.size);
      } else {
        g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      g.restore();
    }
    g.globalAlpha = 1;
    if (this.parts.length) this.raf = requestAnimationFrame((t) => this.frame(t));
    else {
      this.raf = 0;
      g.clearRect(0, 0, innerWidth, innerHeight);
    }
  }
}

const layer = new Layer();
const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

function centre(el: Element): { x: number; y: number; w: number; h: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

/** Sparkles around an element's edge: a right answer. */
export function sparkle(el: Element, n = 10): void {
  const c = centre(el);
  layer.add(Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 90;
    return {
      kind: 'sparkle' as const, x: c.x + Math.cos(a) * c.w * 0.45, y: c.y + Math.sin(a) * c.h * 0.5,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.45 + Math.random() * 0.25, age: 0,
      size: 3 + Math.random() * 3, colour: pick(SPARKLE), spin: 0, angle: 0,
    };
  }));
}

/** A burst of confetti from a point: a promotion, all errands done, a big combo. */
export function confetti(x: number, y: number, n = 40, spread = 1): void {
  layer.add(Array.from({ length: n }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1 * spread;
    const sp = 220 + Math.random() * 260;
    return {
      kind: 'confetti' as const, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.1 + Math.random() * 0.6, age: 0,
      size: 5 + Math.random() * 4, colour: pick(CONFETTI), spin: (Math.random() - 0.5) * 16, angle: Math.random() * 6,
    };
  }));
}

export function confettiFrom(el: Element, n = 40): void {
  const c = centre(el);
  confetti(c.x, c.y, n);
}

/** Coins popping up from a point: paying. */
export function coins(x: number, y: number, n = 7): void {
  layer.add(Array.from({ length: n }, (_, i) => ({
    kind: 'coin' as const, x: x + (i - n / 2) * 6, y, vx: (Math.random() - 0.5) * 160, vy: -260 - Math.random() * 160,
    life: 0.8, age: 0, size: 8, colour: '#ffd54a', spin: 10 + Math.random() * 8, angle: Math.random() * 3,
  })));
}

/** Embers rising off a hot combo. */
export function embers(el: Element, n = 6): void {
  const c = centre(el);
  layer.add(Array.from({ length: n }, () => ({
    kind: 'ember' as const, x: c.x + (Math.random() - 0.5) * c.w, y: c.y, vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 50,
    life: 0.6 + Math.random() * 0.4, age: 0, size: 2 + Math.random() * 2, colour: pick(EMBER), spin: 0, angle: 0,
  })));
}

// ------------------------------------------------------------------ floating text

/** A number or word that rises and fades from an element, like "+1" or "-¥480". */
export function floatText(anchor: Element | { x: number; y: number }, text: string, cls = ''): void {
  const at = anchor instanceof Element ? (() => {
    const r = anchor.getBoundingClientRect();
    // Just above the top-right corner, clear of the text inside.
    return { x: r.right - 14, y: r.top - 4 };
  })() : anchor;
  const el = h('div', { class: `fx-float ${cls}`.trim(), 'aria-hidden': 'true' }, text);
  el.style.left = `${Math.round(at.x)}px`;
  el.style.top = `${Math.round(at.y)}px`;
  document.body.append(el);
  const done = () => el.remove();
  el.addEventListener('animationend', done, { once: true });
  setTimeout(done, 1600);
}

// ------------------------------------------------------------------ counting up

/** Count an element's number up from 0 over a short time (instantly with reduced motion). */
export function countUp(el: HTMLElement, to: number, ms = 600, format = (n: number) => String(n)): Promise<void> {
  if (reducedMotion() || to === 0) {
    el.textContent = format(to);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      // Ease out, so it slows as it lands.
      el.textContent = format(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

export const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, reducedMotion() ? 0 : ms));
