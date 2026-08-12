# F0 W2C–W4: unabhängiges Abnahmepaket

Stand: 2026-08-12
Paketart: organisatorisch unabhängige, read-only Abnahme
Kandidatenbasis: `c294c0564dc8a5e137eaa00de1276677cb1a1c53`
W4-Kandidaten-HEAD: `e3138f9286775bf6e79c0b5b1845ff72a0230b62`
Paketcommit: aktueller `HEAD`; muss genau einen Parent haben, den W4-Kandidaten
Lokaler W4-Status des Autors: `F0_W4_REVIEW_READY / PASS_LOCAL`
Gesamtstatus vor unabhängiger Abnahme: `OPEN`
Bestmögliches aktuelles Gesamturteil: `BLOCKED_EXTERNAL_PERMISSION`

## 1. Zweck und Stoppgrenze

Dieses Paket ist der vollständige Prüfauftrag für Claude. Es enthält die
Kandidatenanker, das komplette Diff-Inventar, Quellbelege, Kriterien,
Autoren-Receipts, offene externe Grenzen, den Prüfablauf P1–P12 und das
verbindliche Ausgabeformat.

Claude prüft unabhängig und read-only. Claude:

- ändert keine Datei und materialisiert keinen Vertrag;
- führt keine Remote- oder Production-Datenbankaktion aus;
- erstellt keinen PR, keine Preview und kein Deployment;
- merged nicht;
- repariert keinen Befund;
- stoppt unmittelbar nach dem Urteil.

Ein lokales `PASS_LOCAL` darf nicht als CI-, Preview-, Production- oder
Gesamt-F0-PASS umgedeutet werden. Ohne bereits vorhandenen Draft-PR und bereits
vorhandene Preview bleiben diese Gates `NOT_RUN`. Die aktuelle vollständige
Production-Katalogparität bleibt
`BLOCKED_EXTERNAL_PERMISSION/BOOTSTRAP_DECISION`.

## 2. Unveränderliche Kandidatenanker

| Anker | Erwartung |
|---|---|
| Basis | `c294c0564dc8a5e137eaa00de1276677cb1a1c53` |
| W4-Kandidat | `e3138f9286775bf6e79c0b5b1845ff72a0230b62` |
| Commits Basis→Kandidat | 64 |
| Pfade | 314 |
| Added / Modified / Deleted | 98 / 216 / 0 |
| Name-Status-SHA-256 | `075c21a5b733fb45843e814917b4f744b28849b5312e75d3fea8361e0b673a6f` |
| Paketpfade | exakt die drei in §2.1 |
| Paketcommit | genau ein Commit auf dem Kandidaten; genau drei Modified-Pfade |
| Geschützter Checkout | `feature/capture-auth-tenant@8cf9e6ce2f8640dadd1386d9a149137d783aa1a0`, tracked clean und unangetastet |

Das vollständige geordnete 314-Zeilen-Inventar steht in
`F0_W2C_W4_INDEPENDENT_REVIEW_MANIFEST.json`. Seine Kodierung ist UTF-8,
pro Zeile `STATUS<TAB>PATH<LF>`, einschließlich finalem LF, mit
`--no-renames`.

### 2.1 Exakte Paketpfade

1. `docs/evidence/f0/F0_W2C_W4_INDEPENDENT_REVIEW_PACKET.md`
2. `docs/evidence/f0/F0_W2C_W4_INDEPENDENT_REVIEW_MANIFEST.json`
3. `scripts/quality/check-f0-independent-review-package.mjs`

Alle drei sind im Paketcommit geändert. Keine vierte Datei darf Bestandteil
dieses Commits sein.

### 2.2 Missionsscope

Der Kandidat hat keine Löschung, keinen verbotenen Pfad und keine Ausnahme mehr
außerhalb der Missions-Allowlist. Die zuvor strittigen Pfade sind jetzt eng und
wörtlich allowlisted:

- `scripts/fetch_and_classify_orders.ts`
- `scripts/test_order_source.ts`
- `vitest.config.ts`

Die Mission erlaubt weiterhin keine Production-, Remote-DB-, RLS-, Policy-,
Grant-, Default-ACL-, Merge-, Deploy- oder Löschaktion.

