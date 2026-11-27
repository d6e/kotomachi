// Game state and saving. The game saves to localStorage when you sleep, between conversations, and when the page is hidden.
// There are three save slots, one per player, each a whole game of its own.

import { emptyLearner, type LearnerData } from '../learner/model.ts';
import { newProgress, type Correction, type ScenarioProgress } from '../scenario/engine.ts';
import type { NpcId } from '../scenario/types.ts';
import type { Errand } from './errands.ts';
import { estimateXp } from './rewards.ts';

/** Where the one save lived before there were slots. It's moved into slot 1 the first time the slots are read. */
export const SAVE_KEY = 'kotomachi.save.v1';
export const SLOT_COUNT = 3;
/** Longest player name, in characters. */
export const NAME_MAX = 12;
export function slotKey(slot: number): string {
  return `kotomachi.slot${slot}.v1`;
}
export const DAY_START = 8 * 60;
export const DAY_END = 23 * 60;
/** Yen at the start of a new game: enough for a few days of errands, not for a sofa. */
export const START_MONEY = 5000;

export interface DayLog {
  newWords: string[];
  corrections: Correction[];
  promotions: string[];
  lookups: number;
  greeted: boolean;
  friendshipStart: Partial<Record<NpcId, number>>;
  /** For the night's results: clean visits, words that went up a level, the longest run of right answers. */
  clean?: number;
  levelUps?: number;
  bestCombo?: number;
  /** How today's answers landed: perfect, okay or a miss. Older saves don't have it. */
  grades?: { perfect: number; okay: number; miss: number };
  /** Experience and yen earned today, for the night's results. */
  xp?: number;
  yen?: number;
  /** The night's combo bonus, once given. */
  bonus?: number;
  /** Friendship points from chatting today, per person (capped a day). */
  chat?: Partial<Record<NpcId, number>>;
  /** Who you've given a present to today (one each a day). */
  gifted?: NpcId[];
}

/** A night booked at the ryokan in 箱根. */
export interface Stay {
  /** The day you checked in; the morning after, you check out. */
  day: number;
  /** When dinner is brought to your room, in minutes from midnight. */
  dinner: number;
  /** Whether you've been shown your room (and changed into the yukata). */
  shown?: boolean;
  /** Whether you've had dinner (the futon goes down after it). */
  dined?: boolean;
}

export interface GameData {
  /** 1: before yen rewards and experience; 2: with them. Old saves are migrated on load. */
  version: 2;
  day: number;
  minutes: number;
  money: number;
  /** Total experience; the level comes from it. */
  xp: number;
  learner: LearnerData;
  progress: Record<string, ScenarioProgress>;
  /** Friendship points per person; hearts and how casually they talk come from these. */
  friendship: Partial<Record<NpcId, number>>;
  /** How many of each friend's invitations you've been on. Older saves don't have it. */
  invites?: Partial<Record<NpcId, number>>;
  /** What you've given each friend, so the notebook can say what they liked. */
  giftsGiven?: Partial<Record<NpcId, string[]>>;
  errands: Errand[];
  /** The day each scenario/variant was last given as an errand, so a week stays varied. */
  recentErrands?: Record<string, number>;
  /** How far each regular's story has got: the next step's index. */
  arcs: Record<string, number>;
  /** Keepsakes you've been given or brought home, by id: the collection, kept even if you put them away. */
  keepsakes: string[];
  /** Everything you have (持ち物), by good id, with how many. */
  bag: Record<string, number>;
  /** What's on the shelf in your room, in order, at most SHELF_SIZE. */
  shelf: string[];
  /** Catalog items you've bought for your room. */
  furniture: string[];
  /** Every correction so far, newest last, with the day it happened. */
  corrections: (Correction & { day: number })[];
  grammarSeen: string[];
  today: DayLog;
  settings: { gloss: boolean };
  /** A night at the ryokan, from check-in until you check out. Older saves don't have it. */
  stay?: Stay;
  /** Nights stayed at the ryokan so far. */
  stays?: number;
  /** The player's name, shown on their save slot. A save from before slots has none. */
  name?: string;
  /** When this game was last saved (ms since 1970), for "last played" on the slot. */
  savedAt?: number;
}

export function newDayLog(friendship: GameData['friendship']): DayLog {
  return { newWords: [], corrections: [], promotions: [], lookups: 0, greeted: false, friendshipStart: { ...friendship }, clean: 0, levelUps: 0, bestCombo: 0, grades: { perfect: 0, okay: 0, miss: 0 }, xp: 0, yen: 0, chat: {}, gifted: [] };
}

export function newGame(name?: string): GameData {
  return {
    version: 2,
    ...(name ? { name } : {}),
    day: 1,
    minutes: DAY_START,
    money: START_MONEY,
    xp: 0,
    learner: emptyLearner(),
    progress: {},
    friendship: { yuki: 0 },
    invites: {},
    giftsGiven: {},
    errands: [],
    arcs: {},
    keepsakes: [],
    bag: {},
    shelf: [],
    furniture: [],
    corrections: [],
    grammarSeen: [],
    today: newDayLog({ yuki: 0 }),
    settings: { gloss: false },
  };
}

export function progressFor(g: GameData, scenario: string): ScenarioProgress {
  return (g.progress[scenario] ??= newProgress());
}

function storageOr(storage?: Storage): Storage | undefined {
  return storage ?? globalThis.localStorage;
}

