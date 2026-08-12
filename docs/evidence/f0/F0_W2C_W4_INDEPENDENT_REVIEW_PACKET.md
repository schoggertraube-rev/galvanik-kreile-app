# F0 W2C–W4 Independent Review Packet

## 1. Zweck, Status und harte Grenze

Dieses Dokument ist das README und der ausführbare Review-Vertrag für eine
organisatorisch unabhängige, **read-only** Abnahme des F0-Kandidaten. Es ist
weder ein F0-Abschlussbericht noch das nachgelagerte Claude-Baupaket.

| Feld | Wert |
|---|---|
| Status des Review-Pakets | `OPEN` |
| Erwartetes maximal wahrheitsgemäßes Urteil im aktuellen Zustand | `FAIL_INTERNAL` |
| Kandidatenbasis | `c294c0564dc8a5e137eaa00de1276677cb1a1c53` |
| W4-Kandidaten-HEAD | `6f802eea10d5abed776dfbf206da5601e5ecce71` |
| Kandidatendifferenz | 60 Commits; 304 Pfade; 88 Added; 216 Modified; 0 Deleted |
| Kanonischer Name-Status-SHA-256 | `d4738ce4e46688dd646504df7bcd40011c530a8086589f79ec39f80c35e505c5` |
| F0-PASS-Claim | verboten |
| Mergeempfehlung | verboten |
| `ZIP_READINESS=GREEN` | verboten |

`F0_CONTRACT_V1` §10 bindet die Reihenfolge: Erst wird F0 gegen den dann
aktuellen Stand unabhängig read-only geprüft. Nur nach unabhängig bestätigtem
F0-GREEN darf der Nutzer separat und wörtlich `Claude-ZIP erstellen`
autorisieren. Dieses Paket ist ausdrücklich **nicht** dieses ZIP und darf es
nicht erzeugen.

Die aktuelle Obergrenze `FAIL_INTERNAL` folgt bereits aus fünf ungeklärten
W4-Vertragsanteilen sowie drei Kandidatenpfaden außerhalb der Missions-Allowlist.
Fehlende CI-, Build-, Draft-PR-, Preview- und organisatorische Review-Nachweise
dürfen ebenfalls nicht aus Subwave-Namen, alten Läufen oder Dateiexistenz
abgeleitet werden.

## 2. Kanonische Paketwahrheit

Die maschinenlesbare Wahrheit liegt in
`docs/evidence/f0/F0_W2C_W4_INDEPENDENT_REVIEW_MANIFEST.json`. Sie enthält:

- das vollständige, geordnete 304-Zeilen-Name-Status-Inventar;
- den Kanon `STATUS<TAB>PATH`, UTF-8, LF nach jeder Zeile einschließlich der
  letzten Zeile, erzeugt mit `--no-renames`;
- 22 SHA-256-gepinnte Quellen einschließlich AGENTS, Mission, fünf
  Projektwahrheiten, F0-Vertrag/Precheck, W2C/W3/W4-Evidenz, W4-Kandidatenvertrag,
  Workflow, Checker und drei neuen Migrationen;
- jeden Missionskriteriums-Identifier genau einmal und in Missionsreihenfolge;
- alle offenen Grenzen, P1–P12-Zustände und Delivery-Gates.

Der Paketchecker hat keine externen Abhängigkeiten und keinen Netzwerkpfad:

```text
node scripts/quality/check-f0-independent-review-package.mjs --selftest
node scripts/quality/check-f0-independent-review-package.mjs --check
```

`--check` ist erst auf dem sauberen Paketcommit gültig. Es fordert genau einen
Commit mit erstem und einzigem Parent
`6f802eea10d5abed776dfbf206da5601e5ecce71`, genau drei hinzugefügte
Paketpfade und keine weitere Arbeitsbaumänderung. Vor dem Commit prüft der
Autor ausschließlich:

```text
node scripts/quality/check-f0-independent-review-package.mjs --check-working-tree
```

Die strukturellen `PASS`-Zeilen des Checkers sind nur Paket-, Quellen- und
Inventarprüfungen. Sie sind niemals ein F0-PASS.

