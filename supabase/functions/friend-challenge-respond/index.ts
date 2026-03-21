import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, json } from "../_shared/responses.ts";
import { requireUser } from "../_shared/auth.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await requireUser(request);
    const { matchId, accepted } = await request.json();

    if (!matchId || typeof accepted !== "boolean") {
      return badRequest("matchId and accepted are required");
    }

    if (!accepted) {
      await supabase
        .from("matches")
        .update({ state: "complete", metadata: { challengeDeclined: true } })
        .eq("id", matchId);

      return json({ success: true, accepted: false });
    }

    await supabase
      .from("match_participants")
      .update({ joined_at: new Date().toISOString() })
      .eq("match_id", matchId)
      .eq("user_id", user.id);

    return json({ success: true, accepted: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 401);
  }
});
