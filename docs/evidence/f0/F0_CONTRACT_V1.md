# F0_CONTRACT_V1 - normative Quelle des F0-V1.0-Vertrags

Herkunft: extern bereitgestellt (Auftraggeber-Upload 2026-08-06, GPT-Masterplanchat). 1:1 ins Repo
uebernommen am 2026-08-10 zur Aufloesbarkeit der Normreferenz (BF-010). Normative Bestaetigung
durch Auftraggeber/Ratifizierer: PENDING (F0_HANDOFF.json contract_ref).

---

# Galvanik-Kreile WerkstattCockpit – F0-Fundamentdoktor-Mission und ZIP-Freigabevertrag

**Version:** 1.0

**Stand:** 06.08.2026

**Mandant:** `galvanik-kreile`

**Repository:** `schoggertraube-rev/galvanik-kreile-app`

**Zielstack:** Next.js App Router, TypeScript, Supabase, Drizzle, Recharts, Framer Motion, PWA

**Auftragstyp:** Konsolidieren, reparieren, beweisen; kein Feature-Big-Bang

**Zielstatus:** `F0 = GREEN` auf genau einem benannten `main`-Commit

---

## 0. Auftrag an den Fundamentdoktor

Bringe das vorhandene technische Fundament des Galvanik-Kreile WerkstattCockpits auf einen einzigen, reproduzierbaren, sicherheitsgeprüften und modular anschlussfähigen Stand. F0 ist Bestandteil der laufenden Fundamentarbeit und kein separates Produktprojekt.

F0 ist erst abgeschlossen, wenn Code, Migrationen, Production-Ledger, Production-Schema, Rollen-/Sicherheitsgrenzen, Storage, CI-Nachweise und kanonische Zustandsdokumente denselben exakten Stand belegen.

Das Ergebnis muss die spätere, commitgebundene Übergabe an einen App-Builder ermöglichen. Es darf noch nicht die gesamte App, den vollständigen modularen Baukasten, die neue UI oder alle Produktmodule implementieren.

### 0.1 Erfolgsformel

```text
ein main-Commit
+ eine reproduzierbare Migrationswahrheit
+ ein Fresh Replay von leerer Datenbank
+ ein versöhntes Production-Ledger
+ fail-closed Rechte-/Storage-Grenzen
+ vollständige automatisierte Checks
+ aktuelle kanonische Dokumente
+ keine ungeklärte parallele Foundation-Arbeit
= F0 GREEN
```

### 0.2 Verbindliche Wahrheitsgrenze

- Ein grüner Build allein ist kein F0-PASS.
- Ein erfolgreicher Fresh Replay allein ist kein Production-Paritätsbeweis.
- Eine lokal vorhandene Migration gilt nicht als remote angewandt.
- Ein aktueller sicherer Production-Zustand ist nicht reproduzierbar, wenn er nicht in der Migrations- und Ledgerkette abgebildet ist.
- Ein PR-Bericht ist kein Beweis. Alle Aussagen müssen auf den exakten Commit, Befehl, Test und Zielzustand zurückführbar sein.
- F0-GREEN erlaubt die Erstellung des Claude-Baupakets, beweist aber weder fertige Fachmodule noch Produkt-Go-live.

---

## 1. Produkt- und Architekturkontext, der nicht beschädigt werden darf

Der Fundamentdoktor arbeitet ausschließlich am WerkstattCockpit. Hotel-, Lerninsel- oder andere Fachlogik darf nicht in das Kreile-Produkt eingebaut werden.

Die spätere Wiederverwendung wird durch einen **modularen Monolithen mit stabilen Verträgen** vorbereitet:

| Schicht | Zweck |
|---|---|
| Plattformkern | Identität, Autorisierung, Audit, Datenbank, Storage, Offline-Outbox, Telemetrie |
| neutrale Shared-Module | Capture/Evidenz, Kommunikation, Aufgaben/Termine, Dokumente, Buchkern, Analyse – erst nach realem Kreile-Beweis extrahierbar |
| Kreile-Vertical | Auftrag, natürliche Arbeitsgruppe, Produktionshandlung, Station, Qualität, Ausgang und restaurationsspezifische Regeln |
| Connectoren | E-Mail, Kalender, OCR, KI, Bank, Export oder andere externe Anbieter hinter Ports/Adaptern |
| App-Komposition | Kreile-Rollen, Navigation, CI, Module, Feature-Reife und konkrete Provider |

Verbindliche Regeln:

