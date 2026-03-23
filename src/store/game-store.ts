import { create } from "zustand";

import type { GhostPlaybackFrame, MatchQuestionView, MatchResult, MatchState, MatchSummary } from "@/types/domain";

interface GameStore {
  summary: MatchSummary | null;
  questions: MatchQuestionView[];
  ghostFrames: GhostPlaybackFrame[];
  currentQuestion: number;
  countdownMs: number;
  state: MatchState;
  localAnswerLocked: boolean;
  playerScore: number;
  opponentScore: number;
  lastScoreDelta: number;
  result: MatchResult | null;
  setMatchPayload: (payload: {
    summary: MatchSummary;
    questions: MatchQuestionView[];
    ghostFrames?: GhostPlaybackFrame[];
    playerScore?: number;
    opponentScore?: number;
    result?: MatchResult | null;
  }) => void;
  tick: (countdownMs: number) => void;
  setState: (state: MatchState, currentQuestion?: number) => void;
  lockAnswer: () => void;
  unlockAnswer: () => void;
  setScores: (playerScore: number, opponentScore: number) => void;
  setLastScoreDelta: (scoreDelta: number) => void;
  reset: () => void;
}

const initialState = {
  summary: null,
  questions: [],
  ghostFrames: [],
  currentQuestion: 1,
  countdownMs: 10_000,
  state: "waiting" as MatchState,
  localAnswerLocked: false,
  playerScore: 0,
  opponentScore: 0,
  lastScoreDelta: 0,
  result: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  setMatchPayload: ({ summary, questions, ghostFrames = [], playerScore, opponentScore, result }) =>
    set({
      summary,
      questions,
      ghostFrames,
      state: summary.state,
      currentQuestion: Math.max(summary.currentQuestion, 1),
      localAnswerLocked: false,
      playerScore: playerScore ?? initialState.playerScore,
      opponentScore: opponentScore ?? initialState.opponentScore,
      result: result ?? null,
    }),
  tick: (countdownMs) => set({ countdownMs }),
  setState: (state, currentQuestion) => set({ state, currentQuestion: currentQuestion ?? 1, localAnswerLocked: false }),
  lockAnswer: () => set({ localAnswerLocked: true }),
  unlockAnswer: () => set({ localAnswerLocked: false }),
  setScores: (playerScore, opponentScore) => set({ playerScore, opponentScore }),
  setLastScoreDelta: (lastScoreDelta) => set({ lastScoreDelta }),
  reset: () => set(initialState),
}));
