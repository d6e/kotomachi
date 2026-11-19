import { test } from 'node:test';
import assert from 'node:assert/strict';
import { npcs, scenarioById, vocab } from '../src/game/content.ts';
import {
  addPoints, canGiveToday, chatPoints, CHAT_PER_DAY, finishInvite, friendAt, FRIENDS, give, heartsFor, HEARTS, inviteReady,
  inviteScenario, PHOTOS, pointsOf, speechLevel, tasteOf, toNextHeart,
} from '../src/game/friends.ts';
import { goodById } from '../src/game/inventory.ts';
import { migrate, newDayLog, newGame } from '../src/game/state.ts';
import { parseLine, plainText } from '../src/lang/markup.ts';
import { ScenarioRun } from '../src/scenario/engine.ts';
import { drawMemory, isMemoryArt, MEMORY_ARTS } from '../src/town/memoryart.ts';
import { SCENE_H, SCENE_W } from '../src/town/scenes.ts';
import { KEEPSAKE_ART } from '../src/town/roomart.ts';

test('hearts fill up at 3, 7, 12, 18 and 25 points, and speech goes casual at two', () => {
  assert.deepEqual([0, 2, 3, 6, 7, 11, 12, 18, 24, 25, 40].map(heartsFor), [0, 0, 1, 1, 2, 2, 3, 4, 4, 5, 5]);
  assert.equal(toNextHeart(0), 3);
  assert.equal(toNextHeart(8), 4);
  assert.equal(toNextHeart(25), null);
  assert.equal(speechLevel(HEARTS[0] - 1), 0);
  assert.equal(speechLevel(HEARTS[0]), 1);
  assert.equal(speechLevel(HEARTS[1]), 2);
});

test('points only report a change when hearts or speech change, and never go below zero', () => {
  const g = newGame();
  assert.equal(addPoints(g, 'mori', 2), null);
  const c = addPoints(g, 'mori', 1)!;
  assert.deepEqual({ before: c.before, after: c.after, speech: c.speech }, { before: 0, after: 1, speech: [0, 1] });
  addPoints(g, 'mori', -10);
  assert.equal(pointsOf(g, 'mori'), 0);
});

test('chatting counts for a couple of points a day per person, but a slip always counts', () => {
  const g = newGame();
  assert.equal(chatPoints(g, 'yuki', 1), 1);
  assert.equal(chatPoints(g, 'yuki', 3), CHAT_PER_DAY - 1);
  assert.equal(chatPoints(g, 'yuki', 1), 0);
  assert.equal(chatPoints(g, 'tanaka', 2), 2, 'each person counts separately');
  assert.equal(chatPoints(g, 'yuki', -1), -1);
  g.today = newDayLog(g.friendship);
  assert.equal(chatPoints(g, 'yuki', 1), 1, 'a new day starts over');
});

test('a present leaves your things, once a day per person, and each friend has favourites', () => {
  const g = newGame();
  g.bag = { ocha: 2, kazegusuri: 1 };
  g.shelf = ['ocha'];
  assert.equal(give(g, 'tanaka', 'ocha'), 'love');
  assert.equal(g.bag['ocha'], 1);
  assert.ok(g.shelf.includes('ocha'));
  assert.ok(!canGiveToday(g, 'tanaka'));
  assert.ok(canGiveToday(g, 'yuki'));
  assert.equal(give(g, 'yuki', 'ocha'), 'like');
  assert.equal(tasteOf('kobayashi', 'ocha'), 'ok');
  assert.equal(g.bag['ocha'], undefined, 'the last one is gone');
  assert.deepEqual(g.shelf, [], 'and off the shelf');
  assert.equal(give(g, 'mori', 'aisu'), null, "you can't give what you haven't got");
  assert.equal(tasteOf('mori', 'kazegusuri'), 'odd');
  assert.deepEqual(g.giftsGiven, { tanaka: ['ocha'], yuki: ['ocha'] });
  for (const f of FRIENDS) {
    for (const id of [...f.loves, ...f.likes]) assert.ok(goodById[id] && !goodById[id]!.keepsake, `${f.id}: ${id} is something you can buy`);
    assert.ok(f.loves.length >= 1);
  }
});

