# ことまち (Kotomachi)

A small top-down town where you learn Japanese by living there. There's no farming and no dungeon. Each day you get a few errands, like buying a latte at the cafe, picking up onigiri at the konbini, getting eye drops at the pharmacy, eating at the restaurant, buying a train ticket, sending a parcel at the post office or greeting your neighbour. Each errand is a real conversation in Japanese. At night your notebook collects the words you met, the mistakes you made and the grammar you ran into. Sleeping saves the game.

Romaji is never shown on screen. You only type it, and it turns into kana as you type.

## Running it

You need Node 22.18 or newer. There are no runtime dependencies. The only dev dependencies are TypeScript and esbuild, with `@types/node` for the tests.

```sh
npm install
npm run dev        # http://127.0.0.1:8000, rebuilds on save
```

| Command | What it does |
| --- | --- |
| `npm run dev` | esbuild watches `src/` and serves `www/`. Set `PORT` to change the port and `HOST=0.0.0.0` to try it from a phone on the same network. |
| `npm run build` | Writes a minified bundle to `www/build/`. Serve `www/` from any static host. |
| `npm run single` | Writes the whole game as one self-contained HTML file, `dist/kotomachi.html`, with the CSS and JavaScript inlined. It opens straight from disk. |
| `npm test` | Unit tests with `node:test`. Node runs the `.ts` files directly, so there's no test framework. |
| `npm run typecheck` | `tsc --noEmit` in strict mode. |
| `npm run check` | Typecheck, tests and build in one go. |

## Controls

- **Walk:** arrow keys or WASD, one tile at a time. A quick tap of a new direction just turns you. Or click or tap where you want to go: clicking a shop walks to its door and goes in, and clicking 田中さん walks over to say hello.
- **Go in and out:** walk up into a door, or press Space, E or Enter at it. Inside, walk down through the door at the bottom (or tap it) to go back out onto the street.
- **Talk:** inside, walk up to the counter and press Space, or tap whoever works there. That starts the errand. Outside, press Space next to 田中さん or tap them.
- **Look a word up:** click or tap it, in dialogue, on signs, in the errands list or in the notebook.
- **Read:** lines type out a letter at a time. Enter, Space or a click on the text shows the whole line at once.
- **Answer:** move the ▶ with the arrow keys and press Enter, or click a row, or press its number. With tiles, tap them in order, then press "Say it". In a fill-in blank, type romaji and press Enter. Capital letters give katakana, so `HOTTO` gives ホット.
- **Notebook:** N, or the Notebook button. **Go home:** the button, or go into the アパート and press Space by the bed. Each day starts in your room.

## How it fits together

```
src/
  lang/      kana.ts (romaji → kana), markup.ts (line format + furigana), conj.ts (conjugation notes)
  srs/       fsrs.ts (FSRS-4.5 scheduler, written from the published algorithm)
  learner/   model.ts (what you know, word by word)
  scenario/  types.ts (content schema), engine.ts (one conversation as a state machine)
  judge/     freeform.ts (interface for a free-text judge; stubbed)
  game/      content.ts, errands.ts, state.ts (save data), game.ts (day loop, glue)
  town/      map.ts (tile grid, collision, path finding), art.ts (the town as pixel art), sprites.ts,
             palette.ts, pixels.ts (a tiny pixel buffer), town.ts (movement, camera, drawing, clicks)
  engine/    input.ts, loop.ts (keyboard state, requestAnimationFrame loop)
  ui/        dialogue.ts, popup.ts, notebook.ts, text.ts, dom.ts (plain DOM)
mockups/     the four art direction mockups (A to D) the look was picked from
data/        vocab.json, forms.json, grammar.json, npcs.json, scenarios/*.json
test/        node:test unit tests
www/         index.html, style.css (the bundle lands in www/build/)
```

There's no framework. The town is a 45×13 grid of 16 px tiles. All the art is drawn in code as pixel data at 1×, into a 320×208 view that follows you sideways, then scaled up by a whole number so pixels stay square and crisp. Sign lettering, furigana and the "Space ▶" hint are drawn on top at full resolution, so they stay readable at any size. Dialogue, the notebook and popups are plain DOM built with a tiny `h()` helper. The romaji converter and the FSRS scheduler are written from scratch as separate modules, with no wanakana and no ts-fsrs, so either can be swapped for a library later without touching anything else.

### Lines and words

Every Japanese line in `data/` is already split into words: `紅茶 を お願いします=お願いする 。`. A token is written as `surface=dictionary form` when the two differ, and `{漢字|かんじ}` overrides the reading where needed. Furigana come from the dictionary entry's reading, so content authors never write it by hand. `npm test` runs `validateContent()`, which checks that every line parses, every word is in `vocab.json`, and every node, slot and grammar id exists.

### The ladder

Each conversation (scenario) is a set of nodes. Each node can be played at any rung:

