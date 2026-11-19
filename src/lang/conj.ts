// Explains how a surface form relates to its dictionary form, for the lookup popup.
// Covers the forms that appear in the MVP's lines; anything unusual goes in data/forms.json.

export interface FormNote {
  /** e.g. "飲む → 飲んで" */
  change: string;
  /** e.g. "て-form + ください: a polite request" */
  label: string | null;
}

const ENDINGS: [string, string][] = [
  ['ませんでした', 'polite past negative (～ませんでした)'],
  ['ましょう', "polite 'let's' (～ましょう)"],
  ['ませんか', 'polite invitation (～ませんか)'],
  ['ますか', 'polite question (～ますか)'],
  ['ません', 'polite negative (～ません)'],
  ['ました', 'polite past (～ました)'],
  ['ます', 'polite non-past (～ます)'],
  ['てください', 'て-form + ください: a polite request'],
  ['でください', 'て-form + ください: a polite request'],
  ['ている', 'て-form + いる: ongoing action'],
  ['たい', 'want to (～たい)'],
  ['ない', 'plain negative (～ない)'],
  ['て', 'て-form: links actions, or asks with ください'],
  ['で', 'て-form: links actions, or asks with ください'],
  ['た', 'plain past (～た)'],
  ['だ', 'plain past (～だ)'],
];

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

export function explainForm(
  surface: string,
  lemma: string,
  overrides: Record<string, string> = {},
): FormNote | null {
  if (surface === lemma) return null;
  const change = `${lemma} → ${surface}`;
  const override = overrides[`${surface}=${lemma}`] ?? overrides[surface];
  if (override !== undefined) return { change, label: override };
  const p = commonPrefix(surface, lemma);
  const ending = surface.slice(p);
  for (const [suffix, label] of ENDINGS) {
    if (ending.endsWith(suffix)) return { change, label };
  }
  return { change, label: null };
}