### 2.1 Sichtbare Scope-Abweichungen

Das exakte Kandidateninventar enthält keine Löschung und keinen Pfad, der auf
Secretmaterial, `node_modules`, ein fremdes Repository oder einen absoluten
Pfad trifft. Drei geänderte Pfade liegen dennoch außerhalb der wörtlichen
`allowed_paths` der Mission:

1. `scripts/fetch_and_classify_orders.ts`
2. `scripts/test_order_source.ts`
3. `vitest.config.ts`

Der Checker verlangt exakt diese Offenlegung. Sie bleibt ein interner
Review-Gegenstand und darf nicht stillschweigend als erlaubt umgedeutet werden.

## 3. Bekannte, nicht bewiesene Vertragsanteile

Die folgenden Kriterien bleiben unabhängig von den Bezeichnungen W4-01,
W4-02 oder W4-03 `NOT_PROVEN`:

| Kriterium | Nicht bewiesen | Erforderliche unabhängige Prüfung |
|---|---|---|
| `W4-02` | Extraktion und Konfidenz als nachvollziehbare Metadaten | Existenz, Originalerhalt, Provenienz und negative Fälle Ende-zu-Ende belegen |
| `W4-03` | wirklich polymorpher Evidence-Link | Mehr als den stationsspezifischen Order-/Item-Graphen nachweisen |
| `W4-04` | Legacy-Evidence-Read-Adapter | Lesende Kompatibilität ohne Legacy-/Objektmutation belegen |
| `W4-08` | globale Exklusivität versionierter `v_*` Cross-Modul-Read-Ports | alle Cross-Modul-Leser inventarisieren, nicht nur den belegten Kern |
| `W4-09` | vollständige Negativmatrix zu den offenen Anteilen | private Evidence, Legacy-Adapter, Append-only, Korrelation, Idempotenz und alle Ports abdecken |

`W4-10` ist nur für den realen, lokal belegten
Galvanik-Handoff-Kernweg als `PASS_LOCAL` vorgemerkt. Das beweist weder die
offenen W4-Anteile noch Production-RLS oder den vollständigen F0-Vertrag.

## 4. Kriterienmatrix für die unabhängige Abnahme

Jeder Status ist ein Kandidatenstatus, kein übernommenes Reviewerurteil.
Der Reviewer muss zu jeder Zeile einen eigenen Befund abgeben.

