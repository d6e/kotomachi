import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consequences, scenarioById, scenarios, vocab, requests } from '../src/game/content.ts';
import { ScenarioRun } from '../src/scenario/engine.ts';
import { errandPay, RETRY_PAY } from '../src/game/rewards.ts';
import { planRequests, type Errand } from '../src/game/errands.ts';
import { drawScene, SCENE_H, SCENE_W, type SceneArt } from '../src/town/scenes.ts';
import { Learner } from '../src/learner/model.ts';
import { newGame } from '../src/game/state.ts';

/** Play right answers until the node with the given id, then pick the choice with a consequence. */
function playTo(scenario: string, variant: string, node: string, stage: 1 | 2 = 2): ScenarioRun {
  const def = scenarioById[scenario]!;
  const r = new ScenarioRun({ def, variant: def.variants.find((v) => v.id === variant)!, stage, friendship: 0, period: 'day', vocab, rng: () => 0.3 });
  for (let i = 0; i < 30 && r.nodeId !== node; i++) {
    const v = r.current();
    if (v.mode === 0) r.continue();
    else r.answerChoice(r.rightChoices()[0]!);
  }
  assert.equal(r.nodeId, node);
  return r;
}

for (const [scenario, variant, node, id] of [
  ['station_ticket', 'platform', 'platnum', 'wrong_platform'],
  ['station_ticket', 'time', 'timeans', 'missed_train'],
  ['pharmacy_buy', 'headache', 'dosage', 'wrong_dose'],
  ['restaurant_eat', 'ramen', 'spice', 'gekikara'],
] as const) {
  test(`${id}: the wrong pick ends the visit with its scene, and the notebook gets the right answer`, () => {
    const r = playTo(scenario, variant, node);
    const bad = r.node.choices!.findIndex((c) => c.consequence === id);
    assert.ok(bad >= 0);
    const out = r.answerChoice(bad);
    assert.equal(out.correct, false);
    assert.equal(out.ended, true);
    assert.equal(r.ended, true);
    assert.equal(r.consequence, id);
    assert.equal(r.clean, false);
    const fix = r.corrections.at(-1)!;
    assert.ok(fix.better.length > 0, 'shows what would have worked');
    assert.notEqual(fix.better, fix.said);
  });
}

test('the right pick at a consequence point carries on as normal', () => {
  const r = playTo('restaurant_eat', 'ramen', 'spice');
  r.answerChoice(r.rightChoices()[0]!);
  assert.equal(r.consequence, null);
  assert.equal(r.ended, false);
});

test('every consequence is used by some choice, and has lines and art', () => {
  const used = new Set(scenarios.flatMap((s) => Object.values(s.nodes).flatMap((n) => (n.choices ?? []).flatMap((c) => (c.consequence ? [c.consequence] : [])))));
  for (const [id, c] of Object.entries(consequences)) {
    assert.ok(used.has(id), `${id} is never played`);
    assert.ok(c.lines.length >= 2);
  }
});

test('each scene picture fills its frame', () => {
  for (const art of ['train', 'clock', 'phone', 'ramen'] as SceneArt[]) {
    const b = drawScene(art);
    assert.equal(b.w, SCENE_W);
    assert.equal(b.h, SCENE_H);
    const empty = [...b.px].filter((p) => p < 0).length;
    assert.equal(empty, 0, `${art} has gaps`);
  }
});

test('a second go pays a little less, never nothing', () => {
  const full = errandPay(2, 0, 0).reward;
  const again = errandPay(2, 0, 0, true).reward;
  assert.ok(again < full && again > 0);
  assert.equal(again, Math.round((full * RETRY_PAY) / 10) * 10);
});

test('a request that went wrong comes back first the next day', () => {
  const learner = new Learner(newGame().learner, vocab);
  const back: Errand = { scenario: 'station_ticket', variant: 'platform', text: 'x', done: false, from: 'tanaka', retry: true };
  const day = planRequests({ defs: scenarios, requests, arcs: {}, learner, vocab, day: 4, carried: [back] });
  assert.equal(day[0]!.scenario, 'station_ticket');
  assert.equal(day[0]!.retry, true);
  assert.equal(day.filter((e) => e.scenario === 'station_ticket').length, 1);
});
