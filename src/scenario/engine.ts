// Scenario logic with no DOM: picks the ladder rung for each node, checks answers,
// applies the in-world consequences, and records evidence for the learner model.

import { normalizeAnswer } from '../lang/kana.ts';
import { lemmasOf, parseLine, plainText, type Slots, type Token, type Vocab } from '../lang/markup.ts';
import type { FreeformJudge } from '../judge/freeform.ts';
import type { ByLevel, ChoiceDef, Mode, NodeDef, Period, Result, ScenarioDef, VariantDef } from './types.ts';

export const PROMOTE_AFTER_CLEAN_RUNS = 3;
export const FALLBACK_AFTER_FAILS = 2;
/** Friendship points needed for each level: stranger, acquaintance, friend. */
export const FRIENDSHIP_LEVELS = [0, 3, 7] as const;
export const FRIENDSHIP_NAMES = ['stranger', 'acquaintance', 'friend'] as const;

export const MODE_NAMES: Record<Mode, string> = {
  0: 'Listening',
  1: 'Multiple choice, with hints',
  2: 'Multiple choice, Japanese only',
  3: 'Word tiles',
  4: 'Fill in the blank',
  5: 'Freeform',
};

export function friendshipLevel(points: number): number {
  let level = 0;
  FRIENDSHIP_LEVELS.forEach((min, i) => {
    if (points >= min) level = i;
  });
  return level;
}

export function periodOf(minutes: number): Period {
  const h = minutes / 60;
  if (h < 11) return 'morning';
  if (h < 18) return 'day';
  return 'evening';
}

export function pickByLevel(text: ByLevel | undefined, level: number): string | undefined {
  if (text === undefined || typeof text === 'string') return text;
  let best: string | undefined;
  let bestKey = -1;
  for (const [k, v] of Object.entries(text)) {
    const n = Number(k);
    if (n <= level && n > bestKey) {
      best = v;
      bestKey = n;
    }
  }
  return best;
}

/** The ladder rung a node is actually played at. */
export function effectiveMode(stage: Mode, node: NodeDef, fails: number, judgeAvailable: boolean): Mode {
  let m = Math.min(stage, node.maxMode ?? 5);
  // Quiet fallback: every two failures on a line at stage 3+ drops that line one rung.
  if (m >= 3) m = Math.max(2, m - Math.floor(fails / FALLBACK_AFTER_FAILS));
  if (m === 5 && (!judgeAvailable || !node.freeform_judge)) m = 4;
  if (m === 4 && !node.blank) m = 3;
  if (m === 3 && !node.tiles) m = 2;
  if (m <= 2 && (!node.choices || node.choices.length === 0)) return 0;
  return Math.max(1, m) as Mode;
}

export interface ScenarioProgress {
  stage: Mode;
  cleanRuns: number;
  runs: number;
}

export function newProgress(): ScenarioProgress {
  return { stage: 1, cleanRuns: 0, runs: 0 };
}

/** Promotion: one stage up after PROMOTE_AFTER_CLEAN_RUNS clean runs in a row. */
export function finishRun(
  p: ScenarioProgress,
  clean: boolean,
  maxStage: Mode,
): { progress: ScenarioProgress; promoted: boolean } {
  const runs = p.runs + 1;
  if (!clean) return { progress: { ...p, runs, cleanRuns: 0 }, promoted: false };
  const cleanRuns = p.cleanRuns + 1;
  if (cleanRuns >= PROMOTE_AFTER_CLEAN_RUNS && p.stage < maxStage) {
    return { progress: { stage: (p.stage + 1) as Mode, cleanRuns: 0, runs }, promoted: true };
  }
  return { progress: { ...p, runs, cleanRuns }, promoted: false };
}

export interface ChoiceContext {
  period: Period;
  friendship: number;
}

export interface ResolvedChoice {
  result: Result;
  friendshipDelta: number;
  note?: string;
}