export function save(g: GameData, slot: number, storage?: Storage, now = Date.now()): boolean {
  try {
    storage = storageOr(storage);
    if (!storage) return false;
    g.savedAt = now;
    storage.setItem(slotKey(slot), JSON.stringify(g));
    return true;
  } catch {
    return false;
  }
}

export function load(slot: number, storage?: Storage): GameData | null {
  try {
    storage = storageOr(storage);
    if (!storage) return null;
    adoptOldSave(storage);
    const raw = storage.getItem(slotKey(slot));
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * The save from before there were slots goes into the first empty slot (slot 1, unless
 * something odd happened), and only then is the old copy removed, so nothing is lost.
 */
export function adoptOldSave(storage?: Storage): void {
  try {
    storage = storageOr(storage);
    const raw = storage?.getItem(SAVE_KEY);
    if (!storage || !raw) return;
    if (!migrate(JSON.parse(raw))) return;
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      const key = slotKey(slot);
      if (storage.getItem(key)) continue;
      storage.setItem(key, raw);
      if (storage.getItem(key) === raw) storage.removeItem(SAVE_KEY);
      return;
    }
  } catch {
    /* leave it where it is */
  }
}

/** What a save slot shows on the title screen. */
export interface SlotSummary {
  slot: number;
  /** Null for an empty slot. */
  game: GameData | null;
  name: string;
}

export function defaultName(slot: number): string {
  return `Player ${slot}`;
}

/** Trim a typed name to something that fits on the slot. Empty means "use the default". */
export function cleanName(raw: string): string {
  return [...raw.replace(/\s+/g, ' ').trim()].slice(0, NAME_MAX).join('');
}

export function listSlots(storage?: Storage): SlotSummary[] {
  const out: SlotSummary[] = [];
  for (let slot = 1; slot <= SLOT_COUNT; slot++) {
    const game = load(slot, storage);
    out.push({ slot, game, name: game?.name || defaultName(slot) });
  }
  return out;
}

/** "today", "yesterday", "3 days ago" or a date, for when a slot was last played. */
export function lastPlayed(savedAt: number | undefined, now = Date.now()): string | null {
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
  const day = (t: number) => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000; };
  const ago = day(now) - day(savedAt);
  if (ago <= 0) return 'today';
  if (ago === 1) return 'yesterday';
  if (ago < 7) return `${ago} days ago`;
  return new Date(savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(ago > 300 ? { year: 'numeric' } : {}) });
}

/** Bring an older save up to date. Returns null for something that isn't a save. */
export function migrate(raw: unknown): GameData | null {
  if (!raw || typeof raw !== 'object') return null;
  const old = raw as Omit<Partial<GameData>, 'version'> & { version?: number };
  const version = old.version;
  if (version !== 1 && version !== 2) return null;
  const g = { ...newGame(), ...old, version: 2 } as GameData;
  g.today = { ...newDayLog(g.friendship), ...old.today };
  // Experience didn't exist yet: start from what this player already knows.
  if (version === 1) g.xp = estimateXp(g.learner, g.day);
  g.xp ??= 0;
  // Friendships with more than ゆき came later: everyone else starts at zero.
  if (!g.friendship || typeof g.friendship !== 'object') g.friendship = { yuki: 0 };
  g.invites = g.invites && typeof g.invites === 'object' ? g.invites : {};
  g.giftsGiven = g.giftsGiven && typeof g.giftsGiven === 'object' ? g.giftsGiven : {};
  g.today.chat ??= {};
  g.today.gifted ??= [];
  // Answers weren't graded perfect / okay / miss yet.
  const gr = g.today.grades as Partial<NonNullable<DayLog['grades']>> | undefined;
  g.today.grades = { perfect: Number(gr?.perfect) || 0, okay: Number(gr?.okay) || 0, miss: Number(gr?.miss) || 0 };
  // Before you had things of your own, only keepsakes were kept, and all of them sat on the shelf.
  if (!old.bag || typeof old.bag !== 'object') {
    g.bag = Object.fromEntries(g.keepsakes.map((k) => [k, 1]));
    g.shelf = g.keepsakes.slice(0, 9);
  }
  g.shelf = (Array.isArray(g.shelf) ? g.shelf : []).filter((id) => (g.bag[id] ?? 0) > 0).slice(0, 9);
  if (typeof g.name !== 'string' || !cleanName(g.name)) delete g.name;
  else g.name = cleanName(g.name);
  if (typeof g.savedAt !== 'number') delete g.savedAt;
  if (g.stay && (typeof g.stay !== 'object' || typeof g.stay.day !== 'number' || typeof g.stay.dinner !== 'number')) delete g.stay;
  return g;
}

export function clearSave(slot: number, storage?: Storage): void {
  try {
    storage = storageOr(storage);
    adoptOldSave(storage);
    storage?.removeItem(slotKey(slot));
  } catch {
    /* ignore */
  }
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Shop hours, in minutes since midnight. */
export const HOURS: Record<string, [number, number]> = {
  cafe: [8 * 60, 18 * 60],
  konbini: [0, 24 * 60],
  pharmacy: [9 * 60, 19 * 60],
  restaurant: [11 * 60, 22 * 60],
  post: [9 * 60, 17 * 60],
  // On the 鎌倉 trip.
  shrine: [9 * 60, 17 * 60],
  omiyage: [9 * 60, 19 * 60],
};

export function isOpen(place: string, minutes: number): boolean {
  const h = HOURS[place];
  if (!h) return true;
  return minutes >= h[0] && minutes < h[1];
}
