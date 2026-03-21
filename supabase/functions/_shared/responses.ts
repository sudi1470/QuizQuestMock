import { corsHeaders } from "./cors.ts";

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function badRequest(message: string, details?: unknown) {
  return json({ error: message, details }, 400);
}
