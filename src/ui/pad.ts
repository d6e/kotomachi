// On-screen controls for phones held upright: a d-pad and two buttons along the bottom
// of the screen, with a tab to slide them away. They press the same keys as a keyboard
// (arrows, Enter, N), so the town, menus and notebook need nothing new.
//
// Shown only in portrait at phone widths on a touch screen, and only while you're out
// walking (not in a conversation, a card or the notebook), so they never sit over the
// answer menus.

import { h } from './dom.ts';

export type PadDir = 'up' | 'down' | 'left' | 'right';

const ARROW: Record<PadDir, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const STORE = 'kotomachi.pad';
export const PAD_QUERY = '(orientation: portrait) and (max-width: 640px) and (any-pointer: coarse)';

/**
 * Which way a touch at (dx, dy) from the d-pad's centre points. Within the dead zone
 * in the middle it points nowhere. Sliding your thumb round changes direction.
 */
export function padDir(dx: number, dy: number, radius: number, dead = 0.22): PadDir | null {
  if (Math.hypot(dx, dy) < radius * dead) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

function send(type: 'keydown' | 'keyup', key: string, code: string): void {
  window.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true }));
}

export class TouchPad {
  readonly el: HTMLElement;
  private dpad: HTMLElement;
  private toggle: HTMLButtonElement;
  private dir: PadDir | null = null;
  private held = new Map<string, [string, string]>();
  private wanted: boolean;
  private active = false;
  private fits: MediaQueryList | null;

  constructor(root: HTMLElement) {
    this.wanted = load();
    this.fits = typeof matchMedia === 'function' ? matchMedia(PAD_QUERY) : null;
    const arms = (['up', 'left', 'right', 'down'] as PadDir[]).map((d) => h('span', { class: `pad-arm pad-${d}`, 'aria-hidden': 'true' }));
    this.dpad = h('div', { class: 'pad-dpad', role: 'group', 'aria-label': 'Walk' }, h('span', { class: 'pad-hub', 'aria-hidden': 'true' }), arms);
    const btnA = this.button('pad-a', 'A', 'Talk', 'Enter', 'Enter');
    const btnB = this.button('pad-b', 'B', 'Book', 'n', 'KeyN');
    this.toggle = h('button', { class: 'pad-toggle', type: 'button', 'aria-expanded': 'true' }) as HTMLButtonElement;
    this.toggle.addEventListener('click', () => this.setWanted(!this.wanted));
    this.el = h('div', { class: 'pad-layer', hidden: true },
      this.toggle,
      h('div', { class: 'pad', 'aria-label': 'Controls' }, this.dpad, h('div', { class: 'pad-buttons' }, btnB, btnA)),
    );
    root.append(this.el);

    this.dpad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.dpad.setPointerCapture?.(e.pointerId);
      this.aim(e);
    });
    this.dpad.addEventListener('pointermove', (e) => {
      if (this.dpad.hasPointerCapture?.(e.pointerId) ?? e.buttons) this.aim(e);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) this.dpad.addEventListener(ev, () => this.walk(null));
    // No page scroll, pinch, double-tap zoom, text selection or long-press menu from the controls.
    for (const t of [this.dpad, btnA, btnB]) {
      t.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      t.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    this.fits?.addEventListener?.('change', () => this.sync());
    window.addEventListener('blur', () => this.releaseAll());
    this.sync();
  }

  /** Call every frame: true while you're out walking and the controls may show. */
  setActive(on: boolean): void {
    if (on === this.active) return;
    this.active = on;
    if (!on) this.releaseAll();
    this.sync();
  }

  get shown(): boolean {
    return this.active && this.wanted && !!this.fits?.matches;
  }

  private button(cls: string, label: string, caption: string, key: string, code: string): HTMLElement {
    const b = h('button', { class: `pad-btn ${cls}`, type: 'button', 'aria-label': caption }, h('b', {}, label), h('small', {}, caption));
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture?.(e.pointerId);
      b.classList.add('on');
      this.press(code, key, code);
    });
    const up = () => {
      b.classList.remove('on');
      this.release(code);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    return b;
  }

  private aim(e: PointerEvent): void {
    const r = this.dpad.getBoundingClientRect();
    this.walk(padDir(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width / 2));
  }

  private walk(d: PadDir | null): void {
    if (d === this.dir) return;
    if (this.dir) this.release('dpad');
    this.dir = d;
    this.dpad.dataset['dir'] = d ?? '';
    if (d) this.press('dpad', ARROW[d], ARROW[d]);
  }

  private press(id: string, key: string, code: string): void {
    if (this.held.has(id)) return;
    this.held.set(id, [key, code]);
    send('keydown', key, code);
  }

  private release(id: string): void {
    const k = this.held.get(id);
    if (!k) return;
    this.held.delete(id);
    send('keyup', k[0], k[1]);
  }

  private releaseAll(): void {
    this.dir = null;
    this.dpad.dataset['dir'] = '';
    for (const id of [...this.held.keys()]) this.release(id);
    for (const b of this.el.querySelectorAll('.pad-btn.on')) b.classList.remove('on');
  }

  private setWanted(on: boolean): void {
    this.wanted = on;
    save(on);
    if (!on) this.releaseAll();
    this.sync();
  }

  private sync(): void {
    const fits = !!this.fits?.matches;
    this.el.hidden = !(this.active && fits);
    this.el.classList.toggle('closed', !this.wanted);
    this.toggle.textContent = this.wanted ? 'Hide controls ▾' : 'Controls ▴';
    this.toggle.setAttribute('aria-expanded', String(this.wanted));
    document.body.classList.toggle('pad-open', this.shown);
    document.body.classList.toggle('pad-tab', this.active && fits && !this.wanted);
  }
}

function load(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORE) !== 'off';
  } catch {
    return true;
  }
}

function save(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(STORE, on ? 'on' : 'off');
  } catch {
    // Private mode or blocked storage: the choice lasts until the page is closed.
  }
}