export function resolveChoice(choice: ChoiceDef, ctx: ChoiceContext): ResolvedChoice {
  const level = friendshipLevel(ctx.friendship);
  if (choice.correctWhen && choice.correctWhen !== ctx.period) {
    return { result: 'npc_amused', friendshipDelta: 0, note: choice.note };
  }
  if (choice.register === 'plain' && choice.result === 'success') {
    if (level < 2) {
      return {
        result: 'npc_puzzled',
        friendshipDelta: -1,
        note: choice.note ?? 'You went casual before they did. Match their politeness until they switch to plain speech.',
      };
    }
    return { result: 'success', friendshipDelta: 1, note: undefined };
  }
  if (choice.register === 'polite' && choice.result === 'success' && level >= 2) {
    return {
      result: 'success',
      friendshipDelta: 0,
      note: 'They talk to you casually now, so plain speech back would feel warmer.',
    };
  }
  return { result: choice.result, friendshipDelta: 0, note: choice.note };
}

export interface Correction {
  scenario: string;
  nodeId: string;
  /** What the player said (plain text). */
  said: string;
  /** A correct way to say it (plain text). */
  better: string;
  note: string;
  grammar?: string;
}

export interface NodeEvidence {
  nodeId: string;
  mode: Mode;
  /** Words the node targets plus the words of the line and the accepted answer. */
  targets: string[];
  lineWords: string[];
  answerWords: string[];
  firstTry: boolean;
  lookedUp: string[];
}

export interface PromptView {
  nodeId: string;
  mode: Mode;
  line: Token[];
  gloss?: string;
  choices?: { index: number; tokens: Token[]; gloss?: string }[];
  tiles?: { id: number; tokens: Token[] }[];
  blank?: { before: Token[]; after: Token[] };
  fallback: boolean;
}

export interface AnswerOutcome {
  correct: boolean;
  result: Result;
  said: Token[];
  reaction?: Token[];
  ended: boolean;
}

export interface RunOptions {
  def: ScenarioDef;
  variant: VariantDef;
  stage: Mode;
  friendship: number;
  period: Period;
  vocab: Vocab;
  judge?: FreeformJudge;
  rng?: () => number;
  /** Extra slots computed by the game (e.g. today's greeting). */
  extraSlots?: Slots;
}

const GENERIC_RECAST = 'すみません 、 もう一度 お願いします 。';

