// Keyboard state: which keys are held, and which were pressed since the last frame.
// Keys typed into text fields are ignored.

export class Input {
  private held = new Set<string>();
  private fresh = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (isTyping(e.target)) return;
      if (!e.repeat) this.fresh.add(e.code);
      this.held.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.held.delete(e.code));
    target.addEventListener('blur', () => this.held.clear());
  }

  down(code: string): boolean {
    return this.held.has(code);
  }

  pressed(code: string): boolean {
    return this.fresh.has(code);
  }

  /** Call once at the end of every frame. */
  endFrame(): void {
    this.fresh.clear();
  }

  clear(): void {
    this.held.clear();
    this.fresh.clear();
  }
}

function isTyping(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
}
