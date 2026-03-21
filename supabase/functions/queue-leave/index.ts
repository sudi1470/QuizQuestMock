import { corsHeaders } from "../_shared/cors.ts";
import { json } from "../_shared/responses.ts";
import { requireUser } from "../_shared/auth.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await requireUser(request);
    const { queueId } = await request.json();

    await supabase
      .from("matchmaking_queue")
      .update({ status: "cancelled" })
      .eq("id", queueId)
      .eq("user_id", user.id);

    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 401);
  }
});
