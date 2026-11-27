import { test } from 'node:test';
import assert from 'node:assert/strict';
import { npcs, requests, scenarioById, scenarios, vocab } from '../src/game/content.ts';
import { planRequests } from '../src/game/errands.ts';
import { goodById, goodFor } from '../src/game/inventory.ts';
import { isOpen } from '../src/game/state.ts';
import { ARRIVAL, canTravel, GACHA_KEEPSAKES, GACHA_PRICE, GACHA_TOYS, gachaPull, rideMinutes, TRIPS } from '../src/game/trips.ts';
import { emptyLearner, Learner } from '../src/learner/model.ts';
import { headArt } from '../src/town/faces.ts';
import { drawRoom, KEEPSAKE_ART } from '../src/town/roomart.ts';
import { doorCell, doorTo, roomDoor, roomEntrance, roomSolid, talkSpot, thingSpot, TRIP_ROOMS, type RoomDef } from '../src/town/rooms.ts';
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
const has = (seen: Set<string>, p: { tx: number; ty: number } | null) => !!p && seen.has(`${p.tx},${p.ty}`);
const SHOPS = ['denki', 'maidcafe', 'arcade'] as const;
const akihabara = TRIPS.find((t) => t.id === 'akihabara')!;

test('秋葉原 is on sale from level 4: a ticket, an hour each way, arriving on the Electric Town street', () => {
  assert.ok(akihabara.built);
  assert.ok(vocab.has(akihabara.name));
  assert.equal(akihabara.level, 4);
  assert.equal(ARRIVAL['akihabara'], 'akihabara');
  assert.equal(canTravel(akihabara, 3, 99999, 600), 'level');
  assert.equal(canTravel(akihabara, 4, akihabara.fare, 600), 'ok');
  for (const p of ['akihabara', ...SHOPS]) assert.equal(rideMinutes(p), akihabara.minutes, p);
});

test('from the platform you cross the road to each shop and the capsule machines, and back to the train', () => {
  const area = TRIP_ROOMS.akihabara;
  const seen = reachable(area);
  assert.ok(has(seen, roomDoor(area)), 'the platform');
  assert.equal(area.exit, 'train');
  for (const to of SHOPS) {
    const d = doorCell(area, to)!;
    assert.ok(has(seen, d), `${to} door reachable`);
    assert.equal(doorTo(area, d.tx, d.ty), to);
    assert.ok(!roomSolid(area, d.tx, d.ty + 1), `${to}: a tile to come out onto`);
    assert.equal(TRIP_ROOMS[to].exit, 'akihabara');
  }
  assert.ok(has(seen, thingSpot(area, 'gacha')), 'the capsule machines');
  // The road is only crossed at the crossing.
  const road = area.rows.findIndex((r) => r.includes('R'));
  for (let tx = 0; tx < 20; tx++) assert.equal(roomSolid(area, tx, road), area.rows[road]![tx] !== 'z', `road at ${tx}`);
});

test('each shop has someone behind the counter you can reach, a person with a sprite and a face', () => {
  for (const place of SHOPS) {
    const room = TRIP_ROOMS[place];
    assert.ok(has(reachable(room), talkSpot(room)), `${place}: counter reachable`);
    assert.ok(npcs[room.staff as keyof typeof npcs], `${place}: ${room.staff} is a person`);
    assert.ok(STAFF[room.staff!], `${place}: ${room.staff} is drawn`);
    for (const row of STAFF[room.staff!]!.rows) assert.equal(row.length, 16, `${room.staff} row width`);
    assert.equal(STAFF[room.staff!]!.rows.length, 16, `${room.staff} rows`);
    assert.ok(headArt(room.staff!), `${room.staff} has a head`);
    const def = scenarios.find((s) => s.place === place)!;
    assert.ok(def, `${place} has a conversation`);
    assert.equal(def.npc, room.staff, `${place}: the errand is with whoever works there`);
  }
});

test('the street and the shops draw, with every sign in the dictionary', () => {
  const art = drawArea(TRIP_ROOMS.akihabara, (t) => t.length * 10);
  assert.deepEqual(art.signs.map((s) => s.word).sort(), ['電気屋', 'メイドカフェ', 'ゲームセンター', '電気街口', '秋葉原'].sort());
  assert.ok([...art.base.px].every((p) => p >= 0), 'every pixel painted');
  for (const place of SHOPS) {
    const inside = drawRoom(TRIP_ROOMS[place], (t) => t.length * 10);
    assert.equal(inside.signs.length, 1, place);
    for (const s of [...art.signs, ...inside.signs]) assert.ok(vocab.has(s.word), s.word);
  }
});

