import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heat } from '../src/ui/dialogue.ts';

test('the combo badge heats up with the streak and never goes down as it grows', () => {
  assert.equal(heat(0), 0);
  assert.equal(heat(1), 0);
  assert.equal(heat(2), 1);
  assert.equal(heat(4), 2);
  assert.equal(heat(7), 3);
  assert.equal(heat(10), 4);
  assert.equal(heat(50), 4);
  for (let n = 1; n < 30; n++) assert.ok(heat(n) >= heat(n - 1));
});
