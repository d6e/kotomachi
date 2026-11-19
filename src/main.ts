import { Game } from './game/game.ts';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');
new Game(root).start();
