import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return typescriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("Edge Function hardening contracts", () => {
  it("authenticates every internal handler before parsing its body or calling a provider", () => {
    const serviceOnly = [
      "customer-enrich",
      "notes-extract",
      "freetext-extract",
      "inquiry-extract",
      "scan-analyze",
      "item-photo-analyze",
      "email-send",
      "mollie-create-payment",
    ];

    for (const name of serviceOnly) {
      const code = source(`supabase/functions/${name}/index.ts`);
      const handler = code.slice(code.indexOf("serve(async"));
      const requestName = handler.match(/^serve\(async\s*\(\s*([A-Za-z_$][\w$]*)/)?.[1];
      expect(requestName, `${name} must expose a request parameter`).toBeTruthy();
      const auth = handler.indexOf(`requireServiceRole(${requestName})`);
      expect(auth, `${name} must require the service role`).toBeGreaterThan(-1);
      expect(handler.indexOf(`${requestName}.json`), `${name} must authenticate before body parsing`).toBeGreaterThan(auth);
      const providerCall = handler.indexOf("fetch(");
      if (providerCall >= 0) {
        expect(providerCall, `${name} must authenticate before provider calls`).toBeGreaterThan(auth);
      }
    }

    const kpi = source("supabase/functions/kpi-insight/index.ts");
    const kpiHandler = kpi.slice(kpi.indexOf("serve(async"));
    const kpiAuth = kpiHandler.indexOf("requireUserOrServiceRole(req)");
    expect(kpiAuth).toBeGreaterThan(-1);
    expect(kpiHandler.indexOf("req.json")).toBeGreaterThan(kpiAuth);
  });

  it("has no wildcard CORS response in any Edge Function", () => {
    const functionsDirectory = join(root, "supabase", "functions");
    for (const file of typescriptFiles(functionsDirectory)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/Access-Control-Allow-Origin[^\n]*\*/);
    }
    const shared = source("supabase/functions/_shared/security.ts");
    expect(shared).toContain('headers["Access-Control-Allow-Origin"] = origin');
    expect(shared).toContain("allowedOrigins().has(origin)");
  });

  it("loads uploaded files only through the constrained storage helper", () => {
    const scan = source("supabase/functions/scan-analyze/index.ts");
    expect(scan).toContain("loadStorageFile");
    expect(scan).not.toMatch(/fetch\s*\(\s*(file_url|fileUrl)/);

    const itemPhoto = source("supabase/functions/item-photo-analyze/index.ts");
    expect(itemPhoto).toContain('supabase.rpc("claim_item_photo_analysis"');
    expect(itemPhoto).toContain('.from("item-photos")');
    expect(itemPhoto).toContain(".download(claim.storage_path)");
    expect(itemPhoto).not.toContain("file_url");
    expect(itemPhoto).not.toContain("base64_data");

    const helper = source("supabase/functions/_shared/storageFetch.ts");
    expect(helper).toContain("url.origin !== base.origin");
    expect(helper).toContain('redirect: "error"');
    expect(helper).toContain("MAX_FILE_BYTES");
    expect(helper).toContain("ALLOWED_MIME");
  });

  it("keeps one canonical create endpoint and one canonical Mollie webhook", () => {
    for (const legacy of ["payments-intent", "mollie-webhook"]) {
      const code = source(`supabase/functions/${legacy}/index.ts`);
      expect(code).toContain("status: 410");
      expect(code).not.toContain("createClient");
      expect(code).not.toContain("fetch(");
    }

    const config = source("supabase/config.toml");
    expect(config.match(/^verify_jwt = false$/gm)).toHaveLength(2);
    expect(config).toMatch(/\[functions\.email-webhook\]\s+verify_jwt = false/);
    expect(config).toMatch(/\[functions\.payments-webhook-mollie\]\s+verify_jwt = false/);
  });

  it("verifies Mollie live truth and finalizes through the atomic RPC once", () => {
    const create = source("supabase/functions/mollie-create-payment/index.ts");
    expect(create).toContain('keys.length === 1 && keys[0] === "orderId"');
    expect(create).toContain('"Idempotency-Key": reservation.paymentId');
    expect(create).toContain('supabase.rpc("get_mollie_payment_quote"');
    expect(create).toContain('supabase.rpc("reserve_mollie_payment_attempt"');

    const webhook = source("supabase/functions/payments-webhook-mollie/index.ts");
    const paymentState = source("supabase/functions/_shared/molliePaymentState.ts");
    expect(webhook).toContain("https://api.mollie.com/v2/payments/");
    expect(paymentState).toContain('amount?.currency !== "EUR"');
    expect(paymentState).toContain("metadata?.quoteDigest !== context.expectedQuoteDigest");
    expect(paymentState).toContain("metadata?.paymentAttemptId !== context.paymentAttemptId");
    expect(webhook).toContain('supabase.rpc("finalize_mollie_payment"');
    expect(webhook).toContain("result?.created === true");
  });

  it("claims durable AI usage before every paid provider call and settles it", () => {
    for (const name of ["customer-enrich", "freetext-extract", "inquiry-extract", "notes-extract"]) {
      const code = source(`supabase/functions/${name}/index.ts`);
      const claim = code.indexOf("claimAiUsage(parsed.usage)");
      const provider = code.indexOf("await generateGeminiJson");
      expect(claim, `${name} must claim a bound reservation`).toBeGreaterThan(-1);
      expect(provider, `${name} must call the bounded provider helper after claim`).toBeGreaterThan(claim);
      expect(code).toContain('outcome: "succeeded"');
      expect(code).toContain('outcome: "uncertain"');
    }

    const kpi = source("supabase/functions/kpi-insight/index.ts");
    expect(kpi.indexOf("await reserveDirectAiUsage")).toBeLessThan(kpi.indexOf("claimAiUsage(usage)"));
    expect(kpi.indexOf("claimAiUsage(usage)")).toBeLessThan(kpi.indexOf("await generateGeminiJson"));
    expect(kpi).toContain('input.kachel !== "werkstatt-puls"');

    const provider = source("supabase/functions/_shared/geminiJson.ts");
    expect(provider).toContain("maxOutputTokens: input.maxOutputTokens");
    expect(provider).toContain("AbortSignal.timeout(20_000)");
    expect(provider).toContain('redirect: "error"');
    expect(provider).toContain("GEMINI_RESPONSE_TOO_LARGE");

    const itemPhoto = source("supabase/functions/item-photo-analyze/index.ts");
    expect(itemPhoto.indexOf('supabase.rpc("claim_item_photo_analysis"')).toBeLessThan(
      itemPhoto.indexOf("await generateGeminiJson"),
    );
    expect(itemPhoto).toContain('supabase.rpc("settle_item_photo_analysis"');
    expect(itemPhoto).toContain("maxOutputTokens: 512");
  });

  it("keeps schema changes local, explicit and approval-gated", () => {
    const migrations = [
      source("supabase/migrations/20260714000100_payment_idempotency_prepared_unapplied.sql"),
      source("supabase/migrations/20260714000200_pin_bcrypt_prepared_unapplied.sql"),
    ];
    for (const migration of migrations) {
      expect(migration).toContain("APPROVAL REQUIRED - PREPARED, NOT APPLIED BY THIS MISSION");
      expect(migration).toContain("PREFLIGHT_FAILED");
      expect(migration).not.toMatch(/CREATE\s+POLICY/i);
      expect(migration).not.toMatch(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    }
  });
});