1. Kreile bleibt erste Referenzkomposition; keine vorschnelle Universal-App.
2. Jetzt intern modularisieren, Kreile beweisen, zweite reale Nutzung beweisen, erst dann extrahieren.
3. Modulgrenzen laufen nur über öffentliche TypeScript-Typen, Ports/Provider, Komponenten-Props und versionierte SQL-Views/Functions.
4. Keine Tiefimporte in Interna anderer Module.
5. Genau eine Single Source of Truth je Kunde, Auftrag, Produktionszustand, Ereignis, Dokument, Rechnung, Zahlung, Aufgabe und Kennzahl.
6. `src/app` komponiert; Routen besitzen keine zweite Fachlogik.
7. KPI-, Prioritäts-, Status- und Geldableitungen liegen in versionierten SQL-Read-Models, nicht parallel in React/TypeScript.
8. Tenant, Rolle und Autorisierung werden serverseitig aus der kanonischen Sitzung bestimmt; nie aus einer Client-`tenantId`.
9. Keine Mockdaten, `Math.random` oder erfundenen Zahlen im Produktionspfad.
10. Keine Ordner-Großverschiebung, Tabellenumbenennung oder Paketextraktion innerhalb dieser Mission.

### 1.1 Geschütztes Produktziel

Das spätere System muss Michael als dauerhafte Büroabhängigkeit ersetzen und Rolf sowie Philipp ermöglichen, den Betrieb zu zweit zu tragen:

- Rolf: Desktop; Kontrolle, Geld, Termine, Freigaben, Risiko und Planbarkeit.
- Philipp: Tablet; Produktion, nächste Handlung und notwendige Dokumentation ohne zusätzliche Büroarbeit.
- Michael: nur Übergabe- und Regressionstest für Aufnahme, Telefon, E-Mail, Eingang und Ausgang; keine dauerhaft notwendige dritte Betriebsrolle.

Operatives Herz:

```text
Kontakt/Kunde
→ Auftragshülle
→ Rückgabesatz und natürliche Arbeitsgruppen
→ nur bei realem Risiko physischer Anker/QR/Behälter
→ Befund und Verpflichtung
→ Arbeitsaktion/Produktion
→ Qualität/Ausgang
→ Rechnung/Zahlung
→ belegte Chef- und Tageslage
```

F0 muss diesen späteren Weg ermöglichen und darf keine konkurrierenden Entitäten oder Statuswahrheiten zementieren. F0 implementiert diesen Gesamtweg noch nicht.

---

## 2. Dokumenten- und Quellenrang

Vor jeder Arbeit muss der Fundamentdoktor aus dem aktuellen `origin/main` lesen:

1. `AGENTS.md`
2. `docs/project/MASTERPLAN.md`
3. `docs/project/CURRENT_STATE.md`
4. `docs/project/NON_LOSS_REGISTER.md`
5. `docs/project/DOCUMENT_AUTHORITY.md`
6. `docs/project/MODULARITY_STRATEGY.md`
7. diese Missionsdatei

Zusätzlicher Produktvertrag für die spätere Übergabe:

- `KREILE_MASTERPLAN_MODULARER_APP_BAUKASTEN_V2_0.md`

Reale Systemwahrheit kommt aus:

1. GitHub `main` und dem exakt geprüften Commit,
2. Vercel Production und dessen Deployment-Commit,
3. Supabase Production: Schema, Ledger, Grants, RLS, Functions, Storage und Default Privileges,
4. reproduzierbaren lokalen bzw. CI-Nachweisen.

Widersprechen die kanonischen Dokumente diesen Ebenen, ist das `DRIFT`. Der Drift wird vorwärtsgerichtet korrigiert; er darf nicht durch Auswahl einer bequemeren Quelle verdeckt werden.

---

## 3. Ausgangssnapshot – zwingend neu zu verifizieren

Der folgende Stand ist nur der zuletzt bekannte Prüfhinweis vom 06.08.2026, nicht die Startwahrheit der Mission:

