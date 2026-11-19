// The morning errand list. Due reviews choose the content: for each shop, the variant
// (which drink, which medicine...) whose words are most due today becomes the errand.

import { greetSlots } from '../scenario/engine.ts';
import { lemmasOf, parseLine, type Vocab } from '../lang/markup.ts';
import type { Learner } from '../learner/model.ts';
import type { NpcId, ScenarioDef, VariantDef } from '../scenario/types.ts';

export interface Errand {
  scenario: string;
  variant: string;
  /** Japanese errand line (markup), already filled in. */
  text: string;
  done: boolean;
  /** Who asked, and why (markup and English). Older saves have errands without these. */
  from?: NpcId;
  reason?: string;
  reasonEn?: string;
  /** A step in someone's story: the arc's id and the step's index. */
  arc?: string;
  step?: number;
  /** A wrong pick played out: the request is off for today and comes back tomorrow. */
  missed?: boolean;
  /** Back from yesterday after a mix-up: pays a little less. */
  retry?: boolean;
}

/** One request in a regular's story. */
export interface RequestStep {
  scenario: string;
  variant: string;
  reason: string;
  reason_en: string;
  /** What they say when it's done (the last step's thanks is the gift's). */
  thanks?: string;
  thanks_en?: string;
}

/** A regular's small story: a few requests in order, then a thank-you gift. */
export interface Arc {
  id: string;
  from: NpcId;
  title: string;
  /** The first day this regular starts asking. */
  startDay: number;
  steps: RequestStep[];
  gift: { id: string; word: string; thanks: string; thanks_en: string };
}

/** An everyday request for when nobody's story needs that place today. */
export interface SmallRequest {
  scenario: string;
  from: NpcId;
  reason: string;
  reason_en: string;
}

export interface RequestData {
  arcs: Arc[];
  small: SmallRequest[];
}

/** Errands in a day: fewer than one per place, so each one matters. */
export const ERRANDS_PER_DAY = 3;
/** At most this many story steps a day; the rest are everyday requests. */
export const STORY_STEPS_PER_DAY = 2;

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

const fill = (def: ScenarioDef, v: VariantDef) => {
  const slots: Record<string, string> = { ...v.slots, price: String(v.price ?? 0) };
  return def.errand!.replace(/\$([a-z_]+)/g, (m, n: string) => slots[n] ?? m);
};

export interface PlanInput {
  defs: ScenarioDef[];
  requests: RequestData;
  /** Next step index for each arc (missing = not started). */
  arcs: Record<string, number>;
  learner: Learner;
  vocab: Vocab;
  day: number;
  recent?: Record<string, number>;
  /** Requests that came back from yesterday (they go first). */
  carried?: Errand[];
}

/**
 * The morning's requests. Anything carried over from yesterday comes first, then the
 * next step of the regulars' stories (the ones whose words are most due win), then
 * everyday requests for other places, where the scheduler picks the variant as before.
 * Never two errands at one place.
 */
export function planRequests(input: PlanInput): Errand[] {
  const { defs, requests, arcs, learner, vocab, day } = input;
  const byId = new Map(defs.map((d) => [d.id, d]));
  const out: Errand[] = (input.carried ?? []).slice(0, ERRANDS_PER_DAY).map((e) => ({ ...e, done: false }));
  const usedPlace = new Set(out.map((e) => e.scenario));
  const usedArc = new Set(out.filter((e) => e.arc).map((e) => e.arc!));
  let story = out.filter((e) => e.arc).length;

  const steps = requests.arcs
    .filter((a) => a.startDay <= day && (arcs[a.id] ?? 0) < a.steps.length && !usedArc.has(a.id))
    .map((a) => {
      const index = arcs[a.id] ?? 0;
      const step = a.steps[index]!;
      const def = byId.get(step.scenario)!;
      const v = def.variants.find((x) => x.id === step.variant)!;
      return { a, index, step, def, v, score: variantScore(variantWords(def, v, vocab), learner, day) + 0.3 * dayHash(day, a.id) };
    })
    .sort((x, y) => y.score - x.score);
  for (const c of steps) {
    if (out.length >= ERRANDS_PER_DAY || story >= STORY_STEPS_PER_DAY) break;
    if (usedPlace.has(c.def.id)) continue;
    out.push({ scenario: c.def.id, variant: c.v.id, text: fill(c.def, c.v), done: false, from: c.a.from, reason: c.step.reason, reasonEn: c.step.reason_en, arc: c.a.id, step: c.index });
    usedPlace.add(c.def.id);
    story++;
  }

  // Places for everyday requests, the most useful first.
  const places = [...new Set(requests.small.map((r) => r.scenario))]
    .filter((id) => byId.get(id)?.errand && !usedPlace.has(id))
    .map((id) => {
      const def = byId.get(id)!;
      const v = pickVariant(def, learner, vocab, day, input.recent);
      // Day 1 starts at the cafe, the gentlest conversation.
      const first = day < 2 && id === 'cafe_order' ? 10 : 0;
      return { def, v, score: first + variantScore(variantWords(def, v, vocab), learner, day) + 0.5 * dayHash(day, id) };
    })
    .sort((x, y) => y.score - x.score);
  for (const c of places) {
    if (out.length >= ERRANDS_PER_DAY) break;
    // Someone who hasn't asked yet today, if anyone can ask for this place.
    const askers = requests.small.filter((r) => r.scenario === c.def.id);
    const used = new Set(out.map((e) => e.from));
    const r = askers.find((x) => !used.has(x.from)) ?? askers[Math.floor(dayHash(day, c.def.id + 'who') * askers.length)]!;
    out.push({ scenario: c.def.id, variant: c.v.id, text: fill(c.def, c.v), done: false, from: r.from, reason: r.reason, reasonEn: r.reason_en });
    usedPlace.add(c.def.id);
  }
  return out;
}
