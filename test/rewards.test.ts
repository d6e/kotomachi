import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comboMultiplier, errandPay, estimateXp, levelFor, levelProgress, xpForLevel } from '../src/game/rewards.ts';
import { load, migrate, newGame, save, START_MONEY } from '../src/game/state.ts';
import { Learner } from '../src/learner/model.ts';
import { vocab } from '../src/game/content.ts';

test('levels go up with experience, each a little further apart', () => {
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(49), 1);
  assert.equal(levelFor(50), 2);
  assert.equal(levelFor(150), 3);
  for (let l = 1; l < 20; l++) {
    assert.ok(xpForLevel(l + 1) - xpForLevel(l) > xpForLevel(l) - xpForLevel(l - 1) || l === 1);
    assert.equal(levelFor(xpForLevel(l)), l);
  }
  assert.equal(levelProgress(100), 0.5);
});

test('errands pay more at higher stages and a little less for each miss, never under half', () => {
  const s1 = errandPay(1, 0, 0).reward;
  const s4 = errandPay(4, 0, 0).reward;
  assert.ok(s4 > s1);
  assert.ok(errandPay(2, 1, 0).reward < errandPay(2, 0, 0).reward);
  assert.equal(errandPay(2, 9, 0).reward, errandPay(2, 0, 0).reward / 2);
  assert.equal(errandPay(3, 0, 480).refund, 480);
});

test('the combo multiplier grows with the streak and is capped', () => {
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(7), 1.7);
  assert.equal(comboMultiplier(99), 3);
});

class Mem {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

test('a save from before yen rewards loads, keeps its money and starts with experience for what it knows', () => {
  const g = newGame();
  const learner = new Learner(g.learner, vocab);
  learner.see('コーヒー', { day: 1, place: 'cafe' });
  learner.see('お願いする', { day: 1, place: 'cafe' });
  g.learner.words['コーヒー']!.status = 'recognized';
  const old = { ...g, version: 1, day: 4, money: 27000 } as Record<string, unknown>;
  delete old['xp'];
  old['today'] = { newWords: [], corrections: [], promotions: [], lookups: 0, greeted: false, friendshipStart: {} };
  const store = new Mem();
  store.setItem('kotomachi.save.v1', JSON.stringify(old));
  const loaded = load(1, store as unknown as Storage)!;
  assert.ok(loaded, 'loads');
  assert.equal(loaded.version, 2);
  assert.equal(loaded.money, 27000);
  assert.equal(loaded.xp, estimateXp(loaded.learner, 4));
  assert.ok(loaded.xp > 0);
  assert.equal(loaded.today.yen, 0);
  assert.equal(loaded.today.clean, 0);
  // And it saves and loads again as it is.
  save(loaded, 1, store as unknown as Storage);
  assert.equal(load(1, store as unknown as Storage)!.xp, loaded.xp);
  assert.equal(migrate({ version: 9 }), null);
  assert.equal(newGame().money, START_MONEY);
});

test('a word stays marked as new until it is looked up or answered right', () => {
  const learner = new Learner(newGame().learner, vocab);
  assert.ok(learner.isFresh('コーヒー'));
  learner.see('コーヒー', { day: 1, place: 'cafe' });
  assert.ok(learner.isFresh('コーヒー'));
  learner.markKnown('コーヒー', 1);
  assert.ok(!learner.isFresh('コーヒー'));
  learner.see('サイズ', { day: 1, place: 'cafe' });
  learner.lookup('サイズ', 1, false);
  assert.ok(!learner.isFresh('サイズ'));
  assert.ok(!learner.isFresh(null));
});