| Bereich | Zuletzt bekannter Stand |
|---|---|
| `main` | `6e0c74893ed10e5337e03b10457477f4b6d8cbf7` |
| lokale Basischecks | TypeScript PASS; ESLint PASS; 22 Unit-Dateien/126 Tests PASS; Build mit sicherem Env-Vertrag PASS |
| Gesamttests | nicht vollständig belegt; zwei Integration-Suites benötigen eine echte Testdatenbank |
| Foundation-Parallelarbeit | acht offene PRs `#40` bis `#47` |
| Baseline/Fresh Replay | PR `#40` als Kandidat; nach späteren Production-Änderungen erneut zu erzeugen |
| Zustandsdokumente | auf `main` nachweislich veraltet; Korrekturkandidat in PR `#45` |
| Production-PINs | zuletzt 6/6 bcrypt cost 12; 0 Legacy-Viersteller |
| aktuelle Tabellen-/View-Grants | zuletzt 0 Grants für `anon` und `authenticated` |
| strukturelle Sicherheitslücke | Default Privileges können künftige Objekte erneut exponieren; RLS-/Rollenvertrag nicht vollständig |
| Production-Ledger | 96 Einträge; produktive Änderungen D1/D2 nicht vollständig ledgergebunden |
| Gesamt-F0 | `RED / FAIL_INTERNAL` |

Der Fundamentdoktor muss am Missionsbeginn jedes Feld neu lesen. Geänderte PR-Nummern, Commits, Ledgerstände oder Runtimebefunde ersetzen diesen Snapshot im Preflightbericht.

---

## 4. Arbeits- und Freigabemodell

### 4.1 Rollen

| Rolle | Verantwortung |
|---|---|
| Writer/Fundamentdoktor | Analyse, Konsolidierungsbranch, Reparaturen, Tests, Draft-PR und Beweise |
| unabhängiger Reviewer | Diff-, Security-, Migration-, Replay- und Nachweisprüfung ohne Vorannahme |
| Nutzer | Freigabe von Merge, Production-Deploy, Remote-Migration, Ledger-Reconciliation, RLS-/Policy-Mutation und Löschung |
| nachgelagerter Produktarchitekt | unabhängige F0-Endprüfung und Erstellung des Claude-ZIP nach Nutzerfreigabe |

### 4.2 Ohne gesonderte Nutzerfreigabe erlaubt

- read-only Inventur von GitHub, Vercel und Supabase;
- isolierter Worktree und Konsolidierungsbranch;
- lokale Code-, Dokument-, Test- und Migrationsänderungen;
- lokale Testdatenbank und Fresh Replay;
- Push eines klar benannten Kandidatenbranches und Erstellung eines Draft-PR, sofern bestehende Repository-Regeln dies erlauben;
- Preview-Deployment des PR-Heads, wenn dies der etablierte nichtproduktive Workflow ist.

### 4.3 Ohne gesonderte Nutzerfreigabe verboten

- Merge nach `main`;
- Production-Promotion oder Production-Deploy;
- Remote-Supabase-Migration oder `db push` gegen Production;
- Eintrag, Reparatur oder Umschreibung des Production-Migrationsledgers;
- RLS-, Policy-, Grant- oder Default-Privilege-Mutation in Production;
- Daten-, Branch-, Datei-, Storage-Objekt- oder Bucket-Löschung;
- Secret-Auslesen, Secret-Ausgabe oder Aktivierung kostenpflichtiger Dienste.

### 4.4 Zulässige Abschlussstatus

- `PASS`
- `FAIL_INTERNAL`
- `BLOCKED_EXTERNAL_PERMISSION`
- `BLOCKED_PRODUCT_DECISION`

Ein externer Freigabestopp ist kein technischer PASS. Vor der Freigabe müssen jedoch alle lokalen und read-only vorbereitbaren Nachweise vollständig sein.

---

## 5. Verbindliche Mission – sequenziell abarbeiten

### F0-01 – Preflight und Driftinventur

1. Aktuelles `origin/main` lesen und exakten SHA sichern.
2. Git-Status, Worktrees, lokale/Remote-Branches und alle offenen PRs erfassen.
3. Vercel-Production-Commit read-only ermitteln.
4. Supabase Production read-only inventarisieren: Ledger, Schema, Tabellen-/View-/Function-Grants, RLS/Policies, Default Privileges, Storage-Buckets/Policies und relevante Extensions.
5. Lokale Migrationen, Manifest, Drizzle-Schema und Production gegeneinander abgleichen.
6. Kanonische Dokumente gegen die reale Systemwahrheit prüfen.
7. Preflight als `docs/evidence/f0/F0_PRECHECK.md` mit Zeitstempel, Befehlen/Queries und Ergebnissen ablegen.

**Definition of Done:** Jede Abweichung besitzt Besitzer, Schweregrad, betroffene Wahrheit, geplante Vorwärtskorrektur und Verifikationsweg. Kein Schreibschritt erfolgt vor diesem Inventar.

