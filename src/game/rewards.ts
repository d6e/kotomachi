// Yen and experience. Errands are paid in yen (more at higher stages, a little less for
// each miss), and experience comes from meeting words, words going up a level and
// finishing errands. Pure functions, so they can be tested.

import type { LearnerData } from '../learner/model.ts';

/** Experience for each thing, earned as it happens during the day. */
export const XP = { newWord: 2, levelUp: 6, errand: 10, clean: 5 } as const;

/** Total experience needed to reach a level: 0, 50, 150, 300, 500, 750 ... */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return 25 * (n - 1) * n;
}

export function levelFor(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

/** How far into the current level, 0 to 1. */
export function levelProgress(xp: number): number {
  const level = levelFor(xp);
  const from = xpForLevel(level);
  return (xp - from) / (xpForLevel(level + 1) - from);
}

/** A reward for an errand by ladder stage, before misses. */
export const STAGE_PAY: Record<number, number> = { 1: 500, 2: 700, 3: 1000, 4: 1300 };

/**
 * What an errand pays: the reward for its stage, 15% less for each miss (never under
 * half), plus whatever you spent on it, paid back by whoever asked.
 */
/** What a second try pays, after yesterday's mix-up: a little less, never nothing. */
export const RETRY_PAY = 0.8;

export function errandPay(stage: number, misses: number, spent: number, retry = false): { reward: number; refund: number } {
  const base = (STAGE_PAY[stage] ?? STAGE_PAY[4]!) * (retry ? RETRY_PAY : 1);
  const factor = Math.max(0.5, 1 - 0.15 * Math.max(0, misses));
  return { reward: Math.round((base * factor) / 10) * 10, refund: Math.max(0, spent) };
}

/** The night's combo multiplier: 1 + a tenth per right answer in a row, at most ×3. */
export function comboMultiplier(bestCombo: number): number {
  return Math.min(3, Math.round((1 + Math.max(0, bestCombo) / 10) * 10) / 10);
}

/** Experience for a save made before experience existed, from what that player already knows. */
export function estimateXp(learner: LearnerData, day: number): number {
  let xp = 0;
  for (const r of Object.values(learner.words)) {
    if (r.status === 'unseen') continue;
    xp += XP.newWord;
    if (r.status === 'recognized' || r.status === 'produced') xp += XP.levelUp;
    if (r.status === 'produced') xp += XP.levelUp;
  }
  return xp + Math.max(0, day - 1) * 3 * XP.errand;
}
