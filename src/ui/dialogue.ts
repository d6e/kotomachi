// The conversation panel for one scenario run: the NPC's lines, your answers, and the
// input for the current ladder rung (choices, word tiles or fill-in-the-blank).

import { hasLatin, toKana } from '../lang/kana.ts';
import { parseLine, type Token, type Vocab } from '../lang/markup.ts';
import { MODE_NAMES, type AnswerOutcome, type PromptView, type ScenarioRun } from '../scenario/engine.ts';
import { clear, h } from './dom.ts';
import { confettiFrom, embers, floatText, play, reducedMotion, sparkle } from './fx.ts';
import { renderTokens } from './text.ts';

export interface DialogueHooks {
  vocab: Vocab;
  npcName: string;
  placeName: string;
  furigana: (t: Token, mode: number) => boolean;
  /** Player tapped a word. */
  lookup: (t: Token, el: HTMLElement) => void;
  /** An NPC line was shown (words count as seen). */
  seen: (tokens: Token[]) => void;
  glossOn: () => boolean;
  setGloss: (on: boolean) => void;
  /** The conversation is over. `then` is the extra button's id, if that was the one pressed. */
  done: (run: ScenarioRun, then?: string) => void;
  /** Hearts with whoever you're talking to, 0 to 5, for friends only. */
  hearts?: number;
  /** A second button at the end, like "Give something", unless it went wrong. */
  extra?: { id: string; label: string };
  /** An answer was given (not just "next"): returns the run of right answers so far today. */
  answered?: (correct: boolean, said: Token[]) => number;
  /** Mark a word as new to you. */
  isNew?: (t: Token) => boolean;
  /** The run of right answers so far today, when the conversation opens. */
  combo?: () => number;
}

/** How hot a combo looks: 0 none, then 1 to 4. */
export function heat(combo: number): number {
  return combo < 2 ? 0 : combo < 4 ? 1 : combo < 7 ? 2 : combo < 10 ? 3 : 4;
}

export class DialogueView {
  readonly el: HTMLElement;
  private readonly log: HTMLElement;
  private readonly input: HTMLElement;
  private readonly header: HTMLElement;
  private run: ScenarioRun | null = null;
  private hooks: DialogueHooks | null = null;
  private lastLineNode: string | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private cursor = 0;
  /** NPC lines still typing out, oldest first; the input waits until they're done. */
  private typing: { bubble: HTMLElement; units: { el: HTMLElement; cost: number }[] }[] = [];
  private typeTimer: number | null = null;
  private comboEl: HTMLElement = h('span', { class: 'combo', hidden: true, 'aria-live': 'polite' });
  /** After a wrong pick, the node it was on: its right answer gets highlighted. */
  private missedOn: string | null = null;