### F0-02 – Parallelarbeit verlustfrei konsolidieren

1. Für jeden offenen Foundation-PR erfassen: Head, Base, Merge-Base, Commits, Dateien, Migrationen, Tests, Abhängigkeiten, Überschneidungen und ersetzte PRs.
2. Den zuletzt bekannten Sachverhalt prüfen: `#41` wurde durch `#45` ersetzt; `#40` ist Baseline-Kandidat; `#42`, `#43`, `#44`, `#45`, `#46`, `#47` müssen kontrolliert bewertet werden.
3. Keine PRs blind oder in beliebiger Reihenfolge mergen.
4. Einen einzigen Konsolidierungsbranch vom aktuellen `origin/main` erstellen.
5. Änderungen klein und nachvollziehbar übernehmen; doppelte oder überholte Varianten nicht parallel erhalten.
6. Nicht übernommene Arbeit im Non-Loss-/Disposition-Register mit Grund und Salvage-Referenz sichern.

**Definition of Done:** Genau ein vollständiger F0-Kandidat; keine ungeklärte überlappende Foundation-Arbeit; jede alte Kandidatenlinie ist `INTEGRATED`, `SUPERSEDED`, `DEFERRED_WITH_REASON` oder `PROTECTED_SALVAGE`.

### F0-03 – Reproduzierbare Baseline und Fresh Replay

1. Aktuelles Production-Schema read-only neu erfassen; keine Daten oder Secrets in die Baseline übernehmen.
2. Baseline und Post-Baseline-Migrationen so ordnen, dass eine leere, definierte Postgres-/Supabase-Testinstanz reproduzierbar aufgebaut werden kann.
3. Bereits produktiv wirksame, aber ledgerlose D1-/D2-Änderungen in der vorwärtsgerichteten Kette abbilden.
4. Keine angewandte Historie still umschreiben und keine Baseline blind auf die bestehende Production anwenden.
5. Fresh Replay mindestens zweimal aus leerer Instanz ausführen.
6. Schema-, Function-, Grant-, RLS-, Default-Privilege- und Storage-Vertrag des Replays gegen den erwarteten Zielzustand vergleichen.
7. Replay-Skript und CI-Gate idempotent und nicht interaktiv machen.

**Definition of Done:** Zwei erfolgreiche Empty-to-Target-Läufe; identische relevante Digests; keine manuelle Zwischenkorrektur; CI führt denselben Replayvertrag aus.

### F0-04 – Ledger-Reconciliation vorbereiten

1. Production-Ledger und lokale aktive Kette versions-, namens-, reihenfolge- und hashgenau vergleichen.
2. Für jede Differenz klassifizieren: `APPLY_REQUIRED`, `ALREADY_EFFECTIVE_REGISTER_ONLY`, `BASELINE_ONLY`, `QUARANTINED`, `CONFLICT`.
3. Einen expliziten Reconciliation-Plan mit Vorher-/Nachherzustand, Risiko, Rollback und Postflight erstellen.
4. Keine bereits wirksame Migration erneut gegen Production ausführen.
5. Keine Ledger-Reparatur ohne gesonderte Nutzerfreigabe durchführen.

**Definition of Done vor Freigabe:** Der Plan ist vom unabhängigen Reviewer geprüft und kann keine DDL/DML-Wirkung mit bloßer Ledgerregistrierung verwechseln.

**Definition of Done nach Freigabe:** Production-Ledger und freigegebene aktive Kette sind versöhnt; ein neuer read-only Digest belegt den Zustand.

### F0-05 – Fail-closed Sicherheitsvertrag

1. Jede Tabelle, View, Function, Sequence und jeden Storage-Pfad einem Besitzer und Zugriffstyp zuordnen.
2. Jede Relation erhält genau eine explizite Entscheidung:
   - über Data API exponiert: RLS aktiv, rollen-/tenantgebundene Policies sowie positive und negative Tests;
   - nicht exponiert: Grants für `anon`/`authenticated` entzogen und kein View-/Function-Bypass.
3. Default Privileges aller relevanten Objektbesitzer/Grantor-Rollen einschließlich `supabase_admin` und `postgres` fail-closed definieren.
4. Breite Alt-Policies wie `USING true`, `WITH CHECK true` oder pauschales `FOR ALL` einzeln bewerten.
5. Views auf `security_invoker` bzw. einen nachweislich unexponierten, begründeten Vertrag prüfen.
6. Function-`EXECUTE`-Rechte und `SECURITY DEFINER`-Funktionen einschließlich `search_path`, Autorisierung und Tenantbindung prüfen.
7. PIN-/Sessionvertrag prüfen: 6/6 bcrypt cost 12, keine Legacy-/Plaintext-PINs, Fehlversuchsschutz, Session-Widerruf; offene Device-Challenge ehrlich ausweisen.
8. Keine Secret-, PIN-, Service-Role- oder interne UUID-Ausgabe im Clientpayload.