## 3. Ergebnis des Reparaturatoms

Die fünf durch die erste unabhängige Prüfung belegten W4-Vertragslücken sind
nicht durch Dokumentation überdeckt, sondern additiv im echten Pfad geschlossen.

### 3.1 W4-02 – Extraktion und Konfidenz

- Neue append-only Metadatenwahrheit
  `private.evidence_extraction_metadata`.
- Ehrlicher Zustand `NOT_REQUESTED` für neue Stationsoriginale.
- Normalisierte bestehende Legacy-Felder aus `public.scan_uploads`.
- Original-ID, Pfad, MIME, Größe und Hash bleiben unverändert.
- Ungültige Confidence-, Provider-, Hash-, MIME-, Größen- oder Linkdaten führen
  fail-closed zu keinem fachlichen Read-Erfolg.

### 3.2 W4-03 – polymorphe Evidence-Links

- Neue append-only Linkwahrheit `private.evidence_domain_links`.
- Zulässige Zieltypen: `ORDER`, `ORDER_ITEM`, `CUSTOMER`, `INVOICE`.
- Stationsfinalisierung erzeugt ORDER- und ORDER_ITEM-Links atomar.
- Der versionierte Server-Port
  `readEvidenceRecordsByTarget({targetType,targetId})` liest reine
  CUSTOMER- und reine INVOICE-Evidence ohne künstlichen Order-Link.
- Unbekannter Typ, ungültige ID, falscher Tenant oder struktureller Linkdrift
  werden vor einem Erfolg verworfen.
- Die echte Integration belegt CUSTOMER und INVOICE jeweils positiv sowie
  falschen Tenant und ungültigen Input negativ.

### 3.3 W4-04 – Legacy Evidence read-only

- `private.v_evidence_records_v1` projiziert verifizierte aktuelle Evidence
  und vorhandene `public.scan_uploads` in ein kanonisches DTO.
- Legacy-Pfad ist ausschließlich lesend.
- Kein Legacy-Status, kein Legacy-Objekt, kein Pfad und keine Metadatenzeile wird
  adoptiert, überschrieben oder gelöscht.
- Vor-/Nach-Snapshots bleiben identisch.

### 3.4 W4-08 – versionierte Read-Ports

- Maschinenlesbares Inventar:
  `docs/evidence/f0/W4_CROSS_MODULE_READ_PORT_INVENTORY.json`.
- Dependency-freier Checker:
  `scripts/quality/check-w4-cross-module-read-ports.mjs`.
- Drei deklarierte, versionierte W4-Read-Ports.
- 613 geprüfte Quelldateien.
- Adversariale Selbsttests blockieren unbekannte Leser, direkte
  Basistabellen-Bypässe, unversionierte Views, fehlende Konsumenten und
  Vertragsdrift.

### 3.5 W4-09 – Positiv-/Negativmatrix

Die bestehende reale W4-Integration wurde erweitert; es gibt kein paralleles
Mock-Erfolgssystem. Belegt sind insbesondere:

- Tenant, Rolle, Capability und Actor;
- private ACL und null anonyme Schreib-/Listrechte;
- MIME, Magic Bytes, Größe, SHA-256 und Object-Zeitfenster;
- append-only Update/Delete/Truncate-Denials;
- Korrelation, Idempotenz, Lost Response und paralleles Finalize;
- Grant-Ablauf, Outside-Window, Mismatch und Providerfehler;
- polymorphe Ziele einschließlich reiner Customer-/Invoice-Reads;
- Legacy-Read-only und unveränderte Snapshots;
- Scope-Wechsel, Unmount, Single-Flight und Capability-Entzug;
- signierte Original-URL, TTL, Pfad, Query, Filename und Linkablauf;
- Read-Port-Exklusivität und negative Checkerfälle.

### 3.6 Zuordnung der neun Claude-Befunde

Die vollständige Ursache-/Datei-/Nachweismatrix steht gepinnt in
`docs/evidence/f0/F0_CLAUDE_REPAIR_LEDGER.md`. Für die Abnahme gilt:

