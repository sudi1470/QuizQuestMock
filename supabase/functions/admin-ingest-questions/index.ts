import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, json } from "../_shared/responses.ts";
import { requireUser } from "../_shared/auth.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await requireUser(request);
    const { rows } = await request.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return badRequest("rows array is required");
    }

    const stagedRows = rows.map((row) => ({
      category_name: row.categoryName,
      difficulty: row.difficulty,
      question_text: row.questionText,
      option_a: row.optionA,
      option_b: row.optionB,
      option_c: row.optionC,
      option_d: row.optionD,
      correct_answer: row.correctAnswer,
      explanation: row.explanation ?? null,
      source: row.source ?? null,
      imported_by: user.id,
      validation_errors: [
        !row.categoryName ? "missing_category" : null,
        !row.questionText ? "missing_question_text" : null,
      ].filter(Boolean),
      payload: row,
    }));

    const { error: insertError } = await supabase.from("question_ingestion_staging").insert(stagedRows);
    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    const { data: promotedCount, error: promoteError } = await supabase.rpc("promote_staged_questions", {
      p_imported_by: user.id,
    });

    if (promoteError) {
      return json({ error: promoteError.message }, 500);
    }

    return json({ success: true, imported: rows.length, promoted: promotedCount ?? 0 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 401);
  }
});
