import { Text, View } from "react-native";

import { Card } from "@/components/ui/Card";

export default function FriendsScreen() {
  return (
    <View className="flex-1 bg-ink p-6 pt-16">
      <Text className="mb-4 text-3xl font-bold text-white">Friends</Text>
      <Card>
        <Text className="text-lg font-semibold text-white">Challenge queue</Text>
        <Text className="mt-2 text-sm text-muted">
          Accepted friendships, incoming challenges, and rematch requests will live here.
        </Text>
      </Card>
    </View>
  );
}
