import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, json } from "../_shared/responses.ts";
import { requireUser } from "../_shared/auth.ts";
import type { SubmitAnswerBody } from "../_shared/types.ts";

const MIN_HUMAN_RESPONSE_MS = 250;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await requireUser(request);
    const body = (await request.json()) as SubmitAnswerBody;

    if (!body.matchId || !body.questionSequence || !body.selectedAnswer) {
      return badRequest("matchId, questionSequence, and selectedAnswer are required");
    }

    const { data: match } = await supabase
      .from("matches")
      .select("id, state, current_question, question_started_at, penalty_factor, question_time_limit_ms, category_id")
      .eq("id", body.matchId)
      .single();

    if (!match) {
      return badRequest("Match not found");
    }

    if (body.responseTimeMs < MIN_HUMAN_RESPONSE_MS) {
      await supabase.rpc("log_suspicious_match", {
        p_match_id: body.matchId,
        p_user_id: user.id,
        p_reason: "response_under_human_threshold",
        p_evidence: { questionSequence: body.questionSequence, responseTimeMs: body.responseTimeMs },
        p_severity: 6,
      });
      return badRequest("Response rejected for invalid timing");
    }

    if (body.responseTimeMs > match.question_time_limit_ms) {
      return badRequest("Response exceeded question time limit");
    }

    const { data: matchQuestion } = await supabase
      .from("match_questions")
      .select("question_id")
      .eq("match_id", body.matchId)
      .eq("sequence", body.questionSequence)
      .single();

    const { data: question } = await supabase
      .from("questions")
      .select("correct_answer")
      .eq("id", matchQuestion?.question_id)
      .single();

    const isCorrect = question?.correct_answer === body.selectedAnswer;
    const awardedScore = isCorrect
      ? Math.max(0, Math.floor(1000 - body.responseTimeMs * Number(match.penalty_factor)))
      : 0;

    const { data: priorAnswers } = await supabase
      .from("match_answers")
      .select("score_awarded")
      .eq("match_id", body.matchId)
      .eq("user_id", user.id)
      .lt("question_sequence", body.questionSequence);

    const cumulativeScore = (priorAnswers ?? []).reduce((sum, answer) => sum + answer.score_awarded, 0) + awardedScore;

    const { error: insertError } = await supabase
      .from("match_answers")
      .upsert({
        match_id: body.matchId,
        question_id: matchQuestion?.question_id,
        user_id: user.id,
        question_sequence: body.questionSequence,
        selected_answer: body.selectedAnswer,
        is_correct: isCorrect,
        response_time_ms: body.responseTimeMs,
        answered_at_offset_ms: body.responseTimeMs,
        score_awarded: awardedScore,
        cumulative_score: cumulativeScore,
        validation_flags: [],
        is_rejected: false,
      });

    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    await supabase
      .from("match_participants")
      .update({ final_score: cumulativeScore })
      .eq("match_id", body.matchId)
      .eq("user_id", user.id);

    return json({
      success: true,
      questionSequence: body.questionSequence,
      isCorrect,
      awardedScore,
      cumulativeScore,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 401);
  }
});
