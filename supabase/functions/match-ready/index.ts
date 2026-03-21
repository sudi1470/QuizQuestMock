import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, json } from "../_shared/responses.ts";
import { requireUser } from "../_shared/auth.ts";
import type { MatchReadyBody } from "../_shared/types.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await requireUser(request);
    const body = (await request.json()) as MatchReadyBody;

    if (!body.matchId) {
      return badRequest("matchId is required");
    }

    await supabase
      .from("match_participants")
      .update({ ready_at: new Date().toISOString() })
      .eq("match_id", body.matchId)
      .eq("user_id", user.id);

    const { data: participants } = await supabase
      .from("match_participants")
      .select("id, ready_at")
      .eq("match_id", body.matchId);

    const allReady = participants?.length && participants.every((participant) => participant.ready_at);
    if (allReady) {
      const now = new Date().toISOString();
      await supabase
        .from("matches")
        .update({
          state: "ready",
          started_at: now,
          current_question: 1,
          question_started_at: now,
        })
        .eq("id", body.matchId);
    }

    return json({ success: true, allReady: !!allReady });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 401);
  }
});
