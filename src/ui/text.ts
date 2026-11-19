// Renders pre-segmented tokens as tappable words with furigana (<ruby>).

import type { Token } from '../lang/markup.ts';
import { h } from './dom.ts';

export interface TextOptions {
  /** Whether to show furigana above this token's kanji. */
  furigana: (t: Token) => boolean;
  /** Tap on a word. Tokens without a dictionary form (punctuation, numbers) aren't tappable. */
  onTap?: (t: Token, el: HTMLElement) => void;
  className?: string;
  /** Mark a word as new to you (a dotted underline and a little sparkle). */
  isNew?: (t: Token) => boolean;
}

export function renderTokens(tokens: Token[], opts: TextOptions): HTMLElement {
  const line = h('span', { class: `jp ${opts.className ?? ''}`.trim(), lang: 'ja' });
  for (const t of tokens) {
    const showFuri = opts.furigana(t);
    const el = h('span', { class: t.lemma ? (opts.isNew?.(t) ? 'tok word new' : 'tok word') : 'tok' });
    if (t.lemma) el.dataset['lemma'] = t.lemma;
    for (const part of t.ruby) {
      if (part.rt) {
        const rb = h('ruby', { class: showFuri ? '' : 'no-furi' }, part.text, h('rt', {}, part.rt));
        el.append(rb);
      } else el.append(part.text);
    }
    if (t.lemma && opts.onTap) {
      el.tabIndex = 0;
      const tap = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        opts.onTap!(t, el);
      };
      el.addEventListener('click', tap);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tap(e);
      });
    }
    line.append(el);
  }
  return line;
}

/** Furigana for every token (notebook, popups). */
export const ALWAYS = () => true;

/** Take the new-word mark off every copy of a word on screen. */
export function unmarkNew(lemma: string): void {
  for (const el of document.querySelectorAll<HTMLElement>('.tok.new')) if (el.dataset['lemma'] === lemma) el.classList.remove('new');
}
