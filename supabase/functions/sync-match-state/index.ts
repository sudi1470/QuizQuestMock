import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, json } from "../_shared/responses.ts";
import { requireUser } from "../_shared/auth.ts";
import type { SyncMatchStateBody } from "../_shared/types.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase } = await requireUser(request);
    const body = (await request.json()) as SyncMatchStateBody;

    if (!body.matchId) {
      return badRequest("matchId is required");
    }

    const [{ data: match }, { data: participants }, { data: questions }, { data: answers }] = await Promise.all([
      supabase
        .from("matches")
        .select("*")
        .eq("id", body.matchId)
        .single(),
      supabase
        .from("match_participants")
        .select("*")
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

    return json({ match, participants, questions, answers });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 401);
  }
});
