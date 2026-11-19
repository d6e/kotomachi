import { test } from 'node:test';
import assert from 'node:assert/strict';
import { npcs, scenarioById, vocab } from '../src/game/content.ts';
import { goodFor, GOODS } from '../src/game/inventory.ts';
import {
  BATH_CLOSED, canWaitForDinner, checkIn, checkInVariant, checkOut, CHECK_IN_FROM, CHECK_IN_UNTIL, frontDesk, inYukata, keptOut, roomScenario,
  roomState, spendable, stayPhase, STAY_PRICE, trainHomeBlocked,
} from '../src/game/ryokan.ts';
import { migrate, newGame } from '../src/game/state.ts';
import { drawRoom } from '../src/town/roomart.ts';
import { bedSpot, doorCell, doorTo, roomDoor, roomEntrance, roomSolid, talkSpot, thingSpot, TRIP_ROOMS, washitsuFor, type RoomDef } from '../src/town/rooms.ts';
import { PLAYER_YUKATA, STAFF } from '../src/town/sprites.ts';

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

test('箱根: from the platform you can walk into the ryokan, up to your room, to the bath and back', () => {
  const area = TRIP_ROOMS.hakone;
  const seen = reachable(area);
  assert.ok(has(seen, roomDoor(area)), 'the platform');
  const door = doorCell(area, 'ryokan')!;
  assert.ok(has(seen, door));
  assert.equal(doorTo(area, door.tx, door.ty), 'ryokan');
  assert.ok(!roomSolid(area, door.tx, door.ty + 1));
  const lobby = TRIP_ROOMS.ryokan;
  const inside = reachable(lobby);
  for (const to of ['washitsu', 'onsen'] as const) {
    const d = doorCell(lobby, to)!;
    assert.ok(has(inside, d), `${to} reachable from the lobby`);
    assert.ok(!roomSolid(lobby, d.tx, d.ty + 1), `${to}: somewhere to come back out onto`);
    assert.equal(TRIP_ROOMS[to].exit, 'ryokan');
  }
  assert.equal(lobby.exit, 'hakone');
  assert.ok(has(inside, talkSpot(lobby)), 'the front desk');
  assert.ok(has(inside, thingSpot(lobby, 'baiten')), 'the shop');
  assert.ok(has(reachable(TRIP_ROOMS.onsen), talkSpot(TRIP_ROOMS.onsen)), 'the bath, next to 鈴木さん');
});

test('your room: the 仲居 is there when there is something to see to, and the futon goes down after dinner', () => {
  const busy = washitsuFor({ attendant: true, futon: false });
  assert.equal(busy.staff, 'nakai');
  assert.ok(has(reachable(busy), talkSpot(busy)), 'across the low table from her');
  const night = washitsuFor({ attendant: false, futon: true });
  assert.equal(night.staff, undefined);
  assert.ok(has(reachable(night), bedSpot(night)), 'beside the futon');
  assert.ok(has(reachable(night), thingSpot(night, 'rest')), 'the low table');
  assert.equal(bedSpot(washitsuFor({ attendant: false, futon: false })), null, 'no futon before dinner');
});

test('everyone at the ryokan is a person with a sprite, and every room draws', () => {
  for (const place of ['ryokan', 'washitsu', 'onsen'] as const) {
    const room = TRIP_ROOMS[place];
    assert.ok(npcs[room.staff as keyof typeof npcs], `${place}: ${room.staff}`);
    assert.ok(STAFF[room.staff!], `${place}: ${room.staff} drawn`);
    const art = drawRoom(place === 'washitsu' ? washitsuFor({ attendant: true, futon: true }) : room, (t) => t.length * 10);
    for (const s of art.signs) assert.ok(vocab.has(s.word), `${place} sign ${s.word}`);
  }
  for (const side of [PLAYER_YUKATA.front, PLAYER_YUKATA.back, PLAYER_YUKATA.side]) {
    assert.equal(side.length, 16);
    for (const row of side) assert.equal(row.length, 16);
  }
});

