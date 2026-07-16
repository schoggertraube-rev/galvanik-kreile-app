import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockRpc, mockFetch } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockRpc: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));

import { proxyMeteredAiRequest } from "@/lib/server/aiUsage";

const identity = { tenantId: "galvanik-kreile", userId: "user-42" };
const reservationId = "123e4567-e89b-42d3-a456-426614174000";

function request(idempotencyKey?: string) {
  return new Request("http://localhost/api/erfassung/notes-extract", {
    method: "POST",
    headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
  });
}

function call(req = request()) {
  return proxyMeteredAiRequest({
    request: req,
    identity,
    feature: "notes-extract",
    payload: { text: "Rückruf morgen" },
    maxOutputTokens: 1_024,
  });
}

describe("durable AI usage proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_URL", "https://tenant.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("AI_USAGE_HMAC_SECRET", "0123456789abcdef0123456789abcdef");
    mockCreateClient.mockReturnValue({ rpc: mockRpc });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("stops before the provider when the atomic quota rejects the request", async () => {
    mockRpc.mockResolvedValue({
      data: [{
        allowed: false,
        reservation_id: null,
        replay: false,
        usage_status: "rejected",
        replay_result: null,
        retry_after_seconds: 60,
        decision_reason: "user_window",
      }],
      error: null,
    });
    const response = await call();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("replays a settled result without a second provider request", async () => {
    mockRpc.mockResolvedValue({
      data: [{
        allowed: true,
        reservation_id: reservationId,
        replay: true,
        usage_status: "succeeded",
        replay_result: { order: { title: "Stoßstange" } },
        retry_after_seconds: 0,
        decision_reason: "replay_result",
      }],
      error: null,
    });
    const response = await call(request("same-request-42"));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-AI-Replay")).toBe("1");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("forwards only the identity-bound reservation envelope", async () => {
    mockRpc.mockResolvedValue({
      data: [{
        allowed: true,
        reservation_id: reservationId,
        replay: false,
        usage_status: "reserved",
        replay_result: null,
        retry_after_seconds: 0,
        decision_reason: "reserved",
      }],
      error: null,
    });
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ order: { title: "Rückruf" } }), { status: 200 }));

    const response = await call();
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      input: { text: "Rückruf morgen" },
      usage: {
        reservationId,
        tenantId: "galvanik-kreile",
        userId: "user-42",
        feature: "notes-extract",
      },
    });
    expect(init.cache).toBe("no-store");
  });

  it("fails closed on missing configuration or invalid idempotency keys", async () => {
    vi.stubEnv("AI_USAGE_HMAC_SECRET", "short");
    expect((await call()).status).toBe(503);
    vi.stubEnv("AI_USAGE_HMAC_SECRET", "0123456789abcdef0123456789abcdef");
    expect((await call(request("bad key"))).status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