test('the three conversations climb all four stages, and every variant gets real practice', () => {
  for (const id of ['denki_buy', 'maid_cafe', 'arcade_crane']) {
    const def = scenarioById[id]!;
    assert.ok(def, id);
    assert.equal(def.maxStage, 4);
    const ladder = Object.entries(def.nodes).filter(([, n]) => (n.maxMode ?? 5) > 2);
    assert.ok(ladder.length >= 3, `${id}: ${ladder.length} ladder nodes`);
    for (const [nid, n] of ladder) assert.ok(n.choices && n.tiles && n.blank, `${id}.${nid}: stages 1-4 authored`);
    for (const v of def.variants) assert.ok(v.price && v.price > 0, `${id}/${v.id} costs something`);
    assert.ok(Object.values(def.nodes).some((n) => n.effects?.pay), `${id}: you pay somewhere`);
  }
});

test('the maid cafe stays a cafe: the welcome-home greeting, no ご主人様, and no photos of the staff', () => {
  const def = scenarioById['maid_cafe']!;
  const text = JSON.stringify(def);
  assert.ok(!text.includes('ご主人様') && !text.includes('お嬢様'));
  assert.ok(JSON.stringify(def.nodes['home']!.line).includes('おかえりなさい'));
  assert.ok(Object.values(def.nodes).some((n) => JSON.stringify(n.line).includes('ご遠慮ください')));
});

test('the crane game brings home a plushie, one you haven\'t got first', () => {
  for (const v of ['neko', 'inu']) {
    const g = goodFor('arcade_crane', v)!;
    assert.ok(g?.keepsake, v);
    assert.equal(g.word, 'ぬいぐるみ');
  }
  // The electronics shop's things aren't keepsakes; the cafe's food is eaten there.
  assert.equal(goodFor('maid_cafe', 'omurice'), undefined);
});

test('capsule machines: ¥300 a turn, a toy you haven\'t got yet if there is one, each a keepsake with a picture', () => {
  assert.equal(GACHA_PRICE, 300);
  const ids = GACHA_TOYS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const k of GACHA_KEEPSAKES) {
    assert.ok(vocab.has(k.word), k.word);
    assert.ok(KEEPSAKE_ART[k.id], `${k.id} drawn`);
    assert.ok(goodById[k.id]?.keepsake, `${k.id} is a keepsake`);
  }
  const owned: string[] = [];
  for (let i = 0; i < GACHA_TOYS.length; i++) owned.push(gachaPull(owned, () => 0.99).id);
  assert.deepEqual([...owned].sort(), [...ids].sort(), 'three turns, three different toys');
  assert.ok(ids.includes(gachaPull(owned, () => 0.5).id), 'after that, any of them');
  for (const w of ['ガチャガチャ', '百円玉', '三枚', '入れる', '回す', 'カプセル', '出る']) assert.ok(vocab.has(w), w);
});

test('the shops keep Akihabara hours: closed first thing, open into the evening', () => {
  for (const p of SHOPS) {
    assert.ok(!isOpen(p, 9 * 60), `${p} at 9:00`);
    assert.ok(isOpen(p, 12 * 60), `${p} at noon`);
    assert.ok(isOpen(p, 17 * 60 + 30), `${p} at 17:30`);
  }
});

test('neighbours ask you to go to 秋葉原 once you can buy the ticket', () => {
  const learner = new Learner(emptyLearner(), vocab);
  const aki = new Set(['denki_buy', 'maid_cafe', 'arcade_crane']);
  for (const r of requests.small.filter((x) => aki.has(x.scenario))) {
    assert.equal(r.level, 4);
    assert.ok(r.trip);
  }
  let asked = 0;
  for (let day = 1; day <= 40; day++) {
    assert.ok(!planRequests({ defs: scenarios, requests, arcs: {}, learner, vocab, day, level: 3 }).some((e) => aki.has(e.scenario)));
    asked += planRequests({ defs: scenarios, requests, arcs: {}, learner, vocab, day, level: 4 }).filter((e) => aki.has(e.scenario)).length;
  }
  assert.ok(asked > 0);
});
