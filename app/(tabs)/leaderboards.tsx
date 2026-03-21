import { Text, View } from "react-native";

import { Card } from "@/components/ui/Card";

export default function LeaderboardsScreen() {
  return (
    <View className="flex-1 bg-ink p-6 pt-16">
      <Text className="mb-4 text-3xl font-bold text-white">Leaderboards</Text>
      <Card>
        <Text className="text-lg font-semibold text-white">Three ranking tracks</Text>
        <Text className="mt-2 text-sm text-muted">Global rating, per-category ladders, and weekly momentum resets.</Text>
      </Card>
    </View>
  );
}
