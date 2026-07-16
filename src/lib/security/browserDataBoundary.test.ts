import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")
        ? [path]
        : [];
  });
}

describe("browser data boundary", () => {
  it("keeps the browser Supabase factory unreferenced by application modules", () => {
    const allowedDefinitions = new Set([
      "src/lib/supabase/client.ts",
      "src/utils/supabase/client.ts",
    ]);
    const offenders = sourceFiles(join(root, "src"))
      .map((path) => ({ path: relative(root, path).replaceAll("\\", "/"), body: readFileSync(path, "utf8") }))
      .filter(({ path, body }) => !allowedDefinitions.has(path) && /(?:supabase\/client|createBrowserClient)/.test(body))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it("keeps inactive legacy analytics and dossier adapters explicit instead of synthetic", () => {
    const files = [
      "src/components/kommunikation/kommandozentrale/hooks/useClientDossier.ts",
      "src/features/analyse/hooks/useWerkstattPuls.ts",
      "src/features/analyse/hooks/useKiInsight.ts",
    ];
    const body = files.map((path) => readFileSync(join(root, path), "utf8")).join("\n");
    expect(body).not.toContain("supabase.from");
    expect(body).not.toContain("supabase.functions.invoke");
    expect(body).not.toContain("MockCustomer");
    expect(body).not.toContain("INITIAL_ORDERS");
    expect(body).toContain("Serveradapter");
  });
});
