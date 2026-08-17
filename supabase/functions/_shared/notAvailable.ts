export function notAvailableResponse(): Response {
  return new Response(JSON.stringify({ error: "NOT_AVAILABLE" }), {
    status: 503,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
