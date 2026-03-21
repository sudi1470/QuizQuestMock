import { useEffect, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { QUESTION_TIME_LIMIT_MS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useGameStore } from "@/store/game-store";
import type { GhostPlaybackFrame, MatchQuestionView, MatchSummary } from "@/types/domain";

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
      };
    },
    refetchInterval: 3000,
  });

  const ghostFrames = useMemo<GhostPlaybackFrame[]>(() => {
    const answers = matchQuery.data?.answers ?? [];
    const ghostUserId = matchQuery.data?.participants?.find((participant) => participant.is_ghost)?.user_id;
    return answers
      .filter((answer) => answer.user_id === ghostUserId)
      .map((answer) => ({
        questionSequence: answer.question_sequence,
        answerOffsetMs: answer.answered_at_offset_ms,
        selectedAnswer: answer.selected_answer,
        awardedScore: answer.score_awarded,
        cumulativeScore: answer.cumulative_score,
      }));
  }, [matchQuery.data?.answers, matchQuery.data?.participants]);

  useEffect(() => {
    if (!matchQuery.data?.match) {
      return;
    }

    const summary: MatchSummary = {
      id: matchQuery.data.match.id,
      categoryId: matchQuery.data.match.category_id,
      categoryName: matchQuery.data.match.metadata?.categoryName ?? "Category",
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
    setMatchPayload({ summary, questions, ghostFrames });
  }, [ghostFrames, matchQuery.data?.match, matchQuery.data?.questions, setMatchPayload]);

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
    currentQuestion,
    matchId,
    mode: summary?.mode ?? "live",
    isLoading: matchQuery.isLoading,
    error: matchQuery.error,
    refetch: matchQuery.refetch,
  };
}