| ID | Kandidatenstatus | Gepinnte Primärevidenz | Explizite Revieweraufgabe |
|---|---|---|---|
| T0-01 | `PASS_STATIC` | `F0_PRECHECK.md` | Genau eine aktuelle T0-Wahrheit mit Ankern, Risiken, Gates und Schluss prüfen. |
| T0-02 | `PASS_STATIC` | `F0_PRECHECK.md` | Tenant-, Ledger-, RLS/Default-ACL-, Evidence-, Event- und aktive Pfadrisiken neu bewerten. |
| T0-03 | `PASS_STATIC` | `F0_PRECHECK.md` | Null-Side-Effect-Denials für alle benannten externen Grenzen verifizieren. |
| T0-04 | `PASS_STATIC` | `F0_PRECHECK.md` | Lokale W2C–W4-Belege strikt von F0-/Remote-/Legacy-Gates trennen. |
| W2C-01 | `PASS_LOCAL` | `W2C_REENABLEMENT_MATRIX.md` | Browser-Upload/Public-URL-Denials positiv und negativ reproduzieren. |
| W2C-02 | `PASS_LOCAL` | `W2C_REENABLEMENT_MATRIX.md` | ID-only-Operationen ohne Serverautorisierung side-effect-frei ablehnen. |
| W2C-03 | `PASS_LOCAL` | `W2C_REENABLEMENT_MATRIX.md` | Keinen zweiten aktiven Stationswriter außerhalb des Commands zulassen. |
| W2C-04 | `PASS_LOCAL` | `W2C_EDGE_LIVE_RECONCILIATION.md` | Unsichere Extraction-/Provider-Pfade ohne Provideraufruf ablehnen. |
| W2C-05 | `PASS_LOCAL` | `W2C_REENABLEMENT_MATRIX.md` | Today/Cron ohne kanonische Quelle als unverfügbar statt synthetisch prüfen. |
| W2C-06 | `PASS_LOCAL` | `W2C_REENABLEMENT_MATRIX.md` | Nichtatomare, nicht wiederholbare Side-Effects fail-closed halten. |
| W2C-07 | `PASS_LOCAL` | `W2C_REENABLEMENT_MATRIX.md` | Für jeden Denial null Write, Upload, Event und externen Effekt belegen. |
| W2C-08 | `PASS_LOCAL` | `W2C_REENABLEMENT_MATRIX.md` | Vollständige current-head Negativmatrix aller geschlossenen aktiven Pfade ausführen. |
| W2C-09 | `PASS_LOCAL` | `W2C_REENABLEMENT_MATRIX.md` | Einzelregistrierung und sämtliche Service-Worker-Cache-/Netzdenials prüfen. |
| W3-01 | `PASS_LOCAL` | `W3_ORDER_STATION_TRANSITION_EVIDENCE.md` | Am exakten 11er-Cutoff genau einen Server-Command nachweisen. |
| W3-02 | `PASS_LOCAL` | `W3_ORDER_STATION_TRANSITION_EVIDENCE.md` | Actor/Tenant ausschließlich aus Serversession ableiten. |
| W3-03 | `PASS_LOCAL` | `W3_ORDER_STATION_TRANSITION_EVIDENCE.md` | Capability-Denial vor jeder Mutation reproduzieren. |
| W3-04 | `PASS_LOCAL` | `W3_ORDER_STATION_TRANSITION_EVIDENCE.md` | Ownership-Denial ohne Side-Effect reproduzieren. |
| W3-05 | `PASS_LOCAL` | `W3_ORDER_STATION_TRANSITION_EVIDENCE.md` | Versionskonflikt und explizites Konfliktergebnis prüfen. |
| W3-06 | `PASS_LOCAL` | `W3_ORDER_STATION_TRANSITION_EVIDENCE.md` | Diskriminierte Result-Union ausüben und typseitig prüfen. |
| W3-07 | `PASS_LOCAL` | `W3_ORDER_STATION_TRANSITION_EVIDENCE.md` | Server-only Provider und secretfreien Clientpayload belegen. |
| W3-08 | `PASS_LOCAL` | `W3_ORDER_STATION_TRANSITION_EVIDENCE.md` | Tenant/Capability/Ownership/Version negativ und side-effect-frei prüfen. |
| W4-01 | `PASS_LOCAL` | `W4_ORDER_STATION_ATTACHMENT_EVIDENCE.md` | Stabile private Identität plus Pfad/MIME/Größe/Hash/Provenienz reproduzieren. |
| W4-02 | `NOT_PROVEN` | Mission | Extraktion/Konfidenz samt Originalerhalt und Negativfällen belegen oder nicht bestanden melden. |
| W4-03 | `NOT_PROVEN` | Mission | Wirklich polymorphen Evidence-Link belegen oder nicht bestanden melden. |
| W4-04 | `NOT_PROVEN` | Mission | Legacy-Evidence-Read-Adapter ohne Mutation belegen oder nicht bestanden melden. |
| W4-05 | `PASS_LOCAL` | `W4_ORDER_STATION_EVENT_READMODEL_EVIDENCE.md` | Append-only UPDATE/DELETE/TRUNCATE-Denials mit Snapshots reproduzieren. |
| W4-06 | `PASS_LOCAL` | `W4_ORDER_STATION_ATTACHMENT_EVIDENCE.md` | Korrelation und idempotenten Replay für den belegten Kern reproduzieren. |
| W4-07 | `PASS_LOCAL` | `W4_ORDER_STATION_ATTACHMENT_EVIDENCE.md` | Server-Tenant über Evidence/Fakten/Ereignisse konsistent prüfen. |
| W4-08 | `NOT_PROVEN` | `W4_OPERATIONAL_ORDER_READ_EVIDENCE.md` | Globales Cross-Modul-Read-Inventar und exklusive versionierte Views beweisen. |
| W4-09 | `NOT_PROVEN` | Mission | Vollständige Negativmatrix einschließlich aller offenen W4-Anteile ausführen. |
| W4-10 | `PASS_LOCAL` | `W4_ORDER_STATION_ATTACHMENT_EVIDENCE.md` | Kernweg mit Reload-Readback ohne Entwicklerzustand reproduzieren und danach stoppen. |
| G-01 | `NOT_PROVEN` | `quality.yml` | P1–P12 je mit exaktem Befehl, Exitcode, Umgebung und Paketcommit ausführen. |
| G-02 | `PASS_STATIC` | Mission | Nur lokale DB-Arbeit und null Remote/RLS/ACL-Mutation bestätigen. |
| G-03 | `NOT_RUN` | Mission | Bestehenden Draft-PR des Paketcommits prüfen; während des Reviews keinen erstellen oder mergen. |
| G-04 | `NOT_RUN` | Mission | Bestehende Vercel Preview des exakten PR-Heads prüfen; Production nicht promoten. |
| G-05 | `NOT_RUN` | Mission | Eigenes organisatorisch unabhängiges Urteil vor jeder Mergeempfehlung liefern. |