| Claude-ID | Reparatur bzw. Grenze | Primärnachweis | Autorenstatus |
|---|---|---|---|
| `CLAUDE-F0-001` | keine lokale Ersatzhandlung; PR/CI/Preview bleiben genehmigungspflichtig | §8 und Delivery-Gates im Manifest | `BLOCKED_EXTERNAL_PERMISSION` |
| `CLAUDE-F0-002` | Extraktions-/Confidence-Vertrag im kanonischen Evidence-Read | Migration, `evidenceRead.ts`, reale Integration | `CLOSED_PASS_LOCAL` |
| `CLAUDE-F0-003` | polymorphe Links und Target-Read für ORDER/ITEM/CUSTOMER/INVOICE | Migration, Target-Action, reale Integration | `CLOSED_PASS_LOCAL` |
| `CLAUDE-F0-004` | strikt lesender Legacy-Adapter mit unverändertem Vor-/Nach-Snapshot | versionierte View, Port, reale Integration | `CLOSED_PASS_LOCAL` |
| `CLAUDE-F0-005` | vollständiges Cross-Modul-Read-Port-Inventar | Inventar plus Checker und Selftests | `CLOSED_PASS_LOCAL` |
| `CLAUDE-F0-006` | positive und negative W4-Vertragsmatrix | fokussierte Tests und reale lokale Integration | `CLOSED_PASS_LOCAL` |
| `CLAUDE-F0-007` | kanonische lokale Node-/Docker-/CLI-/PG17-Umgebung belegt | P1–P9-Autorenreceipts | `PASS_LOCAL` |
| `CLAUDE-F0-008` | exakt drei notwendige Pfade wörtlich allowlisted | Mission und Paket-Scopechecker | `CLOSED_PASS_LOCAL` |
| `CLAUDE-F0-009` | nativer Paketchecker nach Commit ausgeführt | `--selftest` und committed `--check` | `CLOSED_PASS_LOCAL` |

Damit sind acht Befunde lokal geschlossen bzw. lokal belegt; der neunte ist
die bewusst nicht umgangene externe Liefergrenze. Claude muss alle neun neu
prüfen und darf den erwarteten externen Blocker nicht als internen PASS zählen.

## 4. Kriterienmatrix

Die Kandidatenstatus sind Autorenbelege, nicht Claudes Urteil. Claude verifiziert
sie am Paketcommit.

| Gruppe | IDs | Kandidatenstatus | Primärbeleg |
|---|---|---|---|
| T0 | T0-01…T0-04 | PASS_STATIC | Mission, F0 Contract, Precheck |
| W2C | W2C-01…W2C-09 | PASS_LOCAL | Reenablement Matrix, Edge Reconciliation |
| W3 | W3-01…W3-08 | PASS_LOCAL | W3 Transition Evidence |
| W4 Kern | W4-01, W4-05…W4-07, W4-10 | PASS_LOCAL | Event-/Attachment-Evidence |
| W4 repariert | W4-02, W4-03, W4-04, W4-08, W4-09 | PASS_LOCAL | Evidence-Read-Vertrag, Read-Port-Inventar |
| G-01 | unabhängige P1–P12-Receipts | NOT_PROVEN | wird erst durch Claude erzeugt |
| G-02 | lokale/Remote-Grenze | PASS_STATIC | Mission und lokale Receipts |
| G-03 | Draft-PR | NOT_RUN | keine Freigabe, kein PR |
| G-04 | Vercel Preview | NOT_RUN | keine Freigabe, keine Preview |
| G-05 | unabhängiges Urteil | NOT_RUN | Zweck dieses Pakets |

Es gibt im Manifest keine bekannte interne W4-Lücke mehr. Ein während der
Abnahme gefundener P0/P1 ergibt dennoch `FAIL_INTERNAL`; er darf nicht durch
den erwarteten Maximalstatus maskiert werden.

## 5. Gepinnte Quellen und maschinenlesbarer Vertrag

Das Manifest pinnt 32 Primärquellen jeweils mit Pfad, Bytezahl und SHA-256,
darunter:

