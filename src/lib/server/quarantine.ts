import { NextResponse } from "next/server";

/**
 * Temporary F0 containment boundary for routes that have no safe command or
 * read contract yet. Call this before touching provider, storage, database,
 * event, or external-service state.
 */
export function notAvailableResponse() {
  return NextResponse.json(
    { error: "NOT_AVAILABLE" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
