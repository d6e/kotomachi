import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, buildGrid, COLS, doorSpot, findPath, isSolid, NEIGHBOUR_ROUTE, ROWS, START } from '../src/town/map.ts';
import { NEIGHBOUR, PLAYER, walkFrames, type Dir } from '../src/town/sprites.ts';

test('every door can be reached from the start, and the start is walkable', () => {
  const g = buildGrid();
  assert.equal(g.length, ROWS);
  assert.ok(g.every((r) => r.length === COLS));
  const blocked = (x: number, y: number) => isSolid(g, x, y);
  assert.ok(!blocked(START.tx, START.ty));
  for (const b of BUILDINGS) {
    const spot = doorSpot(b);
    if (!spot) continue;
    assert.ok(!blocked(spot.tx, spot.ty), `${b.id} door spot is blocked`);
    assert.ok(isSolid(g, spot.tx, spot.ty - 1), `${b.id} door is in the wall`);
    assert.ok(findPath(blocked, START, spot), `no way to the ${b.id}`);
  }
});

test('the neighbour route is clear and paths step one tile at a time', () => {
  const g = buildGrid();
  for (let x = NEIGHBOUR_ROUTE.from; x <= NEIGHBOUR_ROUTE.to; x++) assert.ok(!isSolid(g, x, NEIGHBOUR_ROUTE.ty), `route blocked at ${x}`);
  const path = findPath((x, y) => isSolid(g, x, y), START, { tx: 27, ty: 11 })!;
  assert.ok(path.length > 0);
  let at = START;
  for (const p of path) {
    assert.equal(Math.abs(p.tx - at.tx) + Math.abs(p.ty - at.ty), 1);
    assert.ok(!isSolid(g, p.tx, p.ty));
    at = p;
  }
  assert.equal(findPath((x, y) => isSolid(g, x, y), START, { tx: 14, ty: 9 }), null, 'the pond is not walkable');
});

test('sprite frames are all 16x16', () => {
  for (const art of [PLAYER, NEIGHBOUR]) {
    for (const dir of ['down', 'up', 'left', 'right'] as Dir[]) {
      for (const f of walkFrames(art, dir)) {
        assert.equal(f.rows.length, 16);
        for (const r of f.rows) assert.equal(r.length, 16, `${dir}: ${r}`);
      }
    }
  }
});
