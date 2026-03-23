import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, json } from "../_shared/responses.ts";
import { requireUser } from "../_shared/auth.ts";
import type { SyncMatchStateBody } from "../_shared/types.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await requireUser(request);
    const body = (await request.json()) as SyncMatchStateBody;

    if (!body.matchId) {
      return badRequest("matchId is required");
    }

    const [{ data: match }, { data: participants }, { data: questions }, { data: answers }] = await Promise.all([
      supabase
        .from("matches")
        .select("*, category:categories(name)")
        .eq("id", body.matchId)
        .single(),
      supabase
        .from("match_participants")
        .select("*, profile:profiles(id, username, avatar, level, xp)")
        .eq("match_id", body.matchId)
        .order("seat"),
      supabase
        .from("match_questions")
        .select("sequence, question:questions(id, question_text, difficulty, option_a, option_b, option_c, option_d)")
        .eq("match_id", body.matchId)
        .order("sequence"),
      supabase
        .from("match_answers")
        .select("*")
        .eq("match_id", body.matchId)
        .order("question_sequence"),
    ]);

    const demoGhostFrames = Array.isArray(match?.metadata?.demoGhostFrames) ? match.metadata.demoGhostFrames : [];
    const demoGhostProfile = match?.metadata?.demoGhostProfile ?? null;
    const ghostParticipant = (participants ?? []).find((participant) => participant.is_ghost);
    const currentParticipant = (participants ?? []).find((participant) => participant.user_id === user.id);

    const ghostFrames =
      ghostParticipant && answers?.some((answer) => answer.user_id === ghostParticipant.user_id)
        ? answers
            .filter((answer) => answer.user_id === ghostParticipant.user_id)
            .map((answer) => ({
              questionSequence: answer.question_sequence,
              answerOffsetMs: answer.answered_at_offset_ms,
              selectedAnswer: answer.selected_answer,
              awardedScore: answer.score_awarded,
              cumulativeScore: answer.cumulative_score,
            }))
        : demoGhostFrames;

    const playerScore = [...(answers ?? [])]
      .filter((answer) => answer.user_id === user.id)
      .sort((left, right) => right.question_sequence - left.question_sequence)[0]?.cumulative_score ?? 0;

    const opponentScore =
      ghostFrames.length > 0 ? ghostFrames[ghostFrames.length - 1].cumulativeScore : ghostParticipant?.final_score ?? 0;

    const player = currentParticipant
      ? {
          userId: currentParticipant.user_id,
          username: currentParticipant.profile?.username ?? "Guest",
          avatar: currentParticipant.profile?.avatar ?? null,
          level: currentParticipant.profile?.level ?? 1,
          xp: currentParticipant.profile?.xp ?? 0,
          finalScore: currentParticipant.final_score ?? playerScore,
          isGhost: false,
          outcome: currentParticipant.outcome ?? "pending",
        }
      : null;

    const opponent = ghostParticipant
      ? {
          userId: ghostParticipant.user_id,
          username: ghostParticipant.profile?.username ?? "Ghost Rival",
          avatar: ghostParticipant.profile?.avatar ?? null,
          level: ghostParticipant.profile?.level ?? 1,
          xp: ghostParticipant.profile?.xp ?? 0,
          finalScore: ghostParticipant.final_score ?? opponentScore,
          isGhost: true,
          outcome: ghostParticipant.outcome ?? "pending",
        }
      : demoGhostProfile
        ? {
            userId: null,
            username: demoGhostProfile.username ?? "Echo Rival",
            avatar: demoGhostProfile.avatar ?? null,
            level: demoGhostProfile.level ?? 1,
            xp: demoGhostProfile.xp ?? 0,
            finalScore: match?.metadata?.demoGhostTotalScore ?? opponentScore,
            isGhost: true,
            outcome: playerScore === opponentScore ? "draw" : playerScore > opponentScore ? "loss" : "win",
          }
        : null;

    const result =
      match?.state === "complete" || match?.state === "results"
        ? {
            player,
            opponent,
            winnerUserId: match.winner_user_id,
            isDraw: playerScore === opponentScore,
            xpDelta: playerScore >= opponentScore ? 20 : 8,
            ratingDelta: playerScore >= opponentScore ? 18 : -10,
          }
        : null;

    return json({
      match: match
        ? {
            ...match,
            category_name: match.category?.name ?? match.metadata?.categoryName ?? "Category",
          }
        : null,
      participants,
      questions,
      answers,
      ghostFrames,
      playerScore,
      opponentScore,
      player,
      opponent,
      result,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 401);
  }
});
