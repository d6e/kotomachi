import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarioById, vocab } from '../src/game/content.ts';
import { belongings, GOODS, goodFor, receive, SHELF_SIZE, shelve, unshelve } from '../src/game/inventory.ts';
import { migrate, newGame } from '../src/game/state.ts';
import { parseLine } from '../src/lang/markup.ts';
import { itemIcon, KEEPSAKE_ART } from '../src/town/roomart.ts';

test('everything you can own has a word in the dictionary and a picture for the shelf', () => {
  const ids = new Set<string>();
  for (const g of GOODS) {
    assert.ok(!ids.has(g.id), `${g.id} listed once`);
    ids.add(g.id);
    const tokens = parseLine(g.word, vocab);
    assert.ok(tokens.every((t) => t.lemma && vocab.has(t.lemma)), `${g.word} in vocab`);
    assert.ok(KEEPSAKE_ART[g.id], `${g.id} drawn`);
    assert.ok([...itemIcon(g.id, 'keepsake').px].some((p) => p >= 0), `${g.id} icon`);
    if (g.scenario) for (const v of g.variants!) assert.ok(scenarioById[g.scenario]!.variants.some((x) => x.id === v), `${g.scenario}/${v}`);
  }
});

test('what you buy at the cafe, konbini and pharmacy is always something you keep', () => {
  for (const id of ['cafe_order', 'konbini_buy', 'pharmacy_buy', 'shrine_visit', 'omiyage_buy', 'festival_kingyo']) {
    for (const v of scenarioById[id]!.variants) assert.ok(goodFor(id, v.id), `${id}/${v.id}`);
  }
  // A meal is eaten there, and a letter is sent off.
  assert.equal(goodFor('restaurant_eat', 'curry'), undefined);
  assert.equal(goodFor('post_send', 'letter'), undefined);
  assert.equal(goodFor('omiyage_buy', 'okimono')!.id, 'daibutsu');
  assert.equal(goodFor('station_ticket', 'rapid')!.id, 'kippu');
});

test('things collect with a count; a keepsake goes on the shelf, other things wait until you put them there', () => {
  const g = newGame();
  assert.equal(receive(g, 'onigiri'), true);
  assert.equal(receive(g, 'onigiri'), false);
  assert.equal(g.bag['onigiri'], 2);
  assert.deepEqual(g.shelf, []);
  receive(g, 'daibutsu');
  assert.deepEqual(g.shelf, ['daibutsu']);
  assert.deepEqual(g.keepsakes, ['daibutsu']);
  assert.ok(shelve(g, 'onigiri'));
  assert.ok(!shelve(g, 'onigiri'), 'once is enough');
  assert.ok(!shelve(g, 'latte'), "can't shelve what you haven't got");
  unshelve(g, 'daibutsu');
  assert.deepEqual(g.shelf, ['onigiri']);
  assert.equal(g.bag['daibutsu'], 1, 'taken down, still yours');
  assert.deepEqual(belongings(g).map((b) => b.good.id), ['daibutsu', 'onigiri'], 'keepsakes listed first');
  // The shelf holds nine.
  for (const x of GOODS.slice(0, 12)) {
    receive(g, x.id);
    shelve(g, x.id);
  }
  assert.equal(g.shelf.length, SHELF_SIZE);
});

test('an older save keeps its keepsakes, in your things and on the shelf', () => {
  const old = { ...newGame(), keepsakes: ['mug', 'omamori'] } as Record<string, unknown>;
  delete old.bag;
  delete old.shelf;
  const g = migrate(JSON.parse(JSON.stringify(old)))!;
  assert.deepEqual(g.bag, { mug: 1, omamori: 1 });
  assert.deepEqual(g.shelf, ['mug', 'omamori']);
  const v1 = migrate({ version: 1, day: 3, keepsakes: ['plant'] })!;
  assert.deepEqual(v1.shelf, ['plant']);
  // A shelf naming something you don't have is tidied up.
  const odd = migrate({ ...newGame(), bag: { latte: 1 }, shelf: ['latte', 'tv'] })!;
  assert.deepEqual(odd.shelf, ['latte']);
});
