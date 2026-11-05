import type { IntakeFileGrant } from "./captureContract";

/** A restricted object-upload grant, never a database or unscoped Storage client. */
export async function uploadIntakeOriginal(grant: NonNullable<Extract<IntakeFileGrant, { code: "OK" }>["upload"]>, file: File) {
  const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const url = new URL(grant.url);
  if (url.origin !== base.origin || !url.pathname.startsWith("/storage/v1/object/upload/sign/scans/") || grant.bucket !== "scans") throw new Error("INTAKE_UPLOAD_GRANT_INVALID");
  const body = new FormData(); body.append("cacheControl", "3600"); body.append("", file);
  const response = await fetch(url, { method: "PUT", body, credentials: "omit", signal: AbortSignal.timeout(120_000),
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", "x-upsert": "false" } });
  if (!response.ok) console.error("[INTAKE_ORIGINAL_UPLOAD_UNCONFIRMED]", { status: response.status });
  return { ok: response.ok };
}
