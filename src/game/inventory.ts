// What you carry: everything you've bought or been given (持ち物), and the few things you've
// put on the shelf in your room. Pure data and logic, no DOM, so it can be tested.

import { requests } from './content.ts';
import { PHOTOS } from './friends.ts';
import { allKeepsakes } from './room.ts';
import type { GameData } from './state.ts';
import { SOUVENIRS, souvenirFor } from './trips.ts';

/** Something you can own. `word` is markup, like a line: `お弁当=弁当`. */
export interface Good {
  id: string;
  word: string;
  /** The conversation it's bought in, and which of its variants. */
  scenario?: string;
  variants?: string[];
  /** A gift or a souvenir: counted in your keepsakes, and put straight on the shelf. */
  keepsake?: boolean;
}

/** Everyday things bought on errands. Meals eaten at the restaurant, and letters and parcels sent off, aren't kept. */
const BOUGHT: Good[] = [
  { id: 'coffee', word: 'コーヒー', scenario: 'cafe_order', variants: ['coffee'] },
  { id: 'latte', word: 'ラテ', scenario: 'cafe_order', variants: ['latte'] },
  { id: 'koucha', word: '紅茶', scenario: 'cafe_order', variants: ['tea'] },
  { id: 'cocoa', word: 'ココア', scenario: 'cafe_order', variants: ['cocoa'] },
  { id: 'onigiri', word: 'おにぎり', scenario: 'konbini_buy', variants: ['onigiri'] },
  { id: 'ocha', word: 'お茶', scenario: 'konbini_buy', variants: ['tea'] },
  { id: 'bento', word: 'お弁当=弁当', scenario: 'konbini_buy', variants: ['bento'] },
  { id: 'mizu', word: '水', scenario: 'konbini_buy', variants: ['water'] },
  { id: 'aisu', word: 'アイス', scenario: 'konbini_buy', variants: ['ice'] },
  { id: 'kasa', word: '傘', scenario: 'konbini_buy', variants: ['umbrella'] },
  { id: 'denchi', word: '電池', scenario: 'konbini_buy', variants: ['battery'] },
  { id: 'nikuman', word: '肉まん', scenario: 'konbini_buy', variants: ['nikuman'] },
  { id: 'gyunyu', word: '牛乳', scenario: 'konbini_buy', variants: ['milk'] },
  { id: 'kazegusuri', word: '風邪薬', scenario: 'pharmacy_buy', variants: ['cold'] },
  { id: 'zutsuyaku', word: '頭痛薬', scenario: 'pharmacy_buy', variants: ['headache'] },
  { id: 'megusuri', word: '目薬', scenario: 'pharmacy_buy', variants: ['eyes'] },
  { id: 'ichoyaku', word: '胃腸薬', scenario: 'pharmacy_buy', variants: ['stomach'] },
  { id: 'sekidome', word: '咳止め', scenario: 'pharmacy_buy', variants: ['cough'] },
  { id: 'genetsuzai', word: '解熱剤', scenario: 'pharmacy_buy', variants: ['fever'] },
  { id: 'kitte', word: '切手', scenario: 'post_send', variants: ['stamps'] },
  { id: 'nimotsu', word: '荷物', scenario: 'post_send', variants: ['pickup'] },
  { id: 'kippu', word: '切符', scenario: 'station_ticket', variants: ['ticket', 'platform', 'time', 'rapid'] },
  { id: 'okashi', word: 'お菓子', scenario: 'omiyage_buy', variants: ['okashi'] },
  { id: 'manju', word: '温泉まんじゅう', scenario: 'ryokan_baiten', variants: ['manju'] },
];

export const GOODS: Good[] = [
  ...BOUGHT,
  ...[...allKeepsakes(requests, SOUVENIRS), ...PHOTOS].map((k) => ({ id: k.id, word: k.word, keepsake: true })),
];
export const goodById: Record<string, Good> = Object.fromEntries(GOODS.map((g) => [g.id, g]));

/** Three shelves of three. */
export const SHELF_SIZE = 9;

/** What a finished conversation leaves you holding, if anything. */
export function goodFor(scenario: string, variant: string): Good | undefined {
  const s = souvenirFor(scenario, variant);
  if (s) return goodById[s.id];
  return BOUGHT.find((g) => g.scenario === scenario && g.variants!.includes(variant));
}

/** Add one to what you carry. A keepsake goes straight on the shelf if there's room. Returns whether it's the first of its kind. */
export function receive(g: GameData, id: string): boolean {
  const first = !g.bag[id];
  g.bag[id] = (g.bag[id] ?? 0) + 1;
  const good = goodById[id];
  if (good?.keepsake && !g.keepsakes.includes(id)) g.keepsakes.push(id);
  if (first && good?.keepsake) shelve(g, id);
  return first;
}

/** Put something you have on the shelf. False if you haven't got it, it's already there, or the shelf is full. */
export function shelve(g: GameData, id: string): boolean {
  if (!g.bag[id] || g.shelf.includes(id) || g.shelf.length >= SHELF_SIZE) return false;
  g.shelf.push(id);
  return true;
}

/** Take something down off the shelf; it stays in your things. */
export function unshelve(g: GameData, id: string): void {
  g.shelf = g.shelf.filter((s) => s !== id);
}

/** What you have, in the order things are listed: keepsakes first, then everyday things. */
export function belongings(g: GameData): { good: Good; count: number }[] {
  const all = [...GOODS.filter((x) => x.keepsake), ...GOODS.filter((x) => !x.keepsake)];
  return all.filter((x) => (g.bag[x.id] ?? 0) > 0).map((good) => ({ good, count: g.bag[good.id]! }));
}
