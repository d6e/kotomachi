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
  /** Minutes on the train each way. */
  minutes: number;
  /** Whether there's anything there yet. A town that isn't isn't sold, or shown, at all. */
  built: boolean;
  blurb: string;
}

export const TRIPS = tripsJson as Trip[];
/** What the ticket machine sells: only the towns that are built. */
export const ON_SALE = TRIPS.filter((t) => t.built);

/** Minutes on the train each way, by default. */
export const TRIP_MINUTES = 50;
/** The last train out leaves at 17:00, so there's time to see the place and get back. */
export const LAST_TRAIN_OUT = 17 * 60;

/** Where a trip's train arrives: the open-air town. */
export const ARRIVAL: Record<string, TripPlace> = { kamakura: 'kamakura', hakone: 'hakone', akihabara: 'akihabara' };

/** Which trip a place belongs to, so the train home takes as long as the ride out. */
const TRIP_OF: Partial<Record<TripPlace, string>> = {
  kamakura: 'kamakura', shrine: 'kamakura', omiyage: 'kamakura',
  hakone: 'hakone', ryokan: 'hakone', washitsu: 'hakone', onsen: 'hakone',
  akihabara: 'akihabara', denki: 'akihabara', maidcafe: 'akihabara', arcade: 'akihabara',
};

/** How long the ride is between home and wherever this trip place is. */
export function rideMinutes(place: TripPlace | string | null): number {
  const trip = TRIPS.find((t) => t.id === TRIP_OF[place as TripPlace]);
  return trip?.minutes ?? TRIP_MINUTES;
}

/** Can you go now, and if not, why not. */
export function canTravel(trip: Trip, level: number, money: number, minutes: number): 'ok' | 'level' | 'closed' | 'money' | 'late' {
  if (!trip.built) return 'closed';
  if (level < trip.level) return 'level';
  if (minutes >= LAST_TRAIN_OUT) return 'late';
  if (money < trip.fare) return 'money';
  return 'ok';
}

/** What comes out of the capsule-toy machines in 秋葉原: one of these, at random. */
export const GACHA_TOYS = [
  { id: 'gacha_maneki', word: '招き猫', en: 'a beckoning cat' },
  { id: 'gacha_sushi', word: '寿司', en: 'a tiny sushi' },
  { id: 'gacha_densha', word: '電車', en: 'a little train' },
] as const;
/** A turn of a capsule machine's handle: three 100-yen coins. */
export const GACHA_PRICE = 300;

/** A random toy from the machine, preferring one you don't have yet. */
export function gachaPull(owned: readonly string[], rand: () => number = Math.random): (typeof GACHA_TOYS)[number] {
  const fresh = GACHA_TOYS.filter((t) => !owned.includes(t.id));
  const pool = fresh.length ? fresh : GACHA_TOYS;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]!;
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
  // Not from a trip, but the same idea: the goldfish you scoop at the festival comes home in a bowl.
  { id: 'kingyo', word: '金魚', from: 'yamamoto' satisfies NpcId, scenario: 'festival_kingyo' },
  // From the ryokan in 箱根: the tenugui towel from your room, and a wood mosaic box from its shop.
  { id: 'tenugui', word: '手ぬぐい', from: 'okami' satisfies NpcId, scenario: 'ryokan_checkout' },
  { id: 'yosegi', word: '寄木細工', from: 'okami' satisfies NpcId, scenario: 'ryokan_baiten', variant: 'yosegi' },
  // From 秋葉原: the plushie you win at the crane game.
  { id: 'nuigurumi_neko', word: 'ぬいぐるみ', from: 'kato' satisfies NpcId, scenario: 'arcade_crane', variant: 'neko' },
  { id: 'nuigurumi_inu', word: 'ぬいぐるみ', from: 'kato' satisfies NpcId, scenario: 'arcade_crane', variant: 'inu' },
];

/** The capsule toys are keepsakes too, though no conversation gives them: you turn the handle yourself. */
export const GACHA_KEEPSAKES: Keepsake[] = GACHA_TOYS.map((t) => ({ id: t.id, word: t.word, from: 'kato' satisfies NpcId }));

/** Every keepsake that comes from a trip: souvenirs, and the capsule toys. */
export const TRIP_KEEPSAKES: Keepsake[] = [...SOUVENIRS, ...GACHA_KEEPSAKES];

/** What a finished conversation brings home, if anything. */
export function souvenirFor(scenario: string, variant: string): Souvenir | undefined {
  return SOUVENIRS.find((s) => s.scenario === scenario && (!s.variant || s.variant === variant));
}
