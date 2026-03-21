import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, json } from "../_shared/responses.ts";
import { requireUser } from "../_shared/auth.ts";
import type { QueueJoinBody } from "../_shared/types.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await requireUser(request);
    const body = (await request.json()) as QueueJoinBody;

    if (!body.categoryId || !body.matchType) {
      return badRequest("categoryId and matchType are required");
    }

    const { data: existingRating } = await supabase
      .from("ratings")
      .select("rating")
      .eq("user_id", user.id)
      .eq("scope", "global")
      .maybeSingle();

    const { data: queueRow, error: queueError } = await supabase
      .from("matchmaking_queue")
      .insert({
        user_id: user.id,
        category_id: body.categoryId,
        match_type: body.matchType,
        rating_snapshot: existingRating?.rating ?? 1200,
        metadata: body.friendId ? { friendId: body.friendId } : {},
      })
      .select("*")
      .single();

    if (queueError) {
      return json({ error: queueError.message }, 500);
    }

    if (body.matchType === "live_random") {
      const { data: candidateId, error: candidateError } = await supabase.rpc("find_live_match_candidate", {
        p_queue_id: queueRow.id,
      });

      if (!candidateError && candidateId) {
        const { data: candidateQueue } = await supabase
          .from("matchmaking_queue")
          .select("*")
          .eq("id", candidateId)
          .single();

        const { data: matchId, error: matchError } = await supabase.rpc("create_match_with_questions", {
          p_category_id: body.categoryId,
          p_match_type: "live_random",
          p_mode: "live",
          p_player_one: candidateQueue.user_id,
          p_player_two: user.id,
          p_source_match_id: null,
        });

        if (!matchError && matchId) {
          await supabase
            .from("matchmaking_queue")
            .update({ status: "matched" })
            .in("id", [queueRow.id, candidateQueue.id]);

          return json({ queue: queueRow, matched: true, matchId });
        }
      }
    }

    if (body.matchType === "async_random") {
      const { data: reusableGhost } = await supabase
        .from("matches")
        .select("id, ghost_seed_user_id")
        .eq("category_id", body.categoryId)
        .eq("mode", "ghost")
        .eq("state", "complete")
        .not("ghost_seed_user_id", "is", null)
        .order("completed_at", { ascending: false })
        .limit(10);

      let playableGhost: { id: string; ghost_seed_user_id: string | null } | null = null;
      for (const match of reusableGhost ?? []) {
        const { data } = await supabase.rpc("is_ghost_seed_reusable", { p_match_id: match.id });
        if (data) {
          playableGhost = match;
          break;
        }
      }

      if (playableGhost?.ghost_seed_user_id) {
        const { data: matchId } = await supabase.rpc("create_match_with_questions", {
          p_category_id: body.categoryId,
          p_match_type: "async_random",
          p_mode: "ghost",
          p_player_one: playableGhost.ghost_seed_user_id,
          p_player_two: user.id,
          p_source_match_id: playableGhost.id,
        });
        return json({ queue: queueRow, matched: true, matchId, mode: "ghost" });
      }

      const { data: seedMatchId } = await supabase.rpc("create_match_with_questions", {
        p_category_id: body.categoryId,
        p_match_type: "async_random",
        p_mode: "ghost",
        p_player_one: user.id,
        p_player_two: null,
        p_source_match_id: null,
      });

      await supabase.from("matchmaking_queue").update({ status: "matched" }).eq("id", queueRow.id);
      return json({ queue: queueRow, matched: true, matchId: seedMatchId, role: "seed" });
    }

    return json({ queue: queueRow, matched: false });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 401);
  }
});
