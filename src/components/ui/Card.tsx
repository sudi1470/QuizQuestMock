import { PropsWithChildren } from "react";
import { View } from "react-native";

export function Card({ children }: PropsWithChildren) {
  return <View className="rounded-3xl border border-white/10 bg-card p-4">{children}</View>;
}
