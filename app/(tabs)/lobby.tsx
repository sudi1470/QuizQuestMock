import { router } from "expo-router";
import { MotiView } from "moti";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const categories = [
  { id: "movies", name: "Movies", subtitle: "Blockbusters, directors, cult classics" },
  { id: "science", name: "Science", subtitle: "Space, chemistry, weird facts" },
  { id: "history", name: "History", subtitle: "Ancient empires to modern turning points" },
];

export default function LobbyScreen() {
  return (
    <ScrollView className="flex-1 bg-ink" contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View className="gap-2 pt-8">
        <Text className="text-sm uppercase tracking-[3px] text-secondary">QuizQuest</Text>
        <Text className="text-4xl font-bold text-white">Choose a battleground.</Text>
        <Text className="text-base text-muted">Queue live, seed an async ghost match, or challenge a friend.</Text>
      </View>

      <Card>
        <Text className="text-lg font-semibold text-white">Quick Play</Text>
        <Text className="mt-1 text-sm text-muted">Live random within ±200 ELO. Async fills from reusable ghost seeds.</Text>
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Button label="Find Live Match" onPress={() => router.push("/match/mock-live")} />
          </View>
          <View className="flex-1">
            <Button label="Start Ghost Run" variant="secondary" onPress={() => router.push("/match/mock-ghost")} />
          </View>
        </View>
      </Card>

      {categories.map((category, index) => (
        <MotiView
          key={category.id}
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: index * 80 }}
        >
          <Card>
            <Text className="text-2xl font-semibold text-white">{category.name}</Text>
            <Text className="mt-1 text-sm text-muted">{category.subtitle}</Text>
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1">
                <Button label="Live Random" onPress={() => router.push(`/match/${category.id}-live`)} />
              </View>
              <View className="flex-1">
                <Button label="Challenge Friend" variant="ghost" onPress={() => router.push(`/match/${category.id}-ghost`)} />
              </View>
            </View>
          </Card>
        </MotiView>
      ))}
    </ScrollView>
  );
}
