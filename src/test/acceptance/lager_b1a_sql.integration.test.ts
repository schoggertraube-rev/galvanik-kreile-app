// @vitest-environment node
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { afterAll, test } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const replayPort = process.env.GITHUB_ACTIONS === "true" ? "54322" : "54342";
const replay = databaseUrl && URL.canParse(databaseUrl) ? new URL(databaseUrl) : null;
if (!replay || databaseUrl !== process.env.H18_EXPECTED_DATABASE_URL
    || replay.protocol !== "postgresql:" || replay.hostname !== "127.0.0.1" || replay.port !== replayPort) {
  throw new Error("LAGER_B1A_DEDICATED_LOOPBACK_REQUIRED");
}

const sql = postgres(replay.href, { max: 1 });
afterAll(() => sql.end());

const abnahmen = [
  "lager_journal.abnahme.sql",
  "lager_altbestand.abnahme.sql",
  "lager_metallbewegung.abnahme.sql",
  "lager_auftragskalkulation.abnahme.sql",
  "lager_w1_altverbrauch.abnahme.sql",
  "lager_badanker.abnahme.sql",
  "lager_badanalyse.abnahme.sql",
  "lager_orte.abnahme.sql",
  "lager_inventurzaehlung.abnahme.sql",
  "lager_inventurabschluss.schutz.sql",
  "lager_inventur_badbewertung.abnahme.sql",
] as const;

for (const datei of abnahmen) {
  test(datei, async () => {
    const abnahme = await readFile(new URL(datei, import.meta.url), "utf8");
    try {
      await sql.unsafe(abnahme).simple();
    } catch (error) {
      await sql.unsafe("ROLLBACK");
      throw error;
    }
  });
}