**Definition of Done:** Maschinenlesbare Rechte-/Ownership-Matrix; legitime Kontrollfälle PASS; anonym, falsche Rolle und fremder Tenant FAIL; keine implizite oder künftige Wiederexposition durch Default Privileges.

### F0-06 – Storage- und Uploadgrenze

1. Alle Buckets, Pfadkonventionen, Policies, Signed-URL-Erzeuger und `getPublicUrl`-Pfade inventarisieren.
2. Fachzwecke trennen: Originaldokument, OCR-Beleg, Teilefoto, Zustands-/Nacharbeitsfoto.
3. Originale bleiben privat und werden vor OCR/Zuweisung unveränderlich gesichert.
4. Negativtests: anonym, fremder Tenant, manipulierter Pfad, falscher MIME-Typ, Größenüberschreitung, abgelaufene Signed URL und nicht autorisierte Löschung.
5. Kein öffentlicher Bucket oder öffentlicher URL-Pfad als Abkürzung.

**Definition of Done:** Bucket-/Policy-/Pfadmatrix, positive und negative Tests sowie Ablauf-/Fehlernachweis. Vier private Buckets allein genügen nicht als PASS.

### F0-07 – Minimale modulare Anschlussfähigkeit

Diese Stufe repariert Fundamentgrenzen, baut aber noch nicht den Gesamtbaukasten.

1. Jede bestehende Foundation-Wahrheit erhält genau einen Owner: Identity, Database, Storage, Offline, Audit/Telemetry.
2. Direkte Supabase-Clientinstanzen inventarisieren; es bleibt genau ein kanonischer Browserclient unter `src/lib/supabase/client.ts` oder eine im aktuellen `main` bereits verbindlich beschlossene äquivalente kanonische Stelle.
3. Neue/angepasste Grenzen über öffentliche Ports/Typen führen; keine neuen Tiefimporte.
4. Kreile-Tenant, Rollen, UI-Begriffe und Fachstatus nicht in neutrale Foundation-Interna einbrennen.
5. Composition-/Modulmanifest mindestens als validierten Vertrag vorbereiten: Modul-ID, Version, Owner, öffentliche Exporte, benötigte Capabilities, Migrationen, Views/Functions, Storage-Zwecke, Events, Konfiguration und Abhängigkeiten.
6. Verbotene neue Cross-Imports und neue Parallelclients in CI prüfbar machen.
7. Keine Paketextraktion, Massenverschiebung oder zweite Datenbank in F0.

**Definition of Done:** Der spätere Builder kann F1/F2 gegen einen eindeutigen Foundation-Owner- und Importvertrag beginnen, ohne F0-Dateien erneut grundsätzlich umzubauen.

### F0-08 – Runtime-, Build- und Testbeweis

Auf exakt dem Konsolidierungs-Head und mit Node `24.18.0`:

```text
P1: npm ci
P2: npx tsc --noEmit --incremental false
P3: npm run lint
P4: npm run test:unit bzw. kanonischer Unit-Testbefehl
P5: alle relevanten Integrationstests gegen eine isolierte Testdatenbank
P6: npm run build
P7: Fresh Replay von leerer Datenbank
P8: Ledger-/Schema-/Grant-/RLS-/Storage-Parität
P9: positive und negative Auth-/Rollen-/Tenant-/Storage-Tests
P10: Vercel Preview des exakten PR-Heads und relevante Browser-Smokes
P11: git diff --check
P12: git diff --stat und git status --short
```

Voraussetzungen und Testdaten müssen reproduzierbar beschrieben sein. Production darf niemals als schreibende Integrationstestdatenbank verwendet werden.

**Definition of Done:** Jeder P-Check besitzt Befehl, Exitcode, Umgebung, Commit und Ergebnis. Skips, Dummywerte oder fehlende Suites sind einzeln sichtbar und verhindern PASS, sofern sie den F0-Vertrag betreffen.

### F0-09 – Kanonische Dokumente auf Wahrheit bringen

