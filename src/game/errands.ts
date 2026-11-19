// The morning errand list. Due reviews choose the content: for each shop, the variant
// (which drink, which medicine...) whose words are most due today becomes the errand.

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
  const slots: Record<string, string> = { ...variant.slots, price: String(variant.price ?? 0), greet: 'こんにちは' };
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

export function variantScore(words: string[], learner: Learner, day: number): number {
  let score = 0;
  for (const w of words) {
    const status = learner.status(w);
    if (learner.isDue(w, day)) score += 3;
    else if (status === 'seen') score += 1;
    else if (status === 'unseen') score += 0.5;
  }
  return score;
}

/** Deterministic per-day tie-breaking. */
function dayHash(day: number, salt: string): number {
  let h = day * 2654435761;
  for (const c of salt) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

export function pickVariant(def: ScenarioDef, learner: Learner, vocab: Vocab, day: number): VariantDef {
  let best = def.variants[0]!;
  let bestScore = -1;
  for (const v of def.variants) {
    // Variant-specific words weigh in; a small daily jitter keeps the town varied.
    const unique = variantWords(def, v, vocab).filter((w) =>
      def.variants.some((o) => o !== v && !variantWords(def, o, vocab).includes(w)),
    );
    const score = variantScore(unique, learner, day) + dayHash(day, def.id + v.id);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

export function makeErrands(defs: ScenarioDef[], learner: Learner, vocab: Vocab, day: number): Errand[] {
  return defs
    .filter((d) => d.errand)
    .map((d) => {
      const v = pickVariant(d, learner, vocab, day);
      const slots = { ...v.slots, price: String(v.price ?? 0) };
      return { scenario: d.id, variant: v.id, text: d.errand!.replace(/\$([a-z_]+)/g, (m, n: string) => slots[n] ?? m), done: false };
    });
}
