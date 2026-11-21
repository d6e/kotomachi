import { test } from 'node:test';
import assert from 'node:assert/strict';
import { npcs, scenarioById, scenarios, vocab } from '../src/game/content.ts';
import { greetSlots, resolveChoice, ScenarioRun, type Listener } from '../src/scenario/engine.ts';
import { plainText } from '../src/lang/markup.ts';
import { nextCombo, slips } from '../src/game/rewards.ts';
import { migrate, newGame } from '../src/game/state.ts';
import { headArt, HEAD_ROWS, withExpression } from '../src/town/faces.ts';
import type { ChoiceDef, Mode, NpcId } from '../src/scenario/types.ts';

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const clerk: Listener = { friend: false, name: 'a shop clerk' };
const yuki: Listener = { friend: true, name: 'ゆき' };

test('grades: perfect, okay and miss by meaning and by who you talk to', () => {
  const at = (friendship: number, listener = clerk, alternatives = { plain: true, notPlain: true }) => ({ period: 'day' as const, friendship, listener, alternatives });
  const polite: ChoiceDef = { text: 'そう です ね 。', result: 'success', register: 'polite' };
  const plain: ChoiceDef = { text: 'そう だ ね 。', result: 'success', register: 'plain' };
  const okay: ChoiceDef = { text: 'コーヒー だ 。', result: 'success', grade: 'okay', note: 'Right meaning, but blunt.' };
  const okayPlain: ChoiceDef = { ...okay, register: 'plain', note: 'Right meaning, but too casual.' };
  const wrong: ChoiceDef = { text: 'おやすみなさい 。', result: 'npc_amused' };

  assert.equal(resolveChoice(polite, at(0)).grade, 'perfect', 'keigo with a clerk');
  const casual = resolveChoice(plain, at(0));
  assert.equal(casual.grade, 'okay');
  assert.match(casual.note!, /too casual for a shop clerk/);
  assert.equal(casual.friendshipDelta, -1);
  assert.match(resolveChoice(plain, at(3, yuki)).note!, /ゆき still talks politely/);
  assert.equal(resolveChoice(plain, at(7, yuki)).grade, 'perfect', 'casual with a friend at two hearts');
  const stiff = resolveChoice(polite, at(7, yuki));
  assert.equal(stiff.grade, 'okay');
  assert.match(stiff.note!, /stiff: ゆき talks casually/);
  // A register slip only counts when the better register was on offer.
  assert.equal(resolveChoice(polite, at(7, yuki, { plain: false, notPlain: true })).grade, 'perfect');
  assert.equal(resolveChoice(plain, at(0, clerk, { plain: true, notPlain: false })).grade, 'perfect');
  assert.equal(resolveChoice(okay, at(0)).grade, 'okay');
  assert.equal(resolveChoice(okay, at(25, yuki)).grade, 'okay', 'blunt stays blunt');
  assert.equal(resolveChoice(okayPlain, at(0)).grade, 'okay');
  assert.equal(resolveChoice(okayPlain, at(7, yuki)).grade, 'perfect', 'plain speech is fine once they go casual');
  assert.equal(resolveChoice(wrong, at(0)).grade, 'miss');
  assert.equal(resolveChoice({ text: 'おはよう', result: 'success', correctWhen: 'morning' }, at(0)).grade, 'miss');
});

test('an okay answer carries on, explains itself and shows the perfect line', () => {
  const cafe = scenarioById['cafe_order']!;
  const r = new ScenarioRun({ def: cafe, variant: cafe.variants[0]!, stage: 1, friendship: 0, period: 'day', vocab, rng: seeded(5), listener: clerk });
  const i = r.node.choices!.findIndex((c) => c.grade === 'okay');
  assert.ok(i >= 0);
  const out = r.answerChoice(i);
  assert.equal(out.grade, 'okay');
  assert.equal(out.correct, true);
  assert.match(out.why!, /^Right meaning, but/);
  assert.match(plainText(out.better!), /をお願いします。$/);
  assert.notEqual(r.nodeId, cafe.start, 'moved on to the next line');
  assert.equal(r.corrections.length, 1, 'the better way goes in the notebook');
  assert.ok(r.clean, 'an okay is not a miss');
  assert.deepEqual(r.grades, { perfect: 0, okay: 1, miss: 0 });
});

