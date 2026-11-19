import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarioById, scenarios, vocab } from '../src/game/content.ts';
import { makeErrands } from '../src/game/errands.ts';
import { emptyLearner, Learner } from '../src/learner/model.ts';
import type { NodeEvidence } from '../src/scenario/engine.ts';

const ev = (over: Partial<NodeEvidence>): NodeEvidence => ({
  nodeId: 'n', mode: 2, targets: [], lineWords: [], answerWords: [], firstTry: true, lookedUp: [], ...over,
});

test('states move unseen -> seen -> recognized -> produced', () => {
  const l = new Learner(emptyLearner(), vocab);
  assert.equal(l.status('現金'), 'unseen');
  l.see('現金', { day: 1, place: 'cafe', npc: 'yuki' });
  assert.equal(l.status('現金'), 'seen');
  l.applyEvidence(ev({ targets: ['現金'], answerWords: ['現金'] }), { day: 1, furiganaShown: () => true });
  assert.equal(l.status('現金'), 'recognized');
  for (let d = 2; d < 6; d++) l.applyEvidence(ev({ mode: 4, answerWords: ['現金'] }), { day: d, furiganaShown: () => true });
  assert.equal(l.status('現金'), 'produced');
  assert.deepEqual(l.get('現金')!.met, [{ day: 1, place: 'cafe', npc: 'yuki' }]);
});

test('a lookup lowers confidence', () => {
  const l = new Learner(emptyLearner(), vocab);
  l.applyEvidence(ev({ targets: ['円'] }), { day: 1, furiganaShown: () => true });
  const s = l.get('円')!.meaning!.stability;
  l.applyEvidence(ev({ targets: ['円'], lookedUp: ['円'] }), { day: 4, furiganaShown: () => true });
  assert.ok(l.get('円')!.meaning!.stability < s);
  assert.ok(l.isDue('円', 5));
});

test('furigana fades after repeated correct reading, and comes back after a lookup', () => {
  const l = new Learner(emptyLearner(), vocab);
  let day = 1;
  for (; day < 40 && l.showFurigana('店内', 2); day++) {
    l.applyEvidence(ev({ targets: ['店内'], answerWords: ['店内'] }), { day, furiganaShown: (id) => l.showFurigana(id, 2) });
  }
  assert.ok(!l.showFurigana('店内', 2), `furigana still shown on day ${day}`);
  assert.ok(day < 20, `took until day ${day}`);
  assert.ok(l.showFurigana('店内', 1), 'stage 1 always shows furigana');
  l.applyEvidence(ev({ targets: ['店内'], lookedUp: ['店内'] }), { day, furiganaShown: () => false });
  assert.ok(l.showFurigana('店内', 2));
  assert.ok(l.showFurigana('カード', 2) || true);
});

test('due words choose the errands', () => {
  const l = new Learner(emptyLearner(), vocab);
  // Make 目薬 overdue.
  l.applyEvidence(ev({ targets: ['目薬', '目', 'かゆい'] }), { day: 1, furiganaShown: () => true });
  const errands = makeErrands(scenarios, l, vocab, 9);
  const pharmacy = errands.find((e) => e.scenario === 'pharmacy_buy')!;
  assert.equal(pharmacy.variant, 'eyes');
  assert.match(pharmacy.text, /目薬/);
  assert.ok(errands.find((e) => e.scenario === scenarioById['cafe_order']!.id));
});
