import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHOICES_PER_NODE, scenarios, validateContent, vocab } from '../src/game/content.ts';

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

test('every multiple-choice moment offers exactly three answers', () => {
  assert.equal(CHOICES_PER_NODE, 3);
  for (const s of scenarios) {
    for (const [id, n] of Object.entries(s.nodes)) {
      if (n.choices) assert.equal(n.choices.length, 3, `${s.id}.${id}`);
    }
  }
});

test('validation flags a node with the wrong number of choices', () => {
  const cafe = structuredClone(scenarios.find((s) => s.id === 'cafe_order')!);
  const greet = cafe.nodes[cafe.start]!;
  greet.choices = [...greet.choices!, greet.choices![0]!];
  const issues = validateContent([cafe]);
  assert.ok(issues.some((i) => i.problem.includes('needs exactly 3')), JSON.stringify(issues));
});
