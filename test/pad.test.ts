import { test } from 'node:test';
import assert from 'node:assert/strict';
import { padDir } from '../src/ui/pad.ts';

test('the d-pad points the way your thumb is from its centre', () => {
  assert.equal(padDir(0, -50, 69), 'up');
  assert.equal(padDir(0, 50, 69), 'down');
  assert.equal(padDir(-50, 5, 69), 'left');
  assert.equal(padDir(50, -10, 69), 'right');
  // Diagonals go to the stronger axis.
  assert.equal(padDir(30, -40, 69), 'up');
  assert.equal(padDir(40, 30, 69), 'right');
});

test('a touch in the middle of the d-pad points nowhere', () => {
  assert.equal(padDir(0, 0, 69), null);
  assert.equal(padDir(8, -6, 69), null);
});
