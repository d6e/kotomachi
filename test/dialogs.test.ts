import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The game is published in a sandboxed frame without allow-modals. There the browser's
// confirm() returns false at once and alert()/prompt() do nothing, so a button that
// asks "are you sure?" that way silently does nothing (this broke New game).
test('the game never uses the browser’s confirm, alert or prompt boxes', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []));
  const found: string[] = [];
  for (const f of files('src')) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\*|\/\*)/.test(line)) return;
      const code = line.replace(/\/\/.*$/, '').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
      if (/(?<![\w$.])(?:(?:window|globalThis|self)\s*\.\s*)?(?:confirm|alert|prompt)\s*\(/.test(code)) found.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(found, [], 'use an in-game question (Game.ask) instead');
});
