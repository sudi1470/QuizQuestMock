import { Text, View } from "react-native";

interface ScoreBarProps {
  label: string;
  score: number;
  progress: number;
  accentClassName: string;
}

export function ScoreBar({ label, score, progress, accentClassName }: ScoreBarProps) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-white">{label}</Text>
        <Text className="text-sm text-muted">{score}</Text>
      </View>
      <View className="h-3 overflow-hidden rounded-full bg-white/10">
        <View className={`h-full rounded-full ${accentClassName}`} style={{ width: `${Math.max(progress, 6)}%` }} />
      </View>
    </View>
  );
}
