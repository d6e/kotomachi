import { test } from 'node:test';
import assert from 'node:assert/strict';
import { katakanaToHiragana, normalizeAnswer, toKana } from '../src/lang/kana.ts';

test('basic romaji to hiragana', () => {
  assert.equal(toKana('onegaishimasu'), 'おねがいします');
  assert.equal(toKana('kudasai'), 'ください');
  assert.equal(toKana('de'), 'で');
  assert.equal(toKana('wo'), 'を');
});

test('small tsu, n, and yoon', () => {
  assert.equal(toKana('motte'), 'もって');
  assert.equal(toKana('konnichiha'), 'こんにちは');
  assert.equal(toKana('tennai'), 'てんない');
  assert.equal(toKana("kin'en"), 'きんえん');
  assert.equal(toKana('kyou'), 'きょう');
  assert.equal(toKana('shokugo'), 'しょくご');
  assert.equal(toKana('chotto'), 'ちょっと');
  assert.equal(toKana('dotchi'), 'どっち');
  assert.equal(toKana('matcha'), 'まっちゃ');
  assert.equal(toKana('MATCHA'), 'マッチャ');
  assert.equal(toKana('jaa'), 'じゃあ');
  assert.equal(toKana('sanbai'), 'さんばい');
});

test('uppercase gives katakana', () => {
  assert.equal(toKana('HOTTO'), 'ホット');
  assert.equal(toKana('AISU'), 'アイス');
  assert.equal(toKana('KO-HI-'), 'コーヒー');
});

test('IME mode leaves a trailing n for the next keystroke', () => {
  assert.equal(toKana('ten', { ime: true }), 'てn');
  assert.equal(toKana('ten'), 'てん');
  assert.equal(toKana('tenn', { ime: true }), 'てん');
});

test('normalizeAnswer compares across scripts', () => {
  assert.equal(normalizeAnswer('ホット'), normalizeAnswer('hotto'));
  assert.equal(normalizeAnswer(' おねがいします。'), 'おねがいします');
  assert.equal(katakanaToHiragana('アイス'), 'あいす');
});
