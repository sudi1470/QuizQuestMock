import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
