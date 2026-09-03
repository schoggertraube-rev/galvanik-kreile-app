# Dokumentenautorität

Stand: 2026-08-27

## Zweck

Diese Datei verhindert, dass veraltete Masterpläne, Übergaben, Agenturkonzepte oder lokale Artefakte die aktuelle Produkt- und Lieferwahrheit überschreiben.

## Autoritaetsbereiche

Es gibt keine einzige Totalrangfolge fuer Fakten, Scope und Produktprioritaet. Jede Quelle ist nur in ihrem Bereich autoritativ:

### Arbeits- und Sicherheitsgesetze

- Root-`AGENTS.md` bestimmt Sicherheitsgrenzen, Arbeitsmodell und unverhandelbare Architekturregeln.
- Eine Mission oder Roadmap darf diese Gesetze nicht still lockern.

### Reale Liefer- und Systemwahrheit

- GitHub `main` und der konkrete Commit sind die Code-Lieferwahrheit.
- Vercel Production-Deployment und dessen Git-Commit sind die laufende App-Wahrheit.
- Remote-Supabase-Production-Schema, Policies, Storage und Ledger sind die produktive Datenbankwahrheit.
- Integration, Preview und lokale Worktrees sind Test- oder Kandidatenstaende, niemals Production-Ersatz.
- Reproduzierbare Tests, Runtime-Logs und reale Browsernachweise belegen das Verhalten eines konkreten Stands.

Diese Ebenen koennen voneinander abweichen. Dann gewinnt nicht still eine andere Ebene; die Abweichung ist `DRIFT` und bleibt Blocker, bis sie vorwaertsgerichtet aufgeloest wurde. Dokumentation darf diesen Zustand beschreiben, aber nicht ersetzen.

### Aktuelle Mission

- Die ausdruecklich freigegebene Missionsdatei oder die aktuellen nummerierten Akzeptanzkriterien bestimmen Scope und Abnahme der Mission.
- Seit 2026-08-27 gibt es zwei vom Owner autorisierte Paket-Lanes:
  1. `missions/F1_ORDER_TO_CASH_PILOT_001.yml` steuert die Order-to-Cash-Lane (aktuell F1.4, danach
     F1.5 und F1.6) samt ihrer Allowlists, Migrationen und Evidence.
  2. `missions/FRONTEND_IMPLEMENTATION_001.yml` steuert die Frontend-Lane
     (`PARALLEL_PLANNING_ACTIVE` / `IMPLEMENTATION_NOT_STARTED`) mit eigener Phasen- und
     Gatestruktur.
- Zwei autorisierte Paket-Lanes sind keine zwei aktiven Implementierungen. Aktiv ist heute
  ausschliesslich Parallelplanung. Disjunktheit der Implementierung ist erforderlich, aber noch
  nicht belegt. Keine Lane darf Dateien der anderen anfassen, deren Allowlist erweitern oder deren
  Gates umdeuten. Ist die Trennung nicht beweisbar, wird sequenziell gearbeitet.
- Globale Ein-Writer-Regel des Autonomie-Mandats:
  `single_active_code_writer_across_frontend_and_f1 = true`. Es gibt insgesamt genau EINEN aktiven
  Code-Writer, nicht je Teilphase einen. Ein Frontend-Writer und ein F1-Writer laufen niemals
  parallel. Read-only Reviewer und Inventare duerfen parallel laufen; sie sind keine Writer.
- Ein Writer der Frontend-Lane darf erst starten, wenn ein von den Projektregeln erlaubter sauberer
  kurzer Paketbranch vom live aktuellen `main` besteht, kein F1-Writer oder F1-Gate laeuft und die
  exakte Produkt-Allowlist vorab berechnet ist und Schnittmenge 0 zur aktiven
  Order-to-Cash-Allowlist hat. Ist die Trennung nicht beweisbar, wird sequenziell gearbeitet: erst
  F1.4 korrigieren und mergen, danach der Frontend-Writer.
- Die F0-Mission und ihre Evidence sind eingefrorene Historie; R0-A ist nur ein Checkpoint, kein R0-PASS.
- Sie duerfen weder reale Systemfakten umdeuten noch Sicherheitsgesetze aushebeln.
- Verlangt die Mission eine neue Produktentscheidung ausserhalb ihres Scopes oder widerspricht sie einer geschuetzten Produktentscheidung, wird der Konflikt explizit eskaliert.

### Produktsteuerung und Erhalt

- `docs/project/MASTERPLAN.md` bestimmt Produktziel und aktive Reihenfolge.
- `docs/project/CURRENT_STATE.md` beschreibt den letzten verifizierten Stand und offene Blocker.
- `docs/project/NON_LOSS_REGISTER.md` schuetzt Ziele, verschobene Missionen und Salvage vor stillem Verlust.
- `docs/project/DOCUMENT_AUTHORITY.md` definiert diese Autoritaetsbereiche und Driftregeln.
- `docs/project/MODULARITY_STRATEGY.md` definiert Ist-/Zielstruktur und Modulregeln.

