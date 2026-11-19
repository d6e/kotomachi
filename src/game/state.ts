// Game state and saving. The game saves when you sleep (to localStorage).

import { emptyLearner, type LearnerData } from '../learner/model.ts';
import { newProgress, type Correction, type ScenarioProgress } from '../scenario/engine.ts';
import type { NpcId } from '../scenario/types.ts';
import type { Errand } from './errands.ts';
import { estimateXp } from './rewards.ts';

export const SAVE_KEY = 'kotomachi.save.v1';
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
}

export function newDayLog(friendship: GameData['friendship']): DayLog {
  return { newWords: [], corrections: [], promotions: [], lookups: 0, greeted: false, friendshipStart: { ...friendship }, clean: 0, levelUps: 0, bestCombo: 0, xp: 0, yen: 0, chat: {}, gifted: [] };
}

export function newGame(): GameData {
  return {
    version: 2,
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

export function save(g: GameData, storage?: Storage): boolean {
  try {
    storage ??= globalThis.localStorage;
    storage?.setItem(SAVE_KEY, JSON.stringify(g));
    return !!storage;
  } catch {
    return false;
  }
}

export function load(storage?: Storage): GameData | null {
  try {
    storage ??= globalThis.localStorage;
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
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
  // Before you had things of your own, only keepsakes were kept, and all of them sat on the shelf.
  if (!old.bag || typeof old.bag !== 'object') {
    g.bag = Object.fromEntries(g.keepsakes.map((k) => [k, 1]));
    g.shelf = g.keepsakes.slice(0, 9);
  }
  g.shelf = (Array.isArray(g.shelf) ? g.shelf : []).filter((id) => (g.bag[id] ?? 0) > 0).slice(0, 9);
  return g;
}

export function clearSave(storage?: Storage): void {
  try {
    storage ??= globalThis.localStorage;
    storage?.removeItem(SAVE_KEY);
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