1. `docs/project/CURRENT_STATE.md` auf den tatsächlichen Kandidaten- bzw. Endstand aktualisieren.
2. `docs/project/MASTERPLAN.md`, `NON_LOSS_REGISTER.md`, `DOCUMENT_AUTHORITY.md`, `MODULARITY_STRATEGY.md`, `MISSION_QUEUE.md` und `OWNERSHIP_MAP.md` auf Widersprüche prüfen.
3. Abgeschlossene, aktive, blockierte und geschützte Arbeit exakt klassifizieren.
4. Alte Berichte, lokale Altpläne und Prototypquellen bleiben Quellenmaterial und dürfen `main` nicht überschreiben.
5. Keine Behauptung von Produkt-, Offline-, Buchhaltungs-, KI-, DATEV-, GoBD- oder Go-live-Reife ohne E2E-Beweis.

**Definition of Done:** Eine automatisierte Driftprüfung findet keine veralteten Commit-, Ledger-, PR-, Security- oder Statusbehauptungen im kanonischen Dokumentensatz.

### F0-10 – Draft-PR und unabhängige Review

1. Einen einzigen Draft-PR vom Konsolidierungsbranch erstellen.
2. PR-Beschreibung enthält Scope, Nicht-Scope, Start-/End-Head, Migrationen, Securityänderungen, Replay, Tests, Risiken, Rollback, Freigabepunkte und nummerierte Nachweise.
3. Unabhängiger Reviewer reproduziert Replay, Ledgervergleich, Security-Negativtests und Kernchecks.
4. Reviewbefunde werden maximal in zwei kontrollierten Reparaturschleifen geschlossen.
5. Kein Merge durch den Writer.

**Definition of Done:** Reviewstatus `GO_FOR_PERMISSIONED_MERGE`; alle lokalen/CI-Nachweise grün; Remote-Schritte sind als exakte, begrenzte Freigabeanfrage formuliert.

### F0-11 – Freigabepflichtiger Merge, Production-Schritt und Postflight

Erst nach ausdrücklicher Nutzerfreigabe:

1. freigegebenen PR exakt mergen;
2. Production-Deploy nur auf den freigegebenen Commit durchführen bzw. verifizieren;
3. ausschließlich die freigegebene Migrations-/Ledgerfolge ausführen;
4. Schema-Cache bei Bedarf kontrolliert neu laden;
5. Production read-only erneut prüfen: Commit, Ledger, Schema, Grants, RLS, Functions, Default Privileges, Storage und PIN-Vertrag;
6. legitime Runtime-Smokes und negative Auth-/Tenant-/Storage-Fälle ausführen;
7. kanonische Dokumente auf den endgültigen `main`-Commit bringen;
8. finalen F0-Beweisbericht committen und erneut CI prüfen.

**Definition of Done:** Code-, Deployment-, DB-, Ledger-, Security- und Dokumentwahrheit stimmen auf dem endgültigen Commit überein. Kein offener F0-Blocker und keine ungeklärte Foundation-Parallelarbeit.

---

## 6. F0-Austrittsmatrix

Jede Zeile ist zwingend. `PARTIAL`, `CANDIDATE_PASS`, `PASS_CURRENT_STATE` oder `NOT_PROVEN` ergeben kein F0-GREEN.

| ID | Austrittskriterium | Pflichtnachweis |
|---|---|---|
| F0-A01 | genau ein geprüfter `main`-Commit | vollständiger SHA und sauberer Checkout |
| F0-A02 | keine ungeklärte Foundation-Parallelarbeit | PR-/Branch-Disposition und Non-Loss-Register |
| F0-A03 | reproduzierbare Baseline | zwei Fresh Replays aus leerer Instanz |
| F0-A04 | versöhnte Migrationen/Ledger | versions-/namens-/hashgenauer Digest |
| F0-A05 | Production-Parität | Schema-/Function-/Grant-/RLS-/Default-Privilege-/Storage-Vergleich |
| F0-A06 | fail-closed Data API | relationenweise Entscheidung plus positive/negative Tests |
| F0-A07 | fail-closed Functions/Views | `EXECUTE`, `SECURITY DEFINER`, `search_path`, Invoker-/Expositionsprüfung |
| F0-A08 | private und autorisierte Storage-Pfade | Bucket-/Policy-/Signed-URL-/Negativtests |
| F0-A09 | PIN-/Sessiongrundlage sicher | bcrypt-Bestand, kein Plaintext, Rate-Limit/Race und Session-Widerruf |
| F0-A10 | vollständige Quality-Gates | TypeScript, Lint, Unit, Integration, Build, Browser, Diff-Checks |
| F0-A11 | minimale modulare Anschlussfähigkeit | Owner, öffentliche Ports, Importregeln, ein Client, Manifestvertrag |
| F0-A12 | kanonische Dokumente aktuell | Driftprüfung gegen endgültigen Commit und Runtime |
| F0-A13 | unabhängige Review bestanden | Reviewer-Nachweis, kein Selbst-PASS |
| F0-A14 | Rollback und Betrieb vorbereitet | freigegebene Reihenfolge, Rückfallweg, Postflight |
| F0-A15 | keine verdeckte Produktreife behauptet | Scope-/Nicht-Scope- und Restbacklog-Prüfung |

