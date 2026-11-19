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
import restaurant from '../../data/scenarios/restaurant.json' with { type: 'json' };
import station from '../../data/scenarios/station.json' with { type: 'json' };
import post from '../../data/scenarios/post.json' with { type: 'json' };
import catalog from '../../data/scenarios/catalog.json' with { type: 'json' };
import shrine from '../../data/scenarios/shrine.json' with { type: 'json' };
import omiyage from '../../data/scenarios/omiyage.json' with { type: 'json' };
import requestsJson from '../../data/requests.json' with { type: 'json' };
import consequencesJson from '../../data/consequences.json' with { type: 'json' };
import type { RequestData } from './errands.ts';
import type { SceneArt } from '../town/scenes.ts';
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
export const scenarios: ScenarioDef[] = [cafe, konbini, pharmacy, restaurant, station, post, neighbor, catalog, shrine, omiyage] as unknown as ScenarioDef[];
export const scenarioById: Record<string, ScenarioDef> = Object.fromEntries(scenarios.map((s) => [s.id, s]));
/** The regulars' stories and everyday requests. */
export const requests = requestsJson as unknown as RequestData;

/** Who says a line in a consequence scene. */
export type SceneWho = 'narration' | 'me' | 'asker' | 'staff' | 'announce';

/** A short scene that plays when a wrong pick changes how things turn out. */
export interface ConsequenceDef {
  title: string;
  /** Which little picture to draw. */
  art: SceneArt;
  /** Lines in markup, with the conversation's slots ($bad, $num...), and English. */
  lines: { who: SceneWho; text: string; en: string }[];
  outcome_en: string;
}
export const consequences = consequencesJson as unknown as Record<string, ConsequenceDef>;

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
  // Requests: every line parses, every place and variant exists, every asker is a person.
  const byId = Object.fromEntries(defs.map((d) => [d.id, d]));
  const arcIds = new Set<string>();
  for (const a of requests.arcs) {
    if (arcIds.has(a.id)) out.push({ where: `arc ${a.id}`, problem: 'duplicate arc id' });
    arcIds.add(a.id);
    if (!npcs[a.from]) out.push({ where: `arc ${a.id}`, problem: `unknown asker ${a.from}` });
    if (a.steps.length < 3 || a.steps.length > 5) out.push({ where: `arc ${a.id}`, problem: `${a.steps.length} steps, wants 3 to 5` });
    a.steps.forEach((st, i) => {
      const where = `arc ${a.id} step ${i + 1}`;
      const def = byId[st.scenario];
      if (!def) out.push({ where, problem: `unknown scenario ${st.scenario}` });
      else if (!def.variants.some((v) => v.id === st.variant)) out.push({ where, problem: `unknown variant ${st.variant}` });
      check(where, st.reason, {});
      if (st.thanks) check(`${where} thanks`, st.thanks, {});
    });
    check(`arc ${a.id} gift`, a.gift.word, {});
    check(`arc ${a.id} gift thanks`, a.gift.thanks, {});
    if (!vocab.has(a.gift.word)) out.push({ where: `arc ${a.id} gift`, problem: `${a.gift.word} not in vocab` });
  }
  for (const r of requests.small) {
    if (!byId[r.scenario]?.errand) out.push({ where: `small ${r.scenario}`, problem: 'no such place with errands' });
    if (!npcs[r.from]) out.push({ where: `small ${r.scenario}`, problem: `unknown asker ${r.from}` });
    check(`small ${r.scenario}`, r.reason, {});
  }
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
          if (c.consequence) {
            const scene = consequences[c.consequence];
            if (!scene) out.push({ where, problem: `unknown consequence ${c.consequence}` });
            else for (const l of scene.lines) check(`${where} consequence ${c.consequence}`, l.text, slots);
            if (c.result === 'success') out.push({ where, problem: 'a right answer cannot have a consequence' });
          }
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
