import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, json } from "../_shared/responses.ts";
import { requireUser } from "../_shared/auth.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await requireUser(request);
    const { categoryId, friendId } = await request.json();

    if (!categoryId || !friendId) {
      return badRequest("categoryId and friendId are required");
    }

    const { data: matchId, error } = await supabase.rpc("create_match_with_questions", {
      p_category_id: categoryId,
      p_match_type: "friend_challenge",
      p_mode: "ghost",
      p_player_one: user.id,
      p_player_two: friendId,
      p_source_match_id: null,
    });

    if (error) {
      return json({ error: error.message }, 500);
    }

    await supabase.from("notifications").insert({
      user_id: friendId,
      type: "friend_challenge",
      title: "New challenge",
      body: "A friend challenged you to a match.",
      payload: { matchId, challengerId: user.id },
    });

    return json({ success: true, matchId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 401);
  }
});
