<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->

# Dokumentenautorität

Stand: 2026-09-28 — D-GOV-001 + D-GOV-002 + D-GOV-003

## Zweck

Diese Datei verhindert, dass veraltete Masterpläne, Übergaben, Agenturkonzepte oder lokale Artefakte die aktuelle Produkt- und Lieferwahrheit überschreiben.

Diese Datei ist ein Wegweiser, keine zweite Steuerungsquelle. Die maschinenlesbare Zuordnung steht in `quality/authoritative-sources.json`.

| Wahrheitsart | Einzige Quelle |
|---|---|
| Projektregeln | `AGENTS.md` |
| Produktentscheidungen | `docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` |
| Scope und Module | `docs/project/linie/MODULKARTE_KANON.md` |
| Architektur | `docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md` |
| aktive Ausführung | `missions/F1_ORDER_TO_CASH_PILOT_001.yml` |
| auf `main` belegter Lieferstand | `docs/project/CURRENT_STATE.md` |
| UI-Wahrheit | die in `docs/project/linie/00_UI_REFERENZEN_PFADE.md` explizit gelisteten neuesten Referenzen |

Evidence beweist nur einen konkreten Stand. `00_JETZT` und `00_ABC` sind Pointer/Kurzansichten; die externe `00_BIBEL` ist Owner-Eingabe und Historie. Konflikt innerhalb einer Wahrheitsart bedeutet `BLOCKED_GOVERNANCE_CONFLICT`; Dateiname, Alter und Kommentar lösen ihn nicht auf. Abweichende Rangfolgen im erhaltenen historischen Text darunter sind durch D-GOV-001 und D-GOV-002 supersediert.

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
- Fuer die aktive Ausfuehrung ist allein `missions/F1_ORDER_TO_CASH_PILOT_001.yml` autoritativ. Die
  F0-Mission und ihre Evidence sind eingefrorene Historie; R0-A ist nur ein Checkpoint, kein R0-PASS.
- Sie duerfen weder reale Systemfakten umdeuten noch Sicherheitsgesetze aushebeln.
- Verlangt die Mission eine neue Produktentscheidung ausserhalb ihres Scopes oder widerspricht sie einer geschuetzten Produktentscheidung, wird der Konflikt explizit eskaliert.

### Owner-Beschlusslinie

- `docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` ist nach
  D-GOV-002 die einzige operative Produktentscheidungsquelle für Writer, Reviewer, CI und
  Lieferclaims. `docs/project/linie/` enthält daneben klassifizierte Repo-Referenzen und
  Derivate (Index `00_BIBEL_INDEX.md`; Repo-Hashes in `docs/project/linie/README.md`).
- Die externe `00_BIBEL` bleibt erhaltende Owner-Eingabe- und Historienquelle. Ein externer
  Eintrag wird erst ausführbar, nachdem Quelle und Hash erfasst, der Inhalt widerspruchsfrei
  in das Repo-Register übernommen, geprüft und nach `main` geliefert wurde. Eine
  Byte-Identitäts- oder External-master-first-Pflicht besteht nicht mehr.
- Die externen OE-2609-01 bis OE-2609-33 sind durch D-GOV-003 mit dem
  festgehaltenen Source-Hash einzeln disponiert. Nur ihre im Repo-Register
  ratifizierte oder gemappte Fassung ist operativer Bauinput.
- Bauverträge, Leitplanken und frühere Mandate sind ausschließlich
  `REFERENCE_ONLY_NON_EXECUTABLE`; bestätigte Regeln daraus gelten erst nach Aufnahme in die
  jeweils zuständige D-GOV-001-Quelle.
- `00_AUTONOMER_BETRIEB_LEITPLANKEN.md` ist ausdrücklich supersedierte Referenz und besitzt
  keinen Vorrang vor Root-`AGENTS.md`, Mission oder Entscheidungsregister.
- Owner = Siglinder. Ein Konflikt zwischen externer Eingabe und Repo-Register ist
  `BLOCKED_GOVERNANCE_CONFLICT`, bis er im Repo-Register entschieden und nach `main`
  geliefert ist; die externe Fassung darf nicht still als Bauinput gewählt werden.

### Produktsteuerung und Erhalt

- `docs/project/MASTERPLAN.md` bewahrt Zielbild und historische Roadmap, steuert aber kein aktives Paket.
- `docs/project/CURRENT_STATE.md` beschreibt ausschließlich den auf `main` belegten Lieferstand.
- `docs/project/NON_LOSS_REGISTER.md` schuetzt Ziele, verschobene Missionen und Salvage vor stillem Verlust, steuert aber kein aktives Paket.
- `docs/project/DOCUMENT_AUTHORITY.md` definiert diese Autoritaetsbereiche und Driftregeln.
- `docs/project/MODULARITY_STRATEGY.md` definiert Ist-/Zielstruktur und Modulregeln.

