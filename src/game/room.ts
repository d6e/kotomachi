// Your room at home: the catalog at the post office, what you've bought, and the
// keepsakes on your shelf. Pure data and logic, no DOM, so it can be tested.

import catalogJson from '../../data/catalog.json' with { type: 'json' };
import { furnish, ROOMS, type DecorItem, type RoomDef } from '../town/rooms.ts';
import type { RequestData } from './errands.ts';

export interface CatalogItem extends DecorItem {
  /** The word for it (a vocab id), which is also how you order it. */
  word: string;
  price: number;
  /** The level you need before it can be ordered. */
  level: number;
}

export const CATALOG = catalogJson as unknown as CatalogItem[];
export const catalogById: Record<string, CatalogItem> = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

/** Can this be ordered now, and if not, why not. */
export function canOrder(item: CatalogItem, owned: string[], level: number, money: number): 'ok' | 'owned' | 'level' | 'money' {
  if (owned.includes(item.id)) return 'owned';
  if (level < item.level) return 'level';
  if (money < item.price) return 'money';
  return 'ok';
}

/** Your room with what you own in it. */
export function homeRoom(owned: string[], shelf: string[]): RoomDef {
  return furnish(ROOMS.home, owned.flatMap((id) => (catalogById[id] ? [catalogById[id]!] : [])), shelf);
}

/** A keepsake's word and who or where it came from. */
export interface Keepsake {
  id: string;
  word: string;
  from: string;
}

/** Every keepsake there is: the regulars' gifts, then souvenirs. */
export function allKeepsakes(requests: RequestData, souvenirs: Keepsake[] = []): Keepsake[] {
  return [...requests.arcs.map((a) => ({ id: a.gift.id, word: a.gift.word, from: a.from as string })), ...souvenirs];
}
