import { test } from 'node:test';
import assert from 'node:assert/strict';
import { npcs, scenarioById, vocab } from '../src/game/content.ts';
import {
  changeFor, CLEAN_BONUS, COLLEAGUE, CUSTOMER_FACES, CUSTOMERS, CUSTOMERS_PER_SHIFT, cleanJob, customerVariant, finishShift, hire, INTERVIEW, isHired,
  KINDS, lastShiftStart, MENU, planShift, shiftBlocked, shiftPay, SHIFT_HOURS, wageFor,
} from '../src/game/job.ts';
import { HOURS, migrate, newGame } from '../src/game/state.ts';
import { boardNotes } from '../src/game/weather.ts';
import { fillSlots, parseLine, plainText } from '../src/lang/markup.ts';
import { ScenarioRun } from '../src/scenario/engine.ts';
import type { Mode, ScenarioDef, VariantDef } from '../src/scenario/types.ts';
import { STAFF } from '../src/town/sprites.ts';

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const customers = scenarioById[CUSTOMERS]!;
const stranger = { friend: false, name: 'a customer' };

/** Answer every line the best way (polite, and not just okay) and say how it went. */
function playPerfect(def: ScenarioDef, variant: VariantDef, stage: Mode, friendship = 0): ScenarioRun {
  const r = new ScenarioRun({ def, variant, stage, friendship, period: 'day', vocab, rng: seeded(5), listener: stranger });
  const where = `${def.id}/${variant.id}/stage ${stage}`;
  let steps = 0;
  while (!r.ended && steps++ < 40) {
    const v = r.current();
    const node = r.node;
    if (v.mode === 0) r.continue();
    else if (v.mode === 4) assert.ok(r.answerBlank(fillSlots(node.blank!.answers[0]!, r.slots)).correct, `${where} ${r.nodeId}: blank`);
    else if (v.mode === 3) {
      const want = node.tiles!.answers[0]!.map((t) => plainText(parseLine(t, vocab, r.slots)));
      const free = [...v.tiles!];
      const ids = want.map((w) => {
        const i = free.findIndex((t) => plainText(t.tokens) === w);
        assert.ok(i >= 0, `${where} ${r.nodeId}: no tile for ${w}`);
        return free.splice(i, 1)[0]!.id;
      });
      assert.ok(r.answerTiles(ids).correct, `${where} ${r.nodeId}: tiles`);
    } else {
      const i = node.choices!.findIndex((c) => c.result === 'success' && c.grade !== 'okay' && c.register !== 'plain');
      assert.ok(v.choices!.some((c) => c.index === i), `${where} ${r.nodeId}: best answer not shown`);
      const out = r.answerChoice(i);
      assert.equal(out.grade, 'perfect', `${where} ${r.nodeId}: ${plainText(out.said)}`);
    }
    for (const t of r.current().line) assert.ok(!t.surface.includes('$'), `${where}: unfilled slot ${t.surface}`);
  }
  assert.ok(r.ended, `${where}: did not end`);
  return r;
}

test('pay: two hours at a wage that rises with your stage, and a bonus for a shift with no misses', () => {
  assert.deepEqual([1, 2, 3, 4].map(wageFor), [1000, 1100, 1200, 1300]);
  assert.equal(wageFor(0), 1000);
  assert.equal(wageFor(9), 1300);
  assert.deepEqual(shiftPay(1, 0), { wage: 1000, hours: SHIFT_HOURS, base: 2000, bonus: CLEAN_BONUS, total: 2300 });
  assert.equal(shiftPay(3, 2).total, 2400);
  assert.equal(shiftPay(3, 2).bonus, 0);
});

test('change: paid minus the price, with a wrong amount beside it that is off by a coin', () => {
  for (const m of MENU) {
    for (const paid of [500, 1000].filter((p) => p >= m.price)) {
      for (let seed = 1; seed < 30; seed++) {
        const { change, wrong } = changeFor(m.price, paid, seeded(seed));
        assert.equal(change, paid - m.price);
        assert.notEqual(wrong, change);
        assert.ok(wrong > 0);
        assert.ok(Math.abs(wrong - change) <= 100);
      }
    }
  }
});

test('a shift: three customers, the first ordering a drink, all different, with different faces', () => {
  for (let seed = 1; seed < 200; seed++) {
    const plan = planShift(seeded(seed));
    assert.equal(plan.length, CUSTOMERS_PER_SHIFT);
    assert.ok(plan[0]!.kind === 'here' || plan[0]!.kind === 'togo');
    assert.equal(new Set(plan.map((c) => c.kind)).size, plan.length);
    assert.equal(new Set(plan.map((c) => c.face)).size, plan.length);
    for (const c of plan) assert.ok(CUSTOMER_FACES.includes(c.face));
  }
});