test('a stay: check in from 15:00, the room, dinner at 6 or 7, the night, check out in the morning', () => {
  const g = newGame();
  g.day = 4;
  g.money = 20000;
  assert.equal(frontDesk(g, CHECK_IN_FROM - 1), 'early');
  assert.equal(frontDesk(g, CHECK_IN_UNTIL), 'late');
  assert.equal(frontDesk({ ...g, money: STAY_PRICE - 1 }, CHECK_IN_FROM), 'money');
  assert.equal(frontDesk(g, CHECK_IN_FROM), 'checkin');
  assert.equal(keptOut(g, 'washitsu', 16 * 60) !== null, true, 'no room without checking in');
  assert.equal(keptOut(g, 'onsen', 16 * 60) !== null, true, 'the bath is for guests');
  assert.equal(trainHomeBlocked(g), null);

  assert.equal(checkInVariant(16 * 60), 'six');
  assert.equal(checkInVariant(17 * 60 + 30), 'seven');
  const stay = checkIn(g, 16 * 60);
  assert.equal(stay.dinner, 18 * 60);
  assert.equal(stayPhase(g), 'tonight');
  assert.equal(frontDesk(g, 16 * 60), 'staying');
  assert.ok(trainHomeBlocked(g), 'no train home tonight');
  assert.equal(keptOut(g, 'washitsu', 16 * 60), null);
  assert.ok(keptOut(g, 'onsen', 16 * 60), 'see your room (and get the yukata) first');
  assert.equal(spendable(g), 20000 - STAY_PRICE, 'the night is kept back from the shop');

  assert.equal(roomScenario(g, 16 * 60), 'ryokan_room');
  assert.deepEqual(roomState(g, 16 * 60), { attendant: true, futon: false });
  g.stay!.shown = true;
  assert.ok(inYukata(g));
  assert.equal(keptOut(g, 'onsen', 16 * 60), null);
  assert.equal(roomScenario(g, 17 * 60), null, 'nobody there until dinner');
  assert.ok(canWaitForDinner(g, 17 * 60));
  assert.equal(roomScenario(g, 18 * 60), 'ryokan_dinner');
  g.stay!.dined = true;
  assert.deepEqual(roomState(g, 20 * 60), { attendant: false, futon: true });
  assert.ok(!canWaitForDinner(g, 20 * 60));

  // The night passes.
  g.day += 1;
  assert.equal(stayPhase(g), 'morning');
  assert.equal(frontDesk(g, 9 * 60), 'checkout');
  assert.ok(trainHomeBlocked(g), 'check out before the train');
  assert.equal(keptOut(g, 'onsen', 9 * 60), null, 'a morning bath before they clean it');
  assert.ok(keptOut(g, 'onsen', BATH_CLOSED[0]), 'closed for cleaning');
  assert.deepEqual(roomState(g, 9 * 60), { attendant: false, futon: true });
  checkOut(g);
  assert.equal(stayPhase(g), 'none');
  assert.equal(g.stays, 1);
  assert.ok(!inYukata(g));
  assert.equal(trainHomeBlocked(g), null);
});

test('the stay is paid at check-out, and brings home a tenugui; the shop sells a keepsake and a gift', () => {
  const out = scenarioById['ryokan_checkout']!;
  assert.equal(out.variants[0]!.price, STAY_PRICE);
  assert.ok(Object.values(out.nodes).some((n) => n.effects?.pay));
  assert.equal(goodFor('ryokan_checkout', 'stay')?.id, 'tenugui');
  assert.ok(goodFor('ryokan_checkout', 'stay')?.keepsake);
  assert.ok(goodFor('ryokan_baiten', 'yosegi')?.keepsake);
  const manju = goodFor('ryokan_baiten', 'manju');
  assert.equal(manju?.id, 'manju');
  assert.ok(!manju?.keepsake, 'buns are for giving');
  assert.ok(GOODS.some((x) => x.id === 'manju'));
  for (const id of ['ryokan_checkin', 'ryokan_room', 'ryokan_dinner', 'onsen_bath', 'ryokan_checkout', 'ryokan_baiten']) assert.ok(scenarioById[id], id);
  assert.deepEqual(scenarioById['ryokan_checkin']!.variants.map((v) => v.id).sort(), ['seven', 'six']);
});

test('old saves load without a stay, and a broken stay is dropped', () => {
  const old = { ...newGame() } as Record<string, unknown>;
  delete old['stay'];
  delete old['stays'];
  const g = migrate(JSON.parse(JSON.stringify(old)))!;
  assert.equal(stayPhase(g), 'none');
  const bad = migrate({ ...JSON.parse(JSON.stringify(old)), stay: { day: 'x' } })!;
  assert.equal(bad.stay, undefined);
  const kept = migrate({ ...JSON.parse(JSON.stringify(old)), day: 5, stay: { day: 4, dinner: 1080, shown: true, dined: true } })!;
  assert.equal(stayPhase(kept), 'morning');
});
