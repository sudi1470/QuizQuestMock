import { Pressable, Text } from "react-native";
import * as Haptics from "expo-haptics";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
}

export function Button({ label, onPress, variant = "primary", disabled }: ButtonProps) {
  const classes =
    variant === "primary"
      ? "bg-accent"
      : variant === "secondary"
        ? "bg-secondary"
        : "bg-white/10";

  return (
    <Pressable
      disabled={disabled}
      className={`rounded-2xl px-4 py-3 ${classes} ${disabled ? "opacity-50" : ""}`}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
    >
      <Text className="text-center text-base font-semibold text-ink">{label}</Text>
    </Pressable>
  );
}
