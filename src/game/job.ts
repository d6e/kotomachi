// A part-time job at the cafe. A notice on the board says they're hiring; you ask ゆき,
// the manager interviews you, and from then on you can work one short shift a day:
// ゆき says hello, three customers come in and you serve them in shop Japanese, ゆき
// says お疲れ様でした, and you're paid by the hour. Pure functions, so they can be tested.

import type { NpcId, VariantDef } from '../scenario/types.ts';
import { HOURS, type GameData } from './state.ts';

/** Where you work, and the conversations that make up the job. */
export const JOB_PLACE = 'cafe';
export const INTERVIEW = 'job_interview';
export const CUSTOMERS = 'cafe_shift';
export const COLLEAGUE = 'shift_yuki';

/** A shift is two hours of the day. */
export const SHIFT_HOURS = 2;
export const SHIFT_MINUTES = SHIFT_HOURS * 60;
export const CUSTOMERS_PER_SHIFT = 3;
/** Hourly pay by how far up the ladder serving customers is: it goes up as you get better. */
export const WAGE: Record<number, number> = { 1: 1000, 2: 1100, 3: 1200, 4: 1300 };
/** The manager's thank-you for a shift without a single miss. */
export const CLEAN_BONUS = 300;

export interface JobState {
  /** The day you were hired. */
  hired: number;
  /** Shifts worked so far. */
  shifts: number;
  /** The day of the last shift (one a day). */
  lastShift?: number;
  /** Customers served so far, all shifts together. */
  served?: number;
}

export function wageFor(stage: number): number {
  return WAGE[Math.min(4, Math.max(1, Math.floor(stage)))]!;
}

export function isHired(g: GameData): boolean {
  return !!g.job;
}

export function hire(g: GameData): JobState {
  return (g.job ??= { hired: g.day, shifts: 0 });
}

/** The last time a shift can start and still finish before the cafe closes. */
export function lastShiftStart(): number {
  return HOURS[JOB_PLACE]![1] - SHIFT_MINUTES;
}

/** Why you can't work a shift now, or null if you can. */
export function shiftBlocked(g: GameData, minutes: number): string | null {
  if (!g.job) return 'You don\'t work here yet.';
  if (g.job.lastShift === g.day) return 'You\'ve already worked today. Come back tomorrow.';
  const [open] = HOURS[JOB_PLACE]!;
  if (minutes < open) return 'The cafe isn\'t open yet.';
  if (minutes > lastShiftStart()) return 'It\'s too late for a shift today: shifts start by 16:00, so they end before the cafe closes at 18:00.';
  return null;
}

/** What a shift pays: the hours at your wage, and a bonus when nobody was served wrong. */
export function shiftPay(stage: number, misses: number): { wage: number; hours: number; base: number; bonus: number; total: number } {
  const wage = wageFor(stage);
  const base = wage * SHIFT_HOURS;
  const bonus = misses === 0 ? CLEAN_BONUS : 0;
  return { wage, hours: SHIFT_HOURS, base, bonus, total: base + bonus };
}

/** Record a finished shift. */
export function finishShift(g: GameData, served: number): void {
  const job = hire(g);
  job.shifts += 1;
  job.lastShift = g.day;
  job.served = (job.served ?? 0) + served;
}

/** The kinds of customer: a full order, a takeaway, something sold out, the way to the toilet, a wrong drink. */
export type CustomerKind = 'here' | 'togo' | 'soldout' | 'toilet' | 'mistake';
export const KINDS: CustomerKind[] = ['here', 'togo', 'soldout', 'toilet', 'mistake'];
/** The faces customers come with. */
export const CUSTOMER_FACES: NpcId[] = ['kyaku1', 'kyaku2', 'kyaku3'];

/** The cafe's menu, as on the cafe errand, and what each costs. */
export const MENU: { item: string; en: string; price: number }[] = [
  { item: 'コーヒー', en: 'coffee', price: 400 },
  { item: 'ラテ', en: 'latte', price: 450 },
  { item: '紅茶', en: 'black tea', price: 400 },
  { item: 'ココア', en: 'cocoa', price: 450 },
];

const yenText = (n: number): string => n.toLocaleString('en-US');
const pick = <T>(xs: readonly T[], rng: () => number): T => xs[Math.floor(rng() * xs.length) % xs.length]!;

/**
 * Change from a payment, and a wrong amount to offer beside it: off by a coin, but never
 * nothing or less than nothing.
 */
export function changeFor(price: number, paid: number, rng: () => number = Math.random): { change: number; wrong: number } {
  const change = paid - price;
  const step = change % 100 === 0 ? 100 : 50;
  const down = change - step;
  const wrong = down > 0 && rng() < 0.5 ? down : change + step;
  return { change, wrong };
}

/** One customer: which kind, and the slots for the conversation (what they order, what they pay). */
export function customerVariant(kind: CustomerKind, base: VariantDef, rng: () => number = Math.random): VariantDef {
  const slots = { ...base.slots };
  if (kind !== 'toilet') {
    const m = pick(MENU, rng);
    slots['item'] = m.item;
    slots['item_en'] = m.en;
    slots['price'] = String(m.price);
    if (kind === 'here') {
      const paid = pick([500, 1000].filter((p) => p >= m.price), rng);
      const { change, wrong } = changeFor(m.price, paid, rng);
      slots['paid'] = yenText(paid);
      slots['change'] = yenText(change);
      slots['wrong'] = yenText(wrong);
    }
  }
  return { ...base, slots };
}

/**
 * Who comes in on a shift: first someone ordering a drink (to have here, or to go), then
 * two others of different kinds, each with their own face.
 */
export function planShift(rng: () => number = Math.random): { kind: CustomerKind; face: NpcId }[] {
  const first = pick(['here', 'togo'] as const, rng);
  const rest = KINDS.filter((k) => k !== first);
  const out: CustomerKind[] = [first];
  while (out.length < CUSTOMERS_PER_SHIFT) {
    const k = pick(rest.filter((r) => !out.includes(r)), rng);
    out.push(k);
  }
  const faces = [...CUSTOMER_FACES];
  for (let i = faces.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [faces[i], faces[j]] = [faces[j]!, faces[i]!];
  }
  return out.map((kind, i) => ({ kind, face: faces[i % faces.length]! }));
}

/** Bring a saved job up to date; anything odd is dropped (you'd just apply again). */
export function cleanJob(raw: unknown): JobState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const j = raw as Partial<JobState>;
  if (typeof j.hired !== 'number' || !Number.isFinite(j.hired)) return undefined;
  const out: JobState = { hired: j.hired, shifts: typeof j.shifts === 'number' && j.shifts >= 0 ? Math.floor(j.shifts) : 0 };
  if (typeof j.lastShift === 'number' && Number.isFinite(j.lastShift)) out.lastShift = j.lastShift;
  if (typeof j.served === 'number' && j.served >= 0) out.served = Math.floor(j.served);
  return out;
}
