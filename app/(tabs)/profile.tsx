import { Text, View } from "react-native";

import { Card } from "@/components/ui/Card";

export default function ProfileScreen() {
  return (
    <View className="flex-1 bg-ink p-6 pt-16">
      <Text className="mb-4 text-3xl font-bold text-white">Profile</Text>
      <Card>
        <Text className="text-lg font-semibold text-white">Player progression</Text>
        <Text className="mt-2 text-sm text-muted">Avatar, XP, level, rating deltas, and match history land here.</Text>
      </Card>
    </View>
  );
}
