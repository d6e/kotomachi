// Ties everything together: the day loop (morning errands, the day in town, the night
// notebook, sleep and save), scenario runs, lookups and the HUD.

import { Input } from '../engine/input.ts';
import { startLoop } from '../engine/loop.ts';
import { UnavailableJudge, type FreeformJudge } from '../judge/freeform.ts';
import { lemmasOf, parseLine, plainText, type Token } from '../lang/markup.ts';
import { Learner } from '../learner/model.ts';
import { finishRun, friendshipLevel, FRIENDSHIP_NAMES, greetSlots, MODE_NAMES, periodOf, ScenarioRun } from '../scenario/engine.ts';
import type { Mode, PlaceId, ScenarioDef } from '../scenario/types.ts';
import { Town, type Interactable } from '../town/town.ts';
import type { DoorPlace } from '../town/map.ts';
import { DialogueView } from '../ui/dialogue.ts';
import { clear, h } from '../ui/dom.ts';
import { correctionItem, Notebook, type NotebookContext } from '../ui/notebook.ts';
import { Popup } from '../ui/popup.ts';
import { ALWAYS, renderTokens } from '../ui/text.ts';
import { forms, grammar, npcs, scenarioById, scenarios, vocab } from './content.ts';
import { makeErrands, pickVariant } from './errands.ts';
import { DAY_END, DAY_START, isOpen, load, newDayLog, newGame, progressFor, save, clearSave, formatClock, type GameData } from './state.ts';

const PLACE_NAMES: Record<string, string> = {
  cafe: 'Cafe', konbini: 'Konbini', pharmacy: 'Pharmacy', restaurant: 'Restaurant', station: 'Station', post: 'Post office', street: 'Street',
};
const SCENARIO_FOR: Record<Exclude<DoorPlace, 'home'>, string> = {
  cafe: 'cafe_order', konbini: 'konbini_buy', pharmacy: 'pharmacy_buy', restaurant: 'restaurant_eat', station: 'station_ticket', post: 'post_send',
};
/** In-game minutes per real second of walking around town. */
const MINUTES_PER_SECOND = 1;
const MINUTES_PER_SCENARIO = 20;

