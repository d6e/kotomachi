// The town's days: the weather, the time of day, and a festival in the park every 7th
// day. Pure functions of the day number and the clock, so a day looks the same however
// often you load it, and they can be tested.

import type { ChatterLine } from './content.ts';

export type Weather = 'hare' | 'kumori' | 'ame';
export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

/** The weather's word, for the notice board and the morning. */
export const WEATHER_WORD: Record<Weather, string> = { hare: '晴れ', kumori: '曇り', ame: '雨' };
export const WEATHER_EN: Record<Weather, string> = { hare: 'sunny', kumori: 'cloudy', ame: 'rain' };

/** Every 7th day is festival day. */
export const FESTIVAL_EVERY = 7;

export function isFestival(day: number): boolean {
  return day > 0 && day % FESTIVAL_EVERY === 0;
}

/** Days until the next festival: 0 on the day itself. */
export function daysToFestival(day: number): number {
  return (FESTIVAL_EVERY - (day % FESTIVAL_EVERY)) % FESTIVAL_EVERY;
}

function hashDay(day: number, salt: number): number {
  let v = Math.imul(day ^ 0x5bd1e995, 0x27d4eb2d) ^ salt;
  v = Math.imul(v ^ (v >>> 15), 0x85ebca6b);
  return ((v ^ (v >>> 13)) >>> 0) / 4294967296;
}

/** The first day is sunny, and so is every festival; otherwise about one day in four rains. */
export function weatherFor(day: number): Weather {
  if (day <= 1 || isFestival(day)) return 'hare';
  const r = hashDay(day, 7919);
  return r < 0.27 ? 'ame' : r < 0.52 ? 'kumori' : 'hare';
}

export function timeOfDay(minutes: number): TimeOfDay {
  const h = minutes / 60;
  if (h < 11) return 'morning';
  if (h < 17) return 'day';
  if (h < 19) return 'evening';
  return 'night';
}

export interface ChatterContext {
  day: number;
  minutes: number;
  /** Words due for review, which a line is better for bringing up. */
  isDue(word: string): boolean;
  /** Lines already said today, which aren't said again while others are left. */
  said: ReadonlySet<string>;
  lemmas(line: ChatterLine): string[];
  /** A number from 0 to 1, so passers-by don't all say the same thing. */
  random(): number;
}

export function fits(line: ChatterLine, day: number, minutes: number): boolean {
  if (line.festival && !isFestival(day)) return false;
  if (line.eve && daysToFestival(day) !== 1) return false;
  if (line.weather && !line.weather.includes(weatherFor(day))) return false;
  if (line.time && !line.time.includes(timeOfDay(minutes))) return false;
  return true;
}

/**
 * What a passer-by says: a line that fits the day, the weather and the hour, preferring
 * ones with a word due for review, then ones about today (the weather, the festival),
 * and not one already heard today while there are others.
 */
export function pickChatter(lines: ChatterLine[], c: ChatterContext): ChatterLine | null {
  const ok = lines.filter((l) => fits(l, c.day, c.minutes));
  if (!ok.length) return null;
  const fresh = ok.filter((l) => !c.said.has(l.text));
  const pool = fresh.length ? fresh : ok;
  let best: ChatterLine | null = null;
  let bestScore = -1;
  for (const l of pool) {
    const due = c.lemmas(l).some((w) => c.isDue(w)) ? 2 : 0;
    const today = l.festival || l.eve ? 1.5 : l.weather ? 1 : 0;
    const score = due + today + c.random() * 1.2;
    if (score > bestScore) {
      best = l;
      bestScore = score;
    }
  }
  return best;
}

/** Counting days: these readings are irregular, so each carries its own furigana. */
const DAY_COUNT: Record<number, string> = {
  1: '{一日|いちにち}=日', 2: '{二日|ふつか}=日', 3: '{三日|みっか}=日', 4: '{四日|よっか}=日', 5: '{五日|いつか}=日', 6: '{六日|むいか}=日',
};

/** A line in Japanese markup with its English. */
export interface Notice {
  jp: string;
  en: string;
}

/** The notices on the street's notice board (掲示板) today. */
export function boardNotes(day: number): Notice[] {
  const w = weatherFor(day);
  const left = daysToFestival(day);
  const notes: Notice[] = [{ jp: `今日 の 天気 ： ${WEATHER_WORD[w]}`, en: `Today's weather: ${WEATHER_EN[w]}.` }];
  if (left === 0) {
    notes.push({ jp: '今日 は 祭り です ！ 公園 に 屋台 が あります=ある 。', en: "It's festival day! There are stalls in the park: goldfish scooping, takoyaki and shaved ice." });
    notes.push({ jp: '金魚すくい ： 一回 300 円', en: 'Goldfish scooping: ¥300 a go. Whatever you catch is yours to take home.' });
  } else {
    notes.push({ jp: `祭り まで あと ${DAY_COUNT[left]} 。`, en: `The festival in the park is in ${left} day${left === 1 ? '' : 's'}. There's one every 7th day.` });
  }
  return notes;
}

/** A line about the day for the morning, or null on an ordinary day. */
export function morningNote(day: number): Notice {
  if (isFestival(day)) return { jp: '今日 は 祭り です ！', en: "It's festival day: stalls are up in the park, with goldfish scooping." };
  if (daysToFestival(day) === 1) return { jp: '明日 は 祭り です よ 。', en: 'The festival in the park is tomorrow.' };
  const w = weatherFor(day);
  return { jp: `今日 の 天気 ： ${WEATHER_WORD[w]}`, en: w === 'ame' ? 'Rain today. Fewer people are out.' : `Today's weather: ${WEATHER_EN[w]}.` };
}
