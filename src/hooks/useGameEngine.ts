import { useEffect, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { QUESTION_TIME_LIMIT_MS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useGameStore } from "@/store/game-store";
import type { GhostPlaybackFrame, MatchCompetitor, MatchQuestionView, MatchResult, MatchSummary } from "@/types/domain";

function toQuestionView(row: any): MatchQuestionView {
  return {
    id: row.question.id,
    sequence: row.sequence,
    prompt: row.question.question_text,
    difficulty: row.question.difficulty,
    options: {
      A: row.question.option_a,
      B: row.question.option_b,
      C: row.question.option_c,
      D: row.question.option_d,
    },
  };
}

export function useGameEngine() {
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = params.matchId;
  const summary = useGameStore((state) => state.summary);
  const questions = useGameStore((state) => state.questions);
  const currentQuestionIndex = useGameStore((state) => state.currentQuestion);
  const countdownMs = useGameStore((state) => state.countdownMs);
  const state = useGameStore((store) => store.state);
  const localAnswerLocked = useGameStore((store) => store.localAnswerLocked);
  const playerScore = useGameStore((store) => store.playerScore);
  const opponentScore = useGameStore((store) => store.opponentScore);
  const ghostFramesStore = useGameStore((store) => store.ghostFrames);
  const setMatchPayload = useGameStore((store) => store.setMatchPayload);
  const tick = useGameStore((store) => store.tick);
  const setState = useGameStore((store) => store.setState);
  const setScores = useGameStore((store) => store.setScores);
  const resultStore = useGameStore((store) => store.result);

  const matchQuery = useQuery({
    enabled: !!matchId,
    queryKey: ["match-sync", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-match-state", {
        body: { matchId },
      });

      if (error) {
        throw error;
      }

      return data as {
        match: any;
        participants: any[];
        questions: any[];
        answers: any[];
        ghostFrames: GhostPlaybackFrame[];
        playerScore: number;
        opponentScore: number;
        player: MatchCompetitor | null;
        opponent: MatchCompetitor | null;
        result: MatchResult | null;
      };
    },
    refetchInterval: 1000,
  });

  const ghostFrames = useMemo<GhostPlaybackFrame[]>(() => {
    return matchQuery.data?.ghostFrames ?? [];
  }, [matchQuery.data?.ghostFrames]);

  useEffect(() => {
    if (!matchQuery.data?.match) {
      return;
    }

    const summary: MatchSummary = {
      id: matchQuery.data.match.id,
      categoryId: matchQuery.data.match.category_id,
      categoryName: matchQuery.data.match.category_name ?? matchQuery.data.match.metadata?.categoryName ?? "Category",
      matchType: matchQuery.data.match.match_type,
      mode: matchQuery.data.match.mode,
      state: matchQuery.data.match.state,
      currentQuestion: matchQuery.data.match.current_question,
      totalQuestions: matchQuery.data.match.total_questions,
      startedAt: matchQuery.data.match.started_at,
      questionStartedAt: matchQuery.data.match.question_started_at,
      expiresAt: matchQuery.data.match.expires_at,
    };

    const questions = (matchQuery.data.questions ?? []).map(toQuestionView);
    setMatchPayload({
      summary,
      questions,
      ghostFrames,
      playerScore: matchQuery.data.playerScore,
      opponentScore: matchQuery.data.opponentScore,
      result: matchQuery.data.result,
    });
  }, [ghostFrames, matchQuery.data, setMatchPayload]);

  useEffect(() => {
    if (!summary?.questionStartedAt) {
      return;
    }

    const questionStartedAt = new Date(summary.questionStartedAt).getTime();
    const interval = setInterval(() => {
      const elapsed = Date.now() - questionStartedAt;
      tick(Math.max(0, QUESTION_TIME_LIMIT_MS - elapsed));
    }, 250);

    return () => clearInterval(interval);
  }, [summary?.questionStartedAt, tick]);

  useEffect(() => {
    const channel = supabase
      .channel(`match:${matchId}`)
      .on("broadcast", { event: "score_update" }, ({ payload }) => {
        setScores(payload.playerScore ?? 0, payload.opponentScore ?? 0);
      })
      .on("broadcast", { event: "question_start" }, ({ payload }) => {
        setState("question_active", payload.currentQuestion);
      })
      .on("broadcast", { event: "match_end" }, () => {
        setState("results", currentQuestionIndex);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentQuestionIndex, matchId, setScores, setState]);

  const currentQuestion = questions.find((question) => question.sequence === currentQuestionIndex) ?? questions[0];

  return {
    summary,
    questions,
    ghostFrames: ghostFramesStore,
    currentQuestionNumber: currentQuestionIndex,
    countdownMs,
    state,
    localAnswerLocked,
    playerScore,
    opponentScore,
    result: matchQuery.data?.result ?? resultStore,
    player: matchQuery.data?.player ?? null,
    opponent: matchQuery.data?.opponent ?? null,
    currentQuestion,
    matchId,
    mode: summary?.mode ?? "live",
    isLoading: matchQuery.isLoading,
    error: matchQuery.error,
    refetch: matchQuery.refetch,
  };
}
