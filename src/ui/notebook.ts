// The notebook: words grouped by place and by person, corrections, grammar you've met,
// and progress (ladder stage per scenario, friendship).

import { parseLine, type Token, type Vocab } from '../lang/markup.ts';
import type { Learner } from '../learner/model.ts';
import { friendshipLevel, FRIENDSHIP_LEVELS, FRIENDSHIP_NAMES, MODE_NAMES, PROMOTE_AFTER_CLEAN_RUNS } from '../scenario/engine.ts';
import type { GrammarNote, NpcDef, NpcId, ScenarioDef } from '../scenario/types.ts';
import type { GameData } from '../game/state.ts';
import { clear, h } from './dom.ts';
import { STATUS_LABEL } from './popup.ts';
import { ALWAYS, renderTokens } from './text.ts';

export interface NotebookContext {
  vocab: Vocab;
  learner: Learner;
  npcs: Record<NpcId, NpcDef>;
  grammar: Record<string, GrammarNote>;
  scenarios: ScenarioDef[];
  placeName: (place: string) => string;
  lookup: (t: Token, el: HTMLElement) => void;
  /** What you have (持ち物), for the Things tab. */
  things?: () => Thing[];
}

export interface Thing {
  id: string;
  word: string;
  meaning: string;
  count: number;
  onShelf: boolean;
  icon: HTMLElement;
}

type Tab = 'places' | 'people' | 'things' | 'corrections' | 'grammar' | 'progress';
const TABS: [Tab, string][] = [
  ['places', 'Words by place'],
  ['people', 'Words by person'],
  ['things', 'Things'],
  ['corrections', 'Corrections'],
  ['grammar', 'Grammar'],
  ['progress', 'Progress'],
];

export class Notebook {
  readonly el: HTMLElement;
  private readonly body: HTMLElement;
  private readonly tabs: HTMLElement;
  private tab: Tab = 'places';
  private ctx: NotebookContext | null = null;
  private game: GameData | null = null;
  onClose: () => void = () => {};