Die vollständigen Evidence-Pfade und ungekürzten Revieweraufgaben stehen im
Manifest. Kein `PASS_LOCAL` darf ohne frischen Lauf auf dem Paketcommit zum
Abschluss-PASS werden.

## 5. Review-Preconditions

Vor P1 ist fail-closed zu prüfen:

1. Repository und Produkt sind Galvanik-Kreile WerkstattCockpit; keine fremden
   Mandanten oder Worktrees werden einbezogen.
2. Arbeitsbaum ist sauber und `HEAD` ist genau der noch zu benennende
   Paketcommit.
3. `HEAD` hat genau einen Parent, den W4-Kandidaten
   `6f802eea10d5abed776dfbf206da5601e5ecce71`.
4. Der Paketcommit fügt genau die drei Manifestpfade hinzu.
5. Paketchecker `--selftest` und `--check` enden mit Exitcode 0.
6. Ein bereits installiertes Supabase-CLI-Binary meldet exakt `2.111.0`.
   Während der Abnahme wird kein CLI-Paket nachgeladen.
7. Docker/Linux-Engine und genau ein lokaler Supabase-Stack sind verfügbar.
8. Jede DB-Verbindung ist exakt
   `postgresql://postgres:postgres@127.0.0.1:54322/postgres`; der Checker
   verweigert Remotehost, URI-Override, andere Credentials, Port oder DB.
9. PostgreSQL meldet Major 17. Die lokale `postgres`-Rolle hat
   `rolbypassrls`; lokale Katalog-/Prädikatbelege sind keine Production-RLS-
   oder Least-Privilege-Beweise.
10. Captures liegen in einem neu erstellten Tempordner außerhalb des Repos.
    Ihr Inhalt, Runtime-Keys und Tokens erscheinen nicht im Bericht.
11. Es gibt keine Freigabe für Remote-/Production-Abfragen oder -Mutationen,
    Migrationen, RLS/Policy/Grant/Default-ACL-/Bucket-Änderungen, Merge,
    Deployment oder Promotion.

Scheitert eine Precondition, lautet das Urteil entsprechend
`FAIL_INTERNAL`, `BLOCKED_EXTERNAL_PERMISSION` oder
`BLOCKED_PRODUCT_DECISION`. Es werden keine Reparaturen vorgenommen.

## 6. P1–P12: kanonischer Prüfablauf

Für jedes P-Gate muss der Reviewer exakt festhalten:

```text
P<n>_STATUS=PASS|FAIL|NOT_RUN|BLOCKED
P<n>_COMMAND=<literal ausgeführter Befehl oder NOT_RUN>
P<n>_EXIT_CODE=<integer oder NOT_RUN>
P<n>_ENVIRONMENT=<OS; Node; lokale Dienste; redigierte Variablennamen, keine Werte>
P<n>_COMMIT=<40-char Paketcommit>
P<n>_RECEIPT=<kurzer echter Output oder Artefakt-SHA; keine Behauptung>
```