- Mission und Projektwahrheiten;
- W2C-, W3- und W4-Evidenz;
- Reparaturledger;
- 13er Schema-Vertrag und Checker;
- W4 Read-Port-Inventar und Checker;
- vier W3/W4-Migrationen;
- Evidence-Read-Port, Attachment-Domain, Action, Panel und reale Integration.

Claude muss vor inhaltlichem Vertrauen jeden Source-Hash prüfen. Der
Paketchecker verwirft fehlende, zusätzliche, umsortierte oder driftende
Kriterien, Quellen, Diffzeilen, Scopepfade und Paketpfade.

## 6. Autoren-Receipts am finalen W4-Quellstand

| Gate | Ergebnis |
|---|---|
| Fokussierte Unit/Action/RTL | 4 Dateien, 103 Tests PASS |
| Reale lokale W4-Integration | 1 Datei, 14 Tests PASS, 25,82 s |
| Vollständige Units | 87 Dateien, 551 Tests PASS, 107,32 s |
| TypeScript | `tsc --noEmit --incremental false` PASS |
| Vollständiges ESLint | Exit 0; zwei dokumentierte vorbestehende Warnungen |
| Production Build | PASS; 58 Seiten; ausschließlich lokale redigierte Env |
| Read-Port-Checker | 613 Dateien, 3 Ports PASS |
| Read-Port-Selftest | 6 adversariale Fälle PASS |
| Schema-Checker-Selftest | PASS |
| Migration Ledger | 13 aktive Migrationen PASS |
| Baseline9→Candidate13 | exakt 312 ADD; 0 CHANGE; 0 REMOVE |
| W3 real | 19/19 PASS |
| W4 real | 14/14 PASS |
| zweiter Candidate13-Replay | Catalog/Fingerprint/Ledger byteidentisch |
| geschützter Checkout | unverändert und tracked clean |
| Remote/Production/Push/PR/Preview | nicht ausgeführt |

### 6.1 Reproduzierbare Datenbank-Receipts

| Artefakt | SHA-256 | Bytes |
|---|---:|---:|
| Baseline9-Katalog | `a928c98f1e4470f734ae1e9686c6c98bcf03fc5876ba44e038a20ab14095f84b` | laut Capture |
| Candidate13-Katalog | `25b91a7408d022ccbe92b7b26f9f50954dd56f5a935a08f1f9ca6eb6dd756908` | 1.093.433 |
| Candidate13-Fingerprint | `5795e078dae63b17ae616a01aaa4835aca3b3430a777fa9ad80c0131197d1eb1` | 479 |
| Candidate13-Ledger | `c3bbe08a8b6c631d26704b1f1a2ef347f2dbb9dc98f4fe0df69e71a4d0952c8f` | 1.873 |

Der zweite frische Candidate13-Lauf ist zu diesen drei Candidate-Artefakten
sowohl SHA-identisch als auch byteidentisch. Der committed Schema-Vertrag ist
`CAPTURED_LOCAL` und enthält 312/312 Payload-Hashes, beide Kataloghashes und
22 Komponentenhashes.

### 6.2 Ehrliche Fehlerhistorie

Folgende Stops wurden nicht als Produkt-PASS umgedeutet:

1. Docker-Linux-Pipe fehlte zunächst; nach lokalem Start erreichbar.
2. Ein psql-Argument-/Footer-Fehler verfälschte die PG17-Ausgabe; der Checker
   wurde eng korrigiert und danach neu selbstgetestet.
3. 3.812 versus historisch 3.839 zeigte eine unzulässige Epochenkopplung. Die
   3.839 bleiben nur historische Hash-Evidence; aktuelle Full-Catalog-Parität
   bleibt extern/Bootstrap-blockiert.
4. Ein PowerShell-Parserfehler verhinderte Step 5 vor jeder Mutation. Der
   vierteilige lokale Fortsetzungslauf bestand später vollständig.
5. Der erste Build-Aufruf ohne notwendige lokale Env stoppte korrekt. Der
   finale Build mit lokalen, nicht offengelegten Supabase-/DB-Werten bestand.
