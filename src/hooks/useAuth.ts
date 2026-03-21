import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";

export function useAuth() {
  async function signInWithEmail(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signUpWithEmail(email: string, password: string, username: string) {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          user_name: username,
        },
      },
    });
  }

  async function signInWithGoogle() {
    const redirectTo = Linking.createURL("/auth/callback");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        skipBrowserRedirect: true,
        redirectTo,
      },
    });

    if (error) {
      return { error };
    }

    return Linking.openURL(data.url);
  }

  return {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
  };
}