test('when you can work: hired, once a day, from opening to two hours before closing', () => {
  const g = newGame();
  const [open, close] = HOURS['cafe']!;
  assert.equal(lastShiftStart(), close - 120);
  assert.match(shiftBlocked(g, open + 60)!, /don't work here/);
  hire(g);
  assert.ok(isHired(g));
  assert.equal(g.job!.hired, g.day);
  assert.match(shiftBlocked(g, open - 1)!, /isn't open/);
  assert.equal(shiftBlocked(g, open), null);
  assert.equal(shiftBlocked(g, lastShiftStart()), null);
  assert.match(shiftBlocked(g, lastShiftStart() + 1)!, /too late/);
  finishShift(g, 3);
  assert.deepEqual(g.job, { hired: g.day, shifts: 1, lastShift: g.day, served: 3 });
  assert.match(shiftBlocked(g, open + 60)!, /already worked/);
  g.day += 1;
  assert.equal(shiftBlocked(g, open + 60), null);
});

test('the job is kept in the save, and an odd one is dropped', () => {
  const g = newGame();
  hire(g);
  finishShift(g, 3);
  const back = migrate(JSON.parse(JSON.stringify(g)));
  assert.deepEqual(back!.job, g.job);
  const none = migrate(JSON.parse(JSON.stringify(newGame())));
  assert.equal(none!.job, undefined);
  assert.equal(cleanJob({ shifts: 2 }), undefined);
  assert.equal(cleanJob('yes'), undefined);
  assert.deepEqual(cleanJob({ hired: 3, shifts: -1, served: 2.7 }), { hired: 3, shifts: 0, served: 2 });
  const bad = migrate({ ...JSON.parse(JSON.stringify(newGame())), job: { hired: 'x' } });
  assert.equal(bad!.job, undefined);
});

test('the people at the job are all there, with faces', () => {
  for (const id of ['tencho', ...CUSTOMER_FACES] as const) {
    assert.ok(npcs[id], id);
    assert.ok(STAFF[id], `${id} drawn`);
  }
  assert.ok(scenarioById[INTERVIEW] && scenarioById[COLLEAGUE] && customers);
  for (const k of KINDS) assert.ok(customers.variants.some((v) => v.id === k), k);
});

test('every customer, with every drink, at every stage: served perfectly start to finish', () => {
  for (const kind of KINDS) {
    const base = customers.variants.find((v) => v.id === kind)!;
    for (let seed = 1; seed <= 8; seed++) {
      const variant = customerVariant(kind, base, seeded(seed));
      for (let stage = 1; stage <= customers.maxStage!; stage++) {
        const r = playPerfect({ ...customers, npc: CUSTOMER_FACES[seed % 3]! }, variant, stage as Mode);
        assert.ok(r.clean, `${kind}/${seed}/stage ${stage}`);
        assert.equal(r.grades.miss, 0);
        assert.equal(r.grades.okay, 0);
      }
    }
  }
});

test('the drink, the price and the change in a conversation are the ones the customer has', () => {
  const base = customers.variants.find((v) => v.id === 'here')!;
  for (let seed = 1; seed < 40; seed++) {
    const v = customerVariant('here', base, seeded(seed));
    const m = MENU.find((x) => x.item === v.slots['item'])!;
    assert.ok(m);
    assert.equal(v.slots['price'], String(m.price));
    const paid = Number(v.slots['paid']!.replace(',', ''));
    assert.equal(Number(v.slots['change']!.replace(',', '')), paid - m.price);
    assert.notEqual(v.slots['wrong'], v.slots['change']);
  }
  const toilet = customerVariant('toilet', customers.variants.find((v) => v.id === 'toilet')!, seeded(1));
  assert.equal(toilet.slots['price'], customers.variants.find((v) => v.id === 'toilet')!.slots['price']);
});

test('casual or plain answers to a customer are okay at best, with a note on the polite line', () => {
  const variant = customerVariant('here', customers.variants.find((v) => v.id === 'here')!, seeded(2));
  let okays = 0;
  for (const [id, node] of Object.entries(customers.nodes)) {
    if (!node.choices) continue;
    for (const c of node.choices) {
      if (c.grade === 'okay') {
        okays++;
        assert.ok(c.note, `${id}: an okay answer needs a note`);
      }
    }
  }
  assert.ok(okays >= 5, 'several lines where a casual answer is only okay');
  // The first line: plain いらっしゃい is understood, but staff say いらっしゃいませ.
  const r = new ScenarioRun({ def: customers, variant, stage: 1, friendship: 0, period: 'day', vocab, rng: seeded(5), listener: stranger });
  const casual = r.node.choices!.findIndex((c) => c.grade === 'okay');
  assert.ok(casual >= 0);
  const out = r.answerChoice(casual);
  assert.equal(out.grade, 'okay');
  assert.ok(out.why);
});

test('the interview and the shift with ゆき play through answered well', () => {
  const interview = scenarioById[INTERVIEW]!;
  for (let stage = 1; stage <= interview.maxStage!; stage++) assert.ok(playPerfect(interview, interview.variants[0]!, stage as Mode).clean);
  const shift = scenarioById[COLLEAGUE]!;
  for (const v of shift.variants) {
    for (const friendship of [0, 25]) {
      const r = new ScenarioRun({ def: shift, variant: v, stage: 1, friendship, period: 'day', vocab, rng: seeded(5) });
      while (!r.ended) {
        const node = r.node;
        if (!node.choices) r.continue();
        else r.answerChoice(node.choices.findIndex((c) => c.result === 'success' && c.register === (friendship ? 'plain' : 'polite')));
      }
      assert.ok(r.clean, `${v.id}/${friendship}`);
    }
  }
});

test('the board says the cafe is hiring until you have the job', () => {
  assert.match(boardNotes(2, true).map((n) => n.jp).join(' '), /アルバイト/);
  assert.doesNotMatch(boardNotes(2, false).map((n) => n.jp).join(' '), /アルバイト/);
});