6. Der normale Hook des Implementierungscommits bestand TypeScript und
   Staged-Lint, traf jedoch bei 550/551 einen 5-s-Timeout in einem unveränderten
   Render-Test. Derselbe Test bestand unmittelbar danach isoliert 5/5; eine
   vollständige 551/551-Suite war am finalen Quellstand bereits frisch grün.
   Der Implementierungscommit wurde danach bewusst ohne erneute Hook-Doppelung
   erstellt. Claude muss P4 am Paketcommit unabhängig neu ausführen.
7. Der erste Paketcommit-Hook bestand ebenfalls TypeScript und Staged-Lint,
   traf bei 550/551 einen 5-s-Timeout in einem anderen unveränderten Render-Test.
   Auch diese Datei bestand unmittelbar danach isoliert 5/5. Das Paket wird
   deshalb ohne eine dritte vollständige Hook-Doppelung committed; P4 bleibt
   ausdrücklich Claudes unabhängiges Pflichtgate.

## 7. Verbindlicher unabhängiger Ablauf P1–P12

Für jedes Gate protokolliert Claude:

```text
P<n>_STATUS=PASS|FAIL|NOT_RUN|BLOCKED
P<n>_COMMAND=<wortwörtlicher Befehl>
P<n>_EXIT=<Exitcode oder NOT_RUN>
P<n>_ENV=<OS, Node, npm, Docker, Supabase CLI, PostgreSQL soweit relevant>
P<n>_COMMIT=<Paketcommit>
P<n>_RECEIPT=<knapper objektiver Beleg>
```

Ein fehlendes Werkzeug ist `NOT_RUN/BLOCKED`, niemals ein erfundener PASS.

### P1 – Umgebung und Abhängigkeiten

```powershell
git status --short
git rev-parse HEAD
git rev-list --parents -n 1 HEAD
node --version
npm --version
npm ci
```

Prüfe zuerst den Paketchecker:

```powershell
node scripts/quality/check-f0-independent-review-package.mjs --selftest
node scripts/quality/check-f0-independent-review-package.mjs --check
```

### P2 – TypeScript

```powershell
npx tsc --noEmit --incremental false
```

### P3 – vollständiges Lint

```powershell
npm run lint:full
```

Warnungen getrennt von Fehlern berichten; keine Warnung als Fehler erfinden.

### P4 – vollständige Unit-Suite

```powershell
npm run test:unit
```

Erwartung des Autorenlaufs: 87 Dateien, 551 Tests. Claude übernimmt diese Zahl
nicht, sondern protokolliert die eigene.

### P5 – fokussierter W4-Pfad und reale Integration

```powershell
npx vitest run src/lib/server/__tests__/orderStationAttachment.test.ts src/lib/server/__tests__/evidenceRead.test.ts src/app/warendurchlauf/__tests__/w4OrderStationAttachmentActions.test.ts src/app/warendurchlauf/galvanik/__tests__/w4OrderStationAttachmentPanel.test.tsx
```

Danach ausschließlich gegen den lokalen Loopback-Stack den Integrationstest
ausführen:

```powershell
npx vitest run src/test/w4_order_station_attachment.integration.test.ts
```

Die benötigten lokalen URL-/Key-/DB-Werte sind aus der gepinnten lokalen CLI zu
beziehen, nie aus Production und nie im Bericht offenzulegen.

### P6 – Production Build

```powershell
npm run build
```

Nur lokale, redigierte Env verwenden. Fehlende Env ergibt keinen Code-Fail,
sondern einen ehrlichen Umgebungsstop; ein PASS erfordert jedoch einen
erfolgreichen finalen Build.

### P7 – frische lokale Replay-Kette

Seriell und ohne Seed:

1. Reset bis `20260810100000`; Production-Hard-Fingerprint prüfen.
2. Voller Reset bis alle 13 Migrationen; Candidate-Capture.
3. Reset bis `20260811154732`; W3 19/19.
4. Voller 13er-Reset; W4 14/14.
5. Noch ein voller 13er-Reset; zweiter Capture.

Erlaubt ist ausschließlich
`postgresql://postgres:postgres@127.0.0.1:54322/postgres` unter PG17.
Jede andere Host-/Port-/DB-/Query-/Service-URL muss der Checker ablehnen.