Keine dieser Dateien darf ausserhalb ihres Bereichs eine andere Quelle ueberschreiben. Ein Agent benennt Konflikte, verwendet den jeweils zustaendigen Vertrag und eskaliert echte Scope-/Produktentscheidungen statt still zu priorisieren.

### Owner-Uebergaben als Provenienz

Physische Owner-Dateien ausserhalb des Repositories sind ausschliesslich ueber SHA-256 und
Bytegroesse als Herkunft bindend. Nach der Kanonisierung in eine Missions- oder Steuerungsdatei ist
diese Repodatei autoritativ; die Owner-/Desktop-Quelle wird danach nicht Autoritaet, wird nicht
nachtraeglich veraendert und ersetzt keinen Gatebeweis.

| Owner-Quelle | SHA-256 | Bytes | Kanonisiert nach | Status |
|---|---|---|---|---|
| `KREILE_UEBERGABE_FRONTEND_UMSETZUNG_V1_2026-08-21.md` | `1CC0BDD969E1E5BB8F437542FCD8208FCDD2DF5B3B7FC8A0B18030AAC21B5C8C` | 4054 | `missions/FRONTEND_IMPLEMENTATION_001.yml` | Zielbild ratifiziert, Umsetzung nicht begonnen |
| `KREILE_F1_5_BAUVERTRAG_ZAHLUNGSEINGANG_WARENAUSGANG_V1_2026-08-21.md` | `5BCD70BFC2BD9D6A6DF06CF48D0D95C4A288DD5C6364BE2783954DDA1196BDE1` | 5592 | noch nicht kanonisiert | `PENDING_OWNER_RATIFICATION`; nicht ratifiziert, nicht baubar vor F1.4-Merge |
| `KREILE_AUTONOMIE_MANDAT_2026-08-27.md` | `C244EC1C5F1FF1493420F4DCC44FEFCD8F0E76CEAEFD16853BE2A4E4C539364A` | 4904 | `CURRENT_STATE.md`, `NON_LOSS_REGISTER.md`, `missions/FRONTEND_IMPLEMENTATION_001.yml` | Owner-Mandat und `PROVENANCE_OF_ACTIVE_OWNER_AUTHORITY`: F1.4-Vertragsinhalt vollstaendig ratifiziert, Frontend als Parallelpaket ratifiziert, getrennte Statusachsen, globale Ein-Writer-Regel, stehende Merge-Autoritaet `STANDING_GRANTED` (`valid_from` 2026-08-27, `valid_until` `NEXT_REAL_JOINT_OWNER_ORCHESTRATOR_DECISION`) |

Das Mandat ist weiterhin gueltig. Sein Teil 3 war der Abschluss derselben Uebergabe und ausdruecklich
keine Revokation. Die Merge-Autoritaet ist erteilt (`authority_status: STANDING_GRANTED`,
`additional_owner_merge_approval_required: false`); getrennt davon steht die Reife des konkreten
Pakets (`eligibility_status: NOT_MATURED`). Manuelle Production-Promotion und manueller Deploy
bleiben `FORBIDDEN`; ein bereits bestehendes automatisches Vercel-Deployment als Folge eines spaeter
autorisierten `main`-Merges wird nicht manuell ausgeloest, sondern danach nur beobachtet und belegt.

### F1.4: ratifizierter Vertragsinhalt und offener Implementierungsabgleich

Der Owner hat den F1.4-Vertragsinhalt mit dem Autonomie-Mandat vom 2026-08-27 vollstaendig
ratifiziert: `EVOLVE_PUBLIC_INVOICES` additiv und rueckwaertskompatibel; Umsatzsteuer ausschliesslich
19 Prozent; Rechnungsnummernkreis `R-JJJJ-NNNN` lueckenlos; Korrektur ausschliesslich als Storno plus
Neuausstellung; Stammdaten aus der Tenant-Config fail-closed; `PAYMENT_TERM_DAYS` exakt 14;
PDF-Download-Uebergang. Es fehlt dazu **keine** weitere Ownerentscheidung.

Fuer diesen Nachtrag existiert weiterhin keine eigene physische F1.4-Bauvertragsdatei; die
Provenienz ist ausschliesslich das oben gebundene Autonomie-Mandat. Es wird keine Datei-Provenienz
erfunden und kein SHA nachtraeglich konstruiert.
`missions/F1_ORDER_TO_CASH_PILOT_001.yml` bindet weiterhin
`f1_4_contract_sha256 = B1F4E10ECB0C907085D9BE90E859AAFEF1C9798AE5DEEE2E3CE0DD849AD2634A`. Die
Abweichung zwischen diesem gebundenen Vertrag samt Kandidatenstand und dem ratifizierten Inhalt ist
`RATIFIED_CONTRACT_DRIFT`, Klasse `FAIL_INTERNAL` nach `AGENTS.md`: Implementierungs- und
Vertragsabgleich durch den zustaendigen F1-Writer, nicht `BLOCKED_PRODUCT_DECISION`. Die
Dokumentation loest die Drift nicht still auf und behauptet nicht, der ratifizierte Inhalt sei
bereits umgesetzt. Details in `CURRENT_STATE.md`.

