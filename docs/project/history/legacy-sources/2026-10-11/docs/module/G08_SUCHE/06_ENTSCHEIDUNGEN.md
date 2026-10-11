<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G08_SUCHE — Angewandte Entscheidungen

| Register-ID / Fundstelle | Kurzform (1 Zeile) | Datum | gilt/überholt |
|---|---|---|---|
| D-GOV-001 / `DOCUMENT_AUTHORITY.md` | Lieferstatus kommt aus Git/Mission/Current-State-Hierarchie, nicht aus Chat oder Evidence. | 2026-08-28 ff. | gilt |
| D-ARCH-009 | SUCHLEISTE ist eigener F1-Grundstamm, tenantgebunden und Pflicht vor Pilot. | 2026-09-06 | gilt |
| D-UI-CORE-001 | Suche wird erst nach Shell, Orders und Customers in die Ziel-Kopfzeile integriert und als vollständige Route abgenommen. | 2026-09-10 | gilt |
| D-UI-CORE-002 | Eine Overlay-/Backstack-Wahrheit bewahrt Filter und Scroll für Home→Auftrag→Kunde→Auftrag, Kunde→Auftrag und Intake→Auftrag. | 2026-09-10 | gilt |
| D-UI-V5-001 | `CURRENT_DESIGN_REFERENCE.json` bindet V5 als Ablaufreferenz; Einzelreferenzen bleiben Seitenwahrheit. | 2026-09-14 | gilt |
| D-UI-V5-003 / Repo-Register | V5 ist einzige Zielvorlage; V6 ist verworfen. | 2026-09-21 | gilt |
| D-AI-001 | RLS vor Retrieval, exakte/strukturierte Suche zuerst, spätere Semantik nur über öffentliche Read-Ports und ohne Mutation. | 2026-09-10 | gilt |
| D-RES-001 | Fehler nennen Wirkung, sichere Datenlage, Correlation-ID und nächsten Schritt; kein Erfolg ohne Readback. | 2026-09-10 | gilt |
| ARCHITEKTUR_MODULE_PATH1 Nähte 1–4 | Modulmanifest, positive Fassade, Tenantinjektion und Cross-Modul-Fakten nur über deklarierte Ports/Views. | 2026-09-06/15 | gilt |
| OE-2609-01 / Owner-Entscheidungen | Grundstamm vor unabhängigen Modulen; G08 gehört zum Grundstamm. | 2026-09-25/26 | gilt |
| OE-2609-03 | Designsystem aus V5 ableiten; Mock-CSS nicht kopieren, `kr-`-Präfix. | 2026-09-25/26 | gilt; ältere Mock-Treue-Bauanweisung überholt |
| OE-2609-09 | Lesen ist für alle Personen offen, sofern Admin nicht individuell sperrt/erweitert. | 2026-09-25/26 | gilt; enger fester Rollencheck überholt |
| OE-2609-15 | Für jedes Modul ist vor Bau ein vollständiges, quellengeprüftes Dossier Pflicht. | 2026-09-25/26 | gilt |
| OE-2609-17 | Der neutrale Suchvertrag wird vor M07 stabilisiert; Kreile bleibt alleiniger Inhalt dieses Dossiers. | 2026-09-25/26 | gilt |
| Plan T-04 | Ziel-Kopfzeile, neutraler Kern/Kreile-Adapter, Backstack und Entfernung der Alt-GlobalSearch-Doppelung. | 2026-09-26 | gilt, noch nicht gebaut |
| Plan T-13 | Altpfade erst nach Importinventar und Negativtests bereinigen. | 2026-09-26 | gilt, noch nicht gebaut |
| OP-10 | Dokument-Port L4 für die Suche ist offen. | 2026-09-26 | gilt → Q-G08-001 |
| Mindmap „Suchvertrag jedes Modul + Volltext“ | struktureller Ursprung der Suche; Detailaussagen gelten nur soweit später ratifiziert. | 2026-08-15 | teilweise überholt durch D-ARCH-009/D-AI-001/Owner-Nachträge |
| PR-84-/P3-Kandidatenstatus in Mission/Evidence | historischer Kandidatenstand, kein aktueller sichtbarer UI-PASS. | 2026-09-10/17 | als Lieferbehauptung überholt; Doku-Drift Q-G08-002 |
| PL-/KOORD-Digests | liefern Historie und frühere Antworten, aber keine Liefer- oder Designautorität. | bis 2026-09-25 | überholt, soweit sie Mock-CSS/Delivery behaupten |
| ältere Bibel-Kopie `10122CDBB5F2` | endet vor D-UI-V5-003 und weicht von der Repo-Kopie ab. | 2026-09-21 | überholt; gemäß Auftrag gilt Repo-Kopie `96C91AB9210F` plus D-UI-V5-003 |

## Für den Builder bindende Auslegung

1. Der vorhandene Kern ist Salvage, kein Beleg für gelieferte Ziel-UI.
2. T-04 darf vorhandene deterministische Logik übernehmen, muss aber Source-Registry, öffentliche Read-Ports, Capability-Modell, Correlation-ID, Ziel-Designsystem und NavigationContext schließen.
3. Es wird keine neue Datenwahrheit, Tabelle, Providerabhängigkeit oder Dokumentquelle erfunden.
4. Offene Punkte werden nach `08_OFFENE_FRAGEN.md` fail-contained; sie rechtfertigen keinen stillen Fallback.