---

## 7. Expliziter Nicht-Scope dieser Mission

Nicht innerhalb F0 bauen:

- die vollständige neue Navigation oder UI;
- Figma-/Storybook-Gesamtsystem;
- den vollständigen Produktionsablauf oder alle P1–P10-Slices;
- Unternehmer-Cockpit, Brain, Marketing, Bäderwirtschaft oder vollständigen Buchkern;
- 48-Stunden-Offlinefähigkeit als Produktfunktion;
- reale externe KI-, Bank-, DATEV-, Kalender-, E-Mail- oder OCR-Produktivadapter;
- Microservices, Monorepo-Großumbau oder extrahierte Universalpakete;
- eine Lerninsel-, Hotel- oder andere Fremdkomposition;
- Production-Go-live der Gesamt-App.

Erlaubt sind ausschließlich Foundation-Änderungen, die für F0-Wahrheit, Sicherheit, Reproduzierbarkeit oder die minimale modulare Anschlussfähigkeit zwingend sind.

---

## 8. Pflichtartefakte des Fundamentdoktors

Alle Artefakte müssen im Draft-PR versioniert und auf denselben Head bezogen sein. Pfade dürfen an die bestehende Repo-Konvention angepasst werden, sofern die Zuordnung eindeutig bleibt.

| Artefakt | Mindestinhalt |
|---|---|
| `F0_PRECHECK.md` | Start-Head, Runtime-/DB-/PR-Inventur und Drift |
| `F0_PR_CONSOLIDATION_MATRIX.md` | jede Foundation-Kandidatenlinie und Disposition |
| `F0_MIGRATION_BASELINE_AND_REPLAY.md` | Baseline, aktive Kette, zwei Replayläufe, Digests |
| `F0_LEDGER_RECONCILIATION_PLAN.md` | Klassifikation jeder Differenz, Freigabeschritt, Rollback |
| `F0_SECURITY_OWNERSHIP_MATRIX.md` | Tabellen, Views, Functions, Sequences, Default Privileges, Rollen, Owner |
| `F0_STORAGE_CONTRACT.md` | Buckets, Fachzwecke, Pfade, Policies, URL-Erzeuger, Negativtests |
| `F0_MODULAR_FOUNDATION_MAP.md` | Foundation-Owner, Ports, Clients, Importe, Manifestvertrag |
| `F0_TEST_EVIDENCE.md` | P1–P12 mit Befehl, Exitcode, Umgebung und Commit |
| `F0_PERMISSION_PACKET.md` | exakt benötigte Remote-Freigaben und ihre Wirkung |
| `F0_POSTFLIGHT.md` | endgültiger Production-/Ledger-/Security-/Runtimeabgleich |
| `F0_FINAL_REPORT.md` | Austrittsmatrix F0-A01–F0-A15, Restblocker, Abschlussstatus |
| `F0_HANDOFF.json` | maschinenlesbare Übergabewerte gemäß Abschnitt 9 |

Beweislogs dürfen gekürzt werden, müssen aber Befehl, Exitcode, relevante Ausgabe, Zeitpunkt und Commit enthalten. Secrets, PINs, Tokens und echte personenbezogene Daten dürfen nie in Artefakte oder Logs gelangen.

---

## 9. Verbindliches Rückgabeformat

Der Fundamentdoktor beendet seine Antwort mit diesem ausgefüllten Block:

