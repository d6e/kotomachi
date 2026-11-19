// Loads the hand-written content in data/ and checks it.

import { greetSlots } from '../scenario/engine.ts';
import vocabJson from '../../data/vocab.json' with { type: 'json' };
import formsJson from '../../data/forms.json' with { type: 'json' };
import grammarJson from '../../data/grammar.json' with { type: 'json' };
import npcsJson from '../../data/npcs.json' with { type: 'json' };
import cafe from '../../data/scenarios/cafe.json' with { type: 'json' };
import konbini from '../../data/scenarios/konbini.json' with { type: 'json' };
import pharmacy from '../../data/scenarios/pharmacy.json' with { type: 'json' };
import neighbor from '../../data/scenarios/neighbor.json' with { type: 'json' };
import { parseLine, Vocab, type ParseIssue, type VocabEntry } from '../lang/markup.ts';
import type { GrammarNote, NpcDef, NpcId, ScenarioDef } from '../scenario/types.ts';

export const vocab = new Vocab(vocabJson as VocabEntry[]);
export const forms = formsJson as Record<string, string>;
export const grammar: Record<string, GrammarNote> = Object.fromEntries(
  (grammarJson as GrammarNote[]).map((g) => [g.id, g]),
);
export const npcs: Record<NpcId, NpcDef> = Object.fromEntries(
  (npcsJson as NpcDef[]).map((n) => [n.id, n]),
) as Record<NpcId, NpcDef>;
export const scenarios: ScenarioDef[] = [cafe, konbini, pharmacy, neighbor] as unknown as ScenarioDef[];
export const scenarioById: Record<string, ScenarioDef> = Object.fromEntries(scenarios.map((s) => [s.id, s]));

export interface ContentIssue {
  where: string;
  problem: string;
}

/** Every multiple-choice moment offers exactly this many answers. */
export const CHOICES_PER_NODE = 3;

/** Every line must parse against the vocab, every node link must exist, every slot must be filled. */
export function validateContent(defs: ScenarioDef[] = scenarios): ContentIssue[] {
  const out: ContentIssue[] = [];
  const check = (where: string, markup: string, slots: Record<string, string>) => {
    const issues: ParseIssue[] = [];
    parseLine(markup, vocab, slots, issues);
    for (const i of issues) out.push({ where, problem: `${i.token}: ${i.problem}` });
  };
  for (const n of Object.values(npcs)) check(`npc ${n.id}`, n.name, {});
  for (const g of Object.values(grammar)) check(`grammar ${g.id}`, g.example, {});
  for (const s of defs) {
    if (!s.nodes[s.start]) out.push({ where: s.id, problem: `start node ${s.start} missing` });
    for (const v of s.variants) {
      const slots: Record<string, string> = { ...v.slots, price: String(v.price ?? 0), ...greetSlots('day') };
      for (const [k, opts] of Object.entries(s.randomSlots ?? {})) slots[k] = opts[0]!;
      if (s.errand) check(`${s.id} errand (${v.id})`, s.errand, slots);
      for (const [id, n] of Object.entries(s.nodes)) {
        if (n.onlyFor && !n.onlyFor.includes(v.id)) continue;
        const where = `${s.id}.${id} (${v.id})`;
        const lines = typeof n.line === 'string' ? [n.line] : Object.values(n.line);
        for (const l of lines) check(where, l, slots);
        for (const c of n.choices ?? []) {
          check(where, c.text, slots);
          if (c.reaction) check(`${where} reaction`, c.reaction, slots);
          if (c.grammar && !grammar[c.grammar]) out.push({ where, problem: `unknown grammar note ${c.grammar}` });
        }
        if (n.recast) check(`${where} recast`, n.recast, slots);
        for (const a of n.tiles?.answers ?? []) for (const t of a) check(`${where} tile`, t, slots);
        for (const t of n.tiles?.decoys ?? []) check(`${where} tile`, t, slots);
        if (n.blank) {
          check(`${where} blank`, n.blank.before ?? '', slots);
          check(`${where} blank`, n.blank.after ?? '', slots);
        }
        for (const t of n.targets) if (!vocab.has(t)) out.push({ where, problem: `target ${t} not in vocab` });
        for (const g of n.grammar ?? []) if (!grammar[g]) out.push({ where, problem: `unknown grammar note ${g}` });
        for (const next of Object.values(n.next ?? {})) {
          if (next && !s.nodes[next]) out.push({ where, problem: `next node ${next} missing` });
        }
        if (!n.end && !n.next?.success) out.push({ where, problem: 'node has no success exit and is not an end' });
        if (n.choices && !n.choices.some((c) => c.result === 'success')) out.push({ where, problem: 'no correct choice' });
        if (n.choices && n.choices.length !== CHOICES_PER_NODE) out.push({ where, problem: `has ${n.choices.length} choices, needs exactly ${CHOICES_PER_NODE}` });
      }
    }
  }
  return out;
}