### P1 – Abhängigkeiten

```text
npm ci
```

### P2 – TypeScript

```text
npx tsc --noEmit --incremental false
```

### P3 – vollständiges ESLint

```text
npm run lint:full
```

### P4 – kanonische Units

```text
npm run test:unit
```

### P5 – relevante echte Integrationen

P5 ist erst PASS, wenn der unter §7 beschriebene lokale Ablauf am exakten
11er-W3- und 12er-W4-Cutoff erfolgreich ist. Erwartete frühere Receipts sind
W3 `19/19` und W4-03 `12/12`; der Reviewer muss sie frisch reproduzieren.

### P6 – Build

```text
npm run build
```

Der Build läuft mit der lokalen, redigierten Supabase-/DB-Umgebung wie im
`fresh-supabase-replay`-Job von `.github/workflows/quality.yml`. Ein alter
Build oder ein Build auf einem anderen Commit ist `NOT_RUN`.

### P7 – frischer Replay

P7 führt die frischen lokalen Reset-/Capture-Sequenzen aus §7 seriell aus:
9er-Production-Cutoff, 12er-Kandidat, 11er-W3-Cutoff, 12er-W4 und zweiter
frischer 12er-Kandidat. Seed wird nie verwendet.

### P8 – Ledger, Schema, Grants, RLS und Storage

P8 übernimmt unverändert die Gates des Workflows:

```text
node scripts/check-migration-ledger.mjs --base <review-diff-base>
node scripts/quality/check-w4-candidate-schema.mjs --selftest
node scripts/quality/fingerprint-compare.mjs <baseline-fingerprint-pipe> docs/evidence/f0/PROD_FINGERPRINT_REFERENCE.txt
node scripts/quality/check-w4-candidate-schema.mjs --check <capture-arguments>
psql <loopback-only-options> -v ON_ERROR_STOP=1 -f scripts/quality/f0_negative_tests.sql
node scripts/quality/check-tenant-coverage.mjs
node scripts/quality/f0-storage-http-tests.mjs
```

`<baseline-fingerprint-pipe>` und `<capture-arguments>` werden ausschließlich
aus den lokalen Temp-Captures gebildet. Es erfolgt **kein**
`--materialize-contract`, kein `--contract`-Override und keine Änderung des
committeten W4-Vertrags.

### P9 – positive und negative Evidenz

P9 verlangt positive und negative Fälle zu Auth, Rolle, Capability, Tenant,
Ownership, Version, Storage, append-only, Korrelation, Idempotenz und
Read-Ports. Dazu gehören die unveränderten W3-/W4-Integrationen,
`f0_negative_tests.sql`, Tenant-Coverage, echte lokale Storage-HTTP-Matrix,
`src/test/scan_order.integration.test.ts` sowie die Kriterien-spezifischen
Negativfälle. Die offenen `W4-02/03/04/08/09` dürfen nicht durch bestehende
Kernwegtests ersetzt werden.

### P10 – Preview und Browser-Smokes

P10 prüft read-only einen **bereits vorhandenen** Draft-PR und eine bereits
vorhandene Vercel Preview:

1. PR-Head ist bytegenau der Paketcommit.
2. Preview-Deployment ist bytegenau diesem PR-Head zugeordnet.
3. Production wurde nicht deployt oder promotet.
4. Relevante Browser-Smokes laufen gegen die Preview; der lokale
   Workflow-Basissmoke `npm run test:e2e` wird separat protokolliert.

Fehlen PR oder Preview, bleibt P10 `NOT_RUN`. Der unabhängige Reviewer erstellt
oder mutiert sie nicht.

### P11 – Whitespace/Merge-Marker

```text
git diff --check c294c0564dc8a5e137eaa00de1276677cb1a1c53..<package-commit>
```

### P12 – Diff und sauberer Status

