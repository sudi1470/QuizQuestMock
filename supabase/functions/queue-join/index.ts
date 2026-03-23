import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, json } from "../_shared/responses.ts";
import { requireUser } from "../_shared/auth.ts";
import type { QueueJoinBody } from "../_shared/types.ts";
import { buildDemoGhostPayload } from "../_shared/demo_ghost.ts";

async function activateMatch(supabase: any, matchId: string, metadata: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  await supabase
    .from("matches")
    .update({
      state: "question_active",
      started_at: now,
      current_question: 1,
      question_started_at: now,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      metadata,
    })
    .eq("id", matchId);
}

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
        .neq("ghost_seed_user_id", user.id)
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

        const [{ data: sourceAnswers }, { data: ghostProfile }, { data: category }] = await Promise.all([
          supabase
            .from("match_answers")
            .select("*")
            .eq("match_id", playableGhost.id)
            .eq("user_id", playableGhost.ghost_seed_user_id)
            .order("question_sequence"),
          supabase
            .from("profiles")
            .select("id, username, avatar, level, xp")
            .eq("id", playableGhost.ghost_seed_user_id)
            .single(),
          supabase.from("categories").select("name").eq("id", body.categoryId).single(),
        ]);

        if (sourceAnswers?.length) {
          await supabase.from("match_answers").insert(
            sourceAnswers.map((answer) => ({
              match_id: matchId,
              question_id: answer.question_id,
              user_id: answer.user_id,
              question_sequence: answer.question_sequence,
              selected_answer: answer.selected_answer,
              is_correct: answer.is_correct,
              response_time_ms: answer.response_time_ms,
              answered_at_offset_ms: answer.answered_at_offset_ms,
              score_awarded: answer.score_awarded,
              cumulative_score: answer.cumulative_score,
              validation_flags: answer.validation_flags,
              is_rejected: answer.is_rejected,
            })),
          );

          await supabase
            .from("match_participants")
            .update({ final_score: sourceAnswers[sourceAnswers.length - 1].cumulative_score })
            .eq("match_id", matchId)
            .eq("user_id", playableGhost.ghost_seed_user_id);
        }

        await activateMatch(supabase, matchId, {
          categoryName: category?.name ?? "Category",
          replaySourceMatchId: playableGhost.id,
          ghostProfile,
        });

        await supabase.from("matchmaking_queue").update({ status: "matched" }).eq("id", queueRow.id);
        return json({ queue: queueRow, matched: true, matchId, mode: "ghost", demoGhost: false });
      }

      const { data: seedMatchId } = await supabase.rpc("create_match_with_questions", {
        p_category_id: body.categoryId,
        p_match_type: "async_random",
        p_mode: "ghost",
        p_player_one: user.id,
        p_player_two: null,
        p_source_match_id: null,
      });

      const [{ data: seedQuestions }, { data: category }] = await Promise.all([
        supabase
          .from("match_questions")
          .select("sequence, question:questions(correct_answer, difficulty)")
          .eq("match_id", seedMatchId)
          .order("sequence"),
        supabase.from("categories").select("name").eq("id", body.categoryId).single(),
      ]);

      const demoGhost = buildDemoGhostPayload(seedQuestions ?? [], 0.08);
      await activateMatch(supabase, seedMatchId, {
        categoryName: category?.name ?? "Category",
        demoGhostProfile: demoGhost.profile,
        demoGhostFrames: demoGhost.frames,
        demoGhostTotalScore: demoGhost.totalScore,
      });

      await supabase.from("matchmaking_queue").update({ status: "matched" }).eq("id", queueRow.id);
      return json({ queue: queueRow, matched: true, matchId: seedMatchId, role: "seed", demoGhost: true });
    }

    return json({ queue: queueRow, matched: false });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 401);
  }
});
