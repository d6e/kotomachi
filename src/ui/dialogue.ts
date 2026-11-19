// The conversation panel for one scenario run: the NPC's lines, your answers, and the
// input for the current ladder rung (choices, word tiles or fill-in-the-blank).

import { hasLatin, toKana } from '../lang/kana.ts';
import { parseLine, type Token, type Vocab } from '../lang/markup.ts';
import { MODE_NAMES, type AnswerOutcome, type PromptView, type ScenarioRun } from '../scenario/engine.ts';
import { clear, h } from './dom.ts';
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
  done: (run: ScenarioRun) => void;
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

  constructor(root: HTMLElement) {
    this.header = h('div', { class: 'dlg-header' });
    this.log = h('div', { class: 'dlg-log', 'aria-live': 'polite' });
    this.input = h('div', { class: 'dlg-input' });
    this.el = h('div', { class: 'dialogue', hidden: true, role: 'dialog' }, this.header, this.log, this.input);
    root.append(this.el);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  start(run: ScenarioRun, hooks: DialogueHooks): void {
    this.run = run;
    this.hooks = hooks;
    this.lastLineNode = null;
    clear(this.log);
    this.el.hidden = false;
    this.keyHandler = (e) => this.onKey(e);
    window.addEventListener('keydown', this.keyHandler);
    this.render();
  }

  close(): void {
    this.el.hidden = true;
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
    this.run = null;
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.run || (e.target instanceof HTMLInputElement)) return;
    if (document.querySelector('.popup:not([hidden])')) return;
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

  private tokens(tokens: Token[], mode: number, cls?: string): HTMLElement {
    const hooks = this.hooks!;
    return renderTokens(tokens, {
      furigana: (t) => hooks.furigana(t, mode),
      onTap: (t, el) => hooks.lookup(t, el),
      className: cls,
    });
  }

  private bubble(who: 'npc' | 'me', content: HTMLElement, gloss?: string, extraClass = ''): void {
    const b = h('div', { class: `bubble ${who} ${extraClass}`.trim() },
      content,
      gloss ? h('div', { class: 'gloss' }, gloss) : null,
    );
    this.log.append(b);
    this.log.scrollTop = this.log.scrollHeight;
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
    this.header.append(
      h('div', { class: 'who' }, name, h('span', { class: 'place' }, hooks.placeName)),
      h('div', { class: 'stage' + (view.fallback ? ' fallback' : '') }, MODE_NAMES[view.mode], glossToggle),
    );
    this.el.classList.toggle('show-gloss', hooks.glossOn());
  }

  private render(): void {
    const run = this.run!;
    const hooks = this.hooks!;
    if (run.ended) {
      clear(this.input);
      const leave = h('button', { class: 'primary', onclick: () => {
        const r = this.run!;
        this.close();
        hooks.done(r);
      } }, 'Leave ▶');
      this.input.append(leave);
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
    if (view.mode === 0) this.renderContinue();
    else if (view.mode === 1 || view.mode === 2) this.renderChoices(view);
    else if (view.mode === 3) this.renderTiles(view);
    else this.renderBlank(view);
  }

  private after(out: AnswerOutcome, mode: number): void {
    if (out.said.length) this.bubble('me', this.tokens(out.said, mode), undefined, out.correct ? '' : 'wrong');
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
    const list = h('div', { class: 'choices' });
    view.choices!.forEach((c, i) => {
      const row = h('div', { class: 'choice', role: 'button', tabindex: '0' },
        h('span', { class: 'num' }, String(i + 1)),
        h('span', { class: 'choice-text' }, this.tokens(c.tokens, view.mode), c.gloss ? h('span', { class: 'gloss' }, c.gloss) : null),
      );
      row.addEventListener('click', () => this.after(this.run!.answerChoice(c.index), view.mode));
      list.append(row);
    });
    this.input.append(list, h('div', { class: 'hint' }, 'Tap a word to look it up. Tap the row (or press its number) to answer.'));
  }

  private renderTiles(view: PromptView): void {
    const chosen: number[] = [];
    const answer = h('div', { class: 'tile-answer', 'aria-label': 'Your sentence' });
    const pool = h('div', { class: 'tile-pool' });
    const tiles = view.tiles!;
    const draw = () => {
      clear(answer);
      clear(pool);
      if (chosen.length === 0) answer.append(h('span', { class: 'placeholder' }, 'Build your answer from the tiles below'));
      for (const id of chosen) {
        const t = tiles.find((x) => x.id === id)!;
        answer.append(h('button', { class: 'tile', lang: 'ja', onclick: () => { chosen.splice(chosen.indexOf(id), 1); draw(); } }, this.tokens(t.tokens, 3)));
      }
      for (const t of tiles) {
        const used = chosen.includes(t.id);
        pool.append(h('button', { class: 'tile' + (used ? ' used' : ''), lang: 'ja', ...(used ? { disabled: true } : {}), onclick: () => { chosen.push(t.id); draw(); } },
          renderTokens(t.tokens, { furigana: (tok) => this.hooks!.furigana(tok, 3) })));
      }
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
