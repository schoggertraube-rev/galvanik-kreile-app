<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Bericht — Nacharbeit Dossier M01_BUCHHALTUNG

**Stand:** 2026-09-26  
**Anlass:** unabhängige Prüfung vom 2026-09-26  
**Umfang:** ausschließlich OE-2609-25/Hintergrund-Jobs und die Dateianzahl von `accounting-core-contract-v1-candidate2`

## Änderungsliste

| Datei | Stelle | alt → neu | Beleg |
|---|---|---|---|
| `06_ENTSCHEIDUNGEN.md` | Entscheidungsverweise | OE-2609-25 fehlte → Verweis mit Datum 2026-09-26 und fortbestehendem Owner-Gate ergänzt | `..\00_PROJEKT\OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md`, Zeile OE-2609-25 |
| `04_SCHNITTSTELLEN_DATEN.md` | APIs, Provider und Secrets / M365-E-Mail | allgemeiner Microsoft-Owner-Gate → „Produktiv im Kreile-eigenen Tenant/Azure-Abo, Dev nur synthetisch“ samt Anlage-/Zustimmungsgate | `..\00_PROJEKT\OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md`, OE-2609-25; `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` §8 |
| `04_SCHNITTSTELLEN_DATEN.md` | APIs, Provider und Secrets / Hintergrund-Jobs | fehlte → „Hintergrund-Jobs über Supabase Cron + Outbox“ mit PL-Entscheidung vom 2026-09-26 und offenem Kosten-Gate ergänzt | `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` §8 |
| `08_OFFENE_FRAGEN.md` | Q-M01-016 | Produktiv-/Kosten-Gate fehlte → konkrete Owner-Frage; bis dahin Produktivanbindungen und Hintergrund-Jobs „In Klärung“, Dev nur synthetisch | `..\00_PROJEKT\OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md`, OE-2609-25; `..\00_PROJEKT\00_OFFENE_PUNKTE_KREILE.md`, OP-36/37; `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` §8 |
| `11_IST_CODE_UMBAU.md` | Candidate.2-Zeile | 83 Dateien → 86 Dateien insgesamt; 83 bleiben als Umfang des Core-Hashinventars erklärt | `C:\Users\Traube\Documents\Codex\2026-09-16\du\work\accounting-core-contract-v1-candidate2\`; dort `CORE_ARTIFACT_HASHES.sha256` |
| `BERICHT_2026-09-26.md` | Aktualitätsprüfung / Candidate.2 | 83 Dateien → 86 Dateien insgesamt mit Abgrenzung zum 83-Dateien-Core-Inventar | derselbe Kandidatenordner und `CORE_ARTIFACT_HASHES.sha256` |
| `10_CHECKLISTE.md` | Punkte 1, 6, 8, 10, 11 und 12 | Stand vor Nacharbeit → OE-2609-25, Hintergrund-Jobs, Q-M01-016, 86-Dateien-Gesamtzahl, Nacharbeitsbericht und tatsächliche Schreibgrenze nachgezogen | `..\00_ANLEITUNG_MODULDOSSIER.md` §7; die vorgenannten Belege und geänderten Dossierdateien |

## Nachzählung Candidate.2

Die schreibfreie rekursive Aufzählung des realen Kandidatenordners ergab 86 Dateien. `CORE_ARTIFACT_HASHES.sha256` enthält 83 Hashzeilen und erklärt ausdrücklich, dass es sich selbst sowie `CLAUDE_OPUS_AUDIT.md` und `FINAL_ARTIFACT_HASHES.sha256` ausschließt. Damit gilt:

- 83 Dateien im Core-Hashinventar
- 3 ausgeschlossene Hash-/Prüfartefakte
- 86 Dateien insgesamt im Kandidatenordner

Es wurde kein Build, Test, Providerlauf oder Code-Lauf ausgeführt. `02_app`, der Off-Repo-Kandidat und alle fremden Ordner wurden nur gelesen; geschrieben wurde ausschließlich in diesem Dossierordner.

Das offene Produktiv-/Kostengate ist als Q-M01-016 mit „In Klärung“ fail-closed abgesichert. Nach Anleitung §8 verhindert dieses externe Gate den Dossierstatus BAUBEREIT nicht.

DOSSIER-STATUS: BAUBEREIT