```text
MISSION=KREILE_F0_FOUNDATION_TRUTH_AND_ZIP_READINESS
FINAL_STATUS=PASS|FAIL_INTERNAL|BLOCKED_EXTERNAL_PERMISSION|BLOCKED_PRODUCT_DECISION
START_MAIN_HEAD=<40-char-sha>
FINAL_MAIN_HEAD=<40-char-sha-or-NOT_MERGED>
CANDIDATE_HEAD=<40-char-sha>
DRAFT_PR=<url-or-NONE>
PRODUCTION_DEPLOYMENT_HEAD=<40-char-sha-or-NOT_PROVEN>
PRODUCTION_LEDGER_COUNT=<integer>
PRODUCTION_LEDGER_DIGEST=<digest-or-NOT_PROVEN>
FRESH_REPLAY_RUNS=<integer>
FRESH_REPLAY_DIGEST=<digest-or-NOT_PROVEN>
SCHEMA_SECURITY_DIGEST=<digest-or-NOT_PROVEN>
OPEN_FOUNDATION_PRS=<integer>
UNRESOLVED_PARALLEL_WORK=<integer>
F0_A01_TO_A15=<PASS-or-list-of-nonpass-ids>
REMOTE_MUTATIONS=<exact-list-or-NONE>
OPEN_BLOCKERS=<integer>
NEXT_REQUIRED_PERMISSION=<exact-action-or-NONE>
ZIP_READINESS=GREEN|RED
```

Zusätzlich sind zu liefern:

- Link zum Draft-/Merge-PR;
- Link zum exakten Preview-Deployment;
- Pfade zu allen Pflichtartefakten;
- vollständige Liste der Remote-Mutationen ohne Secretwerte;
- Liste aller nicht bestandenen oder übersprungenen Tests;
- unabhängiges Reviewurteil.

`ZIP_READINESS=GREEN` ist nur zulässig, wenn `FINAL_STATUS=PASS`, F0-A01 bis F0-A15 `PASS`, `OPEN_BLOCKERS=0`, `UNRESOLVED_PARALLEL_WORK=0` und der endgültige `main`-/Production-/Ledgerstand exakt benannt sind.

---

## 10. Übergabe an den Ersteller des Claude-ZIP

Nach Abschluss des Fundamentdoktors gilt folgende Reihenfolge:

1. Nutzer übergibt `F0_FINAL_REPORT.md`, `F0_HANDOFF.json` und PR-/Preview-Links an den Produktarchitekten.
2. Der Produktarchitekt prüft F0 unabhängig read-only gegen den dann aktuellen `main`, Vercel und Supabase. Ein behauptetes PASS wird nicht ungeprüft übernommen.
3. Bei bestätigtem F0-GREEN erteilt der Nutzer ausdrücklich: `Claude-ZIP erstellen`.
4. Erst dann wird das commitgebundene Baupaket aus `KREILE_MASTERPLAN_MODULARER_APP_BAUKASTEN_V2_0.md` erzeugt.
5. Das ZIP enthält den verifizierten Current State, Quellenrang, modulare Architektur, Modul-/Ownership-Katalog, Daten- und Commandverträge, Screen-/Komponenten-/Fixture-Register, Klickpfade, Akzeptanzmatrix, sequenzielle Claude-Prompts, Non-Loss-Register und Go-live-Vertrag.
6. Claude erhält keine Einmalmission „baue alles“, sondern eine sequenzielle Warteschlange mit genau einem begrenzten PR-Inkrement je Auftrag.

### 10.1 Präzise Antwort auf die ZIP-Frage

| Paketart | Vor F0 möglich? | Empfehlung |
|---|---:|---|
| reines Quellen-/Konzeptarchiv | ja | nicht als Bauauftrag verwenden |
| klickbarer Prototyp-/Designinput | parallel möglich | strikt als Szenario-/Designspur kennzeichnen |
| commitgebundenes Claude-Baupaket | nein | erst nach unabhängig bestätigtem F0-GREEN |
| produktiver Implementierungsauftrag | nein | zusätzlich jeweils Slice-, Design- und Datenvertragsgate erforderlich |

F0 ist daher die Eintrittsvoraussetzung für das endgültige ZIP, aber nicht die Behauptung, dass danach bereits alles gebaut oder produktionsreif sei.

---

## 11. Endanweisung an den Fundamentdoktor

Arbeite die Mission F0-01 bis F0-11 strikt in Reihenfolge ab. Stoppe nur bei einer echten externen Freigabe oder einer nicht auflösbaren Produktentscheidung. Ersetze keinen fehlenden Nachweis durch eine plausible Behauptung. Führe keine unautorisierten Remote-Mutationen aus. Melde erst `PASS`, wenn jede Zeile F0-A01 bis F0-A15 auf demselben endgültigen Commit und gegen die tatsächliche Production belegt ist.
