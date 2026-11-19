// Pre-segmented line markup.
//
// Lines in the data files are written as space-separated tokens:
//   "いらっしゃいませ 。 ご注文 は お決まり=決まる ですか ？"
// Each token is `surface[=lemma]`. The lemma is the dictionary form the learner model
// tracks; it defaults to the surface when the surface itself is a vocab entry.
// Furigana is derived from the lemma's reading, or written explicitly as {漢字|かんじ}.
// `$name` inserts a slot (itself markup) before parsing.

import { hasKanji, katakanaToHiragana } from './kana.ts';

export interface VocabEntry {
  id: string;
  reading: string;
  meaning: string;
  pos: string;
  note?: string;
}

export interface RubyPart {
  text: string;
  rt?: string;
}

export interface Token {
  surface: string;
  lemma: string | null;
  ruby: RubyPart[];
}

export type Slots = Record<string, string>;

const PUNCT = /^[。、？！「」『』（）()…・〜ー!?,.:：\s]+$/;
const LITERAL = /^[0-9０-９A-Za-zＡ-Ｚ¥￥,]+$/;

export class Vocab {
  private map = new Map<string, VocabEntry>();

  constructor(entries: VocabEntry[]) {
    for (const e of entries) {
      if (this.map.has(e.id)) throw new Error(`duplicate vocab entry: ${e.id}`);
      this.map.set(e.id, e);
    }
  }

  get(id: string): VocabEntry | undefined {
    return this.map.get(id);
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  all(): VocabEntry[] {
    return [...this.map.values()];
  }

  get size(): number {
    return this.map.size;
  }
}

export function fillSlots(markup: string, slots: Slots = {}): string {
  return markup.replace(/\$([a-z_]+)/g, (m, name: string) => (name in slots ? slots[name]! : m));
}

/** Split a string into alternating kanji / non-kanji runs. */
function runs(s: string): { text: string; kanji: boolean }[] {
  const out: { text: string; kanji: boolean }[] = [];
  for (const ch of s) {
    const k = hasKanji(ch);
    const last = out[out.length - 1];
    if (last && last.kanji === k) last.text += ch;
    else out.push({ text: ch, kanji: k });
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Readings for each kanji run of `word`, given the whole word's kana reading. */
export function kanjiRunReadings(word: string, reading: string): Map<string, string> | null {
  const parts = runs(word);
  const pattern = parts.map((p) => (p.kanji ? '(.+?)' : escapeRe(katakanaToHiragana(p.text)))).join('');
  const m = new RegExp(`^${pattern}$`).exec(katakanaToHiragana(reading));
  if (!m) return null;
  const result = new Map<string, string>();
  let g = 1;
  for (const p of parts) if (p.kanji) result.set(p.text, m[g++]!);
  return result;
}

/** Furigana for a surface form, using the lemma's reading to find each kanji run's reading. */
export function autoRuby(surface: string, lemma: VocabEntry | undefined): RubyPart[] | null {
  if (!hasKanji(surface)) return [{ text: surface }];
  if (!lemma) return null;
  const readings = kanjiRunReadings(lemma.id, lemma.reading);
  if (!readings) return null;
  const out: RubyPart[] = [];
  for (const p of runs(surface)) {
    if (!p.kanji) {
      out.push({ text: p.text });
      continue;
    }
    const rt = readings.get(p.text);
    if (rt === undefined) return null;
    out.push({ text: p.text, rt });
  }
  return out;
}

function parseExplicitRuby(s: string): RubyPart[] {
  const out: RubyPart[] = [];
  const re = /\{([^|}]+)\|([^}]+)\}/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ text: m[1]!, rt: m[2]! });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

export function isPunct(s: string): boolean {
  return PUNCT.test(s);
}

export function isLiteral(s: string): boolean {
  return LITERAL.test(s);
}

export interface ParseIssue {
  token: string;
  problem: string;
}

export function parseToken(raw: string, vocab: Vocab, issues?: ParseIssue[]): Token {
  const eq = raw.indexOf('=');
  const surfaceMarkup = eq >= 0 ? raw.slice(0, eq) : raw;
  const explicitLemma = eq >= 0 ? raw.slice(eq + 1) : null;
  const explicitRuby = surfaceMarkup.includes('{');
  const surface = explicitRuby ? parseExplicitRuby(surfaceMarkup).map((p) => p.text).join('') : surfaceMarkup;

  let lemma: string | null = null;
  if (explicitLemma !== null) {
    lemma = explicitLemma;
    if (!vocab.has(lemma)) issues?.push({ token: raw, problem: `lemma "${lemma}" is not in the vocab` });
  } else if (vocab.has(surface)) {
    lemma = surface;
  } else if (!isPunct(surface) && !isLiteral(surface)) {
    issues?.push({ token: raw, problem: 'not in the vocab and has no =lemma' });
  }

  let ruby: RubyPart[];
  if (explicitRuby) ruby = parseExplicitRuby(surfaceMarkup);
  else {
    const auto = autoRuby(surface, lemma ? vocab.get(lemma) : undefined);
    if (auto) ruby = auto;
    else {
      issues?.push({ token: raw, problem: 'cannot derive furigana; write it as {漢字|かな}' });
      ruby = [{ text: surface }];
    }
  }
  return { surface, lemma, ruby };
}

export function parseLine(markup: string, vocab: Vocab, slots: Slots = {}, issues?: ParseIssue[]): Token[] {
  const filled = fillSlots(markup, slots);
  const unfilled = /\$[a-z_]+/.exec(filled);
  if (unfilled) issues?.push({ token: unfilled[0], problem: 'unfilled slot' });
  return filled
    .split(' ')
    .filter((t) => t.length > 0)
    .map((t) => parseToken(t, vocab, issues));
}

export function plainText(tokens: Token[]): string {
  return tokens.map((t) => t.surface).join('');
}

/** Dictionary forms that occur in a line, without duplicates. */
export function lemmasOf(tokens: Token[]): string[] {
  return [...new Set(tokens.map((t) => t.lemma).filter((l): l is string => l !== null))];
}