function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export class ScenarioRun {
  readonly def: ScenarioDef;
  readonly variant: VariantDef;
  readonly stage: Mode;
  readonly slots: Slots;
  readonly corrections: Correction[] = [];
  readonly evidence: NodeEvidence[] = [];
  friendshipDelta = 0;
  moneySpent = 0;
  clean = true;
  ended = false;
  nodeId: string;

  private readonly opts: RunOptions;
  private readonly rng: () => number;
  private fails = 0;
  private removedChoices = new Set<number>();
  private lookedUp = new Set<string>();
  private prompt: PromptView | null = null;

  constructor(opts: RunOptions) {
    this.opts = opts;
    this.def = opts.def;
    this.variant = opts.variant;
    this.stage = opts.stage;
    this.rng = opts.rng ?? Math.random;
    const slots: Slots = { ...opts.variant.slots, ...(opts.extraSlots ?? {}) };
    if (opts.variant.price !== undefined) slots['price'] = String(opts.variant.price);
    for (const [k, options] of Object.entries(opts.def.randomSlots ?? {})) {
      slots[k] = options[Math.floor(this.rng() * options.length)]!;
    }
    this.slots = slots;
    this.nodeId = this.skipInapplicable(opts.def.start);
  }

  get level(): number {
    return friendshipLevel(this.opts.friendship + this.friendshipDelta);
  }

  get node(): NodeDef {
    const n = this.def.nodes[this.nodeId];
    if (!n) throw new Error(`${this.def.id}: no node ${this.nodeId}`);
    return n;
  }

  private parse(markup: string): Token[] {
    return parseLine(markup, this.opts.vocab, this.slots);
  }

  private gloss(text: string | undefined): string | undefined {
    if (text === undefined) return undefined;
    return text.replace(/\$([a-z_]+)/g, (m, name: string) => this.slots[name] ?? m);
  }

  private skipInapplicable(id: string): string {
    let cur = id;
    for (let guard = 0; guard < 50; guard++) {
      const n = this.def.nodes[cur];
      if (!n) throw new Error(`${this.def.id}: no node ${cur}`);
      if (!n.onlyFor || n.onlyFor.includes(this.variant.id)) return cur;
      const next = n.next?.success;
      if (!next) return cur;
      cur = next;
    }
    throw new Error(`${this.def.id}: node loop`);
  }

  /** Called by the UI when the player looks a word up during this node. */
  noteLookup(lemma: string): void {
    this.lookedUp.add(lemma);
  }

  current(): PromptView {
    if (this.prompt) return this.prompt;
    const node = this.node;
    const mode = effectiveMode(this.stage, node, this.fails, this.opts.judge?.available() ?? false);
    const baseMode = effectiveMode(this.stage, node, 0, this.opts.judge?.available() ?? false);
    const view: PromptView = {
      nodeId: this.nodeId,
      mode,
      line: this.parse(pickByLevel(node.line, this.level) ?? ''),
      gloss: mode === 1 || mode === 0 ? this.gloss(pickByLevel(node.gloss, this.level)) : undefined,
      fallback: mode < baseMode,
    };
    if (mode === 1 || mode === 2) {
      const choices = (node.choices ?? [])
        .map((c, index) => ({ c, index }))
        .filter(({ index }) => !this.removedChoices.has(index));
      view.choices = shuffle(choices, this.rng).map(({ c, index }) => ({
        index,
        tokens: this.parse(c.text),
        gloss: mode === 1 ? this.gloss(c.gloss) : undefined,
      }));
    } else if (mode === 3 && node.tiles) {
      const all = new Set<string>();
      for (const a of node.tiles.answers) for (const t of a) all.add(t);
      for (const d of node.tiles.decoys) all.add(d);
      view.tiles = shuffle([...all], this.rng).map((markup, id) => ({ id, tokens: this.parse(markup) }));
    } else if (mode === 4 && node.blank) {
      view.blank = {
        before: this.parse(node.blank.before ?? ''),
        after: this.parse(node.blank.after ?? ''),
      };
    }
    this.prompt = view;
    return view;
  }

  private correctExample(): Token[] {
    const node = this.node;
    const success = node.choices?.find((c) => c.result === 'success' && !c.correctWhen && c.register !== 'plain')
      ?? node.choices?.find((c) => c.result === 'success' && (!c.correctWhen || c.correctWhen === this.opts.period));
    if (success) return this.parse(success.text);
    if (node.tiles) return this.parse(node.tiles.answers[0]!.join(' '));
    return [];
  }

  private complete(answer: Token[], firstTry: boolean): void {
    const node = this.node;
    const view = this.current();
    const lineWords = lemmasOf(view.line);
    const offered = new Set<string>([...lineWords, ...lemmasOf(answer)]);
    for (const c of view.choices ?? []) for (const l of lemmasOf(c.tokens)) offered.add(l);
    for (const t of view.tiles ?? []) for (const l of lemmasOf(t.tokens)) offered.add(l);
    this.evidence.push({
      nodeId: this.nodeId,
      mode: view.mode,
      // Only targets the player actually met in this node.
      targets: node.targets.filter((t) => offered.has(t)),
      lineWords,
      answerWords: lemmasOf(answer),
      firstTry,
      lookedUp: [...this.lookedUp],
    });
    if (node.effects?.pay && this.variant.price) this.moneySpent += this.variant.price;
    if (node.effects?.friendship) this.friendshipDelta += node.effects.friendship;
  }

  private advance(result: Result): boolean {
    const node = this.node;
    const next = node.next?.[result];
    this.prompt = null;
    this.lookedUp = new Set();
    this.removedChoices = new Set();
    this.fails = 0;
    if (node.end || !next) {
      this.ended = true;
      return true;
    }
    this.nodeId = this.skipInapplicable(next);
    return false;
  }

  private fail(result: Result, said: Token[], note: string, grammar?: string): void {
    this.clean = false;
    this.fails += 1;
    this.prompt = null;
    this.corrections.push({
      scenario: this.def.id,
      nodeId: this.nodeId,
      said: plainText(said),
      better: plainText(this.correctExample()),
      note,
      grammar,
    });
    const redirect = this.node.next?.[result];
    if (redirect) {
      this.lookedUp = new Set();
      this.removedChoices = new Set();
      this.fails = 0;
      this.nodeId = this.skipInapplicable(redirect);
    }
  }

  /** Advance past a node that needs no input. */
  continue(): AnswerOutcome {
    const view = this.current();
    if (view.mode !== 0) throw new Error('this node needs an answer');
    this.complete([], true);
    const ended = this.advance('success');
    return { correct: true, result: 'success', said: [], ended };
  }

  answerChoice(index: number): AnswerOutcome {
    const node = this.node;
    const choice = node.choices?.[index];
    if (!choice) throw new Error(`no choice ${index}`);
    const firstTry = this.fails === 0;
    const said = this.parse(choice.text);
    const resolved = resolveChoice(choice, { period: this.opts.period, friendship: this.opts.friendship + this.friendshipDelta });
    this.friendshipDelta += resolved.friendshipDelta;
    const reaction = choice.reaction ? this.parse(choice.reaction) : undefined;
    if (resolved.result === 'success') {
      if (resolved.note) {
        this.corrections.push({
          scenario: this.def.id,
          nodeId: this.nodeId,
          said: plainText(said),
          better: plainText(said),
          note: resolved.note,
          grammar: choice.grammar,
        });
      }
      this.complete(said, firstTry);
      const ended = this.advance('success');
      // Reactions are for mistakes; on success the NPC simply carries on.
      return { correct: true, result: 'success', said, ended };
    }
    this.removedChoices.add(index);
    const npcReply = reaction ?? this.parse(node.recast ?? GENERIC_RECAST);
    this.fail(resolved.result, said, resolved.note ?? 'Not quite right here.', choice.grammar);
    return { correct: false, result: resolved.result, said, reaction: npcReply, ended: false };
  }

  answerTiles(tileIds: number[]): AnswerOutcome {
    const view = this.current();
    const node = this.node;
    if (!view.tiles || !node.tiles) throw new Error('not a tiles prompt');
    const pool = new Map(view.tiles.map((t) => [t.id, t.tokens]));
    const said = tileIds.flatMap((id) => pool.get(id) ?? []);
    const built = plainText(said);
    const match = node.tiles.answers.find((a) => plainText(this.parse(a.join(' '))) === built);
    const firstTry = this.fails === 0;
    if (match) {
      this.complete(said, firstTry);
      const ended = this.advance('success');
      return { correct: true, result: 'success', said, ended };
    }
    const npcReply = this.parse(node.recast ?? GENERIC_RECAST);
    this.fail('npc_puzzled', said, `You built 「${built}」. One natural way: 「${plainText(this.parse(node.tiles.answers[0]!.join(' ')))}」.`);
    return { correct: false, result: 'npc_puzzled', said, reaction: npcReply, ended: false };
  }

  answerBlank(input: string): AnswerOutcome {
    const view = this.current();
    const node = this.node;
    if (!view.blank || !node.blank) throw new Error('not a blank prompt');
    const typed = normalizeAnswer(input);
    const ok = node.blank.answers.some((a) => normalizeAnswer(a) === typed);
    const said = [...view.blank.before, { surface: input, lemma: null, ruby: [{ text: input }] }, ...view.blank.after];
    const firstTry = this.fails === 0;
    if (ok) {
      // Credit the words of the full sentence the blank stands for.
      const full = node.tiles ? this.parse(node.tiles.answers[0]!.join(' ')) : said;
      this.complete(full, firstTry);
      const ended = this.advance('success');
      return { correct: true, result: 'success', said, ended };
    }
    const expected = node.blank.answers[0]!;
    const npcReply = this.parse(node.recast ?? GENERIC_RECAST);
    this.fail(
      'npc_puzzled',
      said,
      `You typed 「${input}」 in 「${plainText(view.blank.before)}＿${plainText(view.blank.after)}」. Expected: 「${expected}」.`,
    );
    return { correct: false, result: 'npc_puzzled', said, reaction: npcReply, ended: false };
  }
}