```text
git diff --stat c294c0564dc8a5e137eaa00de1276677cb1a1c53..<package-commit>
git status --short
```

## 7. Serielle lokale Supabase-Abnahme

Alle Schritte laufen gegen genau einen lokalen Stack und einen DB-Worker.
Supabase CLI muss als bereits installiertes Binary exakt `2.111.0` melden.
Runtime-Credentials werden lokal mit `supabase status -o env` in eine
temporäre Datei außerhalb des Repos geschrieben, ohne Ausgabe der Werte, und
nur für echte lokale Storage/API-Aufrufe in den Prozess geladen.

### 7.1 Production-Cutoff 9

1. `db reset --local --no-seed --version 20260810100000`.
2. Checker `--capture` für Baseline-Katalog, Baseline-Fingerprint und
   Baseline-Ledger in den Tempordner.
3. PostgreSQL-17-Guard, exakt neun geordnete Migrationen und
   unveränderter harter Production-Fingerprint-Comparator.

Erwartete Receipts:

| Receipt | Erwartet |
|---|---|
| Baseline-Katalog SHA-256 | `a928c98f1e4470f734ae1e9686c6c98bcf03fc5876ba44e038a20ab14095f84b` |
| Hard-Fingerprint | `FINGERPRINT_HARD_FAILS=0`; 7 exakte harte Komponenten |

Die historische 3.839-Objekt-Inventur ist nur hashgepinnte Evidenz vom
2026-08-06. Sie ist kein aktuelles Replay- oder Production-Paritätsgate.
Current Full Catalog bleibt
`BLOCKED_EXTERNAL_PERMISSION/BOOTSTRAP_DECISION`.

### 7.2 Erster vollständiger Kandidat 12

1. `db reset --local --no-seed`.
2. Checker `--capture` für Kandidatkatalog, Fingerprint und Ledger.
3. Striktes `--check` gegen Baseline und den unveränderten committeten Vertrag.
4. Checker-`--selftest`.

Erwartete Receipts:

| Receipt | Erwartet |
|---|---|
| Kandidatkatalog | SHA-256 `cd1c432c9d56874e60298cfcbf87deba3829e15ac8f8885d77a85426bd6cb7fa`; 1.044.578 Bytes |
| Kandidat-Fingerprint-Datei | SHA-256 `b000f8fcbe7d584a616eb6f4c90370a8024c8b11828aa1e48815804d1f20d392`; 479 Bytes |
| Kandidat-Ledger-Datei | SHA-256 `f2db2df9f3cd2882e611c505f5ada4af88a3d608c61a864f9589320b54dc93f0`; 1.733 Bytes |
| W4-Vertrag | SHA-256 `5d0643ce0b7e77efa733302f22f69fcfd59f10cf368e2bba4f5cdcd14433dbee`, vor und nach Review identisch |
| Strikter Delta-Check | exakt 182 ADD; 0 CHANGE; 0 REMOVE |

Die 182 ADD sind exakt 5 Relationen, 87 Spalten, 29 Constraints, 9 Indizes,
3 Views, 9 Trigger und 40 effektive PostgreSQL-17-Owner-Grants. Jede
Abweichung ist FAIL; die Captures dürfen den Vertrag nicht neu materialisieren.

### 7.3 W3-Cutoff 11

1. `db reset --local --no-seed --version 20260811154732`.
2. Mit ausschließlich der Loopback-DB-URL und leerem
   `SUPABASE_SERVICE_ROLE_KEY`:

```text
npx vitest run src/test/w3_order_station.integration.test.ts
```

Erwartet: `19/19`.

### 7.4 W4-Cutoff 12 mit echter lokaler Storage/API

1. `db reset --local --no-seed`.
2. Lokal geladene, nicht ausgegebene Runtime-Credentials verwenden.
3. Mit der exakten Loopback-DB-URL:

```text
npx vitest run src/test/w4_order_station_attachment.integration.test.ts
```

Erwartet: `12/12`. Der Lauf muss echte lokale DB, View, Actions, Panel und
Storage HTTP benutzen; nur `readAppSession` ist gemäß gepinnter Evidence
gemockt.