test('invitations come at three and five hearts, one after the other', () => {
  const g = newGame();
  assert.equal(inviteReady(g, 'kobayashi'), undefined);
  g.friendship.kobayashi = HEARTS[2];
  assert.equal(inviteReady(g, 'kobayashi')?.variant, 'first');
  finishInvite(g, 'kobayashi');
  assert.equal(inviteReady(g, 'kobayashi'), undefined, 'the second waits for five hearts');
  g.friendship.kobayashi = HEARTS[4];
  assert.equal(inviteReady(g, 'kobayashi')?.variant, 'second');
  finishInvite(g, 'kobayashi');
  assert.equal(inviteReady(g, 'kobayashi'), undefined, 'and that is all of them');
});

test('every friend is somewhere you can find them, with two outings that have pictures and words', () => {
  for (const f of FRIENDS) {
    assert.ok(npcs[f.id], f.id);
    assert.equal(friendAt(f.place), f.id);
    assert.ok(scenarioById[inviteScenario(f.id)], `${f.id} has an invitation`);
    assert.deepEqual(f.invites.map((i) => i.hearts), [3, 5]);
    for (const inv of f.invites) {
      assert.ok(isMemoryArt(inv.art), `${inv.art} is drawn`);
      for (const l of inv.lines) {
        const tokens = parseLine(l.text, vocab);
        assert.ok(tokens.every((t) => !t.lemma || vocab.has(t.lemma)), `${f.id}: ${l.text}`);
      }
    }
  }
  assert.equal(new Set(FRIENDS.flatMap((f) => f.invites.map((i) => i.art))).size, MEMORY_ARTS.length);
});

test('each outing picture fills its frame', () => {
  for (const art of MEMORY_ARTS) {
    for (const f of FRIENDS) {
      const b = drawMemory(art, f.id);
      assert.equal(b.w, SCENE_W);
      assert.equal(b.h, SCENE_H);
      assert.equal([...b.px].filter((p) => p < 0).length, 0, `${art} has gaps`);
    }
  }
});

test('a photo from the first outing is a keepsake with a picture', () => {
  for (const p of PHOTOS) {
    assert.ok(goodById[p.id]?.keepsake, p.id);
    assert.ok(KEEPSAKE_ART[p.id], `${p.id} drawn`);
  }
});

test('giving a present: the friend says what it is, and reacts by how much they like it', () => {
  const base = scenarioById['gift_give']!;
  for (const taste of ['love', 'like', 'ok', 'odd']) {
    const def = { ...base, npc: 'mori' as const, place: 'pharmacy' as const };
    const v = base.variants.find((x) => x.id === taste)!;
    const variant = { ...v, slots: { ...v.slots, item: 'お弁当=弁当', item_en: 'bento' } };
    const r = new ScenarioRun({ def, variant, stage: 1, friendship: 0, period: 'day', vocab });
    const lines: string[] = [];
    let steps = 0;
    while (!r.ended && steps++ < 10) {
      lines.push(plainText(r.current().line));
      r.answerChoice(r.node.choices!.findIndex((c) => c.result === 'success' && c.register !== 'plain'));
    }
    assert.ok(r.ended && r.clean, taste);
    assert.equal(lines.length, 2, taste);
    if (taste === 'love' || taste === 'like') assert.match(lines[1]!, /弁当/, taste);
  }
});

test('an old save gets friendships, outings and presents filled in', () => {
  const old = JSON.parse(JSON.stringify(newGame())) as Record<string, unknown>;
  delete old['invites'];
  delete old['giftsGiven'];
  const today = old['today'] as Record<string, unknown>;
  delete today['chat'];
  delete today['gifted'];
  old['friendship'] = { yuki: 9 };
  const g = migrate(old)!;
  assert.deepEqual(g.invites, {});
  assert.deepEqual(g.giftsGiven, {});
  assert.deepEqual(g.today.chat, {});
  assert.deepEqual(g.today.gifted, []);
  assert.equal(heartsFor(pointsOf(g, 'yuki')), 2, 'ゆき keeps what you had');
});