type Phase = 'title' | 'morning' | 'town' | 'talk' | 'night';

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

  constructor(root: HTMLElement) {
    const canvas = h('canvas', { id: 'town', 'aria-label': 'The town. Walk with the arrow keys or WASD, or tap where to go.' });
    this.hud = h('div', { class: 'hud' });
    this.screen = h('div', { class: 'screen', hidden: true });
    this.toastEl = h('div', { class: 'toast', hidden: true, role: 'status' });
    const stage = h('div', { class: 'stage-wrap' }, canvas, this.hud);
    root.append(stage, this.screen, this.toastEl);
    this.town = new Town(canvas, {
      isOpen: (place) => place === 'home' || isOpen(place, this.g.minutes),
      sign: (word) => ({ text: word, furigana: /[㐀-鿿]/.test(word) && this.learner.showFurigana(word, 2) ? (vocab.get(word)?.reading ?? null) : null }),
      onInteract: (t) => this.interact(t),
      onSignClick: (word, x, y) => this.lookup({ surface: word, lemma: word, ruby: [] }, { left: x, top: y, bottom: y }, true),
      neighborAvailable: () => !this.g.today.greeted && this.g.minutes < 21 * 60,
      busy: () => this.phase !== 'town' || this.notebook.open || this.popup.open,
      staffName: (npc) => (npcs[npc as keyof typeof npcs] ? plainText(parseLine(npcs[npc as keyof typeof npcs].name, vocab)) : ''),
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
        this.toast("It's late. You head home.");
        this.goToNight();
      }
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
    if (this.activeRun) {
      this.activeRun.noteLookup(t.lemma);
      this.learner.lookup(t.lemma, this.g.day, false);
    } else this.learner.lookup(t.lemma, this.g.day, penalize);
  }

  private tokens(markup: string, penalize = true): HTMLElement {
    return renderTokens(parseLine(markup, vocab), {
      furigana: (t) => this.learner.showFurigana(t.lemma, 2),
      onTap: (t, el) => this.lookup(t, el.getBoundingClientRect(), penalize),
    });
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
    const key = `${this.phase}|${Math.floor(this.g.minutes / 10)}|${this.g.money}|${this.g.errands.map((e) => e.done).join()}|${this.g.day}`;
    if (!force && key === this.hudKey) return;
    this.hudKey = key;
    clear(this.hud);
    if (this.phase === 'title') return;
    const errands = h('ul', { class: 'errands' }, this.g.errands.map((e) =>
      h('li', { class: e.done ? 'done' : '' }, h('span', { class: 'box' }, e.done ? '✓' : ''), this.tokens(e.text)),
    ));
    this.hud.append(
      h('div', { class: 'hud-top' },
        h('div', { class: 'clock' }, `Day ${this.g.day} · ${formatClock(this.g.minutes)} · ¥${this.g.money.toLocaleString('en-US')}`),
        h('button', { class: 'hud-btn', onclick: () => this.openNotebook(), title: 'Notebook (N)' }, 'Notebook'),
        h('button', { class: 'hud-btn', onclick: () => this.confirmSleep(), title: 'Go home and sleep' }, 'Go home'),
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
        h('button', { class: saved ? '' : 'primary', onclick: () => {
          if (saved && !confirm('Start over? Your saved game will be replaced when you next sleep.')) return;
          clearSave();
          this.begin(newGame());
        } }, 'New game'),
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

  private begin(g: GameData): void {
    this.g = g;
    this.learner = new Learner(this.g.learner, vocab);
    this.town.invalidate();
    this.town.resetPlayer();
    if (this.g.errands.length === 0) this.planDay();
    this.showMorning();
  }

  private planDay(): void {
    const recent = (this.g.recentErrands ??= {});
    this.g.errands = makeErrands(scenarios, this.learner, vocab, this.g.day, recent);
    for (const e of this.g.errands) recent[`${e.scenario}/${e.variant}`] = this.g.day;
  }

  private showMorning(): void {
    this.phase = 'morning';
    const due = this.learner.dueWords(this.g.day).length;
    this.showScreen(
      h('h2', {}, `Day ${this.g.day} · Morning`),
      h('p', {}, this.g.day === 1
        ? 'You just moved into an apartment on this shopping street. Your phone shows a list of things to do today.'
        : due > 0
          ? `${due} word${due === 1 ? ' is' : 's are'} due for review. Today's errands were picked to bring them up.`
          : "Here's what's on today's list."),
      h('ul', { class: 'errands big' }, this.g.errands.map((e) => h('li', {}, h('span', { class: 'box' }), this.tokens(e.text)))),
      h('p', { class: 'muted' }, 'Tap a word you don\'t know. Opening hours: cafe 8:00–18:00, pharmacy 9:00–19:00, post office 9:00–17:00, restaurant 11:00–22:00. The konbini and the station are always open.'),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => this.goToTown() }, 'Head out ▶')),
    );
  }

  private goToTown(): void {
    this.hideScreen();
    this.phase = 'town';
    this.input.clear();
    this.renderHud(true);
  }

  private confirmSleep(): void {
    if (this.phase !== 'town') return;
    const left = this.g.errands.filter((e) => !e.done).length;
    if (left > 0 && !confirm(`${left} errand${left === 1 ? '' : 's'} left. Go home and end the day?`)) return;
    this.goToNight();
  }

  private interact(t: Interactable): void {
    if (this.phase !== 'town') return;
    if (t.kind === 'npc') return this.startScenario(scenarioById['neighbor_greet']!);
    if (t.kind === 'bed') return this.confirmSleep();
    if (t.place === 'home') return this.town.enter('home');
    if (!isOpen(t.place, this.g.minutes)) {
      this.toast(`準備中: the ${PLACE_NAMES[t.place]!.toLowerCase()} is closed right now.`);
      return;
    }
    // Walking into a door goes inside; talking to whoever works there starts the errand.
    if (t.kind === 'door') return this.town.enter(t.place);
    this.startScenario(scenarioById[SCENARIO_FOR[t.place]]!);
  }

  private startScenario(def: ScenarioDef): void {
    const errand = this.g.errands.find((e) => e.scenario === def.id && !e.done);
    const variant = def.variants.find((v) => v.id === errand?.variant) ?? pickVariant(def, this.learner, vocab, this.g.day + this.g.minutes);
    if (variant.price && variant.price > this.g.money) {
      this.toast("You don't have enough money for that.");
      return;
    }
    const progress = progressFor(this.g, def.id);
    const period = periodOf(this.g.minutes);
    const friendship = def.npc === 'yuki' ? (this.g.friendship.yuki ?? 0) : 0;
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
        for (const l of lemmasOf(tokens)) {
          if (this.learner.see(l, { day: this.g.day, place: def.place, npc: def.npc })) this.g.today.newWords.push(l);
        }
      },
      glossOn: () => this.g.settings.gloss,
      setGloss: (on) => (this.g.settings.gloss = on),
      done: (r) => this.finishScenario(r),
    });
  }

  private finishScenario(run: ScenarioRun): void {
    const def = run.def;
    this.activeRun = null;
    // Furigana visibility as it was during the conversation.
    const shownBefore = new Map<string, Set<string>>();
    for (const ev of run.evidence) {
      const set = new Set<string>();
      for (const w of [...ev.targets, ...ev.answerWords]) if (this.learner.showFurigana(w, ev.mode)) set.add(w);
      shownBefore.set(ev.nodeId, set);
    }
    for (const ev of run.evidence) {
      this.learner.applyEvidence(ev, { day: this.g.day + this.g.minutes / 1440, furiganaShown: (id) => shownBefore.get(ev.nodeId)!.has(id) });
    }
    for (const node of Object.values(def.nodes)) {
      for (const gid of node.grammar ?? []) if (!this.g.grammarSeen.includes(gid)) this.g.grammarSeen.push(gid);
    }
    for (const c of run.corrections) {
      this.g.today.corrections.push(c);
      this.g.corrections.push({ ...c, day: this.g.day });
      if (c.grammar && !this.g.grammarSeen.includes(c.grammar)) this.g.grammarSeen.push(c.grammar);
    }
    if (this.g.corrections.length > 300) this.g.corrections.splice(0, this.g.corrections.length - 300);

    this.g.money -= run.moneySpent;
    if (def.npc === 'yuki') {
      const before = friendshipLevel(this.g.friendship.yuki ?? 0);
      this.g.friendship.yuki = Math.max(0, (this.g.friendship.yuki ?? 0) + run.friendshipDelta);
      const after = friendshipLevel(this.g.friendship.yuki);
      if (after > before) this.g.today.promotions.push(`ゆき now treats you as a${after === 1 ? 'n' : ''} ${FRIENDSHIP_NAMES[after]}.`);
    }
    if (def.id === 'neighbor_greet') this.g.today.greeted = true;

    const progress = progressFor(this.g, def.id);
    const { progress: next, promoted } = finishRun(progress, run.clean, def.maxStage);
    this.g.progress[def.id] = next;
    if (promoted) {
      const msg = `${def.title}: now stage ${next.stage}, ${MODE_NAMES[next.stage as Mode].toLowerCase()}.`;
      this.g.today.promotions.push(msg);
      this.toast(msg);
    } else if (run.clean) {
      this.toast(next.stage >= def.maxStage ? 'Clean visit.' : `Clean visit (${next.cleanRuns}/3 to the next stage).`);
    } else {
      this.toast('Done. Notes for tonight are in your notebook.');
    }

    const errand = this.g.errands.find((e) => e.scenario === def.id && e.variant === run.variant.id && !e.done);
    if (errand) errand.done = true;
    this.g.minutes = Math.min(DAY_END - 1, this.g.minutes + MINUTES_PER_SCENARIO);
    this.town.invalidate();
    this.phase = 'town';
    this.input.clear();
    this.renderHud(true);
  }

  private goToNight(): void {
    this.phase = 'night';
    this.popup.hide();
    this.notebook.close();
    const t = this.g.today;
    const newWords = [...new Set(t.newWords)];
    const friendNow = this.g.friendship.yuki ?? 0;
    const friendDelta = friendNow - (t.friendshipStart.yuki ?? 0);
    const done = this.g.errands.filter((e) => e.done).length;
    this.showScreen(
      h('h2', {}, `Day ${this.g.day} · Night`),
      h('p', {}, `You finished ${done} of ${this.g.errands.length} errands and looked up ${t.lookups} word${t.lookups === 1 ? '' : 's'}. ¥${this.g.money.toLocaleString('en-US')} left.`),
      t.promotions.length ? h('ul', { class: 'promos' }, t.promotions.map((p) => h('li', {}, p))) : null,
      friendDelta !== 0 ? h('p', {}, `Friendship with `, this.tokens('ゆき', false), friendDelta > 0 ? ' went up.' : ' went down a little.') : null,
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
    this.g.day += 1;
    this.g.minutes = DAY_START;
    this.g.today = newDayLog(this.g.friendship);
    this.planDay();
    const ok = save(this.g);
    this.town.invalidate();
    this.town.resetPlayer();
    this.showMorning();
    if (!ok) this.toast("Couldn't save in this browser (storage is blocked). You can keep playing.");
  }

  // ------------------------------------------------------------------ testing hooks

  /** State snapshot for automated play-tests. */
  debugState(): { phase: Phase; scene: DoorPlace | null; day: number; minutes: number; money: number; stage: Record<string, number>; friendship: number; words: number } {
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
  debugGoTo(place: DoorPlace | 'tanaka'): void {
    this.town.debugGoTo(place);
  }

  /** Teleport to a door on the street (play-test helper). */
  debugTownDoor(place: DoorPlace): void {
    this.town.debugTownDoor(place);
  }

  get place(): PlaceId | null {
    return this.activeRun?.def.place ?? null;
  }
}