### 7.5 Zweiter frischer Kandidat 12

1. Nochmals `db reset --local --no-seed`.
2. Zweite Kandidat-Captures in neue Tempdateien.
3. Für Katalog, Fingerprint und Ledger jeweils SHA-256 **und** echte
   Bytegleichheit zum ersten Lauf prüfen.
4. Striktes `--check` gegen Baseline, Capture 2 und den unveränderten
   committeten Vertrag.

Erwartet: dieselben drei Hashes und Größen wie §7.2, byteidentisch, erneut
182 ADD. Jede Nichtdeterministik ist FAIL und darf nicht repariert werden.

## 8. Positive/negative Evidenz und externe Grenzen

Der Reviewer protokolliert für jeden Test:

- exakten Befehl, Start/Ende, Exitcode, Paketcommit und relevante Versionen;
- positive Erfolgsevidenz und getrennte negative Null-Side-Effect-Evidenz;
- vor/nach-Snapshots oder Zählwerte, wo Mutation ausgeschlossen werden muss;
- Artefakt-SHA statt Capture-Inhalt;
- redigierte Namen vorhandener Umgebungsvariablen, niemals Werte.

Verboten sind:

- Remote-/Production-Supabase-Aufrufe oder -Abfragen;
- Remote-Migration, RLS-, Policy-, Grant-, Default-ACL- oder Bucketmutation;
- Legacy-Daten-/Objektmutation;
- Contract-Materialisierung, Referenzumschreibung oder Bootstrap;
- Datei-/Datenlöschung außerhalb der ausdrücklich disponiblen lokalen
  Reset-Datenbank;
- Commit, Push, PR-Mutation, Merge, Deployment oder Promotion;
- Fixes nach einem Fehler.

Der Review endet unmittelbar nach dem Urteil. Ein Fehler wird mit Ursache und
Beleg gemeldet, nicht behoben.

## 9. Exakter Claude-Prompt

Der folgende Prompt wird unverändert zusammen mit dem sauberen Paketcommit
übergeben:

```text
Du bist die organisatorisch unabhängige read-only F0-Endprüferin für das
Galvanik-Kreile WerkstattCockpit. Prüfe ausschließlich den sauberen
Paketcommit, dessen einziger Parent
6f802eea10d5abed776dfbf206da5601e5ecce71 ist.

1. Lies AGENTS.md, die Mission F0_FOUNDATION_CONVERGENCE_W2C_W4_001.yml,
   F0_CONTRACT_V1.md vollständig und danach dieses Review-Paket samt JSON.
2. Führe zuerst
   node scripts/quality/check-f0-independent-review-package.mjs --selftest
   und
   node scripts/quality/check-f0-independent-review-package.mjs --check
   aus. Stoppe bei Nonzero ohne Fix.
3. Verifiziere jeden gepinnten Quellhash, Basis/Ancestry, 60 Commits,
   304=88A/216M/0D, den SHA d4738ce4e46688dd646504df7bcd40011c530a8086589f79ec39f80c35e505c5
   und die drei offengelegten Pfade außerhalb der Missions-Allowlist.
4. Prüfe jeden Missionskriteriums-Identifier genau einmal. Übernimm keinen
   PASS aus den Namen W4-01/W4-02/W4-03 oder aus alten Berichten.
5. Behandle W4-02, W4-03, W4-04, W4-08 und W4-09 als NOT_PROVEN, solange du
   die im Paket genannten vollständigen Beweise nicht frisch reproduziert
   hast. Keine Reparaturen und keine Produktänderungen.
6. Führe P1-P12 in der festgelegten Reihenfolge aus und protokolliere je Gate
   exakten Befehl, Exitcode, Umgebung und Paketcommit. Nutze genau einen
   lokalen Supabase-Stack, CLI 2.111.0, Loopback-DB und PostgreSQL 17.
7. Führe die 9/12/11/12/12-Resetfolge, W3 19/19, W4 12/12, beide
   Kandidatencaptures und den strikten Check aus. Materialisiere oder ändere
   den committeten Contract niemals. Gib keine Runtime-Secrets oder
   Capture-Inhalte aus.
8. Führe keinerlei Remote-/Production-Aktion, RLS/ACL-Mutation, Legacy-
   Mutation, Commit, Push, PR-Mutation, Merge, Deployment oder Promotion aus.
9. Prüfe bestehende PR-/Preview-/CI-Belege nur read-only. Fehlen sie, bleiben
   G-03, G-04 beziehungsweise das betreffende Gate NOT_RUN.
10. Liefere das Rückgabeformat aus F0_CONTRACT_V1 §9, danach die vollständige
    Kriterienmatrix, P1-P12-Receipts und REVIEW_HANDOFF aus diesem Paket.
    ZIP_READINESS bleibt RED, solange nicht jede Vertragsbedingung erfüllt
    ist. Behaupte kein F0-PASS und keine Mergeempfehlung bei irgendeinem
    offenen, fehlgeschlagenen, blockierten oder nicht ausgeführten Gate.
11. Stoppe nach dem Urteil. Keine Fixes. Dies ist nicht das Claude-ZIP.
    Ein solches ZIP darf erst nach unabhängig bestätigtem F0-GREEN und einer
    separaten wörtlichen Nutzerfreigabe "Claude-ZIP erstellen" entstehen.
```

