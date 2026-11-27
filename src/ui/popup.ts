// The word popup: reading, meaning, part of speech, conjugation breakdown, and
// where you met the word. Tapping the reading (or the word) shows it in romaji,
// for anyone still learning their kana; it's hidden until then.

import { explainForm } from '../lang/conj.ts';
import { toRomaji } from '../lang/kana.ts';
import { parseLine, type Token, type Vocab, type VocabEntry } from '../lang/markup.ts';
import type { Learner, WordStatus } from '../learner/model.ts';
import type { NpcDef, NpcId } from '../scenario/types.ts';
import { clear, h } from './dom.ts';
import { ALWAYS, renderTokens } from './text.ts';

export interface PopupContext {
  vocab: Vocab;
  learner: Learner;
  forms: Record<string, string>;
  npcs: Record<NpcId, NpcDef>;
  placeName: (place: string) => string;
}

export const STATUS_LABEL: Record<WordStatus, string> = {
  unseen: 'new',
  seen: 'seen',
  recognized: 'recognized',
  produced: 'produced',
};

export class Popup {
  readonly el: HTMLElement;
  private readonly ctx: PopupContext;

  constructor(root: HTMLElement, ctx: PopupContext) {
    this.ctx = ctx;
    this.el = h('div', { class: 'popup', role: 'dialog', 'aria-label': 'Word lookup', hidden: true });
    root.append(this.el);
    document.addEventListener('pointerdown', (e) => {
      if (!this.el.hidden && !this.el.contains(e.target as Node)) this.hide();
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.el.hidden) {
        e.stopPropagation();
        this.hide();
      }
    }, true);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  hide(): void {
    this.el.hidden = true;
  }

  show(token: Token, anchor: { left: number; top: number; bottom: number }): void {
    const { vocab, learner, forms, npcs } = this.ctx;
    const lemma = token.lemma;
    if (!lemma) return;
    const entry = vocab.get(lemma);
    if (!entry) return;
    clear(this.el);
    const head = renderTokens(parseLine(entry.id, vocab), { furigana: ALWAYS, className: 'popup-word' });
    const rec = learner.get(lemma);
    const status = learner.status(lemma);
    const form = explainForm(token.surface, lemma, forms);
    const met = (rec?.met ?? []).map((m) => {
      const who = m.npc ? npcs[m.npc] : undefined;
      const whoEl = who ? renderTokens(parseLine(who.name, vocab), { furigana: ALWAYS }) : null;
      return h('li', {}, whoEl ?? '', whoEl ? ' · ' : '', this.ctx.placeName(m.place), ` · day ${m.day}`);
    });
    const romaji = h('span', { class: 'romaji', lang: 'en' }, readingRomaji(entry));
    const hint = h('span', { class: 'romaji-hint', lang: 'en', 'aria-hidden': 'true' }, 'romaji');
    const reading = h(
      'button',
      { type: 'button', class: 'popup-reading', 'aria-pressed': 'false', 'aria-label': `${entry.reading}: show romaji` },
      h('span', { class: 'kana', lang: 'ja' }, `「${entry.reading}」`),
      hint,
      romaji,
    );
    const toggle = () => {
      const on = reading.getAttribute('aria-pressed') !== 'true';
      reading.setAttribute('aria-pressed', String(on));
      reading.setAttribute('aria-label', on ? `${entry.reading}: ${romaji.textContent}` : `${entry.reading}: show romaji`);
      this.el.classList.toggle('show-romaji', on);
    };
    reading.addEventListener('click', toggle);
    head.classList.add('popup-word-tap');
    head.addEventListener('click', toggle);
    this.el.classList.remove('show-romaji');
    this.el.append(
      h('div', { class: 'popup-head' }, head, h('span', { class: `chip st-${status}` }, STATUS_LABEL[status])),
      reading,
      h('div', { class: 'popup-meaning' }, entry.meaning),
      h('div', { class: 'popup-pos' }, entry.pos),
    );
    if (form) this.el.append(h('div', { class: 'popup-form' }, h('span', { lang: 'ja' }, form.change), form.label ? h('div', {}, form.label) : null));
    if (met.length) this.el.append(h('div', { class: 'popup-met' }, h('div', { class: 'label' }, 'Where you met it'), h('ul', {}, met)));
    this.el.hidden = false;
    // Position near the anchor, inside the viewport.
    const r = this.el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Math.min(Math.max(8, anchor.left), vw - r.width - 8);
    let top = anchor.bottom + 8;
    if (top + r.height > vh - 8) top = Math.max(8, anchor.top - r.height - 8);
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }
}

/** A word's reading in romaji, with は and へ read as particles where the word is one (or ends in one). */
export function readingRomaji(entry: Pick<VocabEntry, 'reading' | 'pos'>): string {
  return toRomaji(entry.reading, { particle: /particle|set phrase|conjunction/.test(entry.pos) });
}
