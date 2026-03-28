import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { MotiView } from "moti";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ScoreBar } from "@/components/game/ScoreBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useGameEngine } from "@/hooks/useGameEngine";
import { supabase } from "@/lib/supabase";
import { useGameStore } from "@/store/game-store";
import type { AnswerOption } from "@/types/domain";

const answerOptions: AnswerOption[] = ["A", "B", "C", "D"];
const OPTION_REVEAL_DURATION_MS = 320;
const OPTION_REVEAL_STAGGER_MS = 60;
const ANSWER_READY_DELAY_MS = OPTION_REVEAL_DURATION_MS + OPTION_REVEAL_STAGGER_MS * (answerOptions.length - 1);

interface RevealOptionProps {
  option: AnswerOption;
  label: string;
  disabled: boolean;
  revealKey: string;
  index: number;
  onPress: () => void;
}

function RevealOption({ option, label, disabled, revealKey, index, onPress }: RevealOptionProps) {
  const [width, setWidth] = useState(0);

  return (
    <Pressable
      disabled={disabled}
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 ${disabled ? "opacity-70" : ""}`}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onPress={onPress}
    >
      <Text className="text-base font-medium text-white">
        {option}. {label}
      </Text>

      {width > 0 ? (
        <MotiView
          key={`${revealKey}:${option}`}
          className="absolute bottom-0 left-0 top-0 bg-ink"
          from={{ translateX: 0 }}
          animate={{ translateX: width }}
          transition={{
            delay: index * OPTION_REVEAL_STAGGER_MS,
            duration: OPTION_REVEAL_DURATION_MS,
            type: "timing",
          }}
          style={{ width }}
          pointerEvents="none"
        />
      ) : null}
    </Pressable>
  );
}

export default function BattleScreen() {
  const { currentQuestion, countdownMs, ghostFrames, isLoading, matchId, mode, playerScore, opponentScore, state, result, player, opponent, refetch } =
    useGameEngine();
  const lastScoreDelta = useGameStore((store) => store.lastScoreDelta);
  const setLastScoreDelta = useGameStore((store) => store.setLastScoreDelta);
  const timeoutReadyQuestionsRef = useRef<Record<string, boolean>>({});
  const submittingQuestionSequenceRef = useRef<number | null>(null);
  const scoreDeltaDisplayIdRef = useRef(0);
  const [submittingQuestionSequence, setSubmittingQuestionSequence] = useState<number | null>(null);
  const [answersReady, setAnswersReady] = useState(false);
  const [scoreDeltaDisplay, setScoreDeltaDisplay] = useState<{ id: number; value: number } | null>(null);

  const currentQuestionKey = currentQuestion ? `${matchId}:${currentQuestion.sequence}` : null;
  const localAnswerLocked = (!!currentQuestion && submittingQuestionSequence === currentQuestion.sequence) || !answersReady;

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

    setAnswersReady(false);
    const timer = setTimeout(() => {
      setAnswersReady(true);
    }, ANSWER_READY_DELAY_MS);

    return () => clearTimeout(timer);
  }, [currentQuestionKey]);

  useEffect(() => {
    if (lastScoreDelta <= 0) {
      return;
    }

    scoreDeltaDisplayIdRef.current += 1;
    const id = scoreDeltaDisplayIdRef.current;
    setScoreDeltaDisplay({ id, value: lastScoreDelta });

    const timer = setTimeout(() => {
      setScoreDeltaDisplay((activeDisplay) => (activeDisplay?.id === id ? null : activeDisplay));
    }, 3000);

    return () => clearTimeout(timer);
  }, [lastScoreDelta]);

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
            <View className="relative mt-2 min-h-5 justify-center overflow-hidden">
              <Text className="text-sm font-semibold text-transparent">+0000 points</Text>
              {scoreDeltaDisplay ? (
                <MotiView
                  key={scoreDeltaDisplay.id}
                  className="absolute inset-0 justify-center"
                  from={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 3000, type: "timing" }}
                  pointerEvents="none"
                >
                  <Text className="text-sm font-semibold text-success">+{scoreDeltaDisplay.value} points</Text>
                </MotiView>
              ) : null}
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <Text className="text-xs uppercase tracking-[2px] text-secondary">{currentQuestion.difficulty}</Text>
        <Text className="mt-3 text-2xl font-semibold text-white">{currentQuestion.prompt}</Text>
        <View className="mt-6 gap-3">
          {answerOptions.map((option, index) => (
            <RevealOption
              key={option}
              option={option}
              label={currentQuestion.options[option]}
              disabled={localAnswerLocked}
              revealKey={currentQuestionKey ?? `${matchId}:unknown`}
              index={index}
              onPress={() => void submitAnswer(option)}
            />
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}
