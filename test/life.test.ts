import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatter, scenarioById } from '../src/game/content.ts';
import { boardNotes, daysToFestival, fits, isFestival, pickChatter, timeOfDay, weatherFor } from '../src/game/weather.ts';
import { drawFestival } from '../src/town/festart.ts';
import { StreetLife, LANES } from '../src/town/life.ts';
import { BOARD, BOARD_SPOT, buildGrid, COLS, festivalGrid, findPath, isSolid, RAIL_ROW, STALLS, stallSpot, START, STREET_ROW, TILE } from '../src/town/map.ts';

const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

test('a festival every 7th day, always fine weather; day 1 is sunny; about a quarter of days rain', () => {
  assert.deepEqual([1, 6, 7, 13, 14, 21].map(isFestival), [false, false, true, false, true, true]);
  assert.deepEqual([1, 5, 6, 7, 8].map(daysToFestival), [6, 2, 1, 0, 6]);
  assert.equal(weatherFor(1), 'hare');
  for (let d = 7; d < 200; d += 7) assert.equal(weatherFor(d), 'hare');
  const rainy = Array.from({ length: 300 }, (_, i) => weatherFor(i + 2)).filter((w) => w === 'ame').length;
  assert.ok(rainy > 40 && rainy < 120, `${rainy} rainy days in 300`);
  assert.equal(weatherFor(23), weatherFor(23), 'the same day has the same weather');
  assert.deepEqual([8 * 60, 12 * 60, 18 * 60, 20 * 60].map(timeOfDay), ['morning', 'day', 'evening', 'night']);
});

test('passers-by say something that fits the day, prefer due words, and vary', () => {
  const base = { said: new Set<string>(), lemmas: (l: { text: string }) => l.text.split(' ').map((t) => t.split('=').pop()!), random: () => 0.5 };
  // A festival line only on festival day, a rain line only when it rains.
  for (const l of chatter.street) {
    if (l.festival) assert.ok(!fits(l, 6, 600) && fits(l, 7, l.time?.includes('night') ? 20 * 60 : l.time?.includes('evening') ? 18 * 60 : 12 * 60) || !!l.weather);
  }
  const rainDay = Array.from({ length: 60 }, (_, i) => i + 2).find((d) => weatherFor(d) === 'ame')!;
  for (let i = 0; i < 20; i++) {
    const l = pickChatter(chatter.street, { ...base, day: rainDay, minutes: 12 * 60, isDue: () => false, random: seeded(i) })!;
    assert.ok(fits(l, rainDay, 12 * 60));
    assert.ok(!l.weather || l.weather.includes('ame'), l.text);
  }
  // A line with a due word wins.
  const due = pickChatter(chatter.street, { ...base, day: 2, minutes: 12 * 60, isDue: (w) => w === '切手' })!;
  assert.match(due.text, /切手/);
  // Once heard, something else comes next.
  const said = new Set<string>([due.text]);
  assert.notEqual(pickChatter(chatter.street, { ...base, said, day: 2, minutes: 12 * 60, isDue: (w) => w === '切手' })!.text, due.text);
});

test('the notice board counts down to the festival, and its goldfish price is the stall’s', () => {
  assert.match(boardNotes(4).map((n) => n.jp).join(' '), /あと/);
  const fest = boardNotes(7).map((n) => n.jp).join(' ');
  assert.match(fest, /祭り/);
  const price = Number(/(\d+) 円/.exec(fest)![1]);
  assert.equal(scenarioById['festival_kingyo']!.variants[0]!.price, price);
});

test('the board, the stalls and the railway fit the street', () => {
  const g = buildGrid();
  assert.ok(isSolid(g, BOARD.tx, BOARD.ty) && !isSolid(g, BOARD_SPOT.tx, BOARD_SPOT.ty));
  for (let x = 0; x < COLS; x++) assert.ok(isSolid(g, x, RAIL_ROW), 'the railway is fenced off');
  const f = festivalGrid(g);
  const blocked = (x: number, y: number) => isSolid(f, x, y);
  for (const s of STALLS) {
    assert.ok(!isSolid(g, s.tx, s.ty), `${s.id} stands on open grass on other days`);
    assert.ok(isSolid(f, s.tx, s.ty) && isSolid(f, s.tx + 1, s.ty - 1));
    assert.ok(findPath(blocked, START, stallSpot(s)), `can walk up to the ${s.id} stall`);
  }
  // The stalls don't cut off the park's paths.
  assert.ok(findPath(blocked, START, { tx: 39, ty: 11 }));
  const art = drawFestival((t) => t.length * 10);
  assert.deepEqual(art.signs.map((s) => s.word), STALLS.map((s) => s.sign));
  assert.ok(art.lanterns.length > 20);
});

test('passers-by keep to the street, never walk into you, and leave at the far end', () => {
  const g = buildGrid();
  const life = new StreetLife(g, seeded(3));
  const player = { tx: 12, ty: STREET_ROW + 1 };
  let seen = 0;
  for (let i = 0; i < 4000; i++) {
    life.update(0.05, { player, neighbour: null, minutes: 12 * 60, rain: false, festival: false, still: false });
    seen = Math.max(seen, life.passers.length);
    for (const a of life.passers) {
      assert.ok(LANES.includes(a.ty), 'on the street');
      if (a.tx >= 0 && a.tx < COLS) assert.ok(!isSolid(g, a.tx, a.ty), 'not in a lamp');
      if (a.dest) assert.ok(!(a.dest.tx === player.tx && a.dest.ty === player.ty) || a.stuck === 0);
    }
  }
  assert.ok(seen >= 2, 'people come by');
  assert.equal(StreetLife.crowd(23 * 60, false, false), 0, 'nobody about late at night');
});

test('birds fly off when you come close; with reduced motion nothing flies and no train runs', () => {
  const g = buildGrid();
  const life = new StreetLife(g, seeded(5));
  const far = { tx: 0, ty: STREET_ROW };
  for (let i = 0; i < 100; i++) life.update(0.1, { player: far, neighbour: null, minutes: 10 * 60, rain: false, festival: false, still: false });
  const bird = life.birds.find((b) => b.state === 'sit')!;
  assert.ok(bird);
  const near = { tx: Math.floor(bird.x / TILE), ty: Math.floor(bird.y / TILE) };
  life.update(0.05, { player: near, neighbour: null, minutes: 10 * 60, rain: false, festival: false, still: false });
  assert.equal(bird.state, 'fly');
  // In the rain the birds stay away.
  for (let i = 0; i < 300; i++) life.update(0.1, { player: far, neighbour: null, minutes: 10 * 60, rain: true, festival: false, still: false });
  assert.ok(life.birds.every((b) => b.state !== 'sit'));
  const still = new StreetLife(g, seeded(9));
  for (let i = 0; i < 1500; i++) {
    still.update(0.1, { player: far, neighbour: null, minutes: 10 * 60, rain: false, festival: false, still: true });
    assert.equal(still.train, null);
    assert.ok(still.birds.every((b) => b.state !== 'fly'));
  }
});