  constructor(root: HTMLElement) {
    this.tabs = h('div', { class: 'nb-tabs', role: 'tablist' });
    this.body = h('div', { class: 'nb-body' });
    this.el = h('div', { class: 'notebook panel', hidden: true, role: 'dialog', 'aria-label': 'Notebook' },
      h('div', { class: 'panel-head' }, h('h2', {}, 'Notebook'), h('button', { class: 'close', 'aria-label': 'Close notebook', onclick: () => this.close() }, '×')),
      this.tabs,
      this.body,
    );
    root.append(this.el);
    window.addEventListener('keydown', (e) => {
      if (!this.el.hidden && e.key === 'Escape' && !document.querySelector('.popup:not([hidden])')) this.close();
    });
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(ctx: NotebookContext, game: GameData, tab?: Tab): void {
    this.ctx = ctx;
    this.game = game;
    if (tab) this.tab = tab;
    this.el.hidden = false;
    this.draw();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose();
  }

  private draw(): void {
    clear(this.tabs);
    for (const [id, label] of TABS) {
      this.tabs.append(h('button', { role: 'tab', class: id === this.tab ? 'active' : '', 'aria-selected': String(id === this.tab), onclick: () => { this.tab = id; this.draw(); } }, label));
    }
    clear(this.body);
    const fn = { places: this.places, people: this.people, things: this.thingsTab, corrections: this.corrections, grammar: this.grammarTab, progress: this.progress }[this.tab];
    fn.call(this);
  }

  private wordRow(id: string): HTMLElement {
    const { vocab, learner } = this.ctx!;
    const e = vocab.get(id)!;
    const st = learner.status(id);
    const rec = learner.get(id);
    return h('li', { class: 'nb-word' },
      renderTokens(parseLine(id, vocab), { furigana: ALWAYS, onTap: this.ctx!.lookup, className: 'nb-jp' }),
      h('span', { class: 'nb-meaning' }, e.meaning),
      h('span', { class: `chip st-${st}` }, STATUS_LABEL[st]),
      rec && rec.lookups > 0 ? h('span', { class: 'nb-lookups', title: 'Times looked up' }, `looked up ×${rec.lookups}`) : null,
    );
  }

  private group(title: HTMLElement | string, ids: string[]): HTMLElement {
    return h('section', { class: 'nb-group' }, h('h3', {}, title), ids.length ? h('ul', {}, ids.map((id) => this.wordRow(id))) : h('p', { class: 'empty' }, 'Nothing yet.'));
  }

  private places(): void {
    const { learner } = this.ctx!;
    const by = new Map<string, string[]>();
    for (const [id, r] of Object.entries(learner.data.words)) {
      for (const m of r.met) {
        const list = by.get(m.place) ?? [];
        if (!list.includes(id)) list.push(id);
        by.set(m.place, list);
      }
    }
    if (by.size === 0) this.body.append(h('p', { class: 'empty' }, 'Words you hear or read around town collect here.'));
    for (const place of ['cafe', 'konbini', 'pharmacy', 'restaurant', 'station', 'post', 'street', 'shrine', 'omiyage', 'matsuri']) {
      const ids = by.get(place);
      if (ids) this.body.append(this.group(this.ctx!.placeName(place), ids));
    }
  }

  private people(): void {
    const { learner, npcs, vocab } = this.ctx!;
    const by = new Map<string, string[]>();
    for (const [id, r] of Object.entries(learner.data.words)) {
      for (const m of r.met) {
        if (!m.npc) continue;
        const list = by.get(m.npc) ?? [];
        if (!list.includes(id)) list.push(id);
        by.set(m.npc, list);
      }
    }
    if (by.size === 0) this.body.append(h('p', { class: 'empty' }, 'Words collect here under the person who said them.'));
    for (const [npc, ids] of by) {
      const n = npcs[npc as NpcId];
      const title = h('span', {}, renderTokens(parseLine(n.name, vocab), { furigana: ALWAYS }), h('span', { class: 'role' }, ` ${n.role}`));
      this.body.append(this.group(title, ids));
    }
  }

  /** Everything you have, and what's on your shelf at home. */
  private thingsTab(): void {
    const { vocab } = this.ctx!;
    const list = this.ctx!.things?.() ?? [];
    const head = h('h3', {}, renderTokens(parseLine('持ち物', vocab), { furigana: ALWAYS, onTap: this.ctx!.lookup }));
    if (!list.length) {
      this.body.append(h('section', { class: 'nb-group' }, head, h('p', { class: 'empty' }, 'What you buy in town is yours to keep, errands for neighbours included, and so are gifts and souvenirs. It all collects here.')));
      return;
    }
    const shelved = list.filter((t) => t.onShelf).length;
    this.body.append(h('section', { class: 'nb-group' }, head,
      h('ul', {}, list.map((t) => h('li', { class: 'nb-word nb-thing' },
        t.icon,
        renderTokens(parseLine(t.word, vocab), { furigana: ALWAYS, onTap: this.ctx!.lookup, className: 'nb-jp' }),
        h('span', { class: 'nb-meaning' }, t.count > 1 ? `${t.meaning} ×${t.count}` : t.meaning),
        t.onShelf ? h('span', { class: 'chip st-recognized' }, 'On the shelf') : null,
      ))),
      h('p', { class: 'muted' }, `${shelved} on the shelf in your room. Go home and tap the shelf to choose what goes on it.`),
    ));
  }

  private corrections(): void {
    const g = this.game!;
    const list = [...g.corrections].reverse();
    if (list.length === 0) {
      this.body.append(h('p', { class: 'empty' }, 'Mistakes and notes from conversations land here. Nobody stops a conversation to correct you.'));
      return;
    }
    this.body.append(h('ul', { class: 'nb-corrections' }, list.slice(0, 80).map((c) => correctionItem(c, this.ctx!))));
  }

  private grammarTab(): void {
    const g = this.game!;
    const { grammar, vocab } = this.ctx!;
    if (g.grammarSeen.length === 0) {
      this.body.append(h('p', { class: 'empty' }, 'Grammar you run into is unlocked here.'));
      return;
    }
    for (const id of g.grammarSeen) {
      const note = grammar[id];
      if (!note) continue;
      this.body.append(h('section', { class: 'nb-grammar' },
        h('h3', { lang: 'ja' }, note.title),
        h('p', {}, note.note),
        h('div', { class: 'example' }, renderTokens(parseLine(note.example, vocab), { furigana: ALWAYS, onTap: this.ctx!.lookup })),
      ));
    }
  }

  private progress(): void {
    const g = this.game!;
    const { learner, scenarios, npcs, vocab } = this.ctx!;
    const counts = learner.counts();
    const due = learner.dueWords(g.day).length;
    this.body.append(
      h('section', { class: 'nb-group' }, h('h3', {}, 'Words'),
        h('div', { class: 'stats' },
          ...(['seen', 'recognized', 'produced'] as const).map((s) => h('div', { class: 'stat' }, h('b', {}, String(counts[s])), ` ${s}`)),
          h('div', { class: 'stat' }, h('b', {}, String(due)), ' due today'),
          h('div', { class: 'stat' }, h('b', {}, String(counts.unseen)), ' not met yet'),
        )),
    );
    const rows = scenarios.map((s) => {
      const p = g.progress[s.id];
      const stage = p?.stage ?? 1;
      return h('tr', {},
        h('td', {}, s.title),
        h('td', {}, `${stage}. ${MODE_NAMES[stage]}`),
        h('td', {}, stage >= s.maxStage ? `max for now (${p?.runs ?? 0} visits)` : `${p?.cleanRuns ?? 0}/${PROMOTE_AFTER_CLEAN_RUNS} clean visits to the next stage`),
      );
    });
    this.body.append(h('section', { class: 'nb-group' }, h('h3', {}, 'Conversations'), h('table', { class: 'nb-table' }, h('tbody', {}, rows))));
    const pts = g.friendship.yuki ?? 0;
    const level = friendshipLevel(pts);
    const next = FRIENDSHIP_LEVELS[level + 1];
    this.body.append(h('section', { class: 'nb-group' }, h('h3', {}, 'Friendship'),
      h('p', {}, renderTokens(parseLine(npcs.yuki.name, vocab), { furigana: ALWAYS }),
        `: ${FRIENDSHIP_NAMES[level]} (${pts} pts${next !== undefined ? `, ${next} for ${FRIENDSHIP_NAMES[level + 1]}` : ''}). `,
        level === 0 ? 'She speaks politely (です/ます).' : level === 1 ? 'Polite, with casual asides (よね, ちょっと).' : 'She talks to you in plain form now.'),
    ));
  }
}

export function correctionItem(
  c: GameData['corrections'][number],
  ctx: { grammar: Record<string, GrammarNote>; lookup?: (t: Token, el: HTMLElement) => void },
): HTMLElement {
  const note = c.grammar ? ctx.grammar[c.grammar] : undefined;
  const text = (plain: string, tokens?: Token[]) =>
    tokens ? renderTokens(tokens, { furigana: ALWAYS, onTap: ctx.lookup }) : h('span', { lang: 'ja' }, plain);
  return h('li', { class: 'correction' },
    h('div', { class: 'said' }, h('span', { class: 'mark bad' }, c.said === c.better ? '△' : '✗'), ' 「', text(c.said, c.saidTokens), '」'),
    c.said !== c.better ? h('div', { class: 'better' }, h('span', { class: 'mark good' }, '✓'), ' 「', text(c.better, c.betterTokens), '」') : null,
    h('div', { class: 'note' }, c.note),
    note ? h('div', { class: 'gnote' }, h('b', { lang: 'ja' }, note.title), ` ${note.note}`) : null,
    h('div', { class: 'meta' }, `day ${c.day}`),
  );
}
