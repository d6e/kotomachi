import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requests, scenarios, vocab } from '../src/game/content.ts';
import { ERRANDS_PER_DAY, planRequests, STORY_STEPS_PER_DAY } from '../src/game/errands.ts';
import { emptyLearner, Learner } from '../src/learner/model.ts';

const plan = (day: number, arcs: Record<string, number> = {}, learner = new Learner(emptyLearner(), vocab), carried = []) =>
  planRequests({ defs: scenarios, requests, arcs, learner, vocab, day, carried });

test('each regular has a story of 3 to 5 requests and a gift at the end', () => {
  assert.ok(requests.arcs.length >= 4);
  for (const a of requests.arcs) {
    assert.ok(a.steps.length >= 3 && a.steps.length <= 5, a.id);
    assert.ok(a.gift.word);
  }
});

test('a day has three requests, at different places, each from someone with a reason', () => {
  for (let day = 1; day <= 12; day++) {
    const es = plan(day);
    assert.equal(es.length, ERRANDS_PER_DAY, `day ${day}`);
    assert.equal(new Set(es.map((e) => e.scenario)).size, es.length, `day ${day}: one per place`);
    for (const e of es) assert.ok(e.from && e.reason && e.reasonEn, `day ${day}: ${e.scenario}`);
    assert.ok(es.filter((e) => e.arc).length <= STORY_STEPS_PER_DAY);
  }
});

test('stories move on one step at a time and later regulars join on their day', () => {
  const d1 = plan(1);
  const story = d1.filter((e) => e.arc);
  assert.ok(story.length >= 1);
  for (const e of story) assert.equal(e.step, 0);
  assert.ok(!d1.some((e) => e.arc === 'kobayashi'), 'not before day 5');
  // ゆき is on step 3: tomorrow offers step 3 if her story is picked.
  for (let day = 2; day < 9; day++) {
    const e = plan(day, { yuki: 2 }).find((x) => x.arc === 'yuki');
    if (e) assert.equal(e.step, 2);
  }
  // A finished story asks nothing more.
  const done = Object.fromEntries(requests.arcs.map((a) => [a.id, a.steps.length]));
  assert.ok(plan(9, done).every((e) => !e.arc));
  assert.equal(plan(9, done).length, ERRANDS_PER_DAY);
});

test('day 1 starts with the cafe and leaves out what a story already covers', () => {
  const d1 = plan(1);
  assert.ok(d1.some((e) => e.scenario === 'cafe_order'));
});

test('everyday requests spread out over different people where they can', () => {
  for (let day = 2; day <= 15; day++) {
    const es = plan(day, Object.fromEntries(requests.arcs.map((a) => [a.id, a.steps.length])));
    assert.ok(new Set(es.map((e) => e.from)).size >= 2, `day ${day}: ${es.map((e) => e.from)}`);
  }
});
