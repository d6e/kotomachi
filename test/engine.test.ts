import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarioById, vocab } from '../src/game/content.ts';
import { effectiveMode, finishRun, newProgress, ScenarioRun, type RunOptions } from '../src/scenario/engine.ts';
import { plainText } from '../src/lang/markup.ts';
import type { Mode } from '../src/scenario/types.ts';

const cafe = scenarioById['cafe_order']!;
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function run(stage: Mode, extra: Partial<RunOptions> = {}) {
  return new ScenarioRun({
    def: cafe, variant: cafe.variants[1]!, stage, friendship: 0, period: 'day', vocab, rng: seeded(7), ...extra,
  });
}

function correctIndex(r: ScenarioRun): number {
  const node = r.node;
  return node.choices!.findIndex((c) => c.result === 'success' && c.register !== 'plain');
}

test('stage 1: a clean run through the cafe', () => {
  const r = run(1);
  let steps = 0;
  while (!r.ended && steps++ < 20) {
    const v = r.current();
    assert.equal(v.mode, 1);
    assert.ok(v.gloss, 'stage 1 shows the English gloss');
    r.answerChoice(correctIndex(r));
  }
  assert.ok(r.ended);
  assert.ok(r.clean);
  assert.equal(r.moneySpent, 450);
  assert.equal(r.friendshipDelta, 2);
  assert.equal(r.evidence.length, 7);
});

test('a wrong answer: NPC recasts, the node repeats without that option, notebook gets a note', () => {
  const r = run(2);
  const v = r.current();
  assert.equal(v.gloss, undefined, 'stage 2 has no English');
  const wrong = r.node.choices!.findIndex((c) => c.text.startsWith('ごちそうさま'));
  const out = r.answerChoice(wrong);
  assert.equal(out.correct, false);
  assert.match(plainText(out.reaction!), /まだ/);
  assert.equal(r.nodeId, 'greet');
  assert.ok(!r.current().choices!.some((c) => c.index === wrong));
  assert.equal(r.clean, false);
  assert.match(r.corrections[0]!.note, /after eating/);
  assert.equal(r.corrections[0]!.better, 'ラテをお願いします。');
});

test('stage 3 tiles and stage 4 fill-in-the-blank', () => {
  const r = run(3);
  const v = r.current();
  assert.equal(v.mode, 3);
  const want = ['ラテ', 'を', 'お願いします'];
  const ids = want.map((w) => v.tiles!.find((t) => plainText(t.tokens) === w)!.id);
  assert.ok(r.answerTiles(ids).correct);
  assert.equal(r.nodeId, 'size');

  const r4 = run(4);
  assert.equal(r4.current().mode, 4);
  assert.equal(r4.answerBlank('onegaishimasu').correct, true);
  assert.equal(r4.answerBlank('de').correct, true, 'size: で');
  assert.equal(r4.answerBlank('AISU').correct, true, 'temp: アイス');
});

test('quiet fallback: two failures on a line drop it one rung', () => {
  const r = run(4);
  assert.equal(r.current().mode, 4);
  r.answerBlank('dame');
  assert.equal(r.current().mode, 4);
  r.answerBlank('dame');
  const v = r.current();
  assert.equal(v.mode, 3);
  assert.ok(v.fallback);
  r.answerTiles([]);
  r.answerTiles([]);
  assert.equal(r.current().mode, 2);
});

test('ladder downgrades when a node lacks data for the stage', () => {
  const small = cafe.nodes['smalltalk']!;
  assert.equal(effectiveMode(4, small, 0, false), 2);
  assert.equal(effectiveMode(5, cafe.nodes['greet']!, 0, false), 4, 'no judge -> fill in');
  assert.equal(effectiveMode(5, cafe.nodes['greet']!, 0, true), 5);
});

test('promotion after three clean runs, capped at the scenario max', () => {
  let p = newProgress();
  for (let i = 0; i < 2; i++) p = finishRun(p, true, 4).progress;
  assert.equal(p.stage, 1);
  const res = finishRun(p, true, 4);
  assert.ok(res.promoted);
  assert.equal(res.progress.stage, 2);
  assert.equal(finishRun({ stage: 4, cleanRuns: 2, runs: 9 }, true, 4).progress.stage, 4);
  assert.equal(finishRun({ stage: 2, cleanRuns: 2, runs: 9 }, false, 4).progress.cleanRuns, 0);
});

test('friendship as politeness: going casual too early costs friendship', () => {
  const r = run(2);
  while (r.nodeId !== 'smalltalk') r.answerChoice(correctIndex(r));
  const plain = r.node.choices!.findIndex((c) => c.register === 'plain');
  const out = r.answerChoice(plain);
  assert.equal(out.correct, false);
  assert.equal(r.friendshipDelta, -1);

  const friend = run(2, { friendship: 7 });
  assert.match(plainText(friend.current().line), /いらっしゃい！/);
  while (friend.nodeId !== 'smalltalk') friend.answerChoice(correctIndex(friend));
  const before = friend.friendshipDelta;
  assert.ok(friend.answerChoice(friend.node.choices!.findIndex((c) => c.register === 'plain')).correct);
  assert.equal(friend.friendshipDelta, before + 2, 'casual back to a friend is warmer');
});

test('greetings depend on the time of day', () => {
  const def = scenarioById['neighbor_greet']!;
  const mk = (period: 'morning' | 'evening') =>
    new ScenarioRun({ def, variant: def.variants[0]!, stage: 1, friendship: 0, period, vocab, extraSlots: { greet: 'こんばんは' } });
  const ohayo = def.nodes['greet']!.choices!.findIndex((c) => c.text.startsWith('おはよう'));
  assert.ok(mk('morning').answerChoice(ohayo).correct);
  const evening = mk('evening').answerChoice(ohayo);
  assert.equal(evening.correct, false);
  assert.match(plainText(evening.reaction!), /こんばんは/);
});

test('variant-only nodes are skipped', () => {
  const k = scenarioById['konbini_buy']!;
  const bento = new ScenarioRun({ def: k, variant: k.variants.find((v) => v.id === 'bento')!, stage: 1, friendship: 0, period: 'day', vocab });
  bento.answerChoice(0);
  assert.equal(bento.nodeId, 'heat');
  const water = new ScenarioRun({ def: k, variant: k.variants.find((v) => v.id === 'water')!, stage: 1, friendship: 0, period: 'day', vocab });
  water.answerChoice(0);
  assert.equal(water.nodeId, 'bag');
});