  constructor(root: HTMLElement) {
    this.header = h('div', { class: 'dlg-header' });
    this.log = h('div', { class: 'dlg-log', 'aria-live': 'polite' });
    this.input = h('div', { class: 'dlg-input' });
    this.el = h('div', { class: 'dialogue', hidden: true, role: 'dialog' }, this.header, this.log, this.input);
    root.append(this.el);
    // Clicking the log skips the typing.
    this.log.addEventListener('click', () => this.finishTyping());
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  start(run: ScenarioRun, hooks: DialogueHooks): void {
    this.run = run;
    this.hooks = hooks;
    this.lastLineNode = null;
    this.missedOn = null;
    clear(this.log);
    this.setCombo(hooks.combo?.() ?? 0, false);
    this.el.hidden = false;
    this.keyHandler = (e) => this.onKey(e);
    window.addEventListener('keydown', this.keyHandler);
    this.render();
  }

  close(): void {
    this.finishTyping();
    this.el.hidden = true;
    this.el.classList.remove('advance', 'typing-now');
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
    this.run = null;
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.run || (e.target instanceof HTMLInputElement)) return;
    if (document.querySelector('.popup:not([hidden])')) return;
    if (this.typing.length) {
      // While a line is typing out, the usual keys skip to the end of it.
      if (['Enter', ' ', 'e', 'E', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) || /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        this.finishTyping();
      }
      return;
    }
    const rows = [...this.input.querySelectorAll<HTMLElement>('.choice')];
    if (rows.length) {
      // A menu with a ▶ cursor: arrows or W/S move it, Enter, Space or E picks.
      const up = e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowLeft';
      const down = e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' || e.key === 'ArrowRight';
      if (up || down) {
        e.preventDefault();
        this.moveCursor(rows, (this.cursor + (down ? 1 : -1) + rows.length) % rows.length);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        rows[this.cursor]?.click();
        return;
      }
    }
    const n = Number(e.key);
    if (n >= 1 && n <= 9) {
      const row = this.input.querySelectorAll<HTMLElement>('.choice')[n - 1];
      if (row) {
        e.preventDefault();
        row.click();
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      const btn = this.input.querySelector<HTMLButtonElement>('button.primary');
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    }
  }

  private moveCursor(rows: HTMLElement[], i: number): void {
    this.cursor = i;
    rows.forEach((r, k) => {
      r.classList.toggle('sel', k === i);
      r.setAttribute('aria-selected', String(k === i));
    });
  }

  private tokens(tokens: Token[], mode: number, cls?: string): HTMLElement {
    const hooks = this.hooks!;
    return renderTokens(tokens, {
      furigana: (t) => hooks.furigana(t, mode),
      onTap: (t, el) => hooks.lookup(t, el),
      isNew: hooks.isNew,
      className: cls,
    });
  }

  private bubble(who: 'npc' | 'me', content: HTMLElement, gloss?: string, extraClass = ''): HTMLElement {
    const b = h('div', { class: `bubble ${who} ${extraClass}`.trim() },
      content,
      gloss ? h('div', { class: 'gloss' }, gloss) : null,
    );
    this.log.append(b);
    if (who === 'npc') {
      for (const old of this.log.querySelectorAll('.bubble.latest')) old.classList.remove('latest');
      b.classList.add('latest');
      this.typeOut(b);
    }
    this.log.scrollTop = this.log.scrollHeight;
    return b;
  }

  // ---------------------------------------------------------------- combo

  private setCombo(n: number, animate: boolean): void {
    const el = this.comboEl;
    const level = heat(n);
    if (level === 0) {
      if (animate && !el.hidden) {
        // The streak breaks: the badge drops away.
        play(el, 'combo-break');
        if (reducedMotion()) el.hidden = true;
        else el.addEventListener('animationend', () => (el.hidden = heat(this.comboN) === 0), { once: true });
      } else el.hidden = true;
      this.comboN = n;
      return;
    }
    this.comboN = n;
    el.hidden = false;
    el.className = `combo heat-${level}`;
    el.textContent = `×${n} combo`;
    if (animate) {
      play(el, 'combo-bump');
      if (level >= 3) embers(el, level === 4 ? 10 : 5);
    }
  }

  private comboN = 0;

  // ---------------------------------------------------------------- typing

  /** Type an NPC line out a character at a time, like a text box in an old handheld game. */
  private typeOut(b: HTMLElement): void {
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const units: { el: HTMLElement; cost: number }[] = [];
    for (const tok of b.querySelectorAll<HTMLElement>('.jp > .tok')) {
      for (const child of [...tok.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          for (const ch of child.textContent ?? '') {
            const span = h('span', { class: 'ch ch-hide' }, ch);
            units.push({ el: span, cost: 1 });
            frag.append(span);
          }
          child.replaceWith(frag);
        } else if (child instanceof HTMLElement) {
          // A word with furigana appears whole, after as long as its letters would take.
          child.classList.add('ch-hide');
          const base = [...child.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('');
          units.push({ el: child, cost: Math.max(1, [...base].length) });
        }
      }
    }
    if (!units.length) return;
    b.classList.add('typing');
    this.el.classList.add('typing-now');
    this.typing.push({ bubble: b, units });
    this.input.classList.add('pending');
    if (this.typeTimer === null) this.tick(0);
  }

  private tick(wait: number): void {
    this.typeTimer = window.setTimeout(() => {
      const cur = this.typing[0];
      if (!cur) return this.doneTyping();
      const u = cur.units.shift();
      if (u) u.el.classList.remove('ch-hide');
      if (!cur.units.length) {
        cur.bubble.classList.remove('typing');
        this.typing.shift();
        if (!this.typing.length) return this.doneTyping();
        this.log.scrollTop = this.log.scrollHeight;
      }
      this.tick(30 * (u?.cost ?? 1));
    }, wait);
  }

  private finishTyping(): void {
    if (!this.typing.length) return;
    for (const t of this.typing) {
      for (const u of t.units) u.el.classList.remove('ch-hide');
      t.bubble.classList.remove('typing');
    }
    this.typing = [];
    this.doneTyping();
  }

  private doneTyping(): void {
    if (this.typeTimer !== null) window.clearTimeout(this.typeTimer);
    this.typeTimer = null;
    this.typing = [];
    this.el.classList.remove('typing-now');
    this.input.classList.remove('pending');
    this.log.scrollTop = this.log.scrollHeight;
    this.input.querySelector<HTMLElement>('input.blank, button.primary')?.focus();
  }

  get isTyping(): boolean {
    return this.typing.length > 0;
  }

  private renderHeader(view: PromptView): void {
    const hooks = this.hooks!;
    clear(this.header);
    const name = renderTokens(parseLine(hooks.npcName, hooks.vocab), { furigana: () => true, onTap: hooks.lookup });
    const glossToggle =
      view.mode <= 1
        ? h('label', { class: 'gloss-toggle' },
            h('input', { type: 'checkbox', ...(hooks.glossOn() ? { checked: true } : {}), onchange: (e: Event) => {
              hooks.setGloss((e.target as HTMLInputElement).checked);
              this.el.classList.toggle('show-gloss', hooks.glossOn());
            } }),
            ' English')
        : null;
    const hearts = hooks.hearts === undefined
      ? null
      : h('span', { class: 'hearts', title: `${hooks.hearts} of 5 hearts`, 'aria-label': `${hooks.hearts} of 5 hearts` }, '♥'.repeat(hooks.hearts), h('span', { class: 'hearts-empty' }, '♥'.repeat(5 - hooks.hearts)));
    this.header.append(
      h('div', { class: 'who' }, name, hearts, this.comboEl),
      h('div', { class: 'stage' + (view.fallback ? ' fallback' : '') }, MODE_NAMES[view.mode], glossToggle),
    );
    this.el.classList.toggle('show-gloss', hooks.glossOn());
  }

  private render(): void {
    const run = this.run!;
    const hooks = this.hooks!;
    if (run.ended) {
      this.el.classList.remove('advance');
      clear(this.input);
      const leave = h('button', { class: 'primary', onclick: () => {
        const r = this.run!;
        this.close();
        hooks.done(r);
      } }, run.consequence ? 'And then… ▶' : 'Leave ▶');
      const extra = hooks.extra && !run.consequence
        ? h('button', { onclick: () => {
            const r = this.run!;
            this.close();
            hooks.done(r, hooks.extra!.id);
          } }, hooks.extra.label)
        : null;
      this.input.append(...(extra ? [extra, leave] : [leave]));
      leave.focus();
      return;
    }
    const view = run.current();
    this.renderHeader(view);
    if (this.lastLineNode !== view.nodeId) {
      this.lastLineNode = view.nodeId;
      this.bubble('npc', this.tokens(view.line, view.mode), view.gloss);
      hooks.seen(view.line);
    }
    clear(this.input);
    // ▼ only when the next step is just "advance": no menu, tiles or blank to fill.
    this.el.classList.toggle('advance', view.mode === 0);
    if (view.mode === 0) this.renderContinue();
    else if (view.mode === 1 || view.mode === 2) this.renderChoices(view);
    else if (view.mode === 3) this.renderTiles(view);
    else this.renderBlank(view);
  }

  private after(out: AnswerOutcome, mode: number): void {
    const nodeId = this.run!.current().nodeId;
    const said = out.said.length ? this.bubble('me', this.tokens(out.said, mode), undefined, out.correct ? '' : 'wrong') : null;
    if (mode >= 1) {
      const combo = this.hooks!.answered?.(out.correct, out.said) ?? 0;
      if (out.correct && said) {
        play(said, 'pop');
        sparkle(said, 8 + Math.min(12, combo));
        if (combo > 0 && combo % 5 === 0) confettiFrom(said, 28);
      } else if (said) {
        play(said, 'wobble');
        // Show what would have been right: in the log for tiles and typing, and on the
        // menu itself when the same choice comes round again.
        const better = this.run!.corrections[this.run!.corrections.length - 1]?.betterTokens;
        if (mode >= 3 && better?.length) said.append(h('div', { class: 'right-answer' }, h('span', { class: 'tick', 'aria-hidden': 'true' }, '✓'), this.tokens(better, mode)));
      }
      this.missedOn = out.correct ? null : nodeId;
      this.setCombo(combo, true);
      // The +N rises from the streak badge in the header, which never scrolls, so it
      // floats up over the town and never over a line you're reading.
      if (out.correct) {
        const badge = this.comboEl.hidden ? this.header.querySelector('.who > .jp') : this.comboEl;
        if (badge) floatText(badge, combo >= 2 ? `+${combo}` : '+1', `heat-${heat(combo)}`);
      }
    }
    if (out.reaction) {
      this.bubble('npc', this.tokens(out.reaction, mode), undefined, 'reaction');
      this.hooks!.seen(out.reaction);
    }
    this.render();
  }

  private renderContinue(): void {
    const btn = h('button', { class: 'primary', onclick: () => this.after(this.run!.continue(), 0) }, '▶');
    this.input.append(btn);
    btn.focus();
  }

  private renderChoices(view: PromptView): void {
    const list = h('div', { class: 'choices', role: 'listbox', 'aria-label': 'What do you say?' });
    const rows: HTMLElement[] = [];
    const right = this.missedOn === view.nodeId ? new Set(this.run!.rightChoices()) : new Set<number>();
    view.choices!.forEach((c, i) => {
      const row = h('div', { class: 'choice' + (right.has(c.index) ? ' show-right' : ''), role: 'option', tabindex: '-1' },
        h('span', { class: 'cursor', 'aria-hidden': 'true' }, '▶'),
        h('span', { class: 'choice-text' }, this.tokens(c.tokens, view.mode), c.gloss ? h('span', { class: 'gloss' }, c.gloss) : null),
      );
      row.addEventListener('click', () => this.after(this.run!.answerChoice(c.index), view.mode));
      // Follow the mouse only when it really moves: rows redrawn under a still pointer
      // must not steal the cursor from the keyboard.
      row.addEventListener('pointermove', (e) => {
        if ((e.movementX || e.movementY) && this.cursor !== i) this.moveCursor(rows, i);
      });
      rows.push(row);
      list.append(row);
    });
    this.moveCursor(rows, 0);
    this.input.append(list, h('div', { class: 'hint' }, '↑↓ to move, Enter to say it. Tap a word to look it up.'));
  }

  private renderTiles(view: PromptView): void {
    const chosen: number[] = [];
    const answer = h('div', { class: 'tile-answer', 'aria-label': 'Your sentence' });
    const pool = h('div', { class: 'tile-pool' });
    const tiles = view.tiles!;
    // Where a tapped tile was, so it can fly from there to its new place.
    let from: { id: number; rect: DOMRect } | null = null;
    const tilt = (el: HTMLElement) => {
      if (reducedMotion()) return;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 16}deg`);
        el.style.setProperty('--rx', `${(0.5 - (e.clientY - r.top) / r.height) * 16}deg`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.removeProperty('--rx');
        el.style.removeProperty('--ry');
      });
    };
    const snap = (el: HTMLElement) => {
      if (!from || reducedMotion()) return;
      const to = el.getBoundingClientRect();
      const dx = from.rect.left - to.left;
      const dy = from.rect.top - to.top;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(1.06)` }, { transform: 'translate(0, -3px) scale(1.04)', offset: 0.75 }, { transform: 'none' }],
        { duration: 210, easing: 'cubic-bezier(.2,.8,.3,1.2)' },
      );
    };
    const draw = () => {
      clear(answer);
      clear(pool);
      if (chosen.length === 0) answer.append(h('span', { class: 'placeholder' }, 'Build your answer from the tiles below'));
      const moved: [number, HTMLElement][] = [];
      for (const id of chosen) {
        const t = tiles.find((x) => x.id === id)!;
        const el = h('button', { class: 'tile', lang: 'ja', onclick: (e: Event) => {
          from = { id, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() };
          chosen.splice(chosen.indexOf(id), 1);
          draw();
        } }, this.tokens(t.tokens, 3));
        tilt(el);
        answer.append(el);
        moved.push([id, el]);
      }
      for (const t of tiles) {
        const used = chosen.includes(t.id);
        const el = h('button', { class: 'tile' + (used ? ' used' : ''), lang: 'ja', ...(used ? { disabled: true } : {}), onclick: (e: Event) => {
          from = { id: t.id, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() };
          chosen.push(t.id);
          draw();
        } }, renderTokens(t.tokens, { furigana: (tok) => this.hooks!.furigana(tok, 3), isNew: this.hooks!.isNew }));
        tilt(el);
        pool.append(el);
        if (!used) moved.push([t.id, el]);
      }
      const landed = from && moved.find(([id]) => id === from!.id);
      if (landed) snap(landed[1]);
      from = null;
    };
    draw();
    const check = h('button', { class: 'primary', onclick: () => this.after(this.run!.answerTiles(chosen), 3) }, 'Say it ▶');
    const reset = h('button', { onclick: () => { chosen.length = 0; draw(); } }, 'Clear');
    this.input.append(answer, pool, h('div', { class: 'row' }, reset, check));
  }

  private renderBlank(view: PromptView): void {
    const field = h('input', {
      class: 'blank', type: 'text', lang: 'ja', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      'aria-label': 'Type the missing part (romaji turns into kana)',
    });
    field.addEventListener('input', () => {
      const v = field.value;
      const converted = toKana(v, { ime: true });
      if (converted !== v) field.value = converted;
    });
    const submit = () => {
      const value = toKana(field.value);
      if (!value.trim() || hasLatin(value)) {
        field.classList.add('shake');
        setTimeout(() => field.classList.remove('shake'), 300);
        return;
      }
      this.after(this.run!.answerBlank(value), 4);
    };
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
    const sentence = h('div', { class: 'blank-line' }, this.tokens(view.blank!.before, 4), field, this.tokens(view.blank!.after, 4));
    this.input.append(
      sentence,
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: submit }, 'Say it ▶')),
      h('div', { class: 'hint' }, 'Type in romaji and it turns into kana. Capital letters give katakana.'),
    );
    setTimeout(() => field.focus(), 0);
  }
}
