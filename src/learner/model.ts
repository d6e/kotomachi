// Learner model: tracks every word by dictionary form, with two FSRS tracks per word,
// meaning (by sound/kana) and written form (kanji), and a coarse state
// unseen -> seen -> recognized -> produced.

import { hasKanji } from '../lang/kana.ts';
import type { Vocab } from '../lang/markup.ts';
import { Fsrs, Rating, type Card } from '../srs/fsrs.ts';
import type { NodeEvidence } from '../scenario/engine.ts';
import type { NpcId, PlaceId } from '../scenario/types.ts';

export type WordStatus = 'unseen' | 'seen' | 'recognized' | 'produced';
const STATUS_ORDER: WordStatus[] = ['unseen', 'seen', 'recognized', 'produced'];

/** Written-form stability (in days) at which furigana stops showing. */
export const FURIGANA_FADE_STABILITY = 6;
/** Production credit: tiles give partial credit, fill-in-the-blank more, freeform full. */
export const PRODUCE_CREDIT: Record<number, number> = { 3: 0.34, 4: 0.5, 5: 1 };

export interface Met {
  day: number;
  place: PlaceId;
  npc?: NpcId;
}

export interface WordRecord {
  status: WordStatus;
  meaning: Card | null;
  written: Card | null;
  seen: number;
  lookups: number;
  produce: number;
  met: Met[];
  firstSeen: number;
  /** Day of the last lookup penalty outside a scenario (at most one per day). */
  penaltyDay?: number;
  /** Answered right at least once (the word stops being marked as new). */
  known?: boolean;
}

export interface LearnerData {
  words: Record<string, WordRecord>;
}

export function emptyLearner(): LearnerData {
  return { words: {} };
}

const atLeast = (s: WordStatus, min: WordStatus): WordStatus =>
  STATUS_ORDER.indexOf(s) >= STATUS_ORDER.indexOf(min) ? s : min;

export interface EvidenceContext {
  day: number;
  /** Whether furigana was shown for this word while the node was played. */
  furiganaShown: (lemma: string) => boolean;
}

export class Learner {
  readonly data: LearnerData;
  private readonly vocab: Vocab;
  private readonly fsrs: Fsrs;

  constructor(data: LearnerData, vocab: Vocab, fsrs = new Fsrs()) {
    this.data = data;
    this.vocab = vocab;
    this.fsrs = fsrs;
  }

  get(id: string): WordRecord | undefined {
    return this.data.words[id];
  }

  status(id: string): WordStatus {
    return this.data.words[id]?.status ?? 'unseen';
  }

  private record(id: string, day: number): WordRecord {
    let r = this.data.words[id];
    if (!r) {
      r = { status: 'unseen', meaning: null, written: null, seen: 0, lookups: 0, produce: 0, met: [], firstSeen: day };
      this.data.words[id] = r;
    }
    return r;
  }

  hasWrittenTrack(id: string): boolean {
    return hasKanji(id);
  }

  /** The word appeared in a line the player heard or read. Returns true if it is new. */
  see(id: string, met: Met): boolean {
    if (!this.vocab.has(id)) return false;
    const r = this.record(id, met.day);
    const isNew = r.status === 'unseen';
    r.status = atLeast(r.status, 'seen');
    r.seen += 1;
    if (isNew) r.firstSeen = met.day;
    const already = r.met.some((m) => m.place === met.place && m.npc === met.npc);
    if (!already) {
      r.met.push(met);
      if (r.met.length > 6) r.met.splice(1, 1);
    }
    return isNew;
  }

  private rate(track: 'meaning' | 'written', r: WordRecord, g: Rating, day: number): void {
    const card = r[track] ?? this.fsrs.newCard(day);
    r[track] = this.fsrs.review(card, g, day);
  }

  /**
   * A lookup. Inside a scenario the rating is applied when the node completes (see applyEvidence);
   * elsewhere (`penalize`), a lookup counts as a failed review once per day.
   */
  lookup(id: string, day: number, penalize: boolean): void {
    if (!this.vocab.has(id)) return;
    const r = this.record(id, day);
    r.lookups += 1;
    if (penalize && r.penaltyDay !== day && r.meaning) {
      r.penaltyDay = day;
      this.rate('meaning', r, Rating.Again, day);
      if (r.written) this.rate('written', r, Rating.Again, day);
    }
  }