1. Multiple choice with furigana and an optional English gloss.
2. Multiple choice in Japanese only. A wrong answer gets an in-character reaction, and you try again with that option gone.
3. Word tiles with decoys.
4. Fill in the blank: you type the missing part in romaji and it becomes kana.

The ladder stops at 4. A freeform rung was planned and dropped: the judge interface is still in `src/judge/freeform.ts`, but nothing offers it. Voice is out of scope.

A scenario moves up a rung after **3 clean visits**. After **2 misses on one node** that node quietly drops back a rung for the rest of the visit. The NPC recasts your mistake the right way ("お願いします？ はい、ラテですね"), the conversation carries on, and the correction goes to the notebook.

### What you know

Words are tracked by dictionary form, with two tracks: meaning (do you understand it) and written form (can you read the kanji). Each word moves through unseen, seen, recognized and produced. Both tracks are scheduled with FSRS, using in-game days as time. Looking a word up mid-conversation lowers the credit for that answer, and looking one up while walking around counts as a lapse. Furigana fade per word once the written track's stability reaches 6 days. Each morning every place gets one errand, chosen from its variants: due words come first, then words you haven't met, and a variant you were given in the last few days steps back so the week varies. Day 1 always gets each place's gentlest variant.

Only the barista, ゆき, has a friendship meter, and it changes how she talks. At first she uses です/ます. At "acquaintance" (3 points) she adds casual asides, and at "friend" (7 points) she switches to plain form. Answering her in plain form before you're friends puzzles her and costs a point.

All of these numbers are constants at the top of `src/scenario/engine.ts` and `src/learner/model.ts`.

## What's implemented and what's stubbed

**Playable now**

