// A small FSRS (v4.5) scheduler. Time is measured in in-game days (fractions allowed),
// so the in-game calendar drives what is due. No dependencies.
//
// Formulas follow the published FSRS-4.5 algorithm:
//   R(t, S)      = (1 + F * t / S) ^ DECAY            F = 19/81, DECAY = -0.5
//   interval     = S / F * (r^(1/DECAY) - 1)          (= S when r = 0.9)
//   S0(G)        = w[G-1]
//   D0(G)        = w4 - (G - 3) * w5
//   D'           = w7 * D0(4) + (1 - w7) * (D - w6 * (G - 3))
//   S' (recall)  = S * (e^w8 * (11 - D) * S^-w9 * (e^(w10 * (1 - R)) - 1) * hard * easy + 1)
//   S' (lapse)   = w11 * D^-w12 * ((S + 1)^w13 - 1) * e^(w14 * (1 - R))

export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type Rating = (typeof Rating)[keyof typeof Rating];

export const DEFAULT_WEIGHTS: readonly number[] = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616, 0.1544, 1.0824, 1.9813,
  0.0953, 0.2975, 2.2042, 0.2407, 2.9466,
];

const DECAY = -0.5;
const FACTOR = 19 / 81;

export interface Card {
  /** Day number when the card is next due. */
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  /** Day number of the last review, or null if never reviewed. */
  last: number | null;
  lastRating: Rating | null;
}

export interface SchedulerOptions {
  weights?: readonly number[];
  /** Target retention, 0.7..0.97. */
  retention?: number;
  maxInterval?: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export class Fsrs {
  readonly w: readonly number[];
  readonly retention: number;
  readonly maxInterval: number;

  constructor(opts: SchedulerOptions = {}) {
    this.w = opts.weights ?? DEFAULT_WEIGHTS;
    if (this.w.length !== 17) throw new Error('FSRS-4.5 needs 17 weights');
    this.retention = opts.retention ?? 0.9;
    this.maxInterval = opts.maxInterval ?? 365;
  }

  newCard(now: number): Card {
    return { due: now, stability: 0, difficulty: 0, reps: 0, lapses: 0, last: null, lastRating: null };
  }

  retrievability(card: Card, now: number): number {
    if (card.last === null || card.stability <= 0) return 0;
    const t = Math.max(0, now - card.last);
    return Math.pow(1 + (FACTOR * t) / card.stability, DECAY);
  }

  interval(stability: number): number {
    const raw = (stability / FACTOR) * (Math.pow(this.retention, 1 / DECAY) - 1);
    return clamp(Math.round(raw), 1, this.maxInterval);
  }

  private initDifficulty(g: Rating): number {
    return clamp(this.w[4]! - (g - 3) * this.w[5]!, 1, 10);
  }

  private nextDifficulty(d: number, g: Rating): number {
    const next = d - this.w[6]! * (g - 3);
    return clamp(this.w[7]! * this.initDifficulty(Rating.Easy) + (1 - this.w[7]!) * next, 1, 10);
  }

  private recallStability(d: number, s: number, r: number, g: Rating): number {
    const w = this.w;
    const hard = g === Rating.Hard ? w[15]! : 1;
    const easy = g === Rating.Easy ? w[16]! : 1;
    return s * (Math.exp(w[8]!) * (11 - d) * Math.pow(s, -w[9]!) * (Math.exp(w[10]! * (1 - r)) - 1) * hard * easy + 1);
  }

  private forgetStability(d: number, s: number, r: number): number {
    const w = this.w;
    const next = w[11]! * Math.pow(d, -w[12]!) * (Math.pow(s + 1, w[13]!) - 1) * Math.exp(w[14]! * (1 - r));
    return Math.min(next, s);
  }

  /** Review a card on day `now` and return the updated copy. */
  review(card: Card, g: Rating, now: number): Card {
    let stability: number;
    let difficulty: number;
    let lapses = card.lapses;
    if (card.reps === 0 || card.last === null) {
      stability = this.w[g - 1]!;
      difficulty = this.initDifficulty(g);
    } else {
      const r = this.retrievability(card, now);
      difficulty = this.nextDifficulty(card.difficulty, g);
      if (g === Rating.Again) {
        stability = this.forgetStability(card.difficulty, card.stability, r);
        lapses += 1;
      } else {
        stability = this.recallStability(card.difficulty, card.stability, r, g);
      }
    }
    stability = Math.max(0.1, stability);
    const due = g === Rating.Again ? now + 1 : now + this.interval(stability);
    return { due, stability, difficulty, reps: card.reps + 1, lapses, last: now, lastRating: g };
  }

  isDue(card: Card, now: number): boolean {
    return card.reps > 0 && card.due <= now;
  }
}