Keine dieser Dateien darf ausserhalb ihres Bereichs eine andere Quelle ueberschreiben. Ein Agent benennt Konflikte, verwendet den jeweils zustaendigen Vertrag und eskaliert echte Scope-/Produktentscheidungen statt still zu priorisieren.

## Unterstützende, nicht autoritative Quellen

Folgende Inhalte dürfen Ideen, Historie oder Detailwissen liefern, aber keine aktuelle Mission oder Lieferentscheidung überschreiben:

- ältere Masterpläne und Umsetzungspläne,
- Übergabe- und Statusdateien außerhalb von `docs/project/`,
- Review-Bundles und Reparaturberichte,
- User-Twin- und USP-Quelldokumente,
- Screenshots und Präsentationsnotizen,
- lokale oder entfernte Branches, PRs und Worktrees,
- nicht versionierte Planungs-, Agentur- oder Governance-Dateien,
- die aeussere `galvanik_kreile/AGENTS.md`; sie ist ausschliesslich eine
  nachgeordnete externe Sitzungssteuerung. Die naechstgelegene
  `02_app/AGENTS.md` bleibt die operative Projektregel.

Bestätigte Inhalte daraus werden je Wahrheitsart in das Produktentscheidungsregister,
`MASTERPLAN.md`, `CURRENT_STATE.md` oder `NON_LOSS_REGISTER.md` übernommen. Erst dann sind
sie Teil der kanonischen Steuerung.

## Bekannte stale oder konfliktträchtige Quellen

Die folgenden lokalen Quellen wurden als potenziell veraltet oder widersprüchlich gemeldet und sind nicht autoritativ:

- die historische Behauptung, `02_app` sei dauerhaft der unantastbare
  Dirty-Worktree `feature/capture-auth-tenant`; D-GOV-003 und die aktive
  Mission binden stattdessen genau einen kurzen Paketbranch im kanonischen
  Repository,
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
- die extern erhaltenen Entscheidungen `D-UI-V6-001` bis `D-UI-V6-004`; sie sind nach
  D-GOV-002 `REJECTED_SUPERSEDED`, während repo-intern D-UI-V5-003 gilt.

Diese Dateien werden nicht automatisch gelöscht. Sie werden erst nach Snapshot, Inhaltsprüfung und ausdrücklicher Freigabe archiviert oder entfernt.

Der M0-Snapshot fuer beide Cowork-Maschinerie-Kopien sowie die stale Missions- und
Build-Steuerung liegt in `repository-consolidation-20260813-193554/tracked-control-plane/MANIFEST.csv`;
123 Dateien wurden einzeln per SHA-256 gegen die Quelle verifiziert.

## Agentenregel

Vor jeder Mission:

1. `origin/main` aktualisieren.
2. alle oben genannten verbindlichen Steuerungsquellen und die Missionsakzeptanz lesen.
3. Bei einer durch D-GOV-003 erlaubten Kandidatenwarteschlange den exakten,
   bereits geprueften Parent-SHA, sein Receipt und die Reihenfolge verifizieren;
   Kandidaten niemals als `main` ausgeben.
4. aktuellen Git-, Vercel- und bei DB-Arbeit Supabase-Zustand verifizieren.
5. Im kanonischen `02_app` nur den in der Mission gebundenen Paketbranch
   schreiben; alle anderen lokalen Dirty-Worktrees read-only behandeln und
   nicht einsehbare externe Checkouts als `UNKNOWN_EXTERNAL` markieren.
6. keine alte Datei als Begründung nutzen, wenn sie dem kanonischen Stand widerspricht.

## Statische Ratchet-Grenze nach PR #143

Der geschützte Base-Workflow nutzt für nachfolgende Kandidaten ausschließlich
`scripts/quality/check-ratchet-boundary.mjs` mit der strikten Policy und dem
Schema unter `quality/`. Er prüft Base-/Kandidatenidentität, Ancestry sowie die
rohen Git-Blobs des gesamten `.github/workflows`- und `docs/delivery`-Baums und
der explizit benannten Vertragsdateien; Kandidatencode wird niemals ausgeführt.
Die statische Grenze ist ein Prüfvertrag, keine neue Produktwahrheit und kein
Merge-, Deploy- oder Delivery-Claim für ein Folgepaket.

## Pflege

- `CURRENT_STATE.md` wird nach jedem Merge/Production-Schritt aktualisiert, wenn sich der reale Zustand ändert.
- `MASTERPLAN.md` wird nur bei Prioritäts- oder Produktentscheidungen geändert.
- `NON_LOSS_REGISTER.md` wird bei neuen Ideen, Verschiebungen, Blockern und erledigten End-to-End-Nachweisen aktualisiert.
- Stale-Dateien werden nicht still gelöscht; sie erhalten zuerst einen dokumentierten Zielstatus.