## Unterstützende, nicht autoritative Quellen

Folgende Inhalte dürfen Ideen, Historie oder Detailwissen liefern, aber keine aktuelle Mission oder Lieferentscheidung überschreiben:

- ältere Masterpläne und Umsetzungspläne,
- Übergabe- und Statusdateien außerhalb von `docs/project/`,
- Review-Bundles und Reparaturberichte,
- User-Twin- und USP-Quelldokumente,
- Screenshots und Präsentationsnotizen,
- lokale oder entfernte Branches, PRs und Worktrees,
- nicht versionierte Planungs-, Agentur- oder Governance-Dateien.

Bestätigte Inhalte daraus werden in `MASTERPLAN.md`, `CURRENT_STATE.md` oder `NON_LOSS_REGISTER.md` übernommen. Erst dann sind sie Teil der kanonischen Steuerung.

## Bekannte stale oder konfliktträchtige Quellen

Die folgenden lokalen Quellen wurden als potenziell veraltet oder widersprüchlich gemeldet und sind nicht autoritativ:

- lokales `AGENTS.md` im Dirty-Worktree `feature/capture-auth-tenant`,
- die vor M0 vorhandenen `KREILE_CLAUDE_COWORK_MASCHINERIE/`-Kopien (im externen
  Konsolidierungsarchiv einzeln gehasht; aus dem aktiven Repository entfernt),
- `PRODUKTFIRMA_LIVE_V3/`,
- `PRODUKTFIRMA_EXTRACTED/`,
- `KREILE_IDEENSAMMLUNG_*`,
- `KREILE_PHASE1_SLICE1_*`,
- `_quarantine/`,
- lokale `tools/`- und `qg01_*`-Artefakte,
- ältere Agentur-/Control-Plane-Masterpläne,
- ältere Übergaben, deren Branch-/Deployment-Angaben nicht mehr mit `main` übereinstimmen.

Diese Dateien werden nicht automatisch gelöscht. Sie werden erst nach Snapshot, Inhaltsprüfung und ausdrücklicher Freigabe archiviert oder entfernt.

Der M0-Snapshot fuer beide Cowork-Maschinerie-Kopien sowie die stale Missions- und
Build-Steuerung liegt in `repository-consolidation-20260813-193554/tracked-control-plane/MANIFEST.csv`;
123 Dateien wurden einzeln per SHA-256 gegen die Quelle verifiziert.

## Agentenregel

Vor jeder Mission:

1. `origin/main` aktualisieren.
2. alle oben genannten verbindlichen Steuerungsquellen und die Missionsakzeptanz lesen.
3. aktuellen Git-, Vercel- und bei DB-Arbeit Supabase-Zustand verifizieren.
4. lokale Dirty-Worktrees ausschliesslich read-only behandeln, sofern die Mission nichts anderes ausdruecklich freigibt; nicht einsehbare externe Checkouts als `UNKNOWN_EXTERNAL` markieren.
5. keine alte Datei als Begründung nutzen, wenn sie dem kanonischen Stand widerspricht.
6. ein Phasenmodus `READ_ONLY` ist eine Inventarisierungserlaubnis und niemals eine implizite
   Repo-Schreibfreigabe. Read-only Auditoutputs bleiben getrennt von spaeteren Evidence-Writes, die
   einen eigenen sauberen Paketkontext und eine vorab berechnete Allowlist brauchen.

## Pflege

- `CURRENT_STATE.md` wird nach jedem Merge/Production-Schritt aktualisiert, wenn sich der reale Zustand ändert.
- `MASTERPLAN.md` wird nur bei Prioritäts- oder Produktentscheidungen geändert.
- `NON_LOSS_REGISTER.md` wird bei neuen Ideen, Verschiebungen, Blockern und erledigten End-to-End-Nachweisen aktualisiert.
- Stale-Dateien werden nicht still gelöscht; sie erhalten zuerst einen dokumentierten Zielstatus.
- Die Frontend-Lane bekommt keine zusaetzliche Steuerungsdatei: kein `docs/project/FRONTEND_*.md`,
  keine Mission-Queue und kein Mission-Template. `missions/FRONTEND_IMPLEMENTATION_001.yml` ist der
  eine Liefervertrag; Fortschritt und Blocker werden in `CURRENT_STATE.md` und
  `NON_LOSS_REGISTER.md` gefuehrt.
