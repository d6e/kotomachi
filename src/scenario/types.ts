// Scenario data schema. Scenarios are scripted state machines; the same node carries
// the data for every rung of the interaction ladder:
//   choices        -> stage 1 (multiple choice with furigana + optional English) and 2 (Japanese only)
//   tiles          -> stage 3 (build the sentence from word tiles, with decoys)
//   blank          -> stage 4 (fill in the blank, typed in romaji and converted to kana)
//   freeform_judge -> stage 5 (freeform, judged by an LLM; stubbed in this MVP)
// A node without data for a stage quietly drops to the next stage down.

export type Result = 'success' | 'npc_confused' | 'npc_amused' | 'npc_puzzled';
export type Period = 'morning' | 'day' | 'evening';
export type PlaceId = 'cafe' | 'konbini' | 'pharmacy' | 'restaurant' | 'station' | 'post' | 'street';
export type NpcId = 'yuki' | 'clerk' | 'mori' | 'server' | 'ekiin' | 'kobayashi' | 'tanaka';

/** 0 = no input (continue), 1..5 = ladder rungs. */
export type Mode = 0 | 1 | 2 | 3 | 4 | 5;

/** Text keyed by friendship level ("0" stranger, "1" acquaintance, "2" friend); the highest key <= level wins. */
export type ByLevel = string | Record<string, string>;

export interface ChoiceDef {
  text: string;
  gloss?: string;
  result: Result;
  /** Explicit feedback, saved for the night notebook (never shown mid-conversation). */
  note?: string;
  /** What the NPC says back, recasting the correct form in-world. */
  reaction?: string;
  grammar?: string;
  /** Speech register of this answer; plain speech before the NPC goes casual costs friendship. */
  register?: 'plain' | 'polite';
  /** The answer is only right at this time of day (greetings). */
  correctWhen?: Period;
  /**
   * A wrong pick that changes how things turn out (the wrong platform, the wrong ramen).
   * Instead of a retry the conversation ends and a short scene plays (an id in
   * data/consequences.json); the request comes back the next day.
   */
  consequence?: string;
}

export interface TilesDef {
  /** Each accepted answer is a list of tiles; each tile is markup (one or more tokens). */
  answers: string[][];
  decoys: string[];
}

export interface BlankDef {
  before?: string;
  after?: string;
  /** Accepted answers, in kana. Compared after converting to hiragana. */
  answers: string[];
}

export interface FreeformDef {
  accept_intents: string[];
  expected_register: 'casual' | 'polite' | 'keigo';
  recast_template?: string;
}

export interface NodeDef {
  line: ByLevel;
  gloss?: ByLevel;
  /** Dictionary forms this node is meant to teach or review. */
  targets: string[];
  grammar?: string[];
  choices?: ChoiceDef[];
  tiles?: TilesDef;
  blank?: BlankDef;
  freeform_judge?: FreeformDef;
  /** NPC line used when a tiles / blank answer is wrong (recast). */
  recast?: string;
  /** Cap the ladder for this node (small talk stays multiple choice). */
  maxMode?: Mode;
  /** Only played for these variants. */
  onlyFor?: string[];
  /** Next node per result; a missing entry for a non-success result repeats the node. */
  next?: Partial<Record<Result, string>>;
  end?: boolean;
  effects?: { pay?: boolean; friendship?: number };
}

export interface VariantDef {
  id: string;
  /** Slot values (markup) used by lines, plus `*_en` slots for English glosses. */
  slots: Record<string, string>;
  price?: number;
}

export interface ScenarioDef {
  id: string;
  title: string;
  place: PlaceId;
  npc: NpcId;
  /** Highest ladder stage this scenario has content for. */
  maxStage: Mode;
  start: string;
  /** Japanese errand line, e.g. "カフェ で $item を 買う". */
  errand?: string;
  variants: VariantDef[];
  /** Slots picked at random each visit. */
  randomSlots?: Record<string, string[]>;
  nodes: Record<string, NodeDef>;
}

export interface NpcDef {
  id: NpcId;
  /** Display name, in Japanese. */
  name: string;
  role: string;
}

export interface GrammarNote {
  id: string;
  title: string;
  note: string;
  example: string;
}
