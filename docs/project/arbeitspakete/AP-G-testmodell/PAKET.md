# AP-G · Ausführbares Testmodell: aus dem BAUPLAN erzeugte Wege-Tests (U-230)

Status: **bereit** – Voraussetzung: #158 (AP-01) gemergt; Abschnitt `testmodell` im BAUPLAN (Endversion-Chat, über `BAUPLAN.next.json`, kommt mit TA-B2d auf main). Fassung 1 vom 01.11.
Gate-Rahmen: Mission KREILE-VERKAUFSSTUFE-1, Block B2, Branch `kreile/b2-eingang` frisch von main. Pfade über TA-B2d.

## Ziel
Die Wege einer Seite (Zustand × Aktion → Anzeige + DB-Wirkung) stehen **einmal** im BAUPLAN-Abschnitt `testmodell`. Ein Generator im Repo erzeugt daraus Playwright-Tests, die in CI gegen die lokale Replay-DB laufen. Ein Paket ist erst fertig, wenn alle erzeugten Fälle seiner Seiten grün sind. Niemand schreibt Erwartungen von Hand nach; der Bau-Codex ändert weder Modell noch erzeugte Tests.

## Bauen
1. **Generator** `scripts/spec/generate-flow-tests.mjs`: liest `docs/project/endversion/codex/BAUPLAN.json` → `testmodell`, schreibt je Seite `e2e/generated/<seite>.flow.spec.ts` (Kopf mit Bauplan-SHA). Deterministisch (gleiche Eingabe → bytegleiche Ausgabe). `--check` vergleicht die eingecheckten Dateien mit einer frischen Erzeugung und schlägt bei Abweichung fehl.
2. **Testgerüst** `e2e/generated/_harness.ts`: Anmeldung über die echte Startseite mit Login-Fixtures aus dem Seed (keine echten Codes), Schritte über `data-spec-id`, Erwartungen an Anzeige (sichtbar/Text/Wert/aktiviert/Fokus/Dialoganzahl) und an die DB (SQL-Prüfung gegen die lokale Replay-DB, nur lesend).
3. **Fixtures** `e2e/generated/_seed.sql`: die im Modell genannten Datenlagen (z. B. `kunde_vollstaendig_firma`, `kunde_privat_ohne_ansprechpartner`, `kunde_plz_land_widerspruch`, `kunde_bedingung_bar`, `kunde_bedingung_vorkasse`, Login Rolf mit Rechten), eingespielt nur in die lokale Replay-DB.
4. **CI-Schritt** in `agentur-gate.yml` (Replay-Job, gleicher env-Block wie die Akzeptanztests): `next build` + `next start` gegen die lokale Replay-DB, Seed, `node scripts/spec/generate-flow-tests.mjs --check`, dann `npx playwright test e2e/generated`. Kein Zugriff auf Dev oder Production, keine Secrets.
5. **Erste Abdeckung:** Seiten `eingang` (Plus, AP-01) und `kundeneu`/`kundebearbeiten` (AP-K1), soweit im Modell beschrieben. Für AP-01 müssen alle Fälle grün sein (Regressionsschutz); Fälle für AP-K1 dürfen in AP-G als „erwartet rot“ markiert sein (Liste in der Abgabe) und werden mit AP-K1 grün.

## Nicht anfassen
Produktcode (außer fehlenden `data-spec-id` an Elementen, die das Modell nennt – dann nur das Attribut), Akzeptanztests, Migrationen, andere Gates.

## Gate
- `--check` grün (erzeugte Dateien = Modell). Alle AP-01-Fälle grün in CI. A11 inkl. `git diff --check`.
- Abgabe `docs/delivery/ABGABE_AP-G.md`: Bauplan-SHA, Anzahl Fälle je Seite, Liste „erwartet rot“ (nur AP-K1), CI-Lauf-Link.
- Prüfung durch den Planungschat: Stichprobe erzeugter Fälle gegen den Bauplan + eigener Playwright-Lauf auf der Preview.
