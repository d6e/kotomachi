import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Fsrs, Rating } from '../src/srs/fsrs.ts';

const f = new Fsrs();

test('first review uses the initial stability weights', () => {
  const c = f.review(f.newCard(0), Rating.Good, 0);
  assert.equal(c.reps, 1);
  assert.ok(Math.abs(c.stability - 3.1262) < 1e-9);
  assert.equal(c.due, 3);
});

test('successful reviews grow the interval; a lapse shrinks it', () => {
  let c = f.review(f.newCard(0), Rating.Good, 0);
  const intervals: number[] = [];
  let day = 0;
  for (let i = 0; i < 4; i++) {
    day = c.due;
    const before = c.stability;
    c = f.review(c, Rating.Good, day);
    assert.ok(c.stability > before, 'stability grows on recall');
    intervals.push(c.due - day);
  }
  for (let i = 1; i < intervals.length; i++) assert.ok(intervals[i]! >= intervals[i - 1]!);
  const lapsed = f.review(c, Rating.Again, c.due);
  assert.ok(lapsed.stability < c.stability);
  assert.equal(lapsed.lapses, 1);
  assert.equal(lapsed.due, c.due + 1);
});

test('retrievability is 0.9 after one interval at default retention', () => {
  const c = f.review(f.newCard(0), Rating.Good, 0);
  const r = f.retrievability(c, c.stability);
  assert.ok(Math.abs(r - 0.9) < 1e-9);
});

test('difficulty stays within 1..10', () => {
  let c = f.review(f.newCard(0), Rating.Again, 0);
  for (let i = 1; i < 20; i++) c = f.review(c, Rating.Again, i);
  assert.ok(c.difficulty <= 10 && c.difficulty >= 1);
  let e = f.review(f.newCard(0), Rating.Easy, 0);
  for (let i = 1; i < 20; i++) e = f.review(e, Rating.Easy, e.due);
  assert.ok(e.difficulty >= 1);
});
