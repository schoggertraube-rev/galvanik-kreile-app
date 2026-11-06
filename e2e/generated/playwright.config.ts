import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { localReplayStorageEnvironment } from "../../src/test/localReplayStorage";

process.env.APP_SESSION_SECRET ??= "flow-tests-local-session-secret-2026-11-02";

// PRs run their selected pages plus the first case of every other page.
// A missing selection keeps the entire suite; an empty one runs the smoke cases.
function prSelection(): RegExp | undefined {
  if (process.env.GITHUB_EVENT_NAME !== "pull_request") return undefined;
  const scopePath = resolve("e2e/generated/_pr_scope.json");
  if (!existsSync(scopePath)) return undefined;
  const scope: unknown = JSON.parse(readFileSync(scopePath, "utf8"));
  if (!Array.isArray(scope) || scope.some(page => typeof page !== "string")) {
    throw new Error("FLOW_PR_SCOPE_INVALID");
  }
  const model = JSON.parse(readFileSync(resolve("docs/project/endversion/codex/BAUPLAN.json"), "utf8"));
  const pages = model?.testmodell?.seiten as Record<string, { faelle?: Array<{ id?: string }> }> | undefined;
  if (!pages || scope.some(page => !Object.hasOwn(pages, page))) throw new Error("FLOW_PR_SCOPE_UNKNOWN_PAGE");
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = Object.entries(pages).map(([page, data]) => {
    if (scope.includes(page)) return `BAUPLAN Wege · ${escape(page)} `;
    const id = data.faelle?.[0]?.id;
    if (!id) throw new Error(`FLOW_PR_SMOKE_MISSING:${page}`);
    return `BAUPLAN Wege · ${escape(page)} ${escape(id)} `;
  });
  return new RegExp(patterns.join("|"));
}

export default defineConfig({
  testDir: ".",
  testMatch: "*.flow.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  grep: prSelection(),
  use: {
    baseURL: "http://127.0.0.1:3001",
    viewport: { width: 1914, height: 917 },
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001/start",
    timeout: 60_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      APP_SESSION_SECRET: process.env.APP_SESSION_SECRET ?? "flow-tests-local-session-secret-2026-11-02",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      KREILE_TENANT_SLUG: process.env.KREILE_TENANT_SLUG ?? "galvanik-kreile",
      KREILE_GENERATED_REPLAY: "1",
      AZURE_DOCINTEL_ENDPOINT: "https://azure-generated-replay.invalid",
      AZURE_DOCINTEL_KEY: "generated-replay-only",
      MS_GRAPH_TENANT_ID: "generated-replay",
      MS_GRAPH_CLIENT_ID: "generated-replay",
      MS_GRAPH_CLIENT_SECRET: "generated-replay-only",
      MS_GRAPH_MAILBOX: "flow-replay@fixture.invalid",
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--import=" + pathToFileURL(resolve("e2e/generated/_replayAdapters.mjs")).href].filter(Boolean).join(" "),
      ...localReplayStorageEnvironment(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
    },
  },
});