## 10. Verbindlicher Reviewer-Output

Zuerst ist der Block aus `F0_CONTRACT_V1` §9 vollständig auszugeben:

```text
MISSION=KREILE_F0_FOUNDATION_TRUTH_AND_ZIP_READINESS
FINAL_STATUS=PASS|FAIL_INTERNAL|BLOCKED_EXTERNAL_PERMISSION|BLOCKED_PRODUCT_DECISION
START_MAIN_HEAD=<40-char-sha>
FINAL_MAIN_HEAD=<40-char-sha-or-NOT_MERGED>
CANDIDATE_HEAD=<40-char-package-commit>
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
ZIP_READINESS=RED
```

Danach folgen:

1. `CRITERION_MATRIX`: alle 36 IDs in Manifestreihenfolge mit
   `PASS|FAIL|NOT_PROVEN|NOT_RUN|BLOCKED`, kurzem Beleg und Reviewerbegründung.
2. `P1_P12_RECEIPTS`: alle zwölf Gates mit dem in §6 definierten
   Befehl-/Exit-/Umgebung-/Commit-/Receipt-Schema.
3. Liste jeder übersprungenen oder fehlgeschlagenen Prüfung.
4. Liste aller Remote-Mutationen ohne Secrets; im freigegebenen Ablauf
   zwingend `NONE`.
5. Bestehender Draft-PR-Link und exakter Preview-Link oder jeweils `NONE`.
6. Unabhängiges Urteil mit offenen internen und externen Blockern.
7. Abschließend exakt:

```text
REVIEW_HANDOFF
PACKAGE_COMMIT=<40-char-sha>
PACKAGE_CHECK=PASS|FAIL
CANDIDATE_NAME_STATUS_SHA256=d4738ce4e46688dd646504df7bcd40011c530a8086589f79ec39f80c35e505c5
CRITERIA_PASS=<comma-list-or-NONE>
CRITERIA_NONPASS=<comma-list-or-NONE>
P_GATES_PASS=<comma-list-or-NONE>
P_GATES_NONPASS=<comma-list-or-NONE>
SCOPE_EXCEPTIONS=scripts/fetch_and_classify_orders.ts,scripts/test_order_source.ts,vitest.config.ts
REMOTE_MUTATIONS=NONE
MERGE_RECOMMENDATION=NO
ZIP_READINESS=RED
STOP_NO_FIXES=YES
```

Im aktuellen Paketstand ist `FINAL_STATUS=PASS`,
`MERGE_RECOMMENDATION=YES` oder `ZIP_READINESS=GREEN` kein zulässiger
vorweggenommener Ausgang. Die unabhängige Prüfung meldet die echte
`FAIL_INTERNAL`-/Blocker-Wahrheit und stoppt.
