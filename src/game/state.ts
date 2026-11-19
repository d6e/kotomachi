// Game state and saving. The game saves when you sleep (to localStorage).

import { emptyLearner, type LearnerData } from '../learner/model.ts';
import { newProgress, type Correction, type ScenarioProgress } from '../scenario/engine.ts';
import type { NpcId } from '../scenario/types.ts';
import type { Errand } from './errands.ts';

export const SAVE_KEY = 'kotomachi.save.v1';
export const DAY_START = 8 * 60;
export const DAY_END = 23 * 60;
export const START_MONEY = 30000;

export interface DayLog {
  newWords: string[];
  corrections: Correction[];
  promotions: string[];
  lookups: number;
  greeted: boolean;
  friendshipStart: Partial<Record<NpcId, number>>;
}

export interface GameData {
  version: 1;
  day: number;
  minutes: number;
  money: number;
  learner: LearnerData;
  progress: Record<string, ScenarioProgress>;
  friendship: Partial<Record<NpcId, number>>;
  errands: Errand[];
  /** The day each scenario/variant was last given as an errand, so a week stays varied. */
  recentErrands?: Record<string, number>;
  /** Every correction so far, newest last, with the day it happened. */
  corrections: (Correction & { day: number })[];
  grammarSeen: string[];
  today: DayLog;
  settings: { gloss: boolean };
}

export function newDayLog(friendship: GameData['friendship']): DayLog {
  return { newWords: [], corrections: [], promotions: [], lookups: 0, greeted: false, friendshipStart: { ...friendship } };
}

export function newGame(): GameData {
  return {
    version: 1,
    day: 1,
    minutes: DAY_START,
    money: START_MONEY,
    learner: emptyLearner(),
    progress: {},
    friendship: { yuki: 0 },
    errands: [],
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
    const g = JSON.parse(raw) as GameData;
    if (g.version !== 1) return null;
    return { ...newGame(), ...g };
  } catch {
    return null;
  }
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
};

export function isOpen(place: string, minutes: number): boolean {
  const h = HOURS[place];
  if (!h) return true;
  return minutes >= h[0] && minutes < h[1];
}
