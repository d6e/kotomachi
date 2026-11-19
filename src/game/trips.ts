// Train trips from the station: where you can go, what a return ticket costs, and the
// souvenirs you can bring home. Pure data and logic, no DOM, so it can be tested.

import tripsJson from '../../data/trips.json' with { type: 'json' };
import type { NpcId } from '../scenario/types.ts';
import type { TripPlace } from '../town/rooms.ts';
import type { Keepsake } from './room.ts';

export interface Trip {
  id: string;
  /** The place's name, a vocab id. */
  name: string;
  /** The level you need to buy a ticket. */
  level: number;
  /** A return ticket, in yen. */
  fare: number;
  /** Whether there's anything there yet; the others show as 工事中. */
  built: boolean;
  blurb: string;
}

export const TRIPS = tripsJson as Trip[];

/** Minutes on the train each way. */
export const TRIP_MINUTES = 50;
/** The last train out leaves at 17:00, so there's time to see the place and get back. */
export const LAST_TRAIN_OUT = 17 * 60;

/** Where a trip's train arrives: the open-air town. */
export const ARRIVAL: Record<string, TripPlace> = { kamakura: 'kamakura' };

/** Can you go now, and if not, why not. */
export function canTravel(trip: Trip, level: number, money: number, minutes: number): 'ok' | 'level' | 'building' | 'money' | 'late' {
  if (level < trip.level) return 'level';
  if (!trip.built) return 'building';
  if (minutes >= LAST_TRAIN_OUT) return 'late';
  if (money < trip.fare) return 'money';
  return 'ok';
}

/** A souvenir: a keepsake you bring home from a trip, by what you bought. */
export interface Souvenir extends Keepsake {
  scenario: string;
  variant?: string;
}

export const SOUVENIRS: Souvenir[] = [
  { id: 'omamori', word: 'お守り', from: 'takahashi' satisfies NpcId, scenario: 'shrine_visit' },
  { id: 'daibutsu', word: '大仏', from: 'sato' satisfies NpcId, scenario: 'omiyage_buy', variant: 'okimono' },
  { id: 'ehagaki', word: '絵はがき', from: 'sato' satisfies NpcId, scenario: 'omiyage_buy', variant: 'ehagaki' },
];

/** What a finished conversation brings home, if anything. */
export function souvenirFor(scenario: string, variant: string): Souvenir | undefined {
  return SOUVENIRS.find((s) => s.scenario === scenario && (!s.variant || s.variant === variant));
}
