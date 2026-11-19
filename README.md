# ことまち (Kotomachi)

A small top-down town where you learn Japanese by living there. There's no farming and no dungeon. Each day you get a few errands, like buying a latte at the cafe, picking up onigiri at the konbini, getting eye drops at the pharmacy or greeting your neighbour. Each errand is a real conversation in Japanese. At night your notebook collects the words you met, the mistakes you made and the grammar you ran into. Sleeping saves the game.

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
- **Interact:** walk up into a door, or press Space, E or Enter at a door or next to 田中さん.
- **Look a word up:** click or tap it, in dialogue, on signs, in the errands list or in the notebook.
- **Talk:** lines type out a letter at a time. Enter, Space or a click on the text shows the whole line at once.
- **Answer:** move the ▶ with the arrow keys and press Enter, or click a row, or press its number. With tiles, tap them in order, then press "Say it". In a fill-in blank, type romaji and press Enter. Capital letters give katakana, so `HOTTO` gives ホット.
- **Notebook:** N, or the Notebook button. **Go home:** the button, or walk into the アパート door.

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

There's no framework. The town is a 32×13 grid of 16 px tiles. All the art is drawn in code as pixel data at 1×, into a 320×208 view that follows you sideways, then scaled up by a whole number so pixels stay square and crisp. Sign lettering, furigana and the "Space ▶" hint are drawn on top at full resolution, so they stay readable at any size. Dialogue, the notebook and popups are plain DOM built with a tiny `h()` helper. The romaji converter and the FSRS scheduler are written from scratch as separate modules, with no wanakana and no ts-fsrs, so either can be swapped for a library later without touching anything else.

### Lines and words

Every Japanese line in `data/` is already split into words: `紅茶 を お願いします=お願いする 。`. A token is written as `surface=dictionary form` when the two differ, and `{漢字|かんじ}` overrides the reading where needed. Furigana come from the dictionary entry's reading, so content authors never write it by hand. `npm test` runs `validateContent()`, which checks that every line parses, every word is in `vocab.json`, and every node, slot and grammar id exists.

### The ladder

Each conversation (scenario) is a set of nodes. Each node can be played at any rung:

1. Multiple choice with furigana and an optional English gloss.
2. Multiple choice in Japanese only. A wrong answer gets an in-character reaction, and you try again with that option gone.
3. Word tiles with decoys.
4. Fill in the blank: you type the missing part in romaji and it becomes kana.
5. Freeform. The interface exists (`src/judge/freeform.ts`), but no judge is wired in.
6. Voice is out of scope.

A scenario moves up a rung after **3 clean visits**. After **2 misses on one node** that node quietly drops back a rung for the rest of the visit. The NPC recasts your mistake the right way ("お願いします？ はい、ラテですね"), the conversation carries on, and the correction goes to the notebook.

### What you know

Words are tracked by dictionary form, with two tracks: meaning (do you understand it) and written form (can you read the kanji). Each word moves through unseen, seen, recognized and produced. Both tracks are scheduled with FSRS, using in-game days as time. Looking a word up mid-conversation lowers the credit for that answer, and looking one up while walking around counts as a lapse. Furigana fade per word once the written track's stability reaches 6 days. Errands are picked from the scenario variants whose words are most due.

Only the barista, ゆき, has a friendship meter, and it changes how she talks. At first she uses です/ます. At "acquaintance" (3 points) she adds casual asides, and at "friend" (7 points) she switches to plain form. Answering her in plain form before you're friends puzzles her and costs a point.

All of these numbers are constants at the top of `src/scenario/engine.ts` and `src/learner/model.ts`.

## What's implemented and what's stubbed

**Playable now**

- A walkable street with an apartment, cafe, konbini, pharmacy, station, park and a neighbour (田中さん) who walks back and forth. Shops keep opening hours: the pharmacy shows 準備中 before 9:00.
- Cafe: the full ladder, stages 1 to 4, with four drinks, three sizes, hot or iced, for here or to go, a payment step and small talk that changes with friendship.
- Konbini and pharmacy: stage 1 for now, with variants (bento heating, bags, cold medicine, headache tablets, eye drops).
- A neighbour greeting where the right greeting depends on the time of day.
- A lookup popup with reading, meaning, part of speech, the conjugation you saw ("お願いします ← お願いする, polite ます form") and where you met the word.
- The notebook: words by place, words by person, corrections, grammar notes and progress.
- The day loop: morning errands, the day (the clock runs while you walk, and each conversation takes 20 minutes), the night summary and sleep. Sleeping saves to `localStorage`.

**Not built yet**

- The freeform judge (stage 5). The `FreeformJudge` interface and an `UnavailableJudge` are in place, so the engine never offers that stage.
- Voice, audio and music.
- Stages 2 to 4 at the konbini and pharmacy. The data format supports them, and their nodes just need tiles and blanks written.
- A morphological analyser (kuromoji or Sudachi) and a real dictionary (JMdict). Lines are segmented by hand and `vocab.json` has 124 entries.
- Indoor maps. Going into a shop opens the conversation window over the street.

## Please get the Japanese reviewed

All of the Japanese here, including lines, readings, glosses, grammar notes and which answers count as natural or rude, was written without a native speaker. Have a native speaker go through `data/` before anyone learns from it. The places most likely to need a second look are the casual lines at friendship level 2, the 敬語 at the pharmacy, and which wrong answers get a puzzled reaction and which get a recast.

## Art

All the art is original and drawn in code: the palette is in `src/town/palette.ts`, the characters are 16×16 character maps in `src/town/sprites.ts`, and the street, shops and park are drawn by `src/town/art.ts`. The look ("style D": full-colour handheld, soft shading, a plum outline and a blue rounded window frame) was picked from four mockups kept in `mockups/`. No fonts or images are bundled; Japanese text uses the system's Japanese font.

## Notes

- The design first suggested Phaser and Vite. This version uses plain TypeScript instead, with as little framework as possible.
- The game was tested in headless Chromium with Playwright, through a script kept outside this repo. It walked the town tile by tile, checked that walls and fences block, looked up a shop sign and the 準備中 plate, clicked a shop and the neighbour to walk over to them, played every scenario, pushed the cafe from stage 1 to stage 4 and played the fill-in stage, then checked that sleep, reload and Continue restore the save. If you want that as part of the repo, a `test/e2e` folder with Playwright as a dev dependency would be the next step.
- `globalThis.__kotomachi` exposes the game object in the browser console for debugging, for example `__kotomachi.debugState()` or `__kotomachi.debugGoTo('cafe')`.
