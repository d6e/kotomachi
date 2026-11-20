// Ties everything together: the day loop (morning errands, the day in town, the night
// notebook, sleep and save), scenario runs, lookups and the HUD.

import { Input } from '../engine/input.ts';
import { startLoop } from '../engine/loop.ts';
import { UnavailableJudge, type FreeformJudge } from '../judge/freeform.ts';
import { lemmasOf, parseLine, plainText, type Token } from '../lang/markup.ts';
import { Learner, type WordStatus } from '../learner/model.ts';
import { finishRun, greetSlots, MODE_NAMES, periodOf, ScenarioRun } from '../scenario/engine.ts';
import type { Mode, NpcId, PlaceId, ScenarioDef, VariantDef } from '../scenario/types.ts';
import { Town, type Interactable, type Said } from '../town/town.ts';
import { washitsuFor, type Scene } from '../town/rooms.ts';
import type { DoorPlace } from '../town/map.ts';
import { toCanvas } from '../town/pixels.ts';
import { drawScene } from '../town/scenes.ts';
import { drawMemory, isMemoryArt } from '../town/memoryart.ts';
import { itemIcon } from '../town/roomart.ts';
import { allKeepsakes, canOrder, CATALOG, catalogById, homeRoom } from './room.ts';
import { ARRIVAL, canTravel, LAST_TRAIN_OUT, ON_SALE, rideMinutes, SOUVENIRS, type Trip } from './trips.ts';
import { canWaitForDinner, checkIn, checkInVariant, checkOut, CHECK_IN_FROM, CHECK_IN_UNTIL, frontDesk, inYukata, keptOut, roomScenario, roomState, spendable, stayPhase, STAY_PRICE, trainHomeBlocked } from './ryokan.ts';
import { belongings, goodById, goodFor, receive, shelve, SHELF_SIZE, unshelve } from './inventory.ts';
import { addPoints, canGiveToday, chatPoints, finishInvite, friendAt, friendById, FRIENDS, GIFT_POINTS, give, heartsFor, inviteReady, inviteScenario, isFriend, MAX_HEARTS, photoId, PHOTOS, POINTS, pointsOf, tasteOf, toNextHeart, type FriendId, type HeartChange, type InviteDef, type Taste } from './friends.ts';
import { DialogueView } from '../ui/dialogue.ts';
import { clear, h } from '../ui/dom.ts';
import { coins, confetti, countUp, floatText, play, wait } from '../ui/fx.ts';
import { correctionItem, Notebook, type NotebookContext } from '../ui/notebook.ts';
import { Popup } from '../ui/popup.ts';
import { ALWAYS, renderTokens, unmarkNew } from '../ui/text.ts';
import { comboMultiplier, errandPay, levelFor, levelProgress, XP, xpForLevel } from './rewards.ts';
import { chatter, consequences, forms, grammar, npcs, requests, scenarioById, scenarios, vocab, type ChatterLine, type ConsequenceDef, type SceneWho } from './content.ts';
import { boardNotes, isFestival, morningNote, pickChatter, weatherFor } from './weather.ts';
import { pickVariant, planRequests, type Errand } from './errands.ts';
import { DAY_END, DAY_START, isOpen, load, newDayLog, newGame, progressFor, save, clearSave, formatClock, type GameData } from './state.ts';

const yen = (n: number): string => `¥${n.toLocaleString('en-US')}`;

const PLACE_NAMES: Record<string, string> = {
  cafe: 'Cafe', konbini: 'Konbini', pharmacy: 'Pharmacy', restaurant: 'Restaurant', station: 'Station', post: 'Post office', street: 'Street',
  shrine: 'Shrine in Kamakura', omiyage: 'Souvenir shop in Kamakura', matsuri: 'Festival in the park',
  hakone: 'Hakone', ryokan: 'Ryokan in Hakone', washitsu: 'Your room at the ryokan', onsen: 'The big bath at the ryokan',
};
const SCENARIO_FOR: Partial<Record<Scene, string>> = {
  cafe: 'cafe_order', konbini: 'konbini_buy', pharmacy: 'pharmacy_buy', restaurant: 'restaurant_eat', station: 'station_ticket', post: 'post_send',
  shrine: 'shrine_visit', omiyage: 'omiyage_buy', onsen: 'onsen_bath',
};
/** In-game minutes per real second of walking around town. */
const MINUTES_PER_SECOND = 1;
const MINUTES_PER_SCENARIO = 20;
/** An outing with a friend takes an hour. */
const MINUTES_PER_INVITE = 60;
const TASTE_WORDS: Record<Taste, string> = { love: 'loved it', like: 'liked it', ok: 'said thanks', odd: 'was puzzled' };

type Phase = 'title' | 'morning' | 'town' | 'talk' | 'gift' | 'oops' | 'shop' | 'night';

/** Every keepsake there is: thank-you gifts, souvenirs and photos with friends. */
const ALL_KEEPSAKES = [...allKeepsakes(requests, SOUVENIRS), ...PHOTOS];

export class Game {
  private readonly input = new Input();
  private readonly town: Town;
  private readonly popup: Popup;
  private readonly dialogue: DialogueView;
  private readonly notebook: Notebook;
  private readonly hud: HTMLElement;
  private readonly screen: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly judge: FreeformJudge = new UnavailableJudge();
  private g: GameData = newGame();
  private learner = new Learner(this.g.learner, vocab);
  private phase: Phase = 'title';
  private activeRun: ScenarioRun | null = null;
  private hudKey = '';
  /** Right answers in a row today (any wrong answer resets it). */
  private combo = 0;
  /** Errands already shown ticked in the HUD, so a new tick can pop. */
  private shownDone = new Set<string>();
  private readonly levelUps: HTMLElement;
  private metBefore = new Set<string>();
  /** Lines passers-by have said today, so they say something else next. */
  private said = new Set<string>();
  /** Level-up cards held back while a gift or a scene is on screen. */
  private pendingUps: string[] = [];

