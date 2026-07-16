import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const DEFAULT_ORIGINS = [
  "https://galvanik-kreile.de",
  "https://www.galvanik-kreile.de",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...configured]);
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins().has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function handleCors(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins().has(origin)) return new Response("Forbidden", { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

function bearer(req: Request): string | null {
  const value = req.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

export function requireServiceRole(req: Request): Response | null {
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = bearer(req);
  if (!serviceRole || !token || !safeEqual(token, serviceRole)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
  return null;
}

export type EdgeIdentity = { userId: string; tenantId: string; serviceRole: boolean };

export async function requireUserOrServiceRole(
  req: Request,
): Promise<{ ok: true; identity: EdgeIdentity } | { ok: false; response: Response }> {
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = bearer(req) ?? "";
  const tenantId = Deno.env.get("KREILE_TENANT_ID") ?? "galvanik-kreile";
  if (serviceRole && safeEqual(token, serviceRole)) {
    return { ok: true, identity: { userId: "service-role", tenantId, serviceRole: true } };
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey || !serviceRole || !token) {
    return { ok: false, response: unauthorized(req) };
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return { ok: false, response: unauthorized(req) };

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: appUser, error } = await admin
    .from("app_users")
    .select("id, tenant_id, active")
    .eq("id", userData.user.id)
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .maybeSingle();
  if (error || !appUser) return { ok: false, response: unauthorized(req) };
  return { ok: true, identity: { userId: appUser.id, tenantId: appUser.tenant_id, serviceRole: false } };
}

function unauthorized(req: Request): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}
