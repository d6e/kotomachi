import { test } from 'node:test';
import assert from 'node:assert/strict';
import { npcs, scenarioById, scenarios, vocab } from '../src/game/content.ts';
import { makeErrands } from '../src/game/errands.ts';
import { HOURS, isOpen } from '../src/game/state.ts';
import { emptyLearner, Learner } from '../src/learner/model.ts';
import { fillSlots, parseLine, plainText } from '../src/lang/markup.ts';
import { BUILDINGS, buildGrid, doorSpot, findPath, isSolid, START } from '../src/town/map.ts';

const NEW_PLACES = ['restaurant_eat', 'station_ticket', 'post_send'];

test('the restaurant, station and post office each have 5 to 7 errands through all four stages', () => {
  for (const id of NEW_PLACES) {
    const def = scenarioById[id]!;
    assert.ok(def, id);
    assert.equal(def.maxStage, 4, id);
    assert.ok(def.variants.length >= 5 && def.variants.length <= 7, `${id} has ${def.variants.length} variants`);
    assert.ok(npcs[def.npc], `${id}: npc ${def.npc}`);
    // Every node that climbs the ladder has multiple choice, tiles and a blank.
    const ladder = Object.entries(def.nodes).filter(([, n]) => (n.maxMode ?? 5) > 2);
    assert.ok(ladder.length >= 4, `${id}: only ${ladder.length} ladder nodes`);
    for (const [nid, n] of ladder) assert.ok(n.choices && n.tiles && n.blank, `${id}.${nid}: stages 1-4 authored`);
    // Every variant meets at least two ladder nodes, so stage 3 and 4 are real practice.
    for (const v of def.variants) {
      const mine = ladder.filter(([, n]) => !n.onlyFor || n.onlyFor.includes(v.id));
      assert.ok(mine.length >= 2, `${id}/${v.id}: ${mine.length} ladder nodes`);
    }
  }
});

test('day 1 gives every place its first, simplest errand', () => {
  const learner = new Learner(emptyLearner(), vocab);
  const errands = makeErrands(scenarios, learner, vocab, 1);
  for (const def of scenarios.filter((s) => s.errand)) {
    const e = errands.find((x) => x.scenario === def.id);
    assert.ok(e, `${def.id} has an errand`);
    assert.equal(e.variant, def.variants[0]!.id, def.id);
  }
  // The first variant is the shortest conversation at each new place.
  for (const id of NEW_PLACES) {
    const def = scenarioById[id]!;
    const length = (vid: string) => Object.values(def.nodes).filter((n) => !n.onlyFor || n.onlyFor.includes(vid)).length;
    const first = length(def.variants[0]!.id);
    for (const v of def.variants) assert.ok(first <= length(v.id), `${id}: ${v.id} is shorter than the first variant`);
  }
});

test('errand lines read as Japanese with every slot filled', () => {
  for (const id of NEW_PLACES) {
    const def = scenarioById[id]!;
    for (const v of def.variants) {
      const line = fillSlots(def.errand!, { ...v.slots, price: String(v.price ?? 0) });
      assert.ok(!line.includes('$'), `${id}/${v.id}: ${line}`);
      assert.ok(plainText(parseLine(line, vocab)).length > 3);
    }
  }
});

test('a price said out loud matches what the errand charges', () => {
  for (const id of NEW_PLACES) {
    const def = scenarioById[id]!;
    for (const v of def.variants) {
      const said = v.slots['payline'];
      if (!said || !/\d/.test(said)) continue;
      assert.ok(said.includes(`${v.price} 円`), `${id}/${v.id}: "${said}" vs ¥${v.price}`);
    }
  }
});

test('the three new buildings stand on the street with a door you can reach and a sign you can look up', () => {
  const g = buildGrid();
  const blocked = (x: number, y: number) => isSolid(g, x, y);
  for (const place of ['restaurant', 'post', 'station'] as const) {
    const b = BUILDINGS.find((bd) => bd.door?.place === place);
    assert.ok(b, place);
    assert.ok(vocab.has(b.sign), `${place} sign ${b.sign}`);
    const spot = doorSpot(b)!;
    assert.ok(spot.tx * 16 >= b.x && spot.tx * 16 + 16 <= b.x + b.w, `${place} door is inside the building`);
    assert.ok(findPath(blocked, START, spot), `no way to the ${place}`);
  }
  // Buildings don't overlap.
  const sorted = [...BUILDINGS].sort((a, b) => a.x - b.x);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i]!.x >= sorted[i - 1]!.x + sorted[i - 1]!.w, `${sorted[i]!.id} overlaps`);
});

test('opening hours: the restaurant opens for lunch, the post office closes at five, the station never closes', () => {
  assert.ok(HOURS['restaurant'] && HOURS['post']);
  assert.equal(isOpen('restaurant', 10 * 60), false);
  assert.equal(isOpen('restaurant', 12 * 60), true);
  assert.equal(isOpen('post', 16 * 60 + 59), true);
  assert.equal(isOpen('post', 17 * 60), false);
  assert.equal(isOpen('station', 22 * 60), true);
});
