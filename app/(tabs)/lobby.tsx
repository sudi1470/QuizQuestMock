import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { MotiView } from "moti";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

const categoryDescriptions: Record<string, string> = {
  Geography: "Capitals, continents, world landmarks, and map instincts.",
  History: "Wars, empires, leaders, revolutions, and turning points.",
  Science: "Space, energy, chemistry, biology, and everyday science.",
  Movies: "Blockbusters, characters, awards, and iconic scenes.",
  "General Knowledge": "Classic trivia, common facts, and broad recall.",
  Technology: "Computers, web basics, devices, and digital literacy.",
  Sports: "Global sports, tournaments, athletes, and rules.",
  Food: "Cuisine, ingredients, famous dishes, and food culture.",
};

export default function LobbyScreen() {
  const { ensureDemoSession } = useAuth();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isStartingMatch, setIsStartingMatch] = useState<string | null>(null);

  useEffect(() => {
    void ensureDemoSession()
      .then((result) => {
        if (result.error) {
          setSessionError(result.error.message);
        }
      })
      .finally(() => setSessionReady(true));
  }, [ensureDemoSession]);

  const profileQuery = useQuery({
    enabled: sessionReady,
    queryKey: ["demo-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return null;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, username, level, xp")
        .eq("id", userData.user.id)
        .single();

      return data;
    },
  });

  const categoriesQuery = useQuery({
    enabled: sessionReady,
    queryKey: ["demo-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, icon")
        .in("name", Object.keys(categoryDescriptions))
        .order("name");

      if (error) {
        throw error;
      }

      return data;
    },
  });

  const categories = useMemo(
    () =>
      (categoriesQuery.data ?? []).map((category) => ({
        id: category.id,
        name: category.name,
        subtitle: categoryDescriptions[category.name] ?? "Seven-question ghost battle.",
      })),
    [categoriesQuery.data],
  );

  async function startGhostMatch(categoryId: string) {
    setIsStartingMatch(categoryId);
    const { data, error } = await supabase.functions.invoke("queue-join", {
      body: {
        categoryId,
        matchType: "async_random",
      },
    });

    setIsStartingMatch(null);

    if (error || !data?.matchId) {
      console.error("Unable to start ghost match", error);
      return;
    }

    router.push(`/match/${data.matchId}`);
  }

  if (!sessionReady || categoriesQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <ActivityIndicator color="#F4B942" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-ink" contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View className="gap-2 pt-8">
        <Text className="text-sm uppercase tracking-[3px] text-secondary">QuizQuest</Text>
        <Text className="text-4xl font-bold text-white">Ghost demo ready.</Text>
        <Text className="text-base text-muted">
          {profileQuery.data?.username ?? "Guest"} can jump into a full seven-question async battle immediately.
        </Text>
      </View>

      <Card>
        <Text className="text-lg font-semibold text-white">Demo flow</Text>
        <Text className="mt-1 text-sm text-muted">
          We’re prioritizing ghost mode first. If a recorded ghost exists, you’ll face that run. Otherwise the backend boots a seeded demo ghost without introducing throwaway UI logic.
        </Text>
        {sessionError ? (
          <Text className="mt-3 text-sm text-danger">
            Guest sign-in is currently blocked: {sessionError}. Enable anonymous auth in Supabase Auth so the demo can create low-friction guest users.
          </Text>
        ) : null}
      </Card>

      {categories.map((category, index) => (
        <MotiView
          key={category.id}
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: index * 70 }}
        >
          <Card>
            <Text className="text-2xl font-semibold text-white">{category.name}</Text>
            <Text className="mt-1 text-sm text-muted">{category.subtitle}</Text>
            <View className="mt-4">
              <Button
                label={isStartingMatch === category.id ? "Starting..." : "Play Ghost Match"}
                onPress={() => void startGhostMatch(category.id)}
                disabled={isStartingMatch !== null || !!sessionError}
              />
            </View>
          </Card>
        </MotiView>
      ))}
    </ScrollView>
  );
}
