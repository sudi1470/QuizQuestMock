import { useState } from "react";
import { Link } from "expo-router";
import { Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";

export default function SignInScreen() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View className="flex-1 justify-center bg-ink px-6">
      <Card>
        <Text className="mb-2 text-3xl font-bold text-white">Welcome back</Text>
        <Text className="mb-6 text-base text-muted">Jump into a live duel or finish an async challenge.</Text>
        <View className="gap-3">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            className="rounded-2xl bg-white/5 px-4 py-3 text-white"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            className="rounded-2xl bg-white/5 px-4 py-3 text-white"
          />
          <Button label="Sign In" onPress={() => void signInWithEmail(email, password)} />
          <Button label="Continue with Google" variant="secondary" onPress={() => void signInWithGoogle()} />
          <Link href="/(auth)/sign-up" className="text-center text-sm text-secondary">
            Need an account? Create one.
          </Link>
        </View>
      </Card>
    </View>
  );
}
