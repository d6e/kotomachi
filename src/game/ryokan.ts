// A night at the ryokan in 箱根: check in at the front desk in the afternoon, see your
// room and change into a yukata, have a bath, dinner in your room, sleep on the futon,
// and check out in the morning. Pure data and logic, no DOM, so it can be tested.

import type { GameData, Stay } from './state.ts';

/** One night with dinner and breakfast, paid when you check out. */
export const STAY_PRICE = 9800;
/** Check-in opens at 15:00; the last check-in is at 19:00. */
export const CHECK_IN_FROM = 15 * 60;
export const CHECK_IN_UNTIL = 19 * 60;
/** Dinner comes at 18:00 if you check in before 17:00, otherwise at 19:00. */
export function dinnerTime(checkIn: number): number {
  return checkIn < 17 * 60 ? 18 * 60 : 19 * 60;
}
/** The big bath is cleaned between 10:00 and 15:00. */
export const BATH_CLOSED: readonly [number, number] = [10 * 60, 15 * 60];

/** Where you are in a stay: not staying, staying tonight, or the morning after (not checked out yet). */
export type StayPhase = 'none' | 'tonight' | 'morning';

export function stayPhase(g: Pick<GameData, 'day' | 'stay'>): StayPhase {
  if (!g.stay) return 'none';
  if (g.stay.day === g.day) return 'tonight';
  if (g.stay.day === g.day - 1) return 'morning';
  return 'none';
}

/** What happens when you talk to the 女将 at the front desk. */
export type FrontDesk = 'checkin' | 'checkout' | 'staying' | 'early' | 'late' | 'money';

export function frontDesk(g: Pick<GameData, 'day' | 'stay' | 'money'>, minutes: number): FrontDesk {
  const phase = stayPhase(g);
  if (phase === 'morning') return 'checkout';
  if (phase === 'tonight') return 'staying';
  if (minutes < CHECK_IN_FROM) return 'early';
  if (minutes >= CHECK_IN_UNTIL) return 'late';
  if (g.money < STAY_PRICE) return 'money';
  return 'checkin';
}

/** Book the night: dinner at 6 or 7 depending on when you arrived. */
export function checkIn(g: GameData, minutes: number): Stay {
  g.stay = { day: g.day, dinner: dinnerTime(minutes) };
  return g.stay;
}

/** The dinner variant of the check-in conversation that matches when dinner is. */
export function checkInVariant(minutes: number): 'six' | 'seven' {
  return dinnerTime(minutes) === 18 * 60 ? 'six' : 'seven';
}

/** The conversation waiting in your room, if any: being shown the room, then dinner once it's time. */
export function roomScenario(g: Pick<GameData, 'day' | 'stay'>, minutes: number): 'ryokan_room' | 'ryokan_dinner' | null {
  if (stayPhase(g) !== 'tonight' || !g.stay) return null;
  if (!g.stay.shown) return 'ryokan_room';
  if (!g.stay.dined && minutes >= g.stay.dinner) return 'ryokan_dinner';
  return null;
}

/** Your room as it is now: whether the 仲居 is there, and whether the futon is down. */
export function roomState(g: Pick<GameData, 'day' | 'stay'>, minutes: number): { attendant: boolean; futon: boolean } {
  const phase = stayPhase(g);
  return {
    attendant: roomScenario(g, minutes) !== null,
    futon: phase === 'morning' || (phase === 'tonight' && !!g.stay?.dined),
  };
}

/** Whether you can rest in your room until dinner: you've seen the room, and dinner hasn't come yet. */
export function canWaitForDinner(g: Pick<GameData, 'day' | 'stay'>, minutes: number): boolean {
  return stayPhase(g) === 'tonight' && !!g.stay?.shown && !g.stay.dined && minutes < g.stay.dinner;
}

/** Whether you're wearing the ryokan's yukata: from being shown your room until you check out. */
export function inYukata(g: Pick<GameData, 'day' | 'stay'>): boolean {
  return stayPhase(g) !== 'none' && !!g.stay?.shown;
}

/** Why you can't go through to your room or the bath, or null if you can. */
export function keptOut(g: Pick<GameData, 'day' | 'stay'>, place: string, minutes: number): string | null {
  const phase = stayPhase(g);
  if (place === 'washitsu') return phase === 'none' ? 'The guest rooms are upstairs. Check in at the front desk first.' : null;
  if (place === 'onsen') {
    if (phase === 'none') return 'The big bath is for guests staying the night. Check in at the front desk first.';
    if (minutes >= BATH_CLOSED[0] && minutes < BATH_CLOSED[1]) return '清掃中: the bath is being cleaned until 15:00.';
    if (phase === 'tonight' && !g.stay?.shown) return 'Go up and see your room first: your yukata is there.';
    return null;
  }
  return null;
}

/** Why you can't take the train home from 箱根 yet, or null if you can. */
export function trainHomeBlocked(g: Pick<GameData, 'day' | 'stay'>): string | null {
  const phase = stayPhase(g);
  if (phase === 'tonight') return "You're staying at the ryokan tonight. The train home is in the morning, after you check out.";
  if (phase === 'morning') return 'Check out at the front desk first.';
  return null;
}

/** Check out: the stay is over and counted. (The bill is paid in the conversation.) */
export function checkOut(g: GameData): void {
  delete g.stay;
  g.stays = (g.stays ?? 0) + 1;
}

/** How much you can spend in the ryokan's shop and still pay for the night. */
export function spendable(g: Pick<GameData, 'day' | 'stay' | 'money'>): number {
  return stayPhase(g) === 'none' ? g.money : Math.max(0, g.money - STAY_PRICE);
}
