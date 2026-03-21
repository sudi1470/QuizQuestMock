import { create } from "zustand";

import type { GhostPlaybackFrame, MatchQuestionView, MatchState, MatchSummary } from "@/types/domain";

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
  setMatchPayload: (payload: {
    summary: MatchSummary;
    questions: MatchQuestionView[];
    ghostFrames?: GhostPlaybackFrame[];
  }) => void;
  tick: (countdownMs: number) => void;
  setState: (state: MatchState, currentQuestion?: number) => void;
  lockAnswer: () => void;
  unlockAnswer: () => void;
  setScores: (playerScore: number, opponentScore: number) => void;
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
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  setMatchPayload: ({ summary, questions, ghostFrames = [] }) =>
    set({
      summary,
      questions,
      ghostFrames,
      state: summary.state,
      currentQuestion: Math.max(summary.currentQuestion, 1),
      localAnswerLocked: false,
    }),
  tick: (countdownMs) => set({ countdownMs }),
  setState: (state, currentQuestion) => set({ state, currentQuestion: currentQuestion ?? 1, localAnswerLocked: false }),
  lockAnswer: () => set({ localAnswerLocked: true }),
  unlockAnswer: () => set({ localAnswerLocked: false }),
  setScores: (playerScore, opponentScore) => set({ playerScore, opponentScore }),
  reset: () => set(initialState),
}));