  applyEvidence(ev: NodeEvidence, ctx: EvidenceContext): void {
    const looked = new Set(ev.lookedUp);
    const words = new Set([...ev.targets, ...ev.answerWords]);
    for (const id of words) {
      if (!this.vocab.has(id)) continue;
      const r = this.record(id, ctx.day);
      const before = r.status;
      r.status = atLeast(r.status, 'seen');
      const wasLooked = looked.has(id);
      const g = wasLooked ? Rating.Again : ev.firstTry ? Rating.Good : Rating.Hard;
      if (ev.mode > 0) this.rate('meaning', r, g, ctx.day);
      if (!wasLooked && ev.firstTry && ev.mode > 0) r.status = atLeast(r.status, 'recognized');

      const credit = PRODUCE_CREDIT[ev.mode] ?? 0;
      if (credit > 0 && ev.answerWords.includes(id) && !wasLooked) {
        r.produce += ev.firstTry ? credit : credit / 2;
        if (r.produce >= 1) r.status = atLeast(r.status, 'produced');
      }

      if (this.hasWrittenTrack(id) && ev.mode > 0) {
        const shown = ctx.furiganaShown(id);
        if (wasLooked) {
          if (r.written) this.rate('written', r, Rating.Again, ctx.day);
        } else if (!shown) {
          this.rate('written', r, ev.firstTry ? Rating.Good : Rating.Hard, ctx.day);
        } else if (ev.firstTry && STATUS_ORDER.indexOf(before) >= STATUS_ORDER.indexOf('recognized')) {
          // Read correctly with the reading printed above it, and the meaning was already known:
          // repeated exposure builds the written form until the furigana can fade.
          this.rate('written', r, Rating.Good, ctx.day);
        }
      }
    }
    // Words of the line that were looked up but are not targets still lose confidence.
    for (const id of looked) {
      if (words.has(id) || !this.vocab.has(id)) continue;
      const r = this.record(id, ctx.day);
      if (r.meaning) this.rate('meaning', r, Rating.Again, ctx.day);
    }
  }

  /** You used the word in a right answer: it stops being marked as new. */
  markKnown(id: string, day: number): void {
    if (!this.vocab.has(id)) return;
    this.record(id, day).known = true;
  }

  /** A new word: met (or about to be) but never looked up or answered right yet. */
  isFresh(id: string | null): boolean {
    if (!id || !this.vocab.has(id)) return false;
    const r = this.data.words[id];
    if (!r) return true;
    return (r.status === 'unseen' || r.status === 'seen') && r.lookups === 0 && !r.known;
  }

  writtenKnown(id: string): boolean {
    const w = this.data.words[id]?.written;
    return !!w && w.reps > 0 && w.lastRating !== Rating.Again && w.stability >= FURIGANA_FADE_STABILITY;
  }

  /** Furigana fades per word once its written form counts as known. Stage 1 always shows it. */
  showFurigana(id: string | null, mode: number): boolean {
    if (mode === 1 || id === null) return true;
    return !this.writtenKnown(id);
  }

  isDue(id: string, day: number): boolean {
    const r = this.data.words[id];
    if (!r) return false;
    return (r.meaning !== null && this.fsrs.isDue(r.meaning, day)) || (r.written !== null && this.fsrs.isDue(r.written, day));
  }

  dueWords(day: number): string[] {
    return Object.keys(this.data.words).filter((id) => this.isDue(id, day));
  }

  counts(): Record<WordStatus, number> {
    const c: Record<WordStatus, number> = { unseen: 0, seen: 0, recognized: 0, produced: 0 };
    for (const e of this.vocab.all()) c[this.status(e.id)] += 1;
    return c;
  }

  retrievability(id: string, day: number): number {
    const m = this.data.words[id]?.meaning;
    return m ? this.fsrs.retrievability(m, day) : 0;
  }
}
