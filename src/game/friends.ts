// Friendships with the townsfolk: ゆき, 田中さん and the shopkeepers. Points come from
// doing what they ask, chatting and gifts; hearts are how the points look. As the hearts
// fill up they talk to you more casually (the scenario lines keyed by level), and at
// 3 and 5 hearts they invite you to something. Pure data and logic, no DOM, so it can be tested.

import friendsJson from '../../data/friends.json' with { type: 'json' };
import { friendshipLevel } from '../scenario/engine.ts';
import type { NpcId } from '../scenario/types.ts';
import type { Keepsake } from './room.ts';
import type { GameData } from './state.ts';

export type FriendId = 'yuki' | 'tanaka' | 'mori' | 'server' | 'kobayashi';
export type Taste = 'love' | 'like' | 'ok' | 'odd';
export type MemoryWho = 'narration' | 'friend' | 'me';

export interface InviteDef {
  /** The variant of the friend's invite scenario (invite_<id>). */
  variant: string;
  /** Hearts needed before they ask. */
  hearts: number;
  title: string;
  /** Which picture the memory card shows. */
  art: string;
  /** What happens, in markup with English. */
  lines: { who: MemoryWho; text: string; en: string }[];
}

export interface FriendDef {
  id: FriendId;
  /** Where you find them: a place with a counter, or the street (田中さん). */
  place: string;
  loves: string[];
  likes: string[];
  invites: InviteDef[];
}

export const FRIENDS = (friendsJson as unknown as { friends: FriendDef[] }).friends;
export const friendById = Object.fromEntries(FRIENDS.map((f) => [f.id, f])) as Record<FriendId, FriendDef>;
export const FRIEND_IDS = FRIENDS.map((f) => f.id);

export function isFriend(npc: string | undefined): npc is FriendId {
  return !!npc && npc in friendById;
}

/** Points needed for each heart, one to five. The first two match the old speech levels (3 and 7). */
export const HEARTS = [3, 7, 12, 18, 25] as const;
export const MAX_HEARTS = HEARTS.length;

/** How many points each thing is worth. Chatting counts for at most CHAT_PER_DAY a day per person. */
export const POINTS = { request: 2, story: 3, invite: 3 } as const;
export const CHAT_PER_DAY = 2;
export const GIFT_POINTS: Record<Taste, number> = { love: 3, like: 2, ok: 1, odd: 0 };

/** Medicine, batteries, tickets and parcels make strange presents. */
const ODD = new Set(['kazegusuri', 'zutsuyaku', 'megusuri', 'ichoyaku', 'sekidome', 'genetsuzai', 'denchi', 'kippu', 'nimotsu']);

export function heartsFor(points: number): number {
  let n = 0;
  for (const min of HEARTS) if (points >= min) n++;
  return n;
}

/** Points to the next heart, or null at five. */
export function toNextHeart(points: number): number | null {
  const next = HEARTS.find((min) => points < min);
  return next === undefined ? null : next - points;
}

/** 0 polite, 1 polite with friendly asides, 2 casual: the level scenario lines are keyed by. */
export function speechLevel(points: number): number {
  return friendshipLevel(points);
}

export function pointsOf(g: GameData, npc: FriendId): number {
  return g.friendship[npc] ?? 0;
}

export interface HeartChange {
  npc: FriendId;
  before: number;
  after: number;
  /** Speech went from polite to casual (or friendlier). */
  speech: [number, number];
}

/** Add (or take away) points. Returns what changed, or null when the hearts and speech stayed the same. */
export function addPoints(g: GameData, npc: FriendId, n: number): HeartChange | null {
  const old = pointsOf(g, npc);
  const now = Math.max(0, old + n);
  g.friendship[npc] = now;
  const change: HeartChange = { npc, before: heartsFor(old), after: heartsFor(now), speech: [speechLevel(old), speechLevel(now)] };
  return change.before !== change.after || change.speech[0] !== change.speech[1] ? change : null;
}

/** Points from talking: losses always count, gains up to CHAT_PER_DAY a day. Returns the points actually added. */
export function chatPoints(g: GameData, npc: FriendId, delta: number): number {
  if (delta <= 0) return delta;
  const chat = (g.today.chat ??= {});
  const used = chat[npc] ?? 0;
  const add = Math.max(0, Math.min(delta, CHAT_PER_DAY - used));
  chat[npc] = used + add;
  return add;
}

export function tasteOf(npc: FriendId, good: string): Taste {
  const f = friendById[npc];
  if (f.loves.includes(good)) return 'love';
  if (f.likes.includes(good)) return 'like';
  if (ODD.has(good)) return 'odd';
  return 'ok';
}

/** One gift a day per person. */
export function canGiveToday(g: GameData, npc: FriendId): boolean {
  return !(g.today.gifted ?? []).includes(npc);
}

/** Hand something over: it leaves your things (and the shelf, if it was the last one). Returns its taste, or null if you haven't got it. */
export function give(g: GameData, npc: FriendId, good: string): Taste | null {
  if (!g.bag[good]) return null;
  g.bag[good] -= 1;
  if (g.bag[good] <= 0) {
    delete g.bag[good];
    g.shelf = g.shelf.filter((s) => s !== good);
  }
  (g.today.gifted ??= []).push(npc);
  const given = ((g.giftsGiven ??= {})[npc] ??= []);
  if (!given.includes(good)) given.push(good);
  return tasteOf(npc, good);
}

/** The next invitation they're ready to make, if any: hearts reached, and the earlier ones done. */
export function inviteReady(g: GameData, npc: FriendId): InviteDef | undefined {
  const done = g.invites?.[npc] ?? 0;
  const next = friendById[npc].invites[done];
  return next && heartsFor(pointsOf(g, npc)) >= next.hearts ? next : undefined;
}

export function inviteScenario(npc: FriendId): string {
  return `invite_${npc}`;
}

export function finishInvite(g: GameData, npc: FriendId): void {
  (g.invites ??= {})[npc] = (g.invites[npc] ?? 0) + 1;
}

/** The photo from the first outing with each friend: a keepsake for the shelf. */
export function photoId(npc: FriendId): string {
  return `photo_${npc}`;
}
export const PHOTOS: Keepsake[] = FRIENDS.map((f) => ({ id: photoId(f.id), word: '写真', from: f.id }));

/** Which friend works at a place (or is out on the street). */
export function friendAt(place: string): FriendId | undefined {
  return FRIENDS.find((f) => f.place === place)?.id;
}

/** Everyone with a heart count, in order. */
export function allFriends(g: GameData): { id: FriendId; points: number; hearts: number }[] {
  return FRIENDS.map((f) => ({ id: f.id, points: pointsOf(g, f.id), hearts: heartsFor(pointsOf(g, f.id)) }));
}

export const asNpc = (f: FriendId): NpcId => f;
