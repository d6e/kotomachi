// Romaji -> kana conversion for typed input, plus small kana helpers.
// Romaji is only ever an input method: it is converted as the player types and
// never shown on screen. Lowercase becomes hiragana; a chunk that starts with
// an uppercase letter becomes katakana (so "HOTTO" -> ホット).

const BASE: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ',
  za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  la: 'ら', li: 'り', lu: 'る', le: 'れ', lo: 'ろ',
  wa: 'わ', wi: 'うぃ', we: 'うぇ', wo: 'を',
  va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
  she: 'しぇ', je: 'じぇ', che: 'ちぇ',
  ti_: 'てぃ', thi: 'てぃ', dhi: 'でぃ', tsa: 'つぁ',
  nn: 'ん', "n'": 'ん', xn: 'ん',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', xtu: 'っ', xtsu: 'っ', ltu: 'っ', xwa: 'ゎ',
  '-': 'ー', '.': '。', ',': '、', '?': '？', '!': '！', '~': '〜',
  '[': '「', ']': '」',
};

// Yōon: consonant + y + vowel (kya, sha, cha, ja ...).
const YOON_ROWS: Record<string, string> = {
  k: 'き', g: 'ぎ', s: 'し', z: 'じ', t: 'ち', d: 'ぢ', n: 'に', h: 'ひ',
  b: 'び', p: 'ぴ', m: 'み', r: 'り', l: 'り',
};
const SMALL_Y: Record<string, string> = { a: 'ゃ', u: 'ゅ', o: 'ょ' };
for (const [c, k] of Object.entries(YOON_ROWS)) {
  for (const [v, s] of Object.entries(SMALL_Y)) BASE[`${c}y${v}`] = k + s;
}
for (const [v, s] of Object.entries(SMALL_Y)) {
  BASE[`sh${v}`] = 'し' + s;
  BASE[`ch${v}`] = 'ち' + s;
  BASE[`j${v}`] = 'じ' + s;
  BASE[`jy${v}`] = 'じ' + s;
  BASE[`cy${v}`] = 'ち' + s;
}
delete BASE['ti_'];

const MAX_CHUNK = 4;
const CONSONANTS = 'bcdfghjklmpqrstvwxyz';

export function hiraganaToKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

export function katakanaToHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export interface ToKanaOptions {
  /** IME mode: a trailing lone "n" (or partial chunk) is left as typed so the player can keep typing. */
  ime?: boolean;
}

/** Convert romaji to kana. Kana already in the string passes through untouched. */
export function toKana(input: string, opts: ToKanaOptions = {}): string {
  let out = '';
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    const lower = ch.toLowerCase();
    const isUpper = ch !== lower;
    const katakana = isUpper;
    const rest = input.slice(i).toLowerCase();

    // Double consonant -> っ (but "nn" is ん).
    const next = rest[1];
    if (next !== undefined && rest[0] === next && CONSONANTS.includes(rest[0]!) && rest[0] !== 'n') {
      out += katakana ? 'ッ' : 'っ';
      i += 1;
      continue;
    }

    // "n" before a consonant (other than n/y) or apostrophe -> ん.
    if (rest[0] === 'n' && next !== undefined && CONSONANTS.includes(next) && next !== 'y' && next !== 'n') {
      out += katakana ? 'ン' : 'ん';
      i += 1;
      continue;
    }

    // "nn": ん, unless a vowel/y follows, in which case the second n starts the next mora
    // (konnichiha -> こんにちは, kannya -> かんにゃ).
    if (rest.startsWith('nn')) {
      const after = rest[2];
      out += katakana ? 'ン' : 'ん';
      i += after !== undefined && 'aiueoy'.includes(after) ? 1 : 2;
      continue;
    }

    let matched = false;
    for (let len = Math.min(MAX_CHUNK, rest.length); len >= 1; len--) {
      const chunk = rest.slice(0, len);
      const kana = BASE[chunk];
      if (kana !== undefined) {
        out += katakana ? hiraganaToKatakana(kana) : kana;
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Lone trailing "n" at end of input.
    if (rest === 'n') {
      if (opts.ime) out += ch;
      else out += katakana ? 'ン' : 'ん';
      i += 1;
      continue;
    }
    // Unmatched: keep the character (partial chunk while typing, kana, spaces...).
    out += ch;
    i += 1;
  }
  return out;
}

/** Normalise an answer for comparison: hiragana only, no spaces or punctuation. */
export function normalizeAnswer(s: string): string {
  return katakanaToHiragana(toKana(s.trim()))
    .replace(/[\s。、？！?!.,「」]/g, '')
    .replace(/ー/g, 'ー');
}

export function hasKanji(s: string): boolean {
  return /[㐀-鿿々]/.test(s);
}

export function isKana(s: string): boolean {
  return /^[ぁ-ゖァ-ーー]+$/.test(s);
}

/** True if the string still contains latin letters (an unfinished romaji chunk). */
export function hasLatin(s: string): boolean {
  return /[a-zA-Z]/.test(s);
}