test('with four answers written, the menu shows three: the perfect one, the okay one and one wrong one', () => {
  const k = scenarioById['konbini_buy']!;
  const variant = k.variants.find((v) => v.id === 'umbrella')!;
  const seen = new Set<number>();
  for (let seed = 1; seed < 40; seed++) {
    const r = new ScenarioRun({ def: k, variant, stage: 1, friendship: 0, period: 'day', vocab, rng: seeded(seed) });
    r.answerChoice(r.rightChoices()[0]!);
    assert.equal(r.nodeId, 'search');
    const node = r.node;
    assert.equal(node.choices!.length, 4);
    const shown = r.current().choices!.map((c) => c.index);
    assert.equal(shown.length, 3);
    assert.ok(shown.includes(node.choices!.findIndex((c) => c.grade === 'okay')));
    assert.ok(shown.some((i) => r.rightChoices().includes(i)));
    const wrong = shown.find((i) => node.choices![i]!.result !== 'success')!;
    seen.add(wrong);
    // After a miss, the same menu comes back without that one, not with the other wrong one.
    r.answerChoice(wrong);
    const again = r.current().choices!.map((c) => c.index).sort();
    assert.deepEqual(again, shown.filter((i) => i !== wrong).sort());
  }
  assert.equal(seen.size, 2, 'either wrong answer can be the one on the menu');
});

test('every menu, as a stranger and as a close friend, has a perfect answer on it', () => {
  for (const def of scenarios) {
    for (const variant of def.variants) {
      for (const friendship of def.id.startsWith('invite_') ? [25] : [0, 25]) {
        for (const period of ['morning', 'day', 'evening'] as const) {
          const r = new ScenarioRun({ def, variant, stage: 1 as Mode, friendship, period, vocab, rng: seeded(11), extraSlots: greetSlots(period) });
          let steps = 0;
          while (!r.ended && steps++ < 40) {
            const v = r.current();
            if (v.mode === 0) {
              r.continue();
              continue;
            }
            const right = r.rightChoices();
            const shown = v.choices!.map((c) => c.index);
            const pick = shown.find((i) => right.includes(i));
            assert.ok(pick !== undefined, `${def.id}/${variant.id}/${friendship}/${period} ${r.nodeId}: no perfect answer shown`);
            const out = r.answerChoice(pick);
            assert.equal(out.grade, 'perfect', `${def.id} ${v.nodeId}`);
          }
          assert.equal(r.grades.okay + r.grades.miss, 0);
        }
      }
    }
  }
});

test('the streak: perfect adds one, okay holds it, a miss breaks it', () => {
  assert.equal(nextCombo(4, 'perfect'), 5);
  assert.equal(nextCombo(4, 'okay'), 4);
  assert.equal(nextCombo(4, 'miss'), 0);
  assert.equal(slips({ perfect: 5, okay: 2, miss: 1 }), 2, 'an okay costs half a miss on errand pay');
});

test('an old save gets a tally of perfect, okay and missed answers', () => {
  const old = JSON.parse(JSON.stringify(newGame())) as { today: Record<string, unknown> };
  delete old.today['grades'];
  const g = migrate(old)!;
  assert.deepEqual(g.today.grades, { perfect: 0, okay: 0, miss: 0 });
  const kept = migrate({ ...old, today: { ...old.today, grades: { perfect: 3, okay: 1 } } })!;
  assert.deepEqual(kept.today.grades, { perfect: 3, okay: 1, miss: 0 });
});

test('everyone you can talk to has a face that smiles, looks puzzled and frowns', () => {
  const talkers = new Set(scenarios.map((s) => s.npc));
  for (const npc of Object.keys(npcs) as NpcId[]) {
    if (!talkers.has(npc)) continue;
    const art = headArt(npc);
    assert.ok(art, `${npc} has a head`);
    assert.equal(art.rows.length, HEAD_ROWS);
    const faces = (['neutral', 'happy', 'confused', 'frown'] as const).map((e) => withExpression(art.rows, e).join('\n'));
    assert.equal(new Set(faces).size, 4, `${npc}: four different faces`);
    for (const f of faces) for (const row of f.split('\n')) assert.equal(row.length, 16);
    for (const f of faces) for (const ch of f) assert.ok(ch === '\n' || ch === '.' || art.key[ch], `${npc}: unknown pixel ${ch}`);
  }
});
