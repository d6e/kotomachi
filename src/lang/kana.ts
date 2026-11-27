// Romaji -> kana conversion for typed input, kana -> romaji for the word card,
// plus small kana helpers.
// Typed romaji is converted as the player types. Lowercase becomes hiragana; a
// chunk that starts with an uppercase letter becomes katakana (so "HOTTO" -> ホット).
// The only place romaji is shown is the word card, and only when you tap the reading.

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

    // Double consonant -> っ (but "nn" is ん). Hepburn writes っち as "tchi" (dotchi).
    const next = rest[1];
    if ((next !== undefined && rest[0] === next && CONSONANTS.includes(rest[0]!) && rest[0] !== 'n') || rest.startsWith('tch')) {
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

// ------------------------------------------------------------ kana -> romaji

// Hepburn, one kana at a time (ゃゅょ and the small vowels combine with the kana before).
const ROMAJI: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
  ゕ: 'ka', ゖ: 'ke',
};

// Two-kana sounds: kana + small ゃゅょ, and the newer combinations used for loanwords.
const ROMAJI_PAIRS: Record<string, string> = {
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', しぇ: 'she',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo', じぇ: 'je',
  ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', ちぇ: 'che',
  つぁ: 'tsa', つぃ: 'tsi', つぇ: 'tse', つぉ: 'tso',
  てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du', てゅ: 'tyu', でゅ: 'dyu',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo', ふゅ: 'fyu',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo', いぇ: 'ye',
  ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo',
  くぁ: 'kwa', ぐぁ: 'gwa',
};
for (const [k, c] of Object.entries({ き: 'k', ぎ: 'g', に: 'n', ひ: 'h', び: 'b', ぴ: 'p', み: 'm', り: 'r' })) {
  ROMAJI_PAIRS[k + 'ゃ'] = c + 'ya';
  ROMAJI_PAIRS[k + 'ゅ'] = c + 'yu';
  ROMAJI_PAIRS[k + 'ょ'] = c + 'yo';
}

const MACRON: Record<string, string> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

export interface ToRomajiOptions {
  /** Read は as "wa" and へ as "e", as the particles are (は, へ, こんにちは). */
  particle?: boolean;
}

/**
 * Kana to Hepburn romaji, spelled kana by kana so it lines up with what's written:
 * なる -> naru, きって -> kitte, まっちゃ -> matcha, てんいん -> ten'in,
 * コーヒー -> kōhī (ー puts a line over the vowel before it). Anything that isn't
 * kana (～, spaces, latin letters) is kept as it is.
 */
export function toRomaji(input: string, opts: ToRomajiOptions = {}): string {
  const s = katakanaToHiragana(input).replace(/ヷ/g, 'ゔぁ').replace(/ヸ/g, 'ゔぃ').replace(/ヹ/g, 'ゔぇ').replace(/ヺ/g, 'ゔぉ');
  // Each sound in romaji, with っ, ん and ー kept as kana until the next sound is known.
  const units: string[] = [];
  let i = 0;
  while (i < s.length) {
    const pair = ROMAJI_PAIRS[s.slice(i, i + 2)];
    if (pair !== undefined) {
      units.push(pair);
      i += 2;
      continue;
    }
    const ch = s[i]!;
    if (ch === 'ー' || ch === 'っ' || ch === 'ん') units.push(ch);
    else units.push(ROMAJI[ch] ?? ch);
    i += 1;
  }
  if (opts.particle && units.length) {
    const last = s[s.length - 1];
    if (last === 'は') units[units.length - 1] = 'wa';
    else if (last === 'へ') units[units.length - 1] = 'e';
  }
  let out = '';
  for (let u = 0; u < units.length; u++) {
    const unit = units[u]!;
    const next = units[u + 1];
    if (unit === 'っ') {
      // Doubles the next consonant (きって kitte, まっちゃ matcha). At the end, or before
      // a vowel, it's a short stop with no letter of its own.
      if (next && /^[bcdfghjkmnprstvwyz]/.test(next)) out += next.startsWith('ch') ? 't' : next[0];
      continue;
    }
    if (unit === 'ん') {
      // ん before a vowel or y gets an apostrophe so it isn't read as な/にゃ (ten'in).
      out += next && /^[aeiouy]/.test(next) ? "n'" : 'n';
      continue;
    }
    if (unit === 'ー') {
      const prev = out[out.length - 1];
      if (prev && MACRON[prev]) out = out.slice(0, -1) + MACRON[prev];
      else if (!prev || !/[āīūēō]/.test(prev)) out += '-';
      continue;
    }
    out += unit;
  }
  return out;
}
