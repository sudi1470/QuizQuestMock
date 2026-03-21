import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ScoreBar } from "@/components/game/ScoreBar";
import { Card } from "@/components/ui/Card";
import { useGameEngine } from "@/hooks/useGameEngine";
import { supabase } from "@/lib/supabase";
import { useGameStore } from "@/store/game-store";
import type { AnswerOption } from "@/types/domain";

const answerOptions: AnswerOption[] = ["A", "B", "C", "D"];

export default function BattleScreen() {
  const { currentQuestion, countdownMs, ghostFrames, isLoading, matchId, mode, playerScore, opponentScore, state } = useGameEngine();
  const localAnswerLocked = useGameStore((store) => store.localAnswerLocked);
  const lockAnswer = useGameStore((store) => store.lockAnswer);

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

  if (isLoading || !currentQuestion) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <ActivityIndicator color="#F4B942" />
      </View>
    );
  }

  async function submitAnswer(selectedAnswer: AnswerOption) {
    if (localAnswerLocked || !matchId) {
      return;
    }

    lockAnswer();
    await supabase.functions.invoke("submit-answer", {
      body: {
        matchId,
        questionSequence: currentQuestion.sequence,
        selectedAnswer,
        responseTimeMs: 10_000 - countdownMs,
      },
    });
  }

  return (
    <ScrollView className="flex-1 bg-ink" contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View className="pt-8">
        <Text className="text-sm uppercase tracking-[3px] text-secondary">{mode === "ghost" ? "Ghost Match" : "Live Match"}</Text>
        <Text className="mt-2 text-4xl font-bold text-white">Question {currentQuestion.sequence} of 7</Text>
        <Text className="mt-2 text-base text-muted">State: {state}. Server-authoritative timers, client-local animation.</Text>
      </View>

      <Card>
        <View className="gap-4">
          <ScoreBar label="You" score={playerScore} progress={(playerScore / 7000) * 100} accentClassName="bg-accent" />
          <ScoreBar
            label={mode === "ghost" ? "Ghost" : "Opponent"}
            score={mode === "ghost" ? ghostProjection : opponentScore}
            progress={((mode === "ghost" ? ghostProjection : opponentScore) / 7000) * 100}
            accentClassName="bg-secondary"
          />
          <View className="rounded-2xl bg-white/5 p-4">
            <Text className="text-sm text-muted">Countdown</Text>
            <Text className="text-4xl font-bold text-white">{(countdownMs / 1000).toFixed(1)}s</Text>
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
