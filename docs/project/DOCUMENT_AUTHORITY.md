# Dokumentenautorität

Stand: 2026-08-13

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
- Fuer den laufenden F1-Lauf ist allein `missions/F1_ORDER_TO_CASH_PILOT_001.yml` aktiv. Die
  F0-Mission und ihre Evidence sind eingefrorene Historie; R0-A ist nur ein Checkpoint, kein R0-PASS.
- Sie duerfen weder reale Systemfakten umdeuten noch Sicherheitsgesetze aushebeln.
- Verlangt die Mission eine neue Produktentscheidung ausserhalb ihres Scopes oder widerspricht sie einer geschuetzten Produktentscheidung, wird der Konflikt explizit eskaliert.

### Produktsteuerung und Erhalt

- `docs/project/MASTERPLAN.md` bestimmt Produktziel und aktive Reihenfolge.
- `docs/project/CURRENT_STATE.md` beschreibt den letzten verifizierten Stand und offene Blocker.
- `docs/project/NON_LOSS_REGISTER.md` schuetzt Ziele, verschobene Missionen und Salvage vor stillem Verlust.
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

## Pflege

- `CURRENT_STATE.md` wird nach jedem Merge/Production-Schritt aktualisiert, wenn sich der reale Zustand ändert.
- `MASTERPLAN.md` wird nur bei Prioritäts- oder Produktentscheidungen geändert.
- `NON_LOSS_REGISTER.md` wird bei neuen Ideen, Verschiebungen, Blockern und erledigten End-to-End-Nachweisen aktualisiert.
- Stale-Dateien werden nicht still gelöscht; sie erhalten zuerst einen dokumentierten Zielstatus.