### P8 – Ledger, Schema und Determinismus

```powershell
node scripts/check-migration-ledger.mjs --base e3138f9286775bf6e79c0b5b1845ff72a0230b62
node scripts/quality/check-w4-candidate-schema.mjs --selftest
node scripts/quality/check-w4-cross-module-read-ports.mjs --selftest
node scripts/quality/check-w4-cross-module-read-ports.mjs --check
```

Den strikten Schema-`--check` mit Baseline-Capture, zweitem Candidate-Capture
und dem committed Vertrag ausführen, ohne `--contract`-Override und ohne
Materialisierung. Erwartung: exakt 312 ADD und null CHANGE/REMOVE. Die beiden
Candidate-Capture-Sätze müssen zusätzlich für Catalog, Fingerprint und Ledger
SHA- und byteidentisch sein.

### P9 – Sicherheits- und Wahrheitsmatrix

Prüfe mindestens:

- Auth/Capability/Tenant/Actor;
- Owner- versus Team-Originalvertrag;
- private ACL, unsigned write/list deny;
- immutable Rows und unveränderte Snapshots;
- Extraction/Confidence-Grenzen;
- ORDER/ORDER_ITEM/CUSTOMER/INVOICE-Ziele;
- reine Customer-/Invoice-Legacy-Reads;
- Legacy null write/delete/adopt;
- Storage Token/Path/Overwrite/TTL;
- paralleles Finalize und Idempotenz;
- alle Read-Port-Selftests.

### P10 – PR, Preview und Browser

Nur einen bereits vorhandenen Draft-PR und eine bereits vorhandene Vercel
Preview des exakten Paketcommits lesen. Falls sie fehlen: `NOT_RUN`. Nichts
erstellen, pushen, deployen oder promoten.

### P11 – Whitespace und Merge-Marker

```powershell
git diff --check c294c0564dc8a5e137eaa00de1276677cb1a1c53..HEAD
git grep -n -E '^(<<<<<<<|=======|>>>>>>>)'
```

### P12 – Diff, Scope und sauberer Zustand

```powershell
git diff --stat c294c0564dc8a5e137eaa00de1276677cb1a1c53..HEAD
git diff --name-status --no-renames c294c0564dc8a5e137eaa00de1276677cb1a1c53..e3138f9286775bf6e79c0b5b1845ff72a0230b62
git status --short
```

Bestätige 64 Commits, 314 Pfade, 98 Added, 216 Modified, 0 Deleted und den
Name-Status-Hash aus §2. Bestätige außerdem, dass der Paketcommit genau die drei
Modified-Paketpfade enthält.

## 8. Externe Grenzen und Urteilskorridor

Selbst wenn P1–P12 lokal bestehen, bleibt das beste aktuelle Gesamturteil
`BLOCKED_EXTERNAL_PERMISSION`, weil folgende autorisierungspflichtige
Lieferbelege fehlen:

- GitHub CI am exakten Paketcommit;
- Draft-PR am exakten Paketcommit;
- Vercel Preview am exakten PR-Head;
- aktuelle Live-Production-Gegenprüfung;
- aktuelle vollständige Production-Katalogparität.

Der historische 3.839-Objekt-Katalog ist ausdrücklich keine aktuelle
Production-Parität. Es ist verboten, die fehlenden 27 Objekte zu erfinden oder
einen neuen Bootstrapvertrag abzuleiten.

Urteile:

- `FAIL_INTERNAL`: reproduzierbarer interner P0/P1, Scopebruch,
  Vertragsbruch, Quellhash-/Inventardrift oder lokales Pflichtgate fehlgeschlagen.
- `BLOCKED_EXTERNAL_PERMISSION`: intern unabhängig grün, aber PR/CI/Preview/
  Live-Production fehlen.
- `BLOCKED_PRODUCT_DECISION`: echte fachliche Entscheidung fehlt.
- `PASS`: im aktuellen Paket nicht erreichbar, solange externe Gates fehlen.

## 9. Exakter Claude-Auftrag