  constructor(root: HTMLElement) {
    const canvas = h('canvas', { id: 'town', 'aria-label': 'The town. Walk with the arrow keys or WASD, or tap where to go.' });
    this.hud = h('div', { class: 'hud' });
    this.screen = h('div', { class: 'screen', hidden: true });
    this.toastEl = h('div', { class: 'toast', hidden: true, role: 'status' });
    this.levelUps = h('div', { class: 'levelups', 'aria-live': 'polite' });
    const stage = h('div', { class: 'stage-wrap' }, canvas, this.hud);
    root.append(stage, this.screen, this.toastEl, this.levelUps);
    this.town = new Town(canvas, {
      isOpen: (place) => place === 'home' || isOpen(place, this.g.minutes),
      sign: (word) => ({ text: word, furigana: /[㐀-鿿]/.test(word) && this.learner.showFurigana(word, 2) ? (vocab.get(word)?.reading ?? null) : null }),
      onInteract: (t) => this.interact(t),
      onSignClick: (word, x, y) => this.lookup({ surface: word, lemma: word, ruby: [] }, { left: x, top: y, bottom: y }, true),
      neighborAvailable: () => (!this.g.today.greeted || !!inviteReady(this.g, 'tanaka')) && this.g.minutes < 21 * 60,
      busy: () => this.phase !== 'town' || this.notebook.open || this.popup.open,
      staffName: (npc) => (npcs[npc as keyof typeof npcs] ? plainText(parseLine(npcs[npc as keyof typeof npcs].name, vocab)) : ''),
      thingName: (id) => ({ catalog: 'カタログ', shelf: '棚', tickets: '切符', baiten: '売店', rest: 'ゆっくり' })[id],
      chatter: (who) => this.chatterFor(who),
      mayEnter: (place) => {
        const why = keptOut(this.g, place, this.g.minutes);
        if (why) {
          this.toast(why);
          return false;
        }
        this.refreshStay();
        return true;
      },
    });
    const game = this;
    this.popup = new Popup(root, {
      vocab, forms, npcs,
      get learner() {
        return game.learner;
      },
      placeName: (p) => PLACE_NAMES[p] ?? p,
    });
    this.dialogue = new DialogueView(root);
    this.notebook = new Notebook(root);
    this.notebook.onClose = () => this.renderHud(true);
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'KeyN' && (this.phase === 'town')) {
        if (this.notebook.open) this.notebook.close();
        else this.openNotebook();
      }
    });
    // Exposed for automated play-testing in a browser.
    (globalThis as Record<string, unknown>)['__kotomachi'] = this;
  }

  start(): void {
    this.showTitle();
    startLoop((dt) => this.frame(dt));
  }

  // ------------------------------------------------------------------ frame

  private frame(dt: number): void {
    const busy = this.town.paused;
    const { walked } = this.town.update(dt, this.input);
    if (this.phase === 'town' && !busy && walked > 0) {
      this.g.minutes += dt * MINUTES_PER_SECOND;
      if (this.g.minutes >= DAY_END) {
        this.toast(stayPhase(this.g) === 'tonight' ? "It's late. You turn in for the night at the ryokan." : "It's late. You head home.");
        this.goToNight();
      }
      // Dinner time can come round while you walk about your room.
      if (this.town.scene === 'washitsu') this.refreshStay();
    }
    this.town.setMinutes(this.g.minutes);
    this.town.render(dt);
    this.input.endFrame();
    this.renderHud();
  }

  // ------------------------------------------------------------------ helpers

  private toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.hidden = false;
    clearTimeout((this.toastEl as unknown as { _t?: number })._t);
    (this.toastEl as unknown as { _t?: number })._t = window.setTimeout(() => (this.toastEl.hidden = true), 3200);
  }

  private notebookCtx(): NotebookContext {
    return {
      vocab, learner: this.learner, npcs, grammar, scenarios,
      placeName: (p) => PLACE_NAMES[p] ?? p,
      lookup: (t, el) => this.lookup(t, el.getBoundingClientRect(), false),
      things: () => belongings(this.g).map(({ good, count }) => ({
        id: good.id, word: good.word, meaning: this.meaningOf(good.word), count, onShelf: this.g.shelf.includes(good.id), icon: this.icon(good.id, 'keepsake'),
      })),
    };
  }

  private openNotebook(): void {
    this.notebook.show(this.notebookCtx(), this.g);
  }

  /** A word lookup. Outside a conversation (`penalize`) it counts as a failed review once a day. */
  private lookup(t: Token, anchor: { left: number; top: number; bottom: number }, penalize: boolean): void {
    if (!t.lemma || !vocab.has(t.lemma)) return;
    this.popup.show(t, anchor);
    this.g.today.lookups += 1;
    unmarkNew(t.lemma);
    if (this.activeRun) {
      this.activeRun.noteLookup(t.lemma);
      this.learner.lookup(t.lemma, this.g.day, false);
    } else this.learner.lookup(t.lemma, this.g.day, penalize);
  }

  private tokens(markup: string, penalize = true): HTMLElement {
    return renderTokens(parseLine(markup, vocab), {
      furigana: (t) => this.learner.showFurigana(t.lemma, 2),
      onTap: (t, el) => this.lookup(t, el.getBoundingClientRect(), penalize),
      isNew: (t) => this.learner.isFresh(t.lemma),
    });
  }

  // ------------------------------------------------------------------ rewards

  /** Experience, with a little "+N XP" off the level badge, and a fanfare on a new level. */
  private addXp(n: number): void {
    if (n <= 0) return;
    const before = levelFor(this.g.xp);
    this.g.xp += n;
    this.g.today.xp = (this.g.today.xp ?? 0) + n;
    const lv = this.hud.querySelector('.lv');
    if (lv) floatText(lv, `+${n} XP`, 'xp');
    const after = levelFor(this.g.xp);
    if (after > before) this.levelUp(after);
    this.renderHud(true);
  }

  private levelUp(level: number): void {
    this.g.today.promotions.push(`You reached level ${level}.`);
    this.toast(`Level ${level}! Keep it up.`);
    this.celebrate(2, 40);
  }

  /** Yen in, with coins off the clock. */
  private addYen(n: number, label = `+${yen(n)}`): void {
    if (n === 0) return;
    this.g.money += n;
    if (n > 0) this.g.today.yen = (this.g.today.yen ?? 0) + n;
    const clock = this.hud.querySelector('.clock');
    if (clock) {
      const r = clock.getBoundingClientRect();
      if (n > 0) coins(r.left + r.width * 0.7, r.bottom, 8);
      floatText({ x: r.left + r.width * 0.7, y: r.bottom + 14 }, label, n > 0 ? 'money gain' : 'money');
    }
  }

  /** A small name tag for whoever asked: ゆき, 田中さん... */
  private asker(e: Errand): HTMLElement | null {
    if (!e.from || !npcs[e.from]) return null;
    return h('span', { class: `asker${e.arc ? ' story' : ''}` }, this.tokens(npcs[e.from].name, false));
  }

  private showScreen(...children: (Node | null)[]): void {
    clear(this.screen);
    this.screen.append(h('div', { class: 'card' }, ...children.filter((c): c is Node => c !== null)));
    this.screen.hidden = false;
  }

  private hideScreen(): void {
    this.screen.hidden = true;
    clear(this.screen);
  }

  // ------------------------------------------------------------------ HUD

  private renderHud(force = false): void {
    const key = `${this.phase}|${Math.floor(this.g.minutes / 10)}|${this.g.money}|${this.g.xp}|${this.g.errands.map((e) => (e.done ? 1 : e.missed ? 2 : 0)).join()}|${this.g.day}|${stayPhase(this.g)}`;
    if (!force && key === this.hudKey) return;
    this.hudKey = key;
    clear(this.hud);
    if (this.phase === 'title') return;
    const errands = h('ul', { class: 'errands' }, this.g.errands.map((e) => {
      const key = `${e.scenario}/${e.variant}`;
      const fresh = e.done && !this.shownDone.has(key);
      if (e.done && this.phase === 'town') this.shownDone.add(key);
      if (e.missed) return h('li', { class: 'missed' }, h('span', { class: 'box' }, '↻'), this.asker(e), this.tokens(e.text), h('span', { class: 'again' }, 'tomorrow'));
      return h('li', { class: (e.done ? 'done' : '') + (fresh && this.phase === 'town' ? ' just-done' : '') }, h('span', { class: 'box' }, e.done ? '✓' : ''), this.asker(e), this.tokens(e.text));
    }));
    this.hud.append(
      h('div', { class: 'hud-top' },
        h('div', { class: 'clock' },
          `Day ${this.g.day} · ${formatClock(this.g.minutes)} · `, h('span', { class: 'yen' }, yen(this.g.money)), ' ',
          h('span', { class: 'lv', title: `${this.g.xp - xpForLevel(levelFor(this.g.xp))} / ${xpForLevel(levelFor(this.g.xp) + 1) - xpForLevel(levelFor(this.g.xp))} XP to the next level` }, `Lv ${levelFor(this.g.xp)}`),
          h('span', { class: 'xpbar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round(levelProgress(this.g.xp) * 100)}%` })),
        ),
        h('button', { class: 'hud-btn', onclick: () => this.openNotebook(), title: 'Notebook (N)' }, 'Notebook'),
        stayPhase(this.g) === 'tonight'
          ? h('button', { class: 'hud-btn', onclick: () => this.confirmSleep(), title: 'Go to bed at the ryokan' }, 'Go to bed')
          : h('button', { class: 'hud-btn', onclick: () => this.confirmSleep(), title: 'Go home and sleep' }, 'Go home'),
      ),
    );
    // The errands list is for walking around; during a conversation it would sit under the panel.
    if (this.phase === 'town') this.hud.append(h('div', { class: 'hud-errands' }, h('div', { class: 'label' }, "Today's errands"), errands));
  }

  // ------------------------------------------------------------------ phases

  private showTitle(): void {
    this.phase = 'title';
    const saved = load();
    const card = [
      h('h1', { lang: 'ja' }, 'ことまち'),
      h('p', { class: 'lede' }, 'A small shopping street where every errand is a Japanese lesson.'),
      h('div', { class: 'row' },
        saved ? h('button', { class: 'primary', onclick: () => this.begin(saved) }, `Continue (day ${saved.day})`) : null,
        h('button', { class: saved ? '' : 'primary', onclick: () => (saved ? this.confirmNewGame(saved.day) : this.startNewGame()) }, 'New game'),
      ),
      h('ul', { class: 'howto' },
        h('li', {}, 'Walk with the arrow keys or WASD, or tap where you want to go. Walk into a door (or tap a shop) to go inside, then talk to whoever works there.'),
        h('li', {}, 'Tap any Japanese word for its reading, meaning and where you met it. Looking a word up counts as not knowing it yet.'),
        h('li', {}, 'Conversations start as multiple choice. Three clean visits move a place up a stage: Japanese only, then word tiles, then typing.'),
        h('li', {}, 'Your notebook (N) keeps words by place and person, plus the corrections from each day. Sleeping saves the game.'),
      ),
    ];
    this.showScreen(...card);
  }

  /**
   * Asked on the page itself: the game runs in a sandboxed frame where the browser's
   * confirm() is blocked and returns false at once, so it must never be used.
   */
  private ask(question: string, yes: string, no: string, onYes: () => void, onNo: () => void): void {
    this.showScreen(
      h('p', { class: 'ask' }, question),
      h('div', { class: 'row' },
        h('button', { onclick: onNo }, no),
        h('button', { class: 'primary', onclick: onYes }, yes),
      ),
    );
  }

  private confirmNewGame(day: number): void {
    this.ask(`Start over from day 1? Your saved game (day ${day}) will be deleted.`, 'Start over', 'Keep my game', () => this.startNewGame(), () => this.showTitle());
  }

  private startNewGame(): void {
    clearSave();
    this.begin(newGame());
  }

  private begin(g: GameData): void {
    this.g = g;
    this.combo = 0;
    this.shownDone = new Set(g.errands.filter((e) => e.done).map((e) => `${e.scenario}/${e.variant}`));
    this.learner = new Learner(this.g.learner, vocab);
    this.refreshHome();
    this.town.invalidate();
    // A night at the ryokan that's long over (from a save that skipped a day) is dropped.
    if (this.g.stay && stayPhase(this.g) === 'none') delete this.g.stay;
    this.wake();
    this.setDay();
    if (this.g.errands.length === 0) this.planDay();
    this.showMorning();
  }

  private planDay(): void {
    const recent = (this.g.recentErrands ??= {});
    // A request that went wrong yesterday comes back first, for another go.
    const carried = this.g.errands.filter((e) => e.missed && !e.done).map((e) => ({ ...e, missed: false, retry: true }));
    this.g.errands = planRequests({ defs: scenarios, requests, arcs: this.g.arcs, learner: this.learner, vocab, day: this.g.day, recent, carried, level: levelFor(this.g.xp) });
    for (const e of this.g.errands) recent[`${e.scenario}/${e.variant}`] = this.g.day;
  }

  private showMorning(): void {
    this.phase = 'morning';
    const due = this.learner.dueWords(this.g.day).length;
    this.showScreen(
      h('h2', {}, `Day ${this.g.day} · Morning`),
      h('p', {}, stayPhase(this.g) === 'morning'
        ? 'You wake up on the futon at the ryokan in 箱根, and breakfast (朝ご飯) is brought to your room. Check out at the front desk before you take the train home.'
        : this.g.day === 1
        ? 'You just moved into an apartment on this shopping street, and your new neighbours already have a few favours to ask.'
        : due > 0
          ? `${due} word${due === 1 ? ' is' : 's are'} due for review. Today's errands were picked to bring them up.`
          : "Here's who could use a hand today."),
      this.dayNote(),
      this.inviteNote(),
      h('ul', { class: 'requests' }, this.g.errands.map((e) => h('li', { class: e.arc ? 'story' : '' },
        h('div', { class: 'req-who' }, this.asker(e), e.arc ? h('span', { class: 'req-tag' }, this.storyLabel(e)) : null, e.retry ? h('span', { class: 'req-tag again' }, 'Another go') : null),
        e.reason ? h('div', { class: 'req-reason' }, this.tokens(e.reason)) : null,
        e.reasonEn ? h('details', { class: 'req-en' }, h('summary', {}, 'English'), e.reasonEn) : null,
        h('div', { class: 'req-task' }, h('span', { class: 'box' }), this.tokens(e.text)),
      ))),
      h('p', { class: 'muted' }, 'Tap a word you don\'t know. Each errand pays back what you spend, plus a reward. Opening hours: cafe 8:00–18:00, pharmacy 9:00–19:00, post office 9:00–17:00, restaurant 11:00–22:00. The konbini and the station are always open.'
        + this.trainNote()),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => this.goToTown() }, 'Head out ▶')),
    );
  }

  /** Where the trains go, once you can buy a ticket. */
  private trainNote(): string {
    const towns = ON_SALE.filter((t) => levelFor(this.g.xp) >= t.level).map((t) => t.name);
    if (!towns.length) return '';
    return ` Trains to ${towns.join(' and ')} leave the station until ${formatClock(LAST_TRAIN_OUT)}.`;
  }

  /** Friends who'd like to take you somewhere, and where to find them. */
  private inviteNote(): HTMLElement | null {
    const ready = FRIENDS.filter((f) => inviteReady(this.g, f.id));
    if (!ready.length) return null;
    return h('ul', { class: 'invites' }, ready.map((f) => h('li', { class: 'invite-note' },
      h('span', { class: 'invite-heart', 'aria-hidden': 'true' }, '♥'),
      this.tokens(npcs[f.id].name, false),
      ` would like to invite you somewhere. ${f.place === 'street' ? 'Say hello on the street.' : `Talk to ${plainText(parseLine(npcs[f.id].name, vocab))} at the ${PLACE_NAMES[f.place]!.toLowerCase()}.`}`)));
  }

  /** Today's weather, the festival, or that it's tomorrow, in Japanese with the English under it. */
  private dayNote(): HTMLElement {
    const n = morningNote(this.g.day);
    return h('div', { class: `day-note${isFestival(this.g.day) ? ' festival' : ''}` }, this.tokens(n.jp), h('div', { class: 'muted' }, n.en));
  }

  /** The weather and the festival for the town, from the day. */
  private setDay(): void {
    this.said.clear();
    this.town.setDay({ weather: weatherFor(this.g.day), festival: isFestival(this.g.day) });
  }

  /** What someone in town says, with furigana where you still need it and due words marked. */
  private chatterFor(who: string): Said | null {
    let line: ChatterLine | null;
    if (who === 'cat') line = chatter.cat;
    else if (who.startsWith('stall:')) line = chatter.stalls[who.slice(6)] ?? null;
    else
      line = pickChatter(chatter.street, {
        day: this.g.day,
        minutes: this.g.minutes,
        isDue: (w) => this.learner.isDue(w, this.g.day),
        said: this.said,
        lemmas: (l) => lemmasOf(parseLine(l.text, vocab)),
        random: Math.random,
      });
    if (!line) return null;
    this.said.add(line.text);
    return {
      en: line.en,
      words: parseLine(line.text, vocab).map((t) => {
        const known = !!t.lemma && vocab.has(t.lemma);
        const ruby = known && this.learner.showFurigana(t.lemma, 2);
        return { parts: t.ruby.map((p) => (ruby && p.rt ? { text: p.text, rt: p.rt } : { text: p.text })), lemma: known ? t.lemma : null, due: known && this.learner.isDue(t.lemma!, this.g.day) };
      }),
    };
  }

  /** The notice board on the street: today's weather, and when the festival is. */
  private showBoard(): void {
    this.phase = 'shop';
    const title = parseLine('掲示板', vocab);
    this.seeAll(title, 'street', 'tanaka');
    this.showScreen(
      h('h2', {}, renderTokens(title, { furigana: ALWAYS, onTap: (t, el) => this.lookup(t, el.getBoundingClientRect(), false) })),
      h('ul', { class: 'notices' }, boardNotes(this.g.day).map((n) => {
        this.seeAll(parseLine(n.jp, vocab), 'street', 'tanaka');
        return h('li', { class: 'notice' }, this.tokens(n.jp, false), h('div', { class: 'muted' }, n.en));
      })),
      h('div', { class: 'row' }, h('button', { onclick: () => this.goToTown() }, 'Close')),
    );
  }

  private storyLabel(e: Errand): string {
    const arc = requests.arcs.find((a) => a.id === e.arc);
    return arc ? `Story ${(e.step ?? 0) + 1}/${arc.steps.length}` : '';
  }

  private goToTown(): void {
    this.hideScreen();
    this.phase = 'town';
    this.input.clear();
    this.renderHud(true);
    if (this.pendingUps.length) {
      this.showLevelUps(this.pendingUps);
      this.pendingUps = [];
    }
  }

  private confirmSleep(): void {
    if (this.phase !== 'town') return;
    const left = this.g.errands.filter((e) => !e.done && !e.missed).length;
    const where = stayPhase(this.g) === 'tonight' ? 'Go to bed at the ryokan' : 'Go home';
    if (left === 0) return this.goToNight();
    this.phase = 'shop';
    this.ask(`${left} errand${left === 1 ? '' : 's'} left. ${where} and end the day?`, where, 'Not yet', () => this.goToNight(), () => this.goToTown());
  }

  private interact(t: Interactable): void {
    if (this.phase !== 'town') return;
    if (t.kind === 'npc') return inviteReady(this.g, 'tanaka') ? this.startInvite('tanaka') : this.startScenario(scenarioById['neighbor_greet']!);
    if (t.kind === 'bed') return this.confirmSleep();
    if (t.kind === 'train') return this.rideHome();
    if (t.kind === 'board') return this.showBoard();
    if (t.kind === 'stall') {
      if (t.id === 'kingyo') this.startScenario(scenarioById['festival_kingyo']!);
      return;
    }
    if (t.kind === 'cat') return;
    if (t.kind === 'thing') {
      if (t.id === 'catalog') return this.showCatalog();
      if (t.id === 'shelf') return this.showShelf();
      if (t.id === 'tickets') return this.showTrips();
      if (t.id === 'baiten') return this.startScenario(scenarioById['ryokan_baiten']!);
      if (t.id === 'rest') return this.restInRoom();
      return;
    }
    if (t.kind === 'staff' && t.place === 'ryokan') return this.atFrontDesk();
    if (t.kind === 'staff' && t.place === 'washitsu') {
      const id = roomScenario(this.g, this.g.minutes);
      if (id) this.startScenario(scenarioById[id]!);
      return;
    }
    if (t.place === 'home') return this.town.enter('home');
    if (!isOpen(t.place, this.g.minutes)) {
      this.toast(`準備中: the ${PLACE_NAMES[t.place]!.toLowerCase()} is closed right now.`);
      return;
    }
    // Walking into a door goes inside; talking to whoever works there starts the errand.
    if (t.kind === 'door') return this.town.enter(t.place);
    const id = SCENARIO_FOR[t.place];
    // A friend who's ready to invite you asks first, unless you're there on an errand.
    const friend = friendAt(t.place);
    if (friend && inviteReady(this.g, friend) && !this.g.errands.some((e) => e.scenario === id && !e.done && !e.missed)) return this.startInvite(friend);
    if (id) this.startScenario(scenarioById[id]!);
  }

  private startInvite(friend: FriendId): void {
    const invite = inviteReady(this.g, friend);
    const def = scenarioById[inviteScenario(friend)];
    if (invite && def) this.startScenario(def, invite.variant);
  }

  /** Things you could give a friend: anything you have that isn't a keepsake. */
  private giftable(): { id: string; word: string; count: number }[] {
    return belongings(this.g).filter((b) => !b.good.keepsake).map((b) => ({ id: b.good.id, word: b.good.word, count: b.count }));
  }

  /** Pick something from your things to give. */
  private showGiftPicker(friend: FriendId): void {
    this.phase = 'shop';
    const name = plainText(parseLine(npcs[friend].name, vocab));
    const given = this.g.giftsGiven?.[friend] ?? [];
    const rows = this.giftable().map((item) => h('li', { class: 'shelf-item' },
      this.icon(item.id, 'keepsake'),
      h('div', { class: 'cat-word' },
        renderTokens(parseLine(item.word, vocab), { furigana: ALWAYS, onTap: (t, el) => this.lookup(t, el.getBoundingClientRect(), false), isNew: (t) => this.learner.isFresh(t.lemma) }),
        h('div', { class: 'muted' }, this.meaningOf(item.word), item.count > 1 ? ` · ×${item.count}` : '',
          given.includes(item.id) ? ` · ${name} ${TASTE_WORDS[tasteOf(friend, item.id)]} last time` : '')),
      h('div', { class: 'cat-buy' }, h('button', { class: 'primary small', onclick: () => this.giveGift(friend, item.id) }, 'Give')),
    ));
    this.showScreen(
      h('h2', {}, 'A present for ', this.tokens(npcs[friend].name, false)),
      h('p', { class: 'muted' }, `One present a day. Everyone has favourites: what ${name} loves counts for more.`),
      h('ul', { class: 'catalog shelf' }, rows),
      h('div', { class: 'row' }, h('button', { onclick: () => this.goToTown() }, 'Not now')),
    );
  }

  private giveGift(friend: FriendId, id: string): void {
    const good = goodById[id];
    const base = scenarioById['gift_give'];
    if (!good || !base) return;
    const taste = give(this.g, friend, id);
    if (!taste) return;
    this.refreshHome();
    this.hideScreen();
    this.phase = 'town';
    const place = friendById[friend].place as PlaceId;
    const def: ScenarioDef = { ...base, npc: friend, place };
    const v = base.variants.find((x) => x.id === taste)!;
    const variant: VariantDef = { ...v, slots: { ...v.slots, item: good.word, item_en: this.meaningOf(good.word) } };
    this.startScenario(def, undefined, variant);
  }

  private startScenario(def: ScenarioDef, variantId?: string, variantOverride?: VariantDef): void {
    // Words already met before this conversation: only these can "level up" at its end.
    this.metBefore = new Set(vocab.all().filter((e) => this.learner.status(e.id) !== 'unseen').map((e) => e.id));
    const errand = this.g.errands.find((e) => e.scenario === def.id && !e.done && !e.missed);
    // On a trip, the shop shows you a souvenir you haven't got yet.
    const unowned = SOUVENIRS.find((s) => s.scenario === def.id && s.variant && !this.g.keepsakes.includes(s.id))?.variant;
    const variant = variantOverride ?? def.variants.find((v) => v.id === (variantId ?? errand?.variant ?? unowned)) ?? pickVariant(def, this.learner, vocab, this.g.day + this.g.minutes);
    if (variant.price && variant.price > this.g.money) {
      this.toast("You don't have enough money for that.");
      return;
    }
    // At the ryokan, keep enough back to pay for the night when you check out.
    if (def.id === 'ryokan_baiten' && variant.price && variant.price > spendable(this.g)) {
      this.toast(`Keep ${yen(STAY_PRICE)} back for your stay: you pay for the night when you check out.`);
      return;
    }
    const progress = progressFor(this.g, def.id);
    const period = periodOf(this.g.minutes);
    const friend = isFriend(def.npc) ? def.npc : undefined;
    const friendship = friend ? pointsOf(this.g, friend) : 0;
    // After an ordinary chat with a friend you can give them something from your things.
    const special = def.id.startsWith('invite_') || def.id === 'gift_give';
    const extra = friend && !special && canGiveToday(this.g, friend) && this.giftable().length ? { id: 'give', label: 'Give something' } : undefined;
    const run = new ScenarioRun({ def, variant, stage: progress.stage, friendship, period, vocab, judge: this.judge, extraSlots: greetSlots(period) });
    this.activeRun = run;
    this.phase = 'talk';
    this.popup.hide();
    const npc = npcs[def.npc];
    this.dialogue.start(run, {
      vocab,
      npcName: npc.name,
      placeName: PLACE_NAMES[def.place] ?? def.place,
      furigana: (t, mode) => this.learner.showFurigana(t.lemma, mode),
      lookup: (t, el) => this.lookup(t, el.getBoundingClientRect(), false),
      seen: (tokens) => {
        let fresh = 0;
        for (const l of lemmasOf(tokens)) {
          if (this.learner.see(l, { day: this.g.day, place: def.place, npc: def.npc })) {
            this.g.today.newWords.push(l);
            fresh++;
          }
        }
        this.addXp(fresh * XP.newWord);
      },
      isNew: (t) => this.learner.isFresh(t.lemma),
      glossOn: () => this.g.settings.gloss,
      setGloss: (on) => (this.g.settings.gloss = on),
      done: (r, then) => this.finishScenario(r, then),
      hearts: friend ? heartsFor(friendship) : undefined,
      extra,
      answered: (ok, said) => {
        if (ok) for (const l of lemmasOf(said)) {
          this.learner.markKnown(l, this.g.day);
          unmarkNew(l);
        }
        this.combo = ok ? this.combo + 1 : 0;
        this.g.today.bestCombo = Math.max(this.g.today.bestCombo ?? 0, this.combo);
        return this.combo;
      },
      combo: () => this.combo,
    });
  }

  private finishScenario(run: ScenarioRun, then?: string): void {
    const def = run.def;
    const changes: HeartChange[] = [];
    const bump = (npc: FriendId, n: number) => {
      const c = addPoints(this.g, npc, n);
      if (c) changes.push(c);
    };
    this.activeRun = null;
    // Furigana visibility as it was during the conversation.
    const shownBefore = new Map<string, Set<string>>();
    for (const ev of run.evidence) {
      const set = new Set<string>();
      for (const w of [...ev.targets, ...ev.answerWords]) if (this.learner.showFurigana(w, ev.mode)) set.add(w);
      shownBefore.set(ev.nodeId, set);
    }
    // Which words go up a level in this conversation, to show as cards afterwards.
    const words = new Set(run.evidence.flatMap((ev) => [...ev.targets, ...ev.answerWords]));
    const before = new Map([...words].map((w) => [w, this.learner.status(w)]));
    for (const ev of run.evidence) {
      this.learner.applyEvidence(ev, { day: this.g.day + this.g.minutes / 1440, furiganaShown: (id) => shownBefore.get(ev.nodeId)!.has(id) });
    }
    const RANK: Record<WordStatus, number> = { unseen: 0, seen: 1, recognized: 2, produced: 3 };
    // Only words you'd met before count: a brand-new word is counted as new instead.
    const ups = [...words].filter((w) => this.metBefore.has(w) && RANK[this.learner.status(w)] > RANK[before.get(w)!] && RANK[this.learner.status(w)] >= 2);
    this.g.today.levelUps = (this.g.today.levelUps ?? 0) + ups.length;
    if (run.clean) this.g.today.clean = (this.g.today.clean ?? 0) + 1;
    for (const node of Object.values(def.nodes)) {
      for (const gid of node.grammar ?? []) if (!this.g.grammarSeen.includes(gid)) this.g.grammarSeen.push(gid);
    }
    for (const c of run.corrections) {
      this.g.today.corrections.push(c);
      this.g.corrections.push({ ...c, day: this.g.day });
      if (c.grammar && !this.g.grammarSeen.includes(c.grammar)) this.g.grammarSeen.push(c.grammar);
    }
    if (this.g.corrections.length > 300) this.g.corrections.splice(0, this.g.corrections.length - 300);

    // An errand is paid for by whoever asked: what you spent comes back, plus a reward.
    const errand = this.g.errands.find((e) => e.scenario === def.id && e.variant === run.variant.id && !e.done && !e.missed);
    const scene = run.consequence ? consequences[run.consequence] : undefined;
    if (errand && scene) {
      // It went wrong: whoever asked covers what you spent, there's no reward today, and
      // the request comes back tomorrow.
      errand.missed = true;
    } else if (errand) {
      const pay = errandPay(run.stage, run.corrections.length, run.moneySpent, errand.retry);
      this.g.money -= run.moneySpent;
      this.addYen(pay.reward + pay.refund, `+${yen(pay.reward)}`);
      this.g.today.yen = (this.g.today.yen ?? 0) - pay.refund;
    } else if (run.moneySpent > 0) this.addYen(-run.moneySpent, `-${yen(run.moneySpent)}`);
    // Friendship: a present or an outing counts in full; chatting counts a little a day.
    const friend = isFriend(def.npc) ? def.npc : undefined;
    let invite: InviteDef | undefined;
    if (friend && def.id === 'gift_give') bump(friend, GIFT_POINTS[run.variant.id as Taste] + Math.min(0, run.friendshipDelta));
    else if (friend && def.id === inviteScenario(friend) && run.ended) {
      invite = friendById[friend].invites.find((i) => i.variant === run.variant.id);
      finishInvite(this.g, friend);
      bump(friend, POINTS.invite + Math.min(0, run.friendshipDelta));
    } else if (friend) bump(friend, chatPoints(this.g, friend, run.friendshipDelta));
    if (def.id === 'neighbor_greet') this.g.today.greeted = true;
    // A catalog order: it's in your room when you get home.
    const ordered = def.id === 'post_catalog' && run.ended && !run.consequence ? catalogById[run.variant.id] : undefined;
    if (ordered && !this.g.furniture.includes(ordered.id)) {
      this.g.furniture.push(ordered.id);
      this.refreshHome();
    }
    // Whatever you bought, for yourself or for someone, is yours to keep: it goes in your
    // things, and a souvenir goes straight on the shelf.
    const good = run.ended && !run.consequence ? goodFor(def.id, run.variant.id) : undefined;
    const firstKeepsake = good?.keepsake && !this.g.keepsakes.includes(good.id) ? good : undefined;
    const firstGood = good && receive(this.g, good.id) ? good : undefined;
    if (firstKeepsake) {
      this.g.today.promotions.push(`${firstKeepsake.id === 'kingyo' ? 'A keepsake' : 'A souvenir'} for your shelf: ${this.meaningOf(firstKeepsake.word)}.`);
      this.refreshHome();
    }

    const progress = progressFor(this.g, def.id);
    const { progress: next, promoted } = invite ? { progress, promoted: false } : finishRun(progress, run.clean, def.maxStage);
    this.g.progress[def.id] = next;
    if (invite) {
      // The outing says it all.
    } else if (def.id === 'gift_give') {
      this.toast(`${plainText(parseLine(npcs[def.npc].name, vocab))} ${TASTE_WORDS[run.variant.id as Taste]}.`);
    } else if (promoted) {
      const msg = `${def.title}: now stage ${next.stage}, ${MODE_NAMES[next.stage as Mode].toLowerCase()}.`;
      this.g.today.promotions.push(msg);
      this.toast(msg);
      this.celebrate(2.5, 50);
    } else if (scene) {
      // The scene says it all.
    } else if (ordered) {
      this.toast(`Ordered: ${vocab.get(ordered.word)?.meaning ?? ordered.word}. It'll be in your room when you get home.`);
    } else if (firstKeepsake) {
      const onShelf = this.g.shelf.includes(firstKeepsake.id) ? "It's on the shelf in your room." : 'Your shelf is full, so it\'s with your things.';
      this.toast(firstKeepsake.id === 'kingyo'
        ? `You caught a goldfish: 金魚 (きんぎょ). ${onShelf.replace("It's", "It's in a bowl")}`
        : `A souvenir: ${this.wordText(firstKeepsake.word)}. ${onShelf}`);
    } else if (firstGood) {
      this.toast(`${this.wordText(firstGood.word)} is yours to keep. It's with your things in the notebook, and you can put it on the shelf at home.`);
    } else if (run.clean) {
      this.toast(next.stage >= def.maxStage ? 'Clean visit.' : `Clean visit (${next.cleanRuns}/3 to the next stage).`);
    } else {
      this.toast('Done. Notes for tonight are in your notebook.');
    }

    let gift: (typeof requests.arcs)[number] | null = null;
    if (errand && !scene) {
      errand.done = true;
      const arc = errand.arc ? requests.arcs.find((a) => a.id === errand.arc) : undefined;
      if (isFriend(errand.from)) bump(errand.from, POINTS.request);
      if (arc && errand.step === (this.g.arcs[arc.id] ?? 0)) {
        this.g.arcs[arc.id] = errand.step + 1;
        const step = arc.steps[errand.step]!;
        if (errand.step + 1 >= arc.steps.length) {
          gift = arc;
          if (isFriend(arc.from)) bump(arc.from, POINTS.story);
        }
        else if (step.thanks) this.toast(`${plainText(parseLine(npcs[arc.from].name, vocab))}: ${plainText(parseLine(step.thanks, vocab))}`);
      }
      if (this.g.errands.every((e) => e.done || e.missed)) {
        this.toast("That's every errand for today. Nice work!");
        this.celebrate(3, 90);
      }
    }
    this.announceHearts(changes);
    const picking = then === 'give' && friend && !gift && !scene && !invite;
    // Over a gift, a scene or an outing the cards would cover the words, so they wait until town.
    if (gift || scene || invite || picking) this.pendingUps = [...this.pendingUps, ...ups];
    else this.showLevelUps([...this.pendingUps.splice(0), ...ups]);
    this.addXp(ups.length * XP.levelUp + (errand && !scene ? XP.errand : 0) + (run.clean ? XP.clean : 0));
    const stayNote = this.afterStayScenario(run);
    if (stayNote) setTimeout(() => this.toast(stayNote), 1800);
    this.g.minutes = Math.min(DAY_END - 1, this.g.minutes + (invite ? MINUTES_PER_INVITE : MINUTES_PER_SCENARIO));
    this.refreshStay();
    this.town.invalidate();
    this.phase = 'town';
    this.input.clear();
    this.renderHud(true);
    if (gift) this.showGift(gift);
    else if (scene) this.showConsequence(run, scene, errand);
    else if (invite && friend) this.showMemory(friend, invite);
    else if (picking) this.showGiftPicker(friend);
  }

  /** Say so when someone's hearts go up, when they start talking casually, and when they'd like to invite you. */
  private announceHearts(changes: HeartChange[]): void {
    const said: string[] = [];
    for (const c of changes) {
      const name = plainText(parseLine(npcs[c.npc].name, vocab));
      if (c.after > c.before) {
        let msg = `${name} ${'♥'.repeat(c.after)}${c.after >= MAX_HEARTS ? ': best friends.' : '.'}`;
        if (c.speech[1] === 2 && c.speech[0] < 2) msg += ` ${name} talks to you casually now, without です and ます.`;
        else if (c.speech[1] === 1 && c.speech[0] < 1) msg += ` ${name} is friendlier with you now.`;
        if (inviteReady(this.g, c.npc)) msg += ` ${name} would like to invite you somewhere.`;
        said.push(msg);
        this.g.today.promotions.push(msg);
      } else if (c.after < c.before) said.push(`${name} seems a little hurt.`);
    }
    if (!said.length) return;
    // After whatever the conversation itself said.
    setTimeout(() => this.toast(said.join(' ')), 1800);
    const up = changes.some((c) => c.after > c.before);
    const r = this.town.canvas.getBoundingClientRect();
    floatText({ x: r.left + r.width / 2, y: r.top + r.height / 3 }, up ? '♥' : '…', up ? 'heart' : 'sad');
  }

  /** The outing with a friend: a picture, what happened, and a photo after the first one. */
  private showMemory(friend: FriendId, invite: InviteDef): void {
    this.phase = 'gift';
    const name = npcs[friend].name;
    const art = isMemoryArt(invite.art) ? toCanvas(drawMemory(invite.art, friend)) : null;
    if (art) art.className = 'oops-art memory-art';
    const place = friendById[friend].place as PlaceId;
    const lines = invite.lines.map((l) => {
      const tokens = parseLine(l.text, vocab);
      this.seeAll(tokens, place, friend);
      return h('div', { class: `oops-line who-${l.who}` },
        l.who === 'narration' ? null : h('span', { class: 'oops-who' }, l.who === 'me' ? 'You' : this.tokens(name, false)),
        h('div', { class: 'oops-jp' }, renderTokens(tokens, { furigana: ALWAYS, onTap: (t, el) => this.lookup(t, el.getBoundingClientRect(), false), isNew: (t) => this.learner.isFresh(t.lemma) })),
        h('div', { class: 'oops-en' }, l.en),
      );
    });
    const photo = invite.variant === 'first' && !this.g.keepsakes.includes(photoId(friend)) ? photoId(friend) : undefined;
    if (photo) {
      receive(this.g, photo);
      this.refreshHome();
      this.g.today.promotions.push(`A photo with ${plainText(parseLine(name, vocab))} for your shelf.`);
    }
    const points = pointsOf(this.g, friend);
    const hearts = heartsFor(points);
    const next = toNextHeart(points);
    const more = friendById[friend].invites[this.g.invites?.[friend] ?? 0];
    this.showScreen(
      h('h2', {}, invite.title),
      h('div', { class: 'oops memory' },
        art,
        h('div', { class: 'oops-lines' }, lines),
        h('p', { class: 'memory-hearts' }, h('span', { class: 'hearts' }, '♥'.repeat(hearts), h('span', { class: 'hearts-empty' }, '♥'.repeat(MAX_HEARTS - hearts))),
          next === null ? ' Best friends.' : more ? ` ${hearts < more.hearts ? 'Another invitation at ' + '♥'.repeat(more.hearts) + '.' : ''}` : ''),
        photo ? h('p', { class: 'muted' }, 'You took a photo together: ', this.tokens('写真', false), ". It's on the shelf in your room.") : null,
      ),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => this.goToTown() }, 'Back to town ▶')),
    );
    if (art) play(art, 'stamp');
    const box = this.screen.querySelector('.memory-hearts');
    if (box) setTimeout(() => box.isConnected && confetti(box.getBoundingClientRect().left + 40, box.getBoundingClientRect().top, 40), 200);
  }

  /** A wrong pick played out: a little scene, the right answer, and when it comes back. */
  private showConsequence(run: ScenarioRun, scene: ConsequenceDef, errand: Errand | undefined): void {
    this.phase = 'oops';
    const slots = run.slots;
    // English slots ($bad_en) go in as they are; Japanese ones ($num) as plain text.
    const en = (s: string) => s.replace(/\$([a-z_]+)/g, (m, k: string) => (slots[k] === undefined ? m : k.endsWith('_en') ? slots[k] : plainText(parseLine(slots[k], vocab))));
    const asker = errand?.from ?? run.def.npc;
    const speaker = (who: SceneWho) => who === 'asker' ? npcs[asker].name : who === 'staff' ? npcs[run.def.npc].name : null;
    const art = toCanvas(drawScene(scene.art));
    art.className = 'oops-art';
    const fix = run.corrections[run.corrections.length - 1];
    const lines = scene.lines.map((l) => {
      const tokens = parseLine(l.text, vocab, slots);
      this.seeAll(tokens, run.def.place, run.def.npc);
      const who = speaker(l.who);
      return h('div', { class: `oops-line who-${l.who}` },
        who ? h('span', { class: 'oops-who' }, this.tokens(who, false)) : l.who === 'me' || l.who === 'announce' ? h('span', { class: 'oops-who' }, l.who === 'me' ? 'You' : 'Announcement') : null,
        h('div', { class: 'oops-jp' }, renderTokens(tokens, { furigana: ALWAYS, onTap: (t, el) => this.lookup(t, el.getBoundingClientRect(), false), isNew: (t) => this.learner.isFresh(t.lemma) })),
        h('div', { class: 'oops-en' }, en(l.en)),
      );
    });
    const later = errand
      ? `${plainText(parseLine(npcs[asker].name, vocab))} will ask again tomorrow.`
      : 'You can try again any time.';
    this.showScreen(
      h('h2', {}, `Oops: ${scene.title.toLowerCase()}`),
      h('div', { class: 'oops' },
        art,
        h('div', { class: 'oops-lines' }, lines),
        h('p', { class: 'oops-outcome' }, en(scene.outcome_en)),
        fix?.betterTokens?.length
          ? h('div', { class: 'oops-fix' },
              h('div', { class: 'oops-fix-label' }, 'What would have worked'),
              h('div', { class: 'right-answer' }, h('span', { class: 'tick', 'aria-hidden': 'true' }, '✓'), renderTokens(fix.betterTokens, { furigana: ALWAYS })),
              h('p', { class: 'muted' }, fix.note))
          : null,
        h('p', { class: 'oops-later' }, later),
      ),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => this.goToTown() }, 'Back to town ▶')),
    );
    play(art, 'wobble');
  }

  private seeAll(tokens: Token[], place: PlaceId, npc: NpcId): void {
    let fresh = 0;
    for (const l of lemmasOf(tokens)) {
      if (this.learner.see(l, { day: this.g.day, place, npc })) {
        this.g.today.newWords.push(l);
        fresh++;
      }
    }
    if (fresh) this.addXp(fresh * XP.newWord);
  }

  /** Your room, redrawn with what you own. */
  private refreshHome(): void {
    this.town.setHome(homeRoom(this.g.furniture, this.g.shelf));
  }

  private icon(id: string, kind: 'floor' | 'wall' | 'rug' | 'keepsake'): HTMLCanvasElement {
    const c = toCanvas(itemIcon(id, kind));
    c.className = `item-icon ${kind}`;
    return c;
  }

  /** The catalog on the post office desk: things for your room, ordered at the counter. */
  private showCatalog(): void {
    this.phase = 'shop';
    const level = levelFor(this.g.xp);
    const rows = CATALOG.map((it) => {
      const state = canOrder(it, this.g.furniture, level, this.g.money);
      const tokens = parseLine(it.word, vocab);
      this.seeAll(tokens, 'post', 'kobayashi');
      const word = renderTokens(tokens, { furigana: ALWAYS, onTap: (t, el) => this.lookup(t, el.getBoundingClientRect(), false), isNew: (t) => this.learner.isFresh(t.lemma) });
      const action = state === 'ok'
        ? h('button', { class: 'primary small', onclick: () => this.order(it.id) }, 'Order')
        : h('span', { class: `cat-state ${state}` }, state === 'owned' ? 'In your room' : state === 'level' ? `Needs Lv ${it.level}` : 'Not enough ¥');
      return h('li', { class: `cat-item ${state}` },
        this.icon(it.id, it.kind),
        h('div', { class: 'cat-word' }, word, h('div', { class: 'muted' }, vocab.get(it.word)?.meaning ?? '')),
        h('div', { class: 'cat-buy' }, h('div', { class: 'cat-price' }, yen(it.price)), action),
      );
    });
    this.showScreen(
      h('h2', {}, 'カタログ'),
      h('p', { class: 'muted' }, `Things for your room. Pick one and order it from 小林さん at the counter, in Japanese. You have ${yen(this.g.money)}.`),
      h('ul', { class: 'catalog' }, rows),
      h('div', { class: 'row' }, h('button', { onclick: () => this.goToTown() }, 'Close')),
    );
  }

  private order(id: string): void {
    this.hideScreen();
    this.phase = 'town';
    this.startScenario(scenarioById['post_catalog']!, id);
  }

  /** A thing's word with its reading, for a toast: お茶 (おちゃ). */
  private wordText(word: string): string {
    const tokens = parseLine(word, vocab);
    const text = plainText(tokens);
    const reading = tokens.map((t) => t.ruby.map((r) => r.rt ?? r.text).join('')).join('');
    return reading && reading !== text ? `${text} (${reading})` : text;
  }

  private meaningOf(word: string): string {
    const lemma = parseLine(word, vocab)[0]?.lemma ?? word;
    return vocab.get(lemma)?.meaning ?? word;
  }

  /** Your shelf at home: what's on it, and everything you have to put there. */
  private showShelf(): void {
    this.phase = 'shop';
    const mine = belongings(this.g);
    const full = this.g.shelf.length >= SHELF_SIZE;
    const row = (id: string, count: number) => {
      const good = goodById[id];
      if (!good) return null;
      const on = this.g.shelf.includes(id);
      const word = renderTokens(parseLine(good.word, vocab), { furigana: ALWAYS, onTap: (t, el) => this.lookup(t, el.getBoundingClientRect(), false), isNew: (t) => this.learner.isFresh(t.lemma) });
      const action = on
        ? h('button', { class: 'small', onclick: () => { unshelve(this.g, id); this.refreshHome(); this.showShelf(); } }, 'Take down')
        : full
          ? h('span', { class: 'cat-state owned' }, 'Shelf is full')
          : h('button', { class: 'primary small', onclick: () => { shelve(this.g, id); this.refreshHome(); this.showShelf(); } }, 'Put on shelf');
      return h('li', { class: `shelf-item${on ? ' on' : ''}` },
        this.icon(id, 'keepsake'),
        h('div', { class: 'cat-word' }, word,
          h('div', { class: 'muted' }, this.meaningOf(good.word), count > 1 ? ` · ×${count}` : '', this.fromLine(id))),
        h('div', { class: 'cat-buy' }, action),
      );
    };
    const onShelf = this.g.shelf.map((id) => row(id, this.g.bag[id] ?? 1));
    const rest = mine.filter((m) => !this.g.shelf.includes(m.good.id)).map((m) => row(m.good.id, m.count));
    const allKeeps = ALL_KEEPSAKES;
    this.showScreen(
      h('h2', {}, '棚'),
      h('h3', { class: 'shelf-head' }, `On the shelf (${this.g.shelf.length} of ${SHELF_SIZE})`),
      onShelf.length
        ? h('ul', { class: 'catalog shelf' }, onShelf)
        : h('p', { class: 'muted' }, 'Nothing on it yet. Anything you have can go here.'),
      h('h3', { class: 'shelf-head' }, renderTokens(parseLine('持ち物', vocab), { furigana: ALWAYS, onTap: (t, el) => this.lookup(t, el.getBoundingClientRect(), false), isNew: (t) => this.learner.isFresh(t.lemma) })),
      rest.length
        ? h('ul', { class: 'catalog shelf' }, rest)
        : h('p', { class: 'muted' }, mine.length ? 'Everything you have is on the shelf.' : 'Nothing yet. What you buy in town is yours to keep, errands for neighbours included, and so are gifts and souvenirs.'),
      h('p', { class: 'muted' }, `${this.g.keepsakes.length} of ${allKeeps.length} keepsakes collected. Things for the rest of the room are in the catalog at the post office.`),
      h('div', { class: 'row' }, h('button', { onclick: () => this.goToTown() }, 'Close')),
    );
  }

  /** Who gave you a keepsake, as a short line. */
  private fromLine(id: string): (string | Node)[] {
    const k = ALL_KEEPSAKES.find((x) => x.id === id);
    return k ? [' · from ', this.tokens(npcs[k.from as NpcId]?.name ?? k.from, false)] : [];
  }

  /** The ticket machines at the station: where the trains go, and what you need to go. */
  private showTrips(): void {
    this.phase = 'shop';
    const level = levelFor(this.g.xp);
    const rows = ON_SALE.map((trip) => {
      const state = canTravel(trip, level, this.g.money, this.g.minutes);
      const tokens = parseLine(trip.name, vocab);
      this.seeAll(tokens, 'station', 'ekiin');
      const name = renderTokens(tokens, { furigana: ALWAYS, onTap: (t, el) => this.lookup(t, el.getBoundingClientRect(), false), isNew: (t) => this.learner.isFresh(t.lemma) });
      const action = state === 'ok'
        ? h('button', { class: 'primary small', onclick: () => this.travel(trip) }, 'Buy and go')
        : h('span', { class: `cat-state ${state}` }, state === 'level' ? `Needs Lv ${trip.level}` : state === 'late' ? 'No more trains today' : 'Not enough ¥');
      return h('li', { class: `cat-item trip ${state}` },
        h('div', { class: 'trip-name' }, name),
        h('div', { class: 'cat-word' }, h('div', { class: 'muted' }, `${trip.blurb} ${trip.minutes} minutes each way.`)),
        h('div', { class: 'cat-buy' }, h('div', { class: 'cat-price' }, yen(trip.fare)), action),
      );
    });
    const label = parseLine('往復 切符', vocab);
    this.seeAll(label, 'station', 'ekiin');
    this.showScreen(
      h('h2', {}, renderTokens(parseLine('切符', vocab), { furigana: ALWAYS })),
      h('p', { class: 'muted' }, 'A return ticket (', renderTokens(label, { furigana: ALWAYS, onTap: (t, el) => this.lookup(t, el.getBoundingClientRect(), false), isNew: (t) => this.learner.isFresh(t.lemma) }),
        `). The last train out leaves at ${formatClock(LAST_TRAIN_OUT)}. You have ${yen(this.g.money)}.`),
      h('ul', { class: 'catalog trips' }, rows),
      h('div', { class: 'row' }, h('button', { onclick: () => this.goToTown() }, 'Close')),
    );
  }

  /** Buy the ticket and ride out. */
  private travel(trip: Trip): void {
    const to = ARRIVAL[trip.id];
    if (!to || canTravel(trip, levelFor(this.g.xp), this.g.money, this.g.minutes) !== 'ok') return;
    this.hideScreen();
    this.addYen(-trip.fare, `-${yen(trip.fare)}`);
    this.g.minutes += trip.minutes;
    this.g.today.promotions.push(`You took the train to ${trip.name}.`);
    this.town.enter(to);
    this.phase = 'town';
    this.input.clear();
    this.renderHud(true);
    this.toast(`${trip.name} に 着きました: you're in ${trip.id[0]!.toUpperCase()}${trip.id.slice(1)}. Walk back onto the platform for the train home.`
      + (trip.id === 'hakone' ? ` Check-in at the ryokan is ${formatClock(CHECK_IN_FROM)}–${formatClock(CHECK_IN_UNTIL)}.` : ''));
  }

  /** The train back from a trip, into the station. */
  private rideHome(): void {
    const blocked = trainHomeBlocked(this.g);
    if (blocked) {
      this.toast(blocked);
      return;
    }
    this.g.minutes += rideMinutes(this.town.scene);
    if (this.g.minutes >= DAY_END) {
      this.goToNight();
      return;
    }
    this.town.enter('station');
    this.toast('Back at the station in ことまち.');
    this.renderHud(true);
  }

  // ------------------------------------------------------------------ the ryokan

  /** Where a day starts: at home, or on the futon at the ryokan the morning after a night there. */
  private wake(): void {
    this.refreshStay();
    if (stayPhase(this.g) === 'morning') this.town.wakeAt('washitsu');
    else this.town.resetPlayer();
  }

  /** Your room at the ryokan and what you're wearing, as the stay has them now. */
  private refreshStay(): void {
    this.town.setRoom('washitsu', washitsuFor(roomState(this.g, this.g.minutes)));
    this.town.setOutfit(inYukata(this.g) ? 'yukata' : 'clothes');
  }

  /** Talking to the 女将 at the front desk: check in, check out, or a word about your stay. */
  private atFrontDesk(): void {
    const desk = frontDesk(this.g, this.g.minutes);
    if (desk === 'checkin') return this.startScenario(scenarioById['ryokan_checkin']!, checkInVariant(this.g.minutes));
    if (desk === 'checkout') return this.startScenario(scenarioById['ryokan_checkout']!, 'stay');
    if (desk === 'staying') {
      const dinner = this.g.stay && !this.g.stay.dined ? ` Dinner is at ${formatClock(this.g.stay.dinner)}, in your room.` : '';
      return this.toast(`Your room is upstairs (二階), and the big bath is through the noren (温泉).${dinner}`);
    }
    if (desk === 'early') return this.toast(`Check-in starts at ${formatClock(CHECK_IN_FROM)}. Have a look around and come back then.`);
    if (desk === 'late') return this.toast(`It's too late to check in tonight: the last check-in is at ${formatClock(CHECK_IN_UNTIL)}.`);
    this.toast(`A night here is ${yen(STAY_PRICE)} with dinner and breakfast, paid when you check out. You have ${yen(this.g.money)}.`);
  }

  /** At the low table in your room: wait for dinner, or just sit a while. */
  private restInRoom(): void {
    if (canWaitForDinner(this.g, this.g.minutes) && this.g.stay) {
      this.g.minutes = this.g.stay.dinner;
      this.refreshStay();
      this.renderHud(true);
      this.toast(`You drink tea and watch the mountains until ${formatClock(this.g.stay.dinner)}. Someone knocks: dinner is here.`);
      return;
    }
    if (stayPhase(this.g) === 'morning') return this.toast('Breakfast is finished. Check out at the front desk downstairs when you are ready.');
    if (this.g.stay?.dined) return this.toast('The futon is laid out. Go to bed when you are ready, or have one more bath first.');
    this.toast('You sit at the low table for a while.');
  }

  /** What a finished conversation at the ryokan changes about your stay, and what to say about it. */
  private afterStayScenario(run: ScenarioRun): string | null {
    const id = run.def.id;
    if (id === 'ryokan_checkin' && run.ended) {
      const stay = checkIn(this.g, this.g.minutes);
      // Dinner is when the conversation said it would be.
      stay.dinner = run.variant.id === 'six' ? 18 * 60 : 19 * 60;
      this.g.today.promotions.push('You checked in at the ryokan in 箱根.');
      return `Checked in. Your room is upstairs (二階): someone will show you round. Dinner is at ${formatClock(stay.dinner)}.`;
    }
    if (!this.g.stay) return null;
    if (id === 'ryokan_room' && run.ended) {
      this.g.stay.shown = true;
      return `You change into the yukata, left over right. The big bath is downstairs (温泉), and dinner comes at ${formatClock(this.g.stay.dinner)}. Sit at the low table to wait for it.`;
    }
    if (id === 'ryokan_dinner' && run.ended) {
      this.g.stay.dined = true;
      return 'The futon is laid out. Go to bed when you are ready, or have one more bath first.';
    }
    // Once the bill is paid you've checked out, even if you didn't stay for the goodbyes.
    if (id === 'ryokan_checkout' && (run.ended || run.moneySpent > 0)) {
      checkOut(this.g);
      this.g.today.promotions.push(`A night at the ryokan in 箱根 (${yen(STAY_PRICE)}).`);
      return 'Checked out. You change back into your own clothes. The train home leaves from the platform.';
    }
    return null;
  }

  /** The end of a regular's story: their thanks and a keepsake. */
  private showGift(arc: (typeof requests.arcs)[number]): void {
    if (!this.g.keepsakes.includes(arc.gift.id)) receive(this.g, arc.gift.id);
    this.refreshHome();
    this.g.today.promotions.push(`A gift from ${plainText(parseLine(npcs[arc.from].name, vocab))}: ${vocab.get(arc.gift.word)?.meaning ?? arc.gift.word}.`);
    this.phase = 'gift';
    const word = renderTokens(parseLine(arc.gift.word, vocab), { furigana: ALWAYS, onTap: (t, el) => this.lookup(t, el.getBoundingClientRect(), false), isNew: (t) => this.learner.isFresh(t.lemma) });
    this.showScreen(
      h('h2', {}, 'A thank-you gift'),
      h('div', { class: 'gift' },
        h('div', { class: 'gift-who' }, this.tokens(npcs[arc.from].name, false)),
        h('div', { class: 'gift-line' }, this.tokens(arc.gift.thanks, false)),
        h('details', { class: 'req-en' }, h('summary', {}, 'English'), arc.gift.thanks_en),
        h('div', { class: 'gift-card' }, h('div', { class: 'gift-word' }, word), h('div', { class: 'muted' }, vocab.get(arc.gift.word)?.meaning ?? '')),
        h('p', { class: 'muted' }, `That's the end of “${arc.title}”. Keepsakes go on the shelf in your room.`),
      ),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => this.goToTown() }, 'Thank you ▶')),
    );
    if (this.learner.see(arc.gift.word, { day: this.g.day, place: 'street', npc: arc.from })) this.g.today.newWords.push(arc.gift.word);
    this.addXp(20);
    const card = this.screen.querySelector('.gift-card');
    if (card) {
      play(card, 'stamp');
      setTimeout(() => card.isConnected && confetti(card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2, card.getBoundingClientRect().top + 20, 60), 120);
    }
  }

  /** Confetti over the town, a flash and a little shake. */
  private celebrate(shake: number, n: number): void {
    const r = this.town.canvas.getBoundingClientRect();
    this.town.flash(0.3);
    this.town.shake(shake, 0.4);
    confetti(r.left + r.width * 0.3, r.top + r.height * 0.75, n / 2);
    confetti(r.left + r.width * 0.7, r.top + r.height * 0.75, n / 2);
  }

  /** A card flips in for each word that went up a level (two, then a count). */
  private showLevelUps(words: string[]): void {
    const NAMES: Partial<Record<WordStatus, string>> = { recognized: 'Recognized', produced: 'Can use it' };
    words.slice(0, 2).forEach((w, i) => {
      const status = this.learner.status(w);
      const card = h('div', { class: `lvl-card lvl-${status}` },
        h('div', { class: 'lvl-badge' }, status === 'produced' ? '★ Level up' : '▲ Level up'),
        renderTokens(parseLine(w, vocab), { furigana: ALWAYS }),
        h('div', { class: 'lvl-status' }, NAMES[status] ?? status),
      );
      card.style.animationDelay = `${i * 140}ms`;
      this.levelUps.append(card);
      setTimeout(() => card.classList.add('out'), 2600 + i * 140);
      setTimeout(() => card.remove(), 3100 + i * 140);
    });
    if (words.length > 2) {
      const more = h('div', { class: 'lvl-card lvl-more' }, `+${words.length - 2} more`);
      more.style.animationDelay = '420ms';
      this.levelUps.append(more);
      setTimeout(() => more.remove(), 3500);
    }
  }

  /**
   * The night's results: the day's experience counted up line by line, multiplied by
   * the best combo, and the bonus added to your level bar. The bonus is given as soon
   * as the screen opens, so skipping the animation loses nothing.
   */
  private results(): HTMLElement {
    const t = this.g.today;
    const done = this.g.errands.filter((e) => e.done).length;
    const lines: [string, number, number][] = [
      [`Errands done (of ${this.g.errands.length})`, done, XP.errand],
      ['Clean visits', t.clean ?? 0, XP.clean],
      ['New words', new Set(t.newWords).size, XP.newWord],
      ['Words levelled up', t.levelUps ?? 0, XP.levelUp],
    ];
    const points = lines.reduce((sum, [, n, each]) => sum + n * each, 0);
    const best = t.bestCombo ?? 0;
    const mult = comboMultiplier(best);
    const total = Math.round(points * mult);
    const xpBefore = this.g.xp;
    if (t.bonus === undefined) {
      t.bonus = total - points;
      this.g.xp += t.bonus;
      if (levelFor(this.g.xp) > levelFor(xpBefore)) t.promotions.push(`You reached level ${levelFor(this.g.xp)}.`);
    }
    const xpAfter = this.g.xp;
    const rows = lines.map(([label, n, each]) => {
      const count = h('b', { class: 'res-n' }, '0');
      const pts = h('span', { class: 'res-pts' }, '+0');
      return { el: h('div', { class: 'res-row' }, h('span', { class: 'res-label' }, label), count, pts), count, pts, n, each };
    });
    const pointsEl = h('b', { class: 'chips' }, '0');
    const multEl = h('b', { class: 'mult' }, `×${mult.toFixed(1)}`);
    const totalEl = h('div', { class: 'res-total' }, '0 XP');
    const sum = h('div', { class: 'res-sum' },
      h('div', { class: 'res-mults' }, pointsEl, h('span', { class: 'times' }, '×'), multEl),
      h('div', { class: 'res-caption' }, `XP × best combo (${best} in a row)`),
    );
    const levelNow = levelFor(xpBefore);
    const lvLabel = h('span', { class: 'res-lv' }, `Lv ${levelNow}`);
    const fill = h('i', { style: `width:${Math.round(levelProgress(xpBefore) * 100)}%` });
    const bar = h('div', { class: 'res-level' }, lvLabel, h('span', { class: 'res-bar' }, fill),
      h('span', { class: 'res-next' }, `${xpForLevel(levelNow + 1) - xpBefore} XP to Lv ${levelNow + 1}`));
    const yenLine = h('div', { class: 'res-yen' }, h('span', { class: 'res-label' }, 'Yen earned from errands'), h('b', {}, yen(t.yen ?? 0)));
    const box = h('div', { class: 'results' }, ...rows.map((r) => r.el), sum, totalEl, bar, yenLine);
    void (async () => {
      await wait(250);
      for (const r of rows) {
        r.el.classList.add('in');
        await countUp(r.count, r.n, 380);
        r.pts.textContent = `+${r.n * r.each}`;
        play(r.pts, 'pop');
        await wait(120);
      }
      sum.classList.add('in');
      await countUp(pointsEl, points, 450);
      play(multEl, 'pop');
      await wait(200);
      totalEl.classList.add('in');
      await countUp(totalEl, total, 700, (n) => `${n.toLocaleString('en-US')} XP`);
      play(totalEl, 'stamp');
      if (!box.isConnected) return;
      const r = totalEl.getBoundingClientRect();
      if (total > 0) confetti(r.left + r.width / 2, r.top + r.height / 2, Math.min(70, 20 + total / 10));
      // The combo bonus fills the level bar.
      bar.classList.add('in');
      await wait(300);
      const lvAfter = levelFor(xpAfter);
      if (lvAfter > levelNow) {
        fill.style.width = '100%';
        await wait(500);
        lvLabel.textContent = `Lv ${lvAfter}`;
        play(lvLabel, 'stamp');
        bar.classList.add('up');
      }
      fill.style.width = `${Math.round(levelProgress(xpAfter) * 100)}%`;
      bar.querySelector('.res-next')!.textContent = `${xpForLevel(lvAfter + 1) - xpAfter} XP to Lv ${lvAfter + 1}`;
      yenLine.classList.add('in');
    })();
    return box;
  }

  private goToNight(): void {
    this.phase = 'night';
    this.popup.hide();
    this.notebook.close();
    const t = this.g.today;
    const newWords = [...new Set(t.newWords)];
    const closer = FRIENDS.filter((f) => pointsOf(this.g, f.id) > (t.friendshipStart[f.id] ?? 0));
    const cooler = FRIENDS.filter((f) => pointsOf(this.g, f.id) < (t.friendshipStart[f.id] ?? 0));
    const done = this.g.errands.filter((e) => e.done).length;
    this.showScreen(
      h('h2', {}, `Day ${this.g.day} · Night`),
      h('p', {}, `You finished ${done} of ${this.g.errands.length} errands and looked up ${t.lookups} word${t.lookups === 1 ? '' : 's'}. ¥${this.g.money.toLocaleString('en-US')} left.`),
      this.results(),
      t.promotions.length ? h('ul', { class: 'promos' }, t.promotions.map((p) => h('li', {}, p))) : null,
      closer.length || cooler.length
        ? h('ul', { class: 'night-friends' }, [...closer, ...cooler].map((f) => {
            const n = heartsFor(pointsOf(this.g, f.id));
            return h('li', {}, this.tokens(npcs[f.id].name, false), ' ',
              h('span', { class: 'hearts' }, '♥'.repeat(n), h('span', { class: 'hearts-empty' }, '♥'.repeat(MAX_HEARTS - n))),
              closer.includes(f) ? ' You got closer today.' : ' A little cooler today.');
          }))
        : null,
      h('h3', {}, `New words today (${newWords.length})`),
      newWords.length
        ? h('ul', { class: 'night-words' }, newWords.map((w) => h('li', {},
            renderTokens(parseLine(w, vocab), { furigana: ALWAYS, onTap: (tok, el) => this.lookup(tok, el.getBoundingClientRect(), false) }),
            h('span', { class: 'nb-meaning' }, vocab.get(w)?.meaning ?? ''))))
        : h('p', { class: 'muted' }, 'No new words today.'),
      h('h3', {}, `Corrections and notes (${t.corrections.length})`),
      t.corrections.length
        ? h('ul', { class: 'nb-corrections' }, t.corrections.map((c) => correctionItem({ ...c, day: this.g.day }, { grammar, lookup: (tok, el) => this.lookup(tok, el.getBoundingClientRect(), false) })))
        : h('p', { class: 'muted' }, 'A clean day: nothing to correct.'),
      h('div', { class: 'row' },
        h('button', { onclick: () => this.notebook.show(this.notebookCtx(), this.g) }, 'Open notebook'),
        h('button', { class: 'primary', onclick: () => this.sleep() }, 'Sleep (saves) ▶'),
      ),
    );
  }

  private sleep(): void {
    this.combo = 0;
    this.shownDone.clear();
    // A whole day went by after a night at the ryokan without checking out: the bill is settled for you.
    let settled = false;
    if (stayPhase(this.g) === 'morning') {
      this.g.money = Math.max(0, this.g.money - STAY_PRICE);
      checkOut(this.g);
      settled = true;
    }
    this.g.day += 1;
    this.g.minutes = DAY_START;
    this.g.today = newDayLog(this.g.friendship);
    if (settled) this.g.today.promotions.push(`The ryokan put your night's stay (${yen(STAY_PRICE)}) on your card.`);
    this.planDay();
    const ok = save(this.g);
    this.town.invalidate();
    this.wake();
    this.setDay();
    this.showMorning();
    if (!ok) this.toast("Couldn't save in this browser (storage is blocked). You can keep playing.");
  }

  // ------------------------------------------------------------------ testing hooks

  /** State snapshot for automated play-tests. */
  debugState(): { phase: Phase; scene: Scene | null; day: number; minutes: number; money: number; stage: Record<string, number>; friendship: number; words: number } {
    return {
      phase: this.phase,
      scene: this.town.scene,
      day: this.g.day,
      minutes: this.g.minutes,
      money: this.g.money,
      stage: Object.fromEntries(Object.entries(this.g.progress).map(([k, v]) => [k, v.stage])),
      friendship: this.g.friendship.yuki ?? 0,
      words: Object.keys(this.g.learner.words).length,
    };
  }

  /** Play-test helpers: list variants, force a stage/variant/time, read text plainly. */
  debugVariants(id: string): string[] {
    return scenarioById[id]!.variants.map((v) => v.id);
  }

  debugSetup(id: string, stage: number, variant: string, minutes: number): void {
    this.g.progress[id] = { stage: stage as Mode, cleanRuns: 0, runs: 0 };
    this.g.errands = [{ scenario: id, variant, text: '', done: false }];
    this.g.minutes = minutes;
    this.g.today.greeted = false;
  }

  debugPeriod(): string {
    return periodOf(this.g.minutes);
  }

  debugPlain(markup: string, slots: Record<string, string>): string {
    return plainText(parseLine(markup, vocab, slots));
  }

  debugPlainTokens(tokens: Token[]): string {
    return plainText(tokens);
  }

  /** Teleport to the counter inside a place, or next to the neighbor (play-test helper). */
  debugGoTo(place: Scene | 'tanaka'): void {
    this.town.debugGoTo(place);
  }

  /** Jump to a day, for its weather and festival (play-test helper). */
  debugDay(day: number, minutes = this.g.minutes): void {
    this.g.day = day;
    this.g.minutes = minutes;
    this.setDay();
  }

  /** Stand in front of a place in the street: the board, a stall, the cat (play-test helper). */
  debugStreet(tx: number, ty: number, dir: 'up' | 'down' | 'left' | 'right' = 'up'): void {
    this.town.debugStreet(tx, ty, dir);
  }

  /** Teleport to a door on the street (play-test helper). */
  debugTownDoor(place: DoorPlace): void {
    this.town.debugTownDoor(place);
  }

  get place(): PlaceId | null {
    return this.activeRun?.def.place ?? null;
  }
}
