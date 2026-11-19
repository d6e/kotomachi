import { test } from 'node:test';
import assert from 'node:assert/strict';
import { npcs, requests, scenarioById, scenarios, vocab } from '../src/game/content.ts';
import { planRequests } from '../src/game/errands.ts';
import { ARRIVAL, canTravel, LAST_TRAIN_OUT, ON_SALE, SOUVENIRS, TRIPS } from '../src/game/trips.ts';
import { emptyLearner, Learner } from '../src/learner/model.ts';
import { itemIcon, KEEPSAKE_ART } from '../src/town/roomart.ts';
import { doorCell, doorTo, roomDoor, roomEntrance, roomFor, ROOMS, roomSolid, talkSpot, thingSpot, TRIP_ROOMS, type RoomDef } from '../src/town/rooms.ts';
import { STAFF } from '../src/town/sprites.ts';
import { drawArea } from '../src/town/tripart.ts';

function reachable(room: RoomDef, from = roomEntrance(room)): Set<string> {
  const seen = new Set([`${from.tx},${from.ty}`]);
  const q = [from];
  while (q.length) {
    const p = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { tx: p.tx + dx!, ty: p.ty + dy! };
      const k = `${n.tx},${n.ty}`;
      if (seen.has(k) || roomSolid(room, n.tx, n.ty)) continue;
      seen.add(k);
      q.push(n);
    }
  }
  return seen;
}

test('鎌倉: from the platform you can walk to the shrine, the shop, and back to the train', () => {
  const area = TRIP_ROOMS.kamakura;
  const seen = reachable(area);
  const exit = roomDoor(area);
  assert.ok(seen.has(`${exit.tx},${exit.ty}`), 'the platform');
  for (const to of ['shrine', 'omiyage'] as const) {
    const d = doorCell(area, to)!;
    assert.ok(d, `${to} has a door`);
    assert.ok(seen.has(`${d.tx},${d.ty}`), `${to} door reachable`);
    assert.equal(doorTo(area, d.tx, d.ty), to);
    // Coming back out, you stand on the path just below the door.
    assert.ok(!roomSolid(area, d.tx, d.ty + 1), `${to}: a tile to come out onto`);
    assert.equal(TRIP_ROOMS[to].exit, 'kamakura');
  }
  assert.equal(area.exit, 'train');
  assert.ok(ARRIVAL['kamakura'] === 'kamakura');
});

test('the shrine and the souvenir shop each have someone to talk to', () => {
  for (const place of ['shrine', 'omiyage'] as const) {
    const room = TRIP_ROOMS[place];
    const talk = talkSpot(room)!;
    assert.ok(talk, place);
    assert.ok(reachable(room).has(`${talk.tx},${talk.ty}`), `${place}: counter reachable`);
    assert.ok(npcs[room.staff as keyof typeof npcs], `${place}: ${room.staff} is a person`);
    assert.ok(STAFF[room.staff!], `${place}: ${room.staff} is drawn`);
    assert.equal(roomFor(place), room);
  }
  assert.equal(roomFor('cafe'), ROOMS.cafe);
});

test('the ticket machines at the station can be reached', () => {
  const spot = thingSpot(ROOMS.station, 'tickets')!;
  assert.ok(spot);
  assert.ok(reachable(ROOMS.station).has(`${spot.tx},${spot.ty}`));
});

test('trips: one place to go now, more planned, each named in Japanese; only built towns are sold', () => {
  assert.ok(TRIPS.length >= 3 && TRIPS.length <= 4);
  assert.equal(TRIPS.filter((t) => t.built).length, 1);
  const levels = TRIPS.map((t) => t.level);
  assert.deepEqual([...levels].sort((a, b) => a - b), levels, 'listed in level order');
  for (const t of TRIPS) assert.ok(vocab.has(t.name), `${t.name} in vocab`);
  const k = TRIPS[0]!;
  assert.equal(canTravel(k, k.level - 1, 99999, 600), 'level');
  assert.equal(canTravel(k, k.level, k.fare - 1, 600), 'money');
  assert.equal(canTravel(k, k.level, k.fare, LAST_TRAIN_OUT), 'late');
  assert.equal(canTravel(k, k.level, k.fare, 600), 'ok');
  // A town that isn't built can't be reached at any level, and the machine doesn't list it.
  for (const t of TRIPS.filter((x) => !x.built)) assert.equal(canTravel(t, 99, 99999, 600), 'closed');
  assert.deepEqual(ON_SALE.map((t) => t.id), ['kamakura']);
  for (const t of ON_SALE) assert.ok(ARRIVAL[t.id], `${t.id} has somewhere to arrive`);
});

test('souvenirs come from the trip conversations, with a word and a picture', () => {
  for (const s of SOUVENIRS) {
    assert.ok(vocab.has(s.word), s.word);
    assert.ok(KEEPSAKE_ART[s.id], `${s.id} drawn`);
    assert.ok([...itemIcon(s.id, 'keepsake').px].some((p) => p >= 0), `${s.id} icon`);
    const def = scenarioById[s.scenario]!;
    assert.ok(def, s.scenario);
    if (s.variant) assert.ok(def.variants.some((v) => v.id === s.variant), `${s.scenario}/${s.variant}`);
  }
});

test('the trip area draws, with its signs', () => {
  const art = drawArea(TRIP_ROOMS.kamakura, (t) => t.length * 10);
  assert.deepEqual(art.signs.map((s) => s.word).sort(), ['お土産', '神社', '鎌倉'].sort());
  assert.ok([...art.base.px].every((p) => p >= 0), 'every pixel painted');
});

test('trip requests wait for the level, and come at most once a day', () => {
  const learner = new Learner(emptyLearner(), vocab);
  const trip = new Set(requests.small.filter((r) => r.trip).map((r) => r.scenario));
  assert.ok(trip.size >= 2);
  let days = 0;
  for (let day = 1; day <= 30; day++) {
    const low = planRequests({ defs: scenarios, requests, arcs: {}, learner, vocab, day, level: 2 });
    assert.ok(!low.some((e) => trip.has(e.scenario)), `day ${day}: no trip before level 3`);
    const high = planRequests({ defs: scenarios, requests, arcs: {}, learner, vocab, day, level: 5 });
    const n = high.filter((e) => trip.has(e.scenario)).length;
    assert.ok(n <= 1, `day ${day}: ${n} trip requests`);
    days += n;
  }
  assert.ok(days > 0, 'some days ask for a trip');
});