```text
Prüfe das Galvanik-Kreile-F0-W2C-W4-Paket strikt unabhängig und read-only.

1. Lies vollständig:
   - docs/evidence/f0/F0_W2C_W4_INDEPENDENT_REVIEW_PACKET.md
   - docs/evidence/f0/F0_W2C_W4_INDEPENDENT_REVIEW_MANIFEST.json
   - scripts/quality/check-f0-independent-review-package.mjs
2. Verifiziere zuerst, dass HEAD genau einen Parent hat:
   e3138f9286775bf6e79c0b5b1845ff72a0230b62.
3. Führe den Paketchecker --selftest und --check aus.
4. Verifiziere alle 32 Quellhashes und das vollständige Kandidateninventar:
   Basis c294c0564dc8a5e137eaa00de1276677cb1a1c53,
   Kandidat e3138f9286775bf6e79c0b5b1845ff72a0230b62,
   64 Commits, 314 Pfade, 98A/216M/0D,
   Name-Status-SHA-256
   075c21a5b733fb45843e814917b4f744b28849b5312e75d3fea8361e0b673a6f.
5. Behandle PASS_LOCAL nur als Autorenbehauptung. Prüfe insbesondere
   W4-02, W4-03, W4-04, W4-08 und W4-09 gegen Migration, Ports,
   Konsumenten, reale Integration und Negativmatrix.
6. Führe P1–P12 in der Reihenfolge des Pakets aus. Pro Gate protokolliere
   Status, wortwörtlichen Befehl, Exitcode, Umgebung, Paketcommit und Beleg.
7. Nutze für Datenbanktests ausschließlich den lokalen PG17-Loopback-Stack
   mit Supabase CLI 2.111.0. Keine Remote- oder Production-Aktion.
8. Erstelle keinen Fix, Commit, Push, PR, Preview oder Deploy.
9. Fehlende Tools oder externe Berechtigungen sind NOT_RUN/BLOCKED, nie PASS.
10. Gib exakt die in §10 geforderten fünf Abschnitte aus und stoppe danach.
```

## 10. Verbindliches Claude-Ausgabeformat

Claude liefert genau:

### 10.1 FINAL_STATUS

```text
FINAL_STATUS=FAIL_INTERNAL|BLOCKED_EXTERNAL_PERMISSION|BLOCKED_PRODUCT_DECISION|PASS
REVIEWED_PACKAGE_COMMIT=<sha>
REVIEWED_CANDIDATE=<sha>
```

### 10.2 CRITERIA_MATRIX

Alle 36 IDs, je eine Zeile:

```text
<ID>=PASS|FAIL|NOT_RUN|BLOCKED — <knapper Beleg>
```

### 10.3 P1_P12_RECEIPTS

Alle zwölf Gates im Schema aus §7. Kein Gate auslassen.

### 10.4 FINDINGS

Nur P0/P1, Planabweichungen und Akzeptanzblocker:

```text
<FINDING_ID> | P0/P1/ACCEPTANCE | betroffenes Kriterium | exakte Datei/Zeile |
Ursache | Auswirkung | kleinste in-scope Korrektur
```

Wenn keine vorliegen: `NO_OPEN_P0_P1_OR_ACCEPTANCE_FINDINGS`.

### 10.5 REVIEW_HANDOFF

```text
INTERNAL_W4_VERDICT=<PASS|FAIL>
EXTERNAL_GATES=<Liste>
REMOTE_OR_PRODUCTION_ACTIONS=NONE
RECOMMENDED_NEXT_STEP=<genau ein Schritt>
STOPPED_AFTER_VERDICT=YES
```

## 11. Abschlusswahrheit bei Paketerstellung

Der W4-Kernablauf ist lokal Ende-zu-Ende belegt:

```text
echte lokale DB
→ private versionierte Views
→ tenant-/capability-gebundene Server-Ports
→ Actions
→ Panel/UI-Zustände
→ private Storage-Originale und Legacy-Read-only
→ frischer Reload/Target-Read
→ positive und negative Belege
```

Das Paket behauptet kein Gesamt-F0-PASS. Es übergibt einen lokal
`F0_W4_REVIEW_READY`-Kandidaten an Claude und stoppt vor F1, Push, PR,
Preview, Deployment und Production.
