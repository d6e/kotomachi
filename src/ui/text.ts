// Renders pre-segmented tokens as tappable words with furigana (<ruby>).

import type { Token } from '../lang/markup.ts';
import { h } from './dom.ts';

export interface TextOptions {
  /** Whether to show furigana above this token's kanji. */
  furigana: (t: Token) => boolean;
  /** Tap on a word. Tokens without a dictionary form (punctuation, numbers) aren't tappable. */
  onTap?: (t: Token, el: HTMLElement) => void;
  className?: string;
}

export function renderTokens(tokens: Token[], opts: TextOptions): HTMLElement {
  const line = h('span', { class: `jp ${opts.className ?? ''}`.trim(), lang: 'ja' });
  for (const t of tokens) {
    const showFuri = opts.furigana(t);
    const el = h('span', { class: t.lemma ? 'tok word' : 'tok' });
    for (const part of t.ruby) {
      if (part.rt) {
        const rb = h('ruby', { class: showFuri ? '' : 'no-furi' }, part.text, h('rt', {}, part.rt));
        el.append(rb);
      } else el.append(part.text);
    }
    if (t.lemma && opts.onTap) {
      el.dataset['lemma'] = t.lemma;
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
