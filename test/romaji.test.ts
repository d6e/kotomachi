import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer, toKana, toRomaji } from '../src/lang/kana.ts';
import { vocab } from '../src/game/content.ts';
import { readingRomaji } from '../src/ui/popup.ts';

test('kana to romaji, kana by kana', () => {
  assert.equal(toRomaji('なる'), 'naru');
  assert.equal(toRomaji('おねがいします'), 'onegaishimasu');
  assert.equal(toRomaji('つくえ'), 'tsukue');
  assert.equal(toRomaji('ふつか'), 'futsuka');
  assert.equal(toRomaji('をとこ'), 'otoko');
});

test('small ゃゅょ combine with the kana before', () => {
  assert.equal(toRomaji('きゃく'), 'kyaku');
  assert.equal(toRomaji('しょくご'), 'shokugo');
  assert.equal(toRomaji('じゃあ'), 'jaa');
  assert.equal(toRomaji('ぎゅうにゅう'), 'gyuunyuu');
  assert.equal(toRomaji('ちょっと'), 'chotto');
});

test('small っ doubles the next consonant', () => {
  assert.equal(toRomaji('きって'), 'kitte');
  assert.equal(toRomaji('まっちゃ'), 'matcha');
  assert.equal(toRomaji('いっしょ'), 'issho');
  assert.equal(toRomaji('あっ'), 'a');
});

test('ん before a vowel or y gets an apostrophe', () => {
  assert.equal(toRomaji('てんいん'), "ten'in");
  assert.equal(toRomaji('こんや'), "kon'ya");
  assert.equal(toRomaji('しんぶん'), 'shinbun');
  assert.equal(toRomaji('ほん'), 'hon');
});

test('katakana, ー as a long vowel, and loanword sounds', () => {
  assert.equal(toRomaji('ホット'), 'hotto');
  assert.equal(toRomaji('コーヒー'), 'kōhī');
  assert.equal(toRomaji('ビール'), 'bīru');
  assert.equal(toRomaji('カフェ'), 'kafe');
  assert.equal(toRomaji('パーティー'), 'pātī');
  assert.equal(toRomaji('ウェイター'), 'weitā');
  assert.equal(toRomaji('ディズニー'), 'dizunī');
});

test('は and へ read as particles only when asked', () => {
  assert.equal(toRomaji('こんにちは'), 'konnichiha');
  assert.equal(toRomaji('こんにちは', { particle: true }), 'konnichiwa');
  assert.equal(toRomaji('へ', { particle: true }), 'e');
  assert.equal(toRomaji('はな', { particle: true }), 'hana');
});

test('the word card reads particles and greetings the way they sound', () => {
  assert.equal(readingRomaji({ reading: 'は', pos: 'particle' }), 'wa');
  assert.equal(readingRomaji({ reading: 'へ', pos: 'particle' }), 'e');
  assert.equal(readingRomaji({ reading: 'こんばんは', pos: 'set phrase' }), 'konbanwa');
  assert.equal(readingRomaji({ reading: 'では', pos: 'conjunction' }), 'dewa');
  assert.equal(readingRomaji({ reading: 'なる', pos: 'verb (u)' }), 'naru');
  assert.equal(readingRomaji({ reading: 'はし', pos: 'noun' }), 'hashi');
});

test('every reading in the vocab becomes plain romaji', () => {
  for (const e of vocab.all()) {
    const r = readingRomaji(e);
    assert.match(r, /^[a-z'āīūēō]+$/, `${e.id} 「${e.reading}」 -> ${r}`);
  }
});

test('hiragana readings type back into the same kana', () => {
  // ぢ/づ/を share romaji with じ/ず/お, and a final っ (えっ) has no letter, so skip those.
  for (const e of vocab.all()) {
    if (!/^[ぁ-ゖ]+$/.test(e.reading) || /[ぢづを]|っ$/.test(e.reading)) continue;
    const r = toRomaji(e.reading);
    assert.equal(normalizeAnswer(toKana(r)), normalizeAnswer(e.reading), `${e.reading} -> ${r}`);
  }
});
