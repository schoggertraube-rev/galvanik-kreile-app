import { getIntakeDraftsAction } from "@/app/actions/eingang.actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same authorized draft reader as the action, outside the App Router action queue. */
export async function GET() {
  const result = await getIntakeDraftsAction();
  return Response.json(result, {
    status: result.code === "UNAUTHENTICATED" ? 401 : result.code === "FORBIDDEN" ? 403 : result.code === "OK" ? 200 : 503,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