- A walkable street with an apartment, cafe, konbini, pharmacy, restaurant, post office, station, park and a neighbour (田中さん) who walks back and forth. Shops keep opening hours: the pharmacy shows 準備中 before 9:00, the restaurant opens at 11:00 and the post office closes at 17:00.
- An inside for every place, the same size as the screen: your tatami room with a bed, and each shop with its counter and the person who works there (ゆき at the cafe, the konbini clerk, 森さん at the pharmacy, 山田さん at the restaurant, the station attendant and 小林さん at the post office). Errands start by talking to them across the counter. 田中さん stays outdoors.
- Cafe: the full ladder, stages 1 to 4, with four drinks, three sizes, hot or iced, for here or to go, a payment step and small talk that changes with friendship.
- Konbini: the full ladder, with eight errands: an onigiri, tea, a bento to heat with chopsticks, water, ice cream with a spoon, an umbrella or batteries you have to ask where to find, and a 肉まん from the counter. Along the way: point cards, bags, the sticker instead of a bag, and paying.
- Pharmacy: the full ladder, with six complaints (sore throat, headache, itchy eyes, stomach ache, cough, fever). You describe the symptom, say since when or whether you have allergies, ask how many times a day, and read back the dosage.
- Restaurant (山田さん): the full ladder, with six visits: curry on your own, ramen and a non-smoking seat, asking what's recommended, pasta and turning down a drink, two people paying separately, and asking if a card is OK. Along the way: how many people (一人, 二人), いただきます when the food comes, how it was (おいしかったです) and ごちそうさまでした as you pay.
- Station (駅員): the full ladder, with five visits: a ticket to Tokyo, which platform the Yokohama train leaves from, how long it takes to Kamakura, whether the rapid stops at Shinagawa, and topping up an IC card. Tickets are 片道 and counted with 枚.
- Post office (小林さん): the full ladder, with five visits: stamps and a postcard, a letter to America by airmail, a parcel to the UK by sea (and what's in it), a parcel to Osaka where you borrow a pen to write the address, and picking up a parcel with a missed-delivery slip.
- 田中さん: the full ladder. The right greeting depends on the time of day, then a short chat that changes daily: heading out, the warm weather, rain tomorrow, the cat on the bench, the new bakery, burnable-trash day, or your weekend.
- A lookup popup with reading, meaning, part of speech, the conjugation you saw ("お願いします ← お願いする, polite ます form") and where you met the word.
- The notebook: words by place, words by person, corrections, grammar notes and progress.
- The day loop: morning errands, the day (the clock runs while you walk, and each conversation takes 20 minutes), the night summary and sleep. Sleeping saves to `localStorage`.
- Requests instead of a to-do list. Each morning brings three errands, each asked by someone in town with a reason in simple Japanese (tap any word, or open English under it). Up to two are steps in a regular's story: ゆき runs short of milk before the morning rush, gets a headache, sends postcards home and wants you to try her new latte; 田中さん sends a parcel to their grandchild in Osaka, needs an umbrella and cough medicine, and goes to Tokyo to visit; 山田さん's restaurant clock stops before the new curry; 小林さん is too busy at the post office for lunch. 山田さん joins on day 3 and 小林さん on day 5. Each step thanks you, and the last one ends with a gift that goes on your shelf. The rest are everyday requests, and the scheduler still picks the variant with the most due words underneath. The data is in `data/requests.json`.
- Yen and experience. An errand pays you back what you spent on it plus a reward: ¥500 at stage 1 up to ¥1,300 at stage 4, 15% less for each miss but never under half. A new game starts with ¥5,000. Experience comes as it happens: 2 XP the first time you meet a word, 6 when a word you'd met goes up a level, 10 for an errand and 5 for a clean visit. At night the day's XP is multiplied by your best combo (×1.1 per right answer in a row, up to ×3) and the bonus fills your level bar. Levels are 50, 150, 300, 500 XP and so on. The clock shows your yen and level, with a thin XP bar under it.
- New words are marked with an orange dotted underline and a small sparkle wherever they appear, in lines, choices, tiles and the errand list, until you look them up or use them in a right answer.
- Saves from before yen rewards still load: they keep their money, and experience is worked out from the words they already know.
- Effects that make answering feel good, drawn with CSS and one canvas, no libraries: a right answer pops with sparkles and a +N that rises from the speaker's name tag; a wrong one wobbles, and the right option glows (or, for tiles and typing, the right sentence appears under yours in green). A streak badge, ×N combo, heats from yellow to red and throws embers, with confetti every fifth right answer, and cracks off when the streak breaks. Tiles lift and tilt toward the pointer and snap into place. Paying sends coins and -¥N off the clock. Words you'd met before that go up a level flip in as cards. A promotion and finishing every errand flash and shake the town with confetti. At night a results card counts up errands, clean visits, new words and level-ups, multiplies by your best combo and stamps a total. With reduced motion turned on, the shakes, particles and bounces are off and only fades remain.

**Not built yet**

- Voice, audio and music.
- A morphological analyser (kuromoji or Sudachi) and a real dictionary (JMdict). Lines are segmented by hand and `vocab.json` has 297 entries.

## Please get the Japanese reviewed

All of the Japanese here was written without a native speaker: lines, readings, glosses, grammar notes, and which answers count as natural or rude. That includes the restaurant, station and post office, which are the newest and least checked, and the konbini, pharmacy and 田中さん conversations just before them. Have a native speaker go through `data/` before anyone learns from it. The newest lines are the requests in `data/requests.json`: please check 牛乳が足りません, 孫に荷物を送りたいです, 孫に会いに東京へ行きます, 店の時計が止まりました, これで新しいカレーが作れます, 飲みに来てください, 食べに来てください, 話しましょう and the thank-you lines (助かりました, 家族も喜びます, 元気が出ます), and the readings 牛乳 (ぎゅうにゅう), 市場 (いちば), 記念切手 (きねんきって) and 鉢植え (はちうえ). The places most likely to need a second look are the casual lines at friendship level 2, the shop staff's 敬語 (お探しですか, よろしいですか, お付けしますか), how the pharmacist reads out a dosage, 田中さん's small talk, and which wrong answers get a puzzled reaction and which get a recast. In the new places, please check: the server's 何名様ですか, お待たせしました and お会計はご一緒ですか; whether staff still ask 禁煙席と喫煙席 today; the station window's opening どちらまでですか and 片道ですか、往復ですか; 横浜行きは何番線ですか and 快速は品川に止まりますか; the post office's 航空便と船便、どちらになさいますか, 中身は何ですか and 身分証明書はお持ちですか; 荷物を取りに来ました at the counter; and the readings 一枚, 五枚, 何番線, 二か月 and 分 (shown as ふん).

## Art

All the art is original and drawn in code: the palette is in `src/town/palette.ts`, the characters are 16×16 character maps in `src/town/sprites.ts`, the street, shops and park are drawn by `src/town/art.ts`, and the insides by `src/town/roomart.ts` from the room maps in `src/town/rooms.ts`. The effects are in `src/ui/fx.ts` and `www/style.css`, with colours from the same palette. The look ("style D": full-colour handheld, soft shading, a plum outline and a blue rounded window frame) was picked from four mockups kept in `mockups/`. No fonts or images are bundled; Japanese text uses the system's Japanese font.

## Notes

- The design first suggested Phaser and Vite. This version uses plain TypeScript instead, with as little framework as possible.
- The game was tested in headless Chromium with Playwright, through a script kept outside this repo. It walked the town tile by tile, checked that walls and fences block, looked up a shop sign and the 準備中 plate, clicked a shop and the neighbour to walk over to them, played every scenario, pushed the cafe from stage 1 to stage 4 and played the fill-in stage, then checked that sleep, reload and Continue restore the save. A second script played every variant of every place at every stage, 1 to 4, on a 390-pixel phone screen, using the real choice menu, tiles and typing, and checked for exactly 3 options, unfilled slots and sideways overflow. `npm test` does the same walk through the engine alone. Safari wasn't tested: WebKit couldn't be installed in the environment it was built in. If you want that as part of the repo, a `test/e2e` folder with Playwright as a dev dependency would be the next step.
- `globalThis.__kotomachi` exposes the game object in the browser console for debugging, for example `__kotomachi.debugState()` or `__kotomachi.debugGoTo('cafe')`.
