// The morning errand list. Due reviews choose the content: for each shop, the variant
// (which drink, which medicine...) whose words are most due today becomes the errand.

import { greetSlots } from '../scenario/engine.ts';
import { lemmasOf, parseLine, type Vocab } from '../lang/markup.ts';
import type { Learner } from '../learner/model.ts';
import type { ScenarioDef, VariantDef } from '../scenario/types.ts';

export interface Errand {
  scenario: string;
  variant: string;
  /** Japanese errand line (markup), already filled in. */
  text: string;
  done: boolean;
}

/** Words a variant would put in front of the player. */
export function variantWords(def: ScenarioDef, variant: VariantDef, vocab: Vocab): string[] {
  const slots: Record<string, string> = { ...variant.slots, price: String(variant.price ?? 0), ...greetSlots('day') };
  const words = new Set<string>();
  for (const v of Object.values(variant.slots)) for (const l of lemmasOf(parseLine(v, vocab))) words.add(l);
  for (const n of Object.values(def.nodes)) {
    if (n.onlyFor && !n.onlyFor.includes(variant.id)) continue;
    for (const t of n.targets) words.add(t);
    const line = typeof n.line === 'string' ? n.line : (n.line['0'] ?? '');
    for (const l of lemmasOf(parseLine(line, vocab, slots))) words.add(l);
  }
  return [...words];
}

/**
 * How much a variant is worth playing today. Due reviews come first; after that,
 * variants with words the player hasn't met yet; variants just played score lowest.
 * Averaged per word, so a long variant doesn't win just for having more words.
 */
export function variantScore(words: string[], learner: Learner, day: number): number {
  if (words.length === 0) return 0.5;
  let sum = 0;
  let due = false;
  for (const w of words) {
    if (learner.isDue(w, day)) {
      sum += 3;
      due = true;
    } else if (learner.status(w) === 'unseen') sum += 2.5;
  }
  return sum / words.length + (due ? 0.5 : 0);
}

/** Deterministic per-day tie-breaking. */
function dayHash(day: number, salt: string): number {
  let h = day * 2654435761;
  for (const c of salt) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

export function pickVariant(def: ScenarioDef, learner: Learner, vocab: Vocab, day: number, recent: Record<string, number> = {}): VariantDef {
  // The first variant is the gentle introduction, so it is always day 1's.
  if (day < 2) return def.variants[0]!;
  let best = def.variants[0]!;
  let bestScore = -Infinity;
  // A variant is judged by its own words: those used by at most half the variants,
  // so particles and the shared greeting don't drown out 傘 or 天気.
  const wordsOf = new Map(def.variants.map((v) => [v, variantWords(def, v, vocab)]));
  const count = new Map<string, number>();
  for (const ws of wordsOf.values()) for (const w of new Set(ws)) count.set(w, (count.get(w) ?? 0) + 1);
  const limit = Math.max(1, Math.floor(def.variants.length / 2));
  for (const v of def.variants) {
    const own = [...new Set(wordsOf.get(v)!)].filter((w) => count.get(w)! <= limit);
    const last = recent[`${def.id}/${v.id}`];
    // Given in the last few days: step back so the week feels different.
    const repeat = last === undefined ? 0 : Math.max(0, 4 - (day - last)) * 0.5;
    const score = variantScore(own, learner, day) - repeat + 0.5 * dayHash(Math.floor(day), def.id + v.id);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

export function makeErrands(defs: ScenarioDef[], learner: Learner, vocab: Vocab, day: number, recent: Record<string, number> = {}): Errand[] {
  return defs
    .filter((d) => d.errand)
    .map((d) => {
      const v = pickVariant(d, learner, vocab, day, recent);
      const slots: Record<string, string> = { ...v.slots, price: String(v.price ?? 0) };
      return { scenario: d.id, variant: v.id, text: d.errand!.replace(/\$([a-z_]+)/g, (m, n: string) => slots[n] ?? m), done: false };
    });
}
