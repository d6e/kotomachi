import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adoptOldSave, cleanName, clearSave, lastPlayed, listSlots, load, newGame, save, SAVE_KEY, slotKey, SLOT_COUNT, NAME_MAX } from '../src/game/state.ts';
import { Learner } from '../src/learner/model.ts';
import { vocab } from '../src/game/content.ts';

class Mem {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const mem = () => new Mem() as unknown as Storage & Mem;

/** A game someone has been playing for a while. */
function played(day: number, money: number) {
  const g = newGame();
  g.day = day;
  g.money = money;
  g.xp = 120;
  g.keepsakes = ['plant'];
  g.bag = { plant: 1 };
  g.settings.gloss = true;
  new Learner(g.learner, vocab).see('コーヒー', { day: 1, place: 'cafe' });
  return g;
}

test('there are three slots, all empty in a fresh browser', () => {
  assert.equal(SLOT_COUNT, 3);
  const slots = listSlots(mem());
  assert.deepEqual(slots.map((s) => [s.slot, s.game, s.name]), [[1, null, 'Player 1'], [2, null, 'Player 2'], [3, null, 'Player 3']]);
});

test('the save from before slots moves into slot 1 with everything in it, once', () => {
  const store = mem();
  const old = played(6, 12345);
  store.setItem(SAVE_KEY, JSON.stringify(old));
  const slots = listSlots(store);
  const g = slots[0]!.game!;
  assert.ok(g, 'slot 1 has the old game');
  assert.equal(g.day, 6);
  assert.equal(g.money, 12345);
  assert.equal(g.xp, 120);
  assert.deepEqual(g.keepsakes, ['plant']);
  assert.equal(g.settings.gloss, true);
  assert.ok(g.learner.words['コーヒー'], 'what it knew comes along');
  assert.equal(slots[0]!.name, 'Player 1');
  assert.equal(slots[1]!.game, null);
  assert.equal(slots[2]!.game, null);
  assert.equal(store.getItem(SAVE_KEY), null, 'the old copy is removed once it is safely in slot 1');
  // Deleting slot 1 afterwards doesn't bring the old save back.
  clearSave(1, store);
  assert.equal(load(1, store), null);
  assert.equal(listSlots(store)[0]!.game, null);
});

test('deleting slot 1 before the slots were ever read still deletes the old save', () => {
  const store = mem();
  store.setItem(SAVE_KEY, JSON.stringify(played(3, 100)));
  clearSave(1, store);
  assert.equal(load(1, store), null);
  assert.equal(store.getItem(SAVE_KEY), null);
});

test('an old save never overwrites a slot that is already taken', () => {
  const store = mem();
  const mine = newGame('Aiko');
  save(mine, 1, store);
  store.setItem(SAVE_KEY, JSON.stringify(played(9, 777)));
  adoptOldSave(store);
  assert.equal(load(1, store)!.name, 'Aiko');
  assert.equal(load(2, store)!.day, 9, 'it goes into the next empty slot');
  // With every slot taken, it stays where it was rather than being lost.
  const full = mem();
  for (let s = 1; s <= 3; s++) save(newGame(`P${s}`), s, full);
  full.setItem(SAVE_KEY, JSON.stringify(played(2, 1)));
  adoptOldSave(full);
  assert.ok(full.getItem(SAVE_KEY));
  assert.deepEqual(listSlots(full).map((s) => s.name), ['P1', 'P2', 'P3']);
});

test('junk in the old save key is left alone and slots stay empty', () => {
  const store = mem();
  store.setItem(SAVE_KEY, '{not json');
  assert.equal(listSlots(store)[0]!.game, null);
  store.setItem(SAVE_KEY, JSON.stringify({ version: 9 }));
  assert.equal(listSlots(store)[0]!.game, null);
});

test('each slot is its own game: saving, changing and deleting one leaves the others as they were', () => {
  const store = mem();
  const a = played(4, 900);
  a.name = 'Aiko';
  const b = newGame('Ben');
  save(a, 1, store);
  save(b, 2, store);
  // Ben plays on: his learner model, yen, things and settings change.
  const ben = load(2, store)!;
  ben.day = 2;
  ben.money = 42;
  ben.bag = { latte: 1 };
  ben.settings.gloss = false;
  new Learner(ben.learner, vocab).see('サイズ', { day: 2, place: 'cafe' });
  save(ben, 2, store);
  const aiko = load(1, store)!;
  assert.equal(aiko.name, 'Aiko');
  assert.equal(aiko.day, 4);
  assert.equal(aiko.money, 900);
  assert.deepEqual(aiko.bag, { plant: 1 });
  assert.equal(aiko.settings.gloss, true);
  assert.equal(aiko.learner.words['サイズ'], undefined, "Ben's words aren't in Aiko's notebook");
  assert.ok(load(2, store)!.learner.words['サイズ']);
  assert.equal(load(3, store), null);
  clearSave(2, store);
  assert.equal(load(2, store), null);
  assert.equal(load(1, store)!.day, 4);
  assert.deepEqual(listSlots(store).map((s) => s.name), ['Aiko', 'Player 2', 'Player 3']);
  // The slots don't share storage keys with each other or the old save.
  assert.equal(new Set([SAVE_KEY, slotKey(1), slotKey(2), slotKey(3)]).size, 4);
});

test('saving stamps the time, for "last played"', () => {
  const store = mem();
  const g = newGame('Aiko');
  save(g, 3, store, Date.UTC(2026, 10, 27, 12));
  assert.equal(load(3, store)!.savedAt, Date.UTC(2026, 10, 27, 12));
  const now = new Date(2026, 10, 27, 20).getTime();
  assert.equal(lastPlayed(new Date(2026, 10, 27, 9).getTime(), now), 'today');
  assert.equal(lastPlayed(new Date(2026, 10, 26, 23).getTime(), now), 'yesterday');
  assert.equal(lastPlayed(new Date(2026, 10, 23, 9).getTime(), now), '4 days ago');
  assert.ok(lastPlayed(new Date(2026, 9, 1).getTime(), now));
  assert.equal(lastPlayed(undefined, now), null);
});

test('names are trimmed, kept short and can be Japanese', () => {
  assert.equal(cleanName('  Aiko  '), 'Aiko');
  assert.equal(cleanName('あい   こ'), 'あい こ');
  assert.equal(cleanName(''), '');
  assert.equal([...cleanName('あ'.repeat(40))].length, NAME_MAX);
  const store = mem();
  store.setItem(slotKey(1), JSON.stringify({ ...newGame(), name: 42 }));
  assert.equal(listSlots(store)[0]!.name, 'Player 1', 'a broken name falls back to the default');
});

test('the game saves into the slot being played, never the old single save key', () => {
  const src = readFileSync('src/game/game.ts', 'utf8');
  assert.ok(!/\bsave\(this\.g\)/.test(src), 'every save names the slot');
  assert.ok(!/SAVE_KEY/.test(src));
});
