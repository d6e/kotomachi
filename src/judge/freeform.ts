// Stage 5 (freeform typing) is judged by an LLM in the full design. This MVP ships only
// the interface and a judge that reports itself unavailable, so scenarios never promote
// past stage 4 and any stage-5 node quietly plays as fill-in-the-blank.

import type { FreeformDef } from '../scenario/types.ts';

export interface JudgeError {
  type: 'particle' | 'conjugation' | 'register' | 'word_choice' | 'unnatural';
  corrected: string;
}

export interface JudgeResult {
  /** One of the node's accepted intents, or "off_script". */
  intent: string;
  errors: JudgeError[];
  register: 'casual' | 'polite' | 'keigo';
  /** 0..1. When low, the NPC asks the player to clarify in-world instead of guessing. */
  confidence: number;
}

export interface JudgeRequest {
  scenario: string;
  nodeId: string;
  npcLine: string;
  playerText: string;
  spec: FreeformDef;
  /** Dictionary forms the player knows, for the vocabulary check on generated lines. */
  knownWords: string[];
}

export interface FreeformJudge {
  available(): boolean;
  judge(req: JudgeRequest): Promise<JudgeResult>;
}

export class UnavailableJudge implements FreeformJudge {
  available(): boolean {
    return false;
  }

  judge(_req: JudgeRequest): Promise<JudgeResult> {
    return Promise.reject(new Error('No freeform judge is configured in this build.'));
  }
}
