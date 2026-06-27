# Dokumentenautorität

Stand: 2026-06-27

## Zweck

Diese Datei verhindert, dass veraltete Masterpläne, Übergaben, Agenturkonzepte oder lokale Artefakte die aktuelle Produkt- und Lieferwahrheit überschreiben.

## Autoritätsreihenfolge

### 1. Reale Liefer- und Systemwahrheit

1. GitHub `main` und der konkrete Commit.
2. Vercel Production-Deployment und dessen Git-Commit.
3. Remote-Supabase-Schema, Policies, Storage und ausgeführte Migrationen.
4. Reproduzierbare Tests, Runtime-Logs und reale Browsernachweise.

Dokumentation darf diesen Zustand beschreiben, aber nicht ersetzen.

### 2. Verbindliche Arbeits- und Produktsteuerung

1. Root-`AGENTS.md` – Arbeits-, Sicherheits- und Architekturgesetze.
2. `docs/project/MASTERPLAN.md` – aktive Reihenfolge und Produktziel.
3. `docs/project/CURRENT_STATE.md` – letzter verifizierter Lieferstand und aktuelle Blocker.
4. `docs/project/NON_LOSS_REGISTER.md` – geschützte Ideen, verschobene Missionen und Salvage-Arbeit.
5. freigegebene Missionsdatei oder ausdrücklich nummerierte Akzeptanzkriterien.

Bei Widerspruch gilt die höher stehende Quelle. Ein Agent darf Widersprüche nicht still auflösen, sondern muss sie benennen und den autoritativen Stand verwenden.

## Unterstützende, nicht autoritative Quellen

Folgende Inhalte dürfen Ideen, Historie oder Detailwissen liefern, aber keine aktuelle Mission oder Lieferentscheidung überschreiben:

- ältere Masterpläne und Umsetzungspläne,
- Übergabe- und Statusdateien außerhalb von `docs/project/`,
- Review-Bundles und Reparaturberichte,
- User-Twin- und USP-Quelldokumente,
- Screenshots und Präsentationsnotizen,
- lokale Branches und Worktrees,
- nicht versionierte Planungs-, Agentur- oder Governance-Dateien.

Bestätigte Inhalte daraus werden in `MASTERPLAN.md`, `CURRENT_STATE.md` oder `NON_LOSS_REGISTER.md` übernommen. Erst dann sind sie Teil der kanonischen Steuerung.

## Bekannte stale oder konfliktträchtige Quellen

Die folgenden lokalen Quellen wurden als potenziell veraltet oder widersprüchlich gemeldet und sind nicht autoritativ:

- lokales `AGENTS.md` im Dirty-Worktree `feature/capture-auth-tenant`,
- `KREILE_CLAUDE_COWORK_MASCHINERIE/`,
- `PRODUKTFIRMA_LIVE_V3/`,
- `PRODUKTFIRMA_EXTRACTED/`,
- `KREILE_IDEENSAMMLUNG_*`,
- `KREILE_PHASE1_SLICE1_*`,
- `_quarantine/`,
- lokale `tools/`- und `qg01_*`-Artefakte,
- ältere Agentur-/Control-Plane-Masterpläne,
- ältere Übergaben, deren Branch-/Deployment-Angaben nicht mehr mit `main` übereinstimmen.

Diese Dateien werden nicht automatisch gelöscht. Sie werden erst nach Snapshot, Inhaltsprüfung und ausdrücklicher Freigabe archiviert oder entfernt.

## Agentenregel

Vor jeder Mission:

1. `origin/main` aktualisieren.
2. die fünf verbindlichen Steuerungsquellen lesen.
3. aktuellen Git-, Vercel- und bei DB-Arbeit Supabase-Zustand verifizieren.
4. lokale Dirty-Worktrees ausschließlich read-only behandeln, sofern die Mission nichts anderes ausdrücklich freigibt.
5. keine alte Datei als Begründung nutzen, wenn sie dem kanonischen Stand widerspricht.

## Pflege

- `CURRENT_STATE.md` wird nach jedem Merge/Production-Schritt aktualisiert, wenn sich der reale Zustand ändert.
- `MASTERPLAN.md` wird nur bei Prioritäts- oder Produktentscheidungen geändert.
- `NON_LOSS_REGISTER.md` wird bei neuen Ideen, Verschiebungen, Blockern und erledigten End-to-End-Nachweisen aktualisiert.
- Stale-Dateien werden nicht still gelöscht; sie erhalten zuerst einen dokumentierten Zielstatus.
