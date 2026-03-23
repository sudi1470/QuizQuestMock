import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ScoreBar } from "@/components/game/ScoreBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useGameEngine } from "@/hooks/useGameEngine";
import { supabase } from "@/lib/supabase";
import { useGameStore } from "@/store/game-store";
import type { AnswerOption } from "@/types/domain";

const answerOptions: AnswerOption[] = ["A", "B", "C", "D"];

export default function BattleScreen() {
  const { currentQuestion, countdownMs, ghostFrames, isLoading, matchId, mode, playerScore, opponentScore, state, result, player, opponent, refetch } =
    useGameEngine();
  const lastScoreDelta = useGameStore((store) => store.lastScoreDelta);
  const setLastScoreDelta = useGameStore((store) => store.setLastScoreDelta);
  const timeoutReadyQuestionsRef = useRef<Record<string, boolean>>({});
  const submittingQuestionSequenceRef = useRef<number | null>(null);
  const [submittingQuestionSequence, setSubmittingQuestionSequence] = useState<number | null>(null);

  const currentQuestionKey = currentQuestion ? `${matchId}:${currentQuestion.sequence}` : null;
  const localAnswerLocked = !!currentQuestion && submittingQuestionSequence === currentQuestion.sequence;

  const ghostProjection = useMemo(() => {
    if (!currentQuestion) {
      return 0;
    }
    const frame = ghostFrames.find((entry) => entry.questionSequence === currentQuestion.sequence);
    if (!frame) {
      return opponentScore;
    }
    return countdownMs <= 10_000 - frame.answerOffsetMs ? frame.cumulativeScore : opponentScore;
  }, [countdownMs, currentQuestion, ghostFrames, opponentScore]);

  useEffect(() => {
    if (!currentQuestionKey) {
      return;
    }

    if (countdownMs > 0) {
      timeoutReadyQuestionsRef.current[currentQuestionKey] = true;
    }
  }, [countdownMs, currentQuestionKey]);

  useEffect(() => {
    if (!currentQuestion || submittingQuestionSequence === null) {
      return;
    }

    if (currentQuestion.sequence !== submittingQuestionSequence) {
      submittingQuestionSequenceRef.current = null;
      setSubmittingQuestionSequence(null);
    }
  }, [currentQuestion, submittingQuestionSequence]);

  useEffect(() => {
    if (!currentQuestion || !currentQuestionKey || localAnswerLocked || state === "complete" || state === "results" || countdownMs > 0) {
      return;
    }

    if (!timeoutReadyQuestionsRef.current[currentQuestionKey]) {
      return;
    }

    timeoutReadyQuestionsRef.current[currentQuestionKey] = false;
    void submitAnswer(null);
  }, [countdownMs, currentQuestion, currentQuestionKey, localAnswerLocked, state]);

  if (isLoading || !currentQuestion) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <ActivityIndicator color="#F4B942" />
      </View>
    );
  }

  async function submitAnswer(selectedAnswer: AnswerOption | null) {
    if (!matchId || !currentQuestion || submittingQuestionSequenceRef.current === currentQuestion.sequence) {
      return;
    }

    const questionSequence = currentQuestion.sequence;
    submittingQuestionSequenceRef.current = questionSequence;
    setSubmittingQuestionSequence(questionSequence);

    try {
      const { data, error } = await supabase.functions.invoke("submit-answer", {
        body: {
          matchId,
          questionSequence,
          selectedAnswer,
          responseTimeMs: 10_000 - countdownMs,
        },
      });

      if (error) {
        throw error;
      }

      setLastScoreDelta(data?.awardedScore ?? 0);
      await refetch();
    } catch (error) {
      submittingQuestionSequenceRef.current = null;
      setSubmittingQuestionSequence(null);
      console.error("Failed to submit answer", error);
    }
  }

  if (result && (state === "complete" || state === "results")) {
    return (
      <ScrollView className="flex-1 bg-ink" contentContainerStyle={{ padding: 24, gap: 16 }}>
        <View className="pt-8">
          <Text className="text-sm uppercase tracking-[3px] text-secondary">Match Complete</Text>
          <Text className="mt-2 text-4xl font-bold text-white">
            {result.isDraw ? "It’s a draw." : result.player.outcome === "win" ? "You win." : "Ghost wins."}
          </Text>
          <Text className="mt-2 text-base text-muted">This payload is the data source we’ll later style into the polished results screen.</Text>
        </View>

        <Card>
          <View className="gap-4">
            <ScoreBar label={result.player.username} score={result.player.finalScore} progress={(result.player.finalScore / 7000) * 100} accentClassName="bg-accent" />
            <ScoreBar
              label={result.opponent.username}
              score={result.opponent.finalScore}
              progress={(result.opponent.finalScore / 7000) * 100}
              accentClassName="bg-secondary"
            />
            <View className="flex-row justify-between">
              <Text className="text-sm text-muted">Mock XP delta</Text>
              <Text className="text-sm font-semibold text-white">+{result.xpDelta}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-muted">Rating delta</Text>
              <Text className="text-sm font-semibold text-white">{result.ratingDelta > 0 ? `+${result.ratingDelta}` : result.ratingDelta}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text className="text-lg font-semibold text-white">Result payload</Text>
          <Text className="mt-2 text-sm text-muted">
            Player: {result.player.username} • Level {result.player.level} • Score {result.player.finalScore}
          </Text>
          <Text className="mt-1 text-sm text-muted">
            Opponent: {result.opponent.username} • Level {result.opponent.level} • Score {result.opponent.finalScore}
          </Text>
        </Card>

        <Button label="Back to Lobby" onPress={() => router.replace("/(tabs)/lobby")} />
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-ink" contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View className="pt-8">
        <Text className="text-sm uppercase tracking-[3px] text-secondary">{mode === "ghost" ? "Ghost Match" : "Live Match"}</Text>
        <Text className="mt-2 text-4xl font-bold text-white">Question {currentQuestion.sequence} of 7</Text>
        <Text className="mt-2 text-base text-muted">
          {player?.username ?? "You"} versus {opponent?.username ?? "Echo Rival"}. Server-authoritative timers, ghost answer timing, and real question scoring.
        </Text>
      </View>

      <Card>
        <View className="gap-4">
          <ScoreBar label={player?.username ?? "You"} score={playerScore} progress={(playerScore / 7000) * 100} accentClassName="bg-accent" />
          <ScoreBar
            label={opponent?.username ?? (mode === "ghost" ? "Ghost" : "Opponent")}
            score={mode === "ghost" ? ghostProjection : opponentScore}
            progress={((mode === "ghost" ? ghostProjection : opponentScore) / 7000) * 100}
            accentClassName="bg-secondary"
          />
          <View className="rounded-2xl bg-white/5 p-4">
            <Text className="text-sm text-muted">Countdown</Text>
            <Text className="text-4xl font-bold text-white">{(countdownMs / 1000).toFixed(1)}s</Text>
            {lastScoreDelta > 0 ? <Text className="mt-2 text-sm font-semibold text-success">+{lastScoreDelta} points</Text> : null}
          </View>
        </View>
      </Card>

      <Card>
        <Text className="text-xs uppercase tracking-[2px] text-secondary">{currentQuestion.difficulty}</Text>
        <Text className="mt-3 text-2xl font-semibold text-white">{currentQuestion.prompt}</Text>
        <View className="mt-6 gap-3">
          {answerOptions.map((option) => (
            <Pressable
              key={option}
              disabled={localAnswerLocked}
              className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${localAnswerLocked ? "opacity-60" : ""}`}
              onPress={() => void submitAnswer(option)}
            >
              <Text className="text-base font-medium text-white">
                {option}. {currentQuestion.options[option]}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}
