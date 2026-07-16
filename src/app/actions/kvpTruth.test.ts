import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("KVP write truth boundary", () => {
  it("uses a tenant-bound deterministic request receipt for creation retries", () => {
    const action = source("src/app/actions/kvp.actions.ts");
    const repository = source("src/lib/repositories/kvpRepository.ts");

    expect(action).toContain("clientRequestId");
    expect(action).toContain('const itemId = `kvp_${clientRequestId.replaceAll("-", "")}`');
    expect(action).toContain(".onConflictDoNothing");
    expect(action).toContain("KVP-Anfrage-ID wurde bereits mit anderem Inhalt verwendet");
    expect(repository).toContain("clientRequestId: item.clientRequestId");
  });

  it("keeps the same request id across uncertain retries and waits for the server receipt", () => {
    const client = source("src/app/betrieb-kvp/BetriebKvpClient.tsx");

    expect(client).toContain("const createRequestId = useRef<string | null>(null)");
    expect(client).toContain("createRequestId.current = clientRequestId");
    expect(client).toContain("createRequestId.current = null");
    expect(client).toContain("setItems((current) =>");
    expect(client).toContain('itemsState === "error"');
    expect(client).toContain("Bestand unbekannt – keine Nullanzeige");
  });

  it("keeps the legacy local demo client outside the active KVP route", () => {
    const page = source("src/app/kvp/page.tsx");

    expect(page).not.toContain("KvpClient");
    expect(page).toContain('href="/betrieb-kvp"');
    expect(page).toContain('href="/admin/analytics"');
  });
});
