import { useState } from "react";
import { Link } from "expo-router";
import { Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";

export default function SignUpScreen() {
  const { signUpWithEmail } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View className="flex-1 justify-center bg-ink px-6">
      <Card>
        <Text className="mb-2 text-3xl font-bold text-white">Create your legend</Text>
        <Text className="mb-6 text-base text-muted">Choose a username and start climbing the trivia ladder.</Text>
        <View className="gap-3">
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            className="rounded-2xl bg-white/5 px-4 py-3 text-white"
          />
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
          <Button label="Create Account" onPress={() => void signUpWithEmail(email, password, username)} />
          <Link href="/(auth)/sign-in" className="text-center text-sm text-secondary">
            Already have an account? Sign in.
          </Link>
        </View>
      </Card>
    </View>
  );
}
