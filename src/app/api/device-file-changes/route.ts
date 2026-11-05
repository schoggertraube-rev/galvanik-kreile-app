import { getIntakeFileChangesAction } from "@/app/actions/eingang.actions";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const result = await getIntakeFileChangesAction(query.get("since") ?? "", query.get("after"));
  const status = result.code === "OK" ? 200 : result.code === "UNAUTHENTICATED" ? 401 : result.code === "FORBIDDEN" ? 403 : result.code === "VALIDATION_ERROR" ? 400 : 503;
  return Response.json(result.code === "OK" ? result.changes : { code: result.code, message: result.message }, {
    status, headers: { "cache-control": "private, no-store", "vary": "Cookie" },
  });
}
