import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requests, scenarioById, vocab } from '../src/game/content.ts';
import { allKeepsakes, canOrder, CATALOG, homeRoom } from '../src/game/room.ts';
import { bedSpot, roomDoor, ROOMS, roomSolid, thingNear, thingSpot, type RoomDef } from '../src/town/rooms.ts';
import { FLOOR_DECOR, itemIcon, KEEPSAKE_ART, RUG_DECOR, WALL_DECOR } from '../src/town/roomart.ts';

function reachable(room: RoomDef): Set<string> {
  const start = roomDoor(room);
  const seen = new Set([`${start.tx},${start.ty}`]);
  const q = [start];
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

test('every catalog item can be ordered in Japanese and has a picture', () => {
  const def = scenarioById['post_catalog']!;
  for (const it of CATALOG) {
    assert.ok(vocab.has(it.word), `${it.word} in vocab`);
    const v = def.variants.find((x) => x.id === it.id);
    assert.ok(v, `${it.id} has an order variant`);
    assert.equal(v!.price, it.price);
    const art = it.kind === 'floor' ? FLOOR_DECOR : it.kind === 'wall' ? WALL_DECOR : RUG_DECOR;
    assert.ok(art[it.id], `${it.id} is drawn`);
    assert.ok([...itemIcon(it.id, it.kind).px].some((p) => p >= 0), `${it.id} icon`);
    if (it.kind === 'floor') assert.ok(it.spot, `${it.id} has a spot`);
  }
});

test('with everything bought, every free tile of your room can still be walked to', () => {
  const full = homeRoom(CATALOG.map((c) => c.id), []);
  const floor = CATALOG.filter((c) => c.kind === 'floor');
  for (const it of floor) assert.equal(full.rows[it.spot!.ty]![it.spot!.tx], 'o', `${it.id} takes its tile`);
  const reach = reachable(full);
  full.rows.forEach((row, ty) => [...row].forEach((_c, tx) => {
    if (!roomSolid(full, tx, ty)) assert.ok(reach.has(`${tx},${ty}`), `${tx},${ty} is cut off`);
  }));
  const bed = bedSpot(full)!;
  assert.ok(reach.has(`${bed.tx},${bed.ty}`));
  const shelf = thingSpot(full, 'shelf')!;
  assert.ok(reach.has(`${shelf.tx},${shelf.ty}`));
  assert.equal(thingNear(full, shelf), 'shelf');
});

test('the catalog desk at the post office can be reached and used', () => {
  const post = ROOMS.post;
  const spot = thingSpot(post, 'catalog')!;
  assert.ok(spot);
  assert.ok(reachable(post).has(`${spot.tx},${spot.ty}`));
  assert.equal(thingNear(post, spot), 'catalog');
});

test('what you can order depends on what you own, your level and your yen', () => {
  const tv = CATALOG.find((c) => c.id === 'tv')!;
  assert.equal(canOrder(tv, [], 1, 99999), 'level');
  assert.equal(canOrder(tv, [], tv.level, tv.price - 1), 'money');
  assert.equal(canOrder(tv, [], tv.level, tv.price), 'ok');
  assert.equal(canOrder(tv, ['tv'], 9, 99999), 'owned');
  assert.ok(CATALOG.some((c) => c.level === 1 && c.price <= 5000), 'something to buy on day one');
});

test('every keepsake has a word and a picture on the shelf', () => {
  for (const k of allKeepsakes(requests)) {
    assert.ok(vocab.has(k.word), k.word);
    assert.ok(KEEPSAKE_ART[k.id], `${k.id} has art`);
  }
});
