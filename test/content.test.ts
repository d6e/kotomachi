import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarios, validateContent, vocab } from '../src/game/content.ts';

test('all content parses against the vocab, links resolve, slots fill', () => {
  const issues = validateContent();
  assert.deepEqual(issues, []);
});

test('the cafe has content for every ladder stage up to fill-in-the-blank', () => {
  const cafe = scenarios.find((s) => s.id === 'cafe_order')!;
  assert.equal(cafe.maxStage, 4);
  const ladder = Object.values(cafe.nodes).filter((n) => (n.maxMode ?? 5) > 2);
  assert.ok(ladder.length >= 5);
  for (const n of ladder) {
    assert.ok(n.choices && n.tiles && n.blank, 'stages 1-4 authored');
  }
});

test('vocabulary size', () => {
  assert.ok(vocab.size >= 100, `have ${vocab.size} words`);
});
