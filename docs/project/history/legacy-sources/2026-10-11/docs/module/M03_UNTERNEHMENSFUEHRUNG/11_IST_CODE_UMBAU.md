<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 11 - Ist-Code und Umbau

Stand: 2026-09-26  
Modul: M03 Unternehmensführung

| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |
|---|---|---|---|---|---|
| `outputs\leadership-goals-v1-module-candidate.3\` | app-neutraler, UI-loser GOALS_V1-Core | GEBAUT off-repo; `NOT_ADOPTED / OPUS_PENDING` | bleibt bytegebunden; erst nach auswertbarem Opus-Gate und atomarer Adoptionsmission vollständig als interner Core übernehmen | Inhalt `3AEB7CDBF7A7…`, Freeze `E7E155C7559D…`, 48/48 + 200 Property | keine Bestandsdaten; synthetische Fixtures nur unter `tests/`; nicht teilweise kopieren |
| Candidate.3 `public.ts` | browser-sichere Types/Readports/Policies | GEBAUT off-repo | bleibt unverändert im neutralen Core; Kreile-Fassade hostlokal außen | SHA `1FC35472BE82…` | nur freigegebene Exporte, kein Tiefimport |
| Candidate.3 `server-public.ts` | server-only Runtime/Hostadapter/Commands/Events | GEBAUT off-repo | bleibt unverändert im neutralen Core; Kreile-Serverfassade außen | SHA `7D8154686FC6…` | keine Clientimporte |
| Candidate.3 `src\v1\` | Domain, Runtime, Validierung, Projection, Ports | GEBAUT off-repo | bleibt; keine Hostnamen/-tabellen einbauen | Core-Hash `9A3554D49B05…` | spätere Änderungen brauchen neue Contractversion und Gate |
| Candidate.3 `schemas\` | DTO- und Manifest-Schemata | GEBAUT off-repo | bleibt; Candidate-Manifest nicht mit Kreile-Manifestschema vermischen | Schema-Hash `DADF8A3B9150…` | Hostmanifest separat, keine Schemaumschreibung |
| Candidate.3 `tests\support\synthetic-*` | zwei synthetische Hostharnesses | GEBAUT, nur Contracttest | bleibt als eindeutig synthetischer Test; niemals Produktpersistenz oder E2E-Beleg | Testgruppenhash `65323C96417B…` | keine synthetischen Daten migrieren |
| `outputs\leadership-goals-v1-module-candidate\` und Candidate.2-Paket | frühere Kandidatenstände | ÜBERHOLT, bytegenau erhalten | entfällt als Adoption; nur Herkunfts-/Regressionsbeleg | Verzeichnishash `424D4651A8A7…`, Paket `E4D693DC1556…` | nicht löschen, nicht mergen, nicht mischen |
| `02_app\src\modules\leadership-decisions\` | owner-ratifizierter späterer Hostslot | kein Code / Pfad fehlt auf `origin/main` | durch Modul neu belegen, aber erst nach Governance-/Opus-/Adoptionsgate | read-only `git ls-tree`: 0 Dateien | keine Tabelle/Route/UI vor den jeweiligen Gates |
| `02_app\src\app\cockpit\` | Legacy-Cockpit (14 Dateien auf origin/main) | Alt-/Legacy-Code, nicht Leadership-Wahrheit | entfällt für M03; nicht wiederverwenden; separate Kill-/Route-Hygiene-Mission | D-ARCH-009/MODULKARTE; P0-Traceability | echte Bestandsdaten nicht übernehmen; Löschung nicht Teil dieses Auftrags |
| `02_app\src\app\kontrolle\` | Legacy-Kontrolloberfläche (2 Dateien) | Alt-/Legacy-Code | entfällt für M03; nicht wiederverwenden | D-ARCH-009; read-only Inventar | keine lokale KPI-/Zielwahrheit übernehmen |
| `02_app\src\app\performance\` | Legacy-Performance-Cockpit (9 Dateien) | Alt-/Legacy-Code | entfällt für M03; nicht wiederverwenden | D-ARCH-009; read-only Inventar | keine Scores/Mocks/Bestandsdaten migrieren |
| `02_app\src\features\analyse\` | Legacy-Analyse-UI/-Actions (25 Dateien) | kein kanonischer M02-Port | entfällt als M03-Basis; später durch echte M02-Ports ersetzen | P0-Traceability §6; D-ARCH-009 | keine Direktimporte oder Berechnungsduplikate |
| `02_app\src\lib\analyse\` | Legacy-Analyseverträge (3 Dateien) | kein öffentlicher kanonischer Port | entfällt als M03-Basis; später durch versionierten Measurement-/Evaluation-Port ersetzen | P0-Traceability §6 | keine Schatten-Messdefinition |
| `02_app\src\db\seed_analyse.ts` und sonstige Analyse-Seeds | synthetische/Legacy-Datenpfade | nicht GOALS-Schema | entfällt für M03 | Repo-Schema-Inventar; Produktwahrheitsregel | keine Seed-/Demo-Daten als Migration oder Produktnachweis |
| `02_app\supabase\migrations\`, `02_app\src\db\schema*.ts` | bestehende Hostdatenbank | kein Goal-/Leadership-Modell | bleibt unverändert; spätere neue Migration nur nach Q-M03-003/Ownergate | 30 Migrationen/15 `src/db`-Dateien, 0 Goals-Treffer | Fresh-Replay, RLS, Restore und Rollback vor Adoption belegen |
| V5/Rolf-V8-HTML-Referenzen | visuelle Referenz mit synthetischen Beispielen | kein M03-Mock | nicht kopieren; M03 auf Kreile-DS aus Designphase 1b bauen | OE-2609-03; D-UI-V5-003 | keine CSS-/Mockdatenübernahme |
| `DECISION_GOVERNANCE_V1` | spätere Decision-/Review-Capability | kein Code; `BLOCKED_NOT_BUILDABLE` | bleibt ungebaut bis eigenem P7-Gate | Candidate.3 `BLOCKED_CAPABILITIES.md` | kein Stub, leerer Port, Route oder Tabelle |

## Umbau-/Adoptionsreihenfolge

1. Das BAUBEREIT-Dossier erlaubt gemäß OE-2609-17 die priorisierte off-repo Kernarbeit; M03 bleibt in der Reihenfolge nach M01/M02 und wird erst seriell an Kreile angebunden. Keine Bestandsdatei ändern, solange Governance-, Opus- und Adoptionsgate offen sind.
2. Candidate.3 exakt verifizieren und atomar in den freigegebenen Slot übernehmen; außen Kreile-Manifest/Fassaden.
3. Reale Hostports, normalisierte Persistenz, RLS, Outbox und Receipt/Readback unter eigenem Gate ergänzen. Für den ersten Kreile-Nutzenfall M01-/M02-Ports für Termintreue und Liquidität 30 Tage anbinden, ohne deren Fakten nach M03 zu kopieren.
4. Reales GOALS-E2E abschließen; erst danach UI-M03-002 bis 006 auf dem Kreile-Designsystem bauen. Dringende Warnungen stehen gemäß OE-2609-26 oberhalb des Tagesüberblicks.
5. Legacy-Cockpit-/Kontrolle-/Performance-/Analysepfade weder importieren noch als „schon gebaut“ zählen; ihre Disposition bleibt eine separate, ausdrücklich freigegebene Route-/Kill-Mission.
6. Es gibt keine M03-Bestandsdatenmigration. Sollten zum Adoptionszeitpunkt doch reale Ziel-/Entscheidungsdaten existieren, ist vor jedem Import ein neues Inventar-, Mapping-, Quarantäne-, Readback- und Rollbackgate Pflicht.
