import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kanjiRunReadings, parseLine, plainText, Vocab, type ParseIssue } from '../src/lang/markup.ts';
import { explainForm } from '../src/lang/conj.ts';
import { forms, vocab } from '../src/game/content.ts';

test('furigana is derived per kanji run from the lemma reading', () => {
  assert.deepEqual([...kanjiRunReadings('召し上がる', 'めしあがる')!], [['召', 'め'], ['上', 'あ']]);
  assert.deepEqual([...kanjiRunReadings('持ち帰り', 'もちかえり')!], [['持', 'も'], ['帰', 'かえ']]);
  const [t] = parseLine('温めます=温める', vocab);
  assert.deepEqual(t!.ruby, [{ text: '温', rt: 'あたた' }, { text: 'めます' }]);
  const [o] = parseLine('お召し上がり=召し上がる', vocab);
  assert.deepEqual(o!.ruby, [{ text: 'お' }, { text: '召', rt: 'め' }, { text: 'し' }, { text: '上', rt: 'あ' }, { text: 'がり' }]);
});

test('slots, punctuation and literals', () => {
  const tokens = parseLine('$size サイズ で お願いします=お願いする 。', vocab, { size: 'M' });
  assert.equal(plainText(tokens), 'Mサイズでお願いします。');
  assert.deepEqual(tokens.map((t) => t.lemma), [null, 'サイズ', 'で', 'お願いする', null]);
});

test('unknown words and missing furigana are reported', () => {
  const v = new Vocab([{ id: '犬', reading: 'いぬ', meaning: 'dog', pos: 'noun' }]);
  const issues: ParseIssue[] = [];
  parseLine('猫 が 犬 を 見た=見る', v, {}, issues);
  assert.ok(issues.some((i) => i.token === '猫'));
  assert.ok(issues.some((i) => i.problem.includes('見る')));
  const ok = parseLine('{猫|ねこ}=犬', v);
  assert.deepEqual(ok[0]!.ruby, [{ text: '猫', rt: 'ねこ' }]);
});

test('conjugation breakdown', () => {
  assert.equal(explainForm('飲んで', '飲む')!.label, 'て-form: links actions, or asks with ください');
  assert.equal(explainForm('お願いします', 'お願いする')!.label, 'polite non-past (～ます)');
  assert.equal(explainForm('寝ません', '寝る')!.label, 'polite negative (～ません)');
  assert.match(explainForm('よかった', 'いい', forms)!.label!, /past of いい/);
  assert.equal(explainForm('飲む', '飲む'), null);
});
