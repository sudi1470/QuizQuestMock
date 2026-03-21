import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, json } from "../_shared/responses.ts";
import { requireUser } from "../_shared/auth.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await requireUser(request);
    const { matchId } = await request.json();

    if (!matchId) {
      return badRequest("matchId is required");
    }

    const { data: participants } = await supabase
      .from("match_participants")
      .select("user_id")
      .eq("match_id", matchId);

    const opponentIds = (participants ?? []).map((participant) => participant.user_id).filter((id) => id !== user.id);

    await supabase.from("notifications").insert(
      opponentIds.map((opponentId) => ({
        user_id: opponentId,
        type: "friend_challenge",
        title: "Rematch requested",
        body: "Your opponent wants another round.",
        payload: { matchId, requesterId: user.id },
      })),
    );

    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 401);
  }
});
