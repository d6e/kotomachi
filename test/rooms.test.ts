import { test } from 'node:test';
import assert from 'node:assert/strict';
import { npcs, scenarioById, scenarios, vocab } from '../src/game/content.ts';
import { BUILDINGS, findPath } from '../src/town/map.ts';
import { bedSpot, bedTiles, roomDoor, roomEntrance, ROOM_COLS, ROOM_PLACES, ROOM_ROWS, ROOMS, roomSolid, staffSpot, talkSpot } from '../src/town/rooms.ts';
import { STAFF } from '../src/town/sprites.ts';

test('every place on the street has an inside, the size of the screen', () => {
  for (const b of BUILDINGS) assert.ok(b.door && ROOMS[b.door.place], `${b.id} has a room`);
  assert.equal(ROOM_PLACES.length, 7);
  for (const place of ROOM_PLACES) {
    const room = ROOMS[place];
    assert.equal(room.rows.length, ROOM_ROWS, place);
    for (const [i, row] of room.rows.entries()) assert.equal(row.length, ROOM_COLS, `${place} row ${i}`);
    assert.equal(room.rows.join('').split('D').length - 1, 1, `${place} has one door`);
    const door = roomDoor(room);
    assert.ok(!roomSolid(room, door.tx, door.ty - 1), `${place}: floor just inside the door`);
  }
});

test('you can walk from the door to the staff and back out, and the staff stand behind a counter', () => {
  for (const place of ROOM_PLACES) {
    const room = ROOMS[place];
    const blocked = (x: number, y: number) => roomSolid(room, x, y);
    const start = roomEntrance(room);
    assert.ok(findPath(blocked, start, roomDoor(room)), `${place}: no way out`);
    if (place === 'home') {
      assert.ok(bedTiles(room).length === 4, 'a two by two bed');
      assert.ok(findPath(blocked, start, bedSpot(room)!), 'you can reach the bed');
      const morning = room.start!;
      assert.ok(!blocked(morning.tx, morning.ty) && findPath(blocked, morning, roomDoor(room)), 'the day starts somewhere you can walk out from');
      continue;
    }
    const staff = staffSpot(room)!;
    assert.ok(staff, `${place} has staff`);
    assert.equal(room.rows[staff.ty + 1]![staff.tx], '=', `${place}: a counter in front of the staff`);
    const talk = talkSpot(room)!;
    assert.ok(!blocked(talk.tx, talk.ty), `${place}: you can stand at the counter`);
    assert.ok(findPath(blocked, start, talk), `${place}: no way to the counter`);
    // Nobody can get round behind the counter to the staff.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]] as const) assert.ok(blocked(staff.tx + dx, staff.ty + dy) || !findPath(blocked, start, { tx: staff.tx + dx, ty: staff.ty + dy }), `${place}: behind the counter`);
  }
});

test('the person behind each counter is the one the errand there is with, and has a sprite', () => {
  const SCENARIO_FOR: Record<string, string> = {
    cafe: 'cafe_order', konbini: 'konbini_buy', pharmacy: 'pharmacy_buy', restaurant: 'restaurant_eat', station: 'station_ticket', post: 'post_send',
  };
  for (const [place, id] of Object.entries(SCENARIO_FOR)) {
    const room = ROOMS[place as keyof typeof ROOMS];
    const def = scenarioById[id]!;
    assert.equal(room.staff, def.npc, place);
    assert.ok(npcs[def.npc], `${place}: ${def.npc}`);
    assert.ok(STAFF[def.npc], `${place}: a sprite for ${def.npc}`);
    for (const row of STAFF[def.npc]!.rows) assert.equal(row.length, 16);
  }
  // Tanaka-san stays outdoors.
  assert.ok(!Object.values(ROOMS).some((r) => r.staff === 'tanaka'));
  assert.ok(scenarios.some((s) => s.npc === 'tanaka'));
});

test('every word on a board inside is in the dictionary', () => {
  for (const room of Object.values(ROOMS)) if (room.sign) assert.ok(vocab.has(room.sign), `${room.place}: ${room.sign}`);
});
