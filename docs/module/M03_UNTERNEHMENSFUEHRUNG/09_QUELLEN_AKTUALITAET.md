<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 09 - Quellen und Aktualität

Stand: 2026-09-26  
Modul: M03 Unternehmensführung

## Aktualitätsurteil

- Im aktuellen Nachlauf wurde Git gemäß Nutzerauftrag nicht erneut aufgerufen: Im Sandbox-Nutzer ist das Repository wegen `dubious ownership` nicht lesbar. Der aktuelle `origin/main`-Stand ist deshalb Q-M03-011 mit Zuständigkeit PL; es wird keine aktuelle Git-/Remote-Aussage behauptet.
- Der frühere Dossierlauf dokumentierte `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9` mit Commitdatum 2026-09-25 und bytegleichen relevanten Working-Tree-Blobs. Diese Angabe bleibt historischer Inventarbeleg, nicht Aktualitätsnachweis für den Nachlauf.
- Candidate.3 ist der neueste GOALS-Stand. Inhaltshash, technischer Freeze und Paket wurden am 2026-09-26 read-only reproduziert und stimmen vollständig.
- Zwei Registerkopien weichen ab. Gemäß OP-01/Nutzerauftrag gilt die zuvor gelesene Repo-Kopie mit D-UI-V5-003; die 00_BIBEL-Kopie ohne diesen Eintrag ist überholt. Die Ownerbeschlüsse bis OE-2609-26 und D-LEADERSHIP-/Slot-Handoffs warten noch auf den formalen Master-first-Nachzug.
- Der frühere Dossierlauf fand den in den Projektregeln verlangten Pfad `missions\MISSION_TEMPLATE.yml` nicht im damals lesbaren `origin/main`. Im Nachlauf wurde dies wegen Q-M03-011 nicht erneut geprüft; daraus wird keine Gate-Ausnahme abgeleitet.
- Die Mindmap-PDF wurde gegen Hash und Quellenregister geprüft. Poppler/Python-PDF-Bibliotheken fehlen, daher war in dieser Sandbox keine visuelle Seitenprüfung möglich; die bytezugehörige HTML-Quelldatei und das Quellenregister wurden textlich abgeglichen. Kein visuelles PDF-Layout-PASS wird behauptet.

| Pfad | Datum | SHA-256 (12) | Status | ersetzt durch |
|---|---|---|---|---|
| `_MODULDOSSIERS\00_ANLEITUNG_MODULDOSSIER.md` | 2026-09-26 | 893D264A026A | GÜLTIG | Version 1.1; Dossierstandard inklusive §8-Abgrenzung |
| `_MODULDOSSIERS\00_PROJEKT\REDTEAM_BUILDER_2026-09-26.md` | 2026-09-26 | 4369457A4C5A | GÜLTIG | Rate-Stellen RT-21/22/23/24/31 und M03-Hostlücken |
| `_MODULDOSSIERS\00_PROJEKT\PLAN_JETZT_BIS_LIVEGANG_2026-09-25.md` | 2026-09-26 | 30AC8172CE0B | GÜLTIG | Plan 1.1; M03-Reihenfolge/Phase 4 |
| `_MODULDOSSIERS\00_PROJEKT\00_OFFENE_PUNKTE_KREILE.md` | 2026-09-26 | 02E14050B37C | GÜLTIG | OP-01/02/25/26/27 |
| `_MODULDOSSIERS\00_PROJEKT\OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` | 2026-09-26 | F04B248EE23D | GÜLTIG | für diesen Auftrag bis OE-2609-26 ausgewertet; formaler Register-Merge offen |
| `_MODULDOSSIERS\00_PROJEKT\QUELLEN\PRIOR_QUELLEN_EINDEUTIG.md` | 2026-09-26 | F46163CD3576 | GÜLTIG | eindeutige Vorwissenspfade, keine erneute Ownerfrage |
| `M03_UNTERNEHMENSFUEHRUNG\HINWEIS_TRENNUNG_2026-09-26.md` | 2026-09-26 | 66DE9BC5059E | GÜLTIG | Owner-Präzisierung: ausschließlich Kreile; Übertragbarkeit nur als app-neutrale Kerngrenze |
| `M03_UNTERNEHMENSFUEHRUNG\HINWEIS_OWNER_OE-2609-23.md` | 2026-09-26 | 9667CAE1C266 | GÜLTIG | klärt Q-M03-005: erstes Ziel kombiniert Termintreue und Liquidität 30 Tage |
| `M03_UNTERNEHMENSFUEHRUNG\HINWEIS_OWNER_OE-2609-26.md` | 2026-09-26 | 102DE574C411 | GÜLTIG | klärt Startseitenhierarchie: Dringendes oben, Tagesüberblick darunter |
| `_MODULDOSSIERS\00_PROJEKT\QUELLEN\00_QUELLENREGISTER.md` | 2026-09-26 | 23640B17DC55 | GÜLTIG | Gültigkeitsabgleich der Mindmap |
| `_MODULDOSSIERS\00_PROJEKT\QUELLEN\KREILE_MODUL_MINDMAP_2026-08-15.pdf` | 2026-08-15 | 80051E940E72 | GÜLTIG | Strukturbild; Entfall-Aussagen durch OE-2609-05 überholt |
| `_MODULDOSSIERS\00_PROJEKT\QUELLEN\KREILE_MODUL_MINDMAP_V2_2026-08-15.html` | 2026-08-15 | B792DEF27F89 | GÜLTIG | Quelldatei zur PDF; nur Strukturinhalt |
| `Temp\kreile_digest\Unternehmensfuehrung_01a0ab1c.md` | 2026-09-25 | E3694FC36F63 | GÜLTIG | Chatentscheidungen, Audit-/Slot-/Buildverlauf; nicht Kanon |
| `outputs\UNTERNEHMENSFUEHRUNG_RECHERCHE_UND_STRUKTURVORBEREITUNG_2026-09-16.md#§§0-10,12-16,18` | 2026-09-16 | 0B8B4C52E9F1 | GÜLTIG | Fach-/Quellenrecherche; spätere Verträge durch Candidate.3 präzisiert |
| `outputs\UNTERNEHMENSFUEHRUNG_RECHERCHE_UND_STRUKTURVORBEREITUNG_2026-09-16.md#UI-Screen-Navigation-Button-Prototyp-Teile` | 2026-09-16 | 0B8B4C52E9F1 | VERWORFEN | durch Owner-Korrektur; keine Bauvorlage |
| `outputs\LEADERSHIP_RUNTIME_CONTRACT_AND_GOALS_V1_BUILDABILITY_2026-09-16.md` | 2026-09-16 | FD85CC0AC3EE | ÜBERHOLT | Candidate.3-Verträge/Ports/Commands sind der neuere ausführbare Stand |
| `outputs\D_LEADERSHIP_001_CANONIZATION_HANDOFF_2026-09-17.md` | 2026-09-17 | 84CC5ABB204B | GÜLTIG | fachlich ratifiziert; formaler Repo-Kanoneintrag offen |
| `outputs\LEADERSHIP_SLOT_DECISION_HANDOFF_2026-09-17.md` | 2026-09-17 | 580D5883A0F9 | GÜLTIG | Slot owner-ratifiziert; keine Adoption/Struktur angelegt |
| `outputs\MASTERPLAN_V1_1_DELTA_TRACEABILITY_P0_2026-09-17.md` | 2026-09-17 | 90156142166A | GÜLTIG | P0-Evidenz und Portinventar; damalige Slotfrage inzwischen beantwortet |
| `outputs\MASTERPLAN_V1_1_REQUIREMENT_REGISTER_2026-09-17.csv` | 2026-09-17 | 97836B101590 | GÜLTIG | 211 Traceability-Gruppen zum Masterplan |
| `outputs\LEADERSHIP_REAL_IMPLEMENTATION_DELTA_FROM_UX_REDTEAM_2026-09-17.md` | 2026-09-17 | DDF5662272F0 | GÜLTIG | finaler Planstand nach fünf Sonnet-P1-Auflagen; keine Produktfreigabe |
| `outputs\UX_REDTEAM_REAL_IMPLEMENTATION_REQUIREMENTS_2026-09-17.csv` | 2026-09-17 | B14638BA55B0 | GÜLTIG | 32 Anforderungen/16 Pflichtfelder, finaler Matrixstand |
| `outputs\UX_REDTEAM_REAL_IMPLEMENTATION_DELTA_HASHES_2026-09-17.json` | 2026-09-17 | 7F77E16951E8 | GÜLTIG | Hashbindung des finalen Delta-Pakets |
| `outputs\leadership-goals-v1-module-candidate\` (candidate.2) | 2026-09-17 | 424D4651A8A7 | ÜBERHOLT | bytegenau erhalten; ersetzt durch Candidate.3 |
| `outputs\app-neutral-leadership-goals-v1-candidate-0.1.0-candidate.2.tgz` | 2026-09-17 | E4D693DC1556 | ÜBERHOLT | ersetzt durch Candidate.3-Paket |
| `outputs\leadership-goals-v1-module-candidate.3\` ohne `ARTIFACT_HASHES.json` | 2026-09-17 | 3AEB7CDBF7A7 | GÜLTIG | finaler Off-Repo-Kandidat; 107 Dateien, nicht adoptiert |
| `outputs\app-neutral-leadership-goals-v1-candidate-0.1.0-candidate.3.tgz` | 2026-09-17 | E4D357426B64 | GÜLTIG | paketierter Candidate.3; nicht adoptiert |
| `outputs\leadership-goals-v1-module-candidate.3\capability.manifest.json` | 2026-09-17 | 7D16F7D86BCC | GÜLTIG | Capability-/Truth-Grenze |
| `outputs\leadership-goals-v1-module-candidate.3\INTEGRATION_HANDSHAKE.json` | 2026-09-17 | CE4E9F23688A | GÜLTIG | Port-/Blocker-/Auditstatus |
| `outputs\leadership-goals-v1-module-candidate.3\ARTIFACT_HASHES.json` | 2026-09-17 | E06070A11949 | GÜLTIG | Hashmanifest finaler Stand |
| `outputs\leadership-goals-v1-module-candidate.3\FINAL_AUDIT_FREEZE.json` | 2026-09-17 | 63EE2497C871 | GÜLTIG | technischer Scope `E7E155C7…` |
| `outputs\leadership-goals-v1-module-candidate.3\AUDIT_REPORT.md` | 2026-09-17 | E25997DA146D | GÜLTIG | Codex interim geschlossen; Opus ausdrücklich pending |
| `outputs\leadership-goals-v1-module-candidate.3\FINAL_OPUS_AUDIT_RAW.json` | 2026-09-17 | 3B3A8A68A0B9 | GÜLTIG | HTTP 429, null Inferenz; kein Audit-PASS |
| `02_app\AGENTS.md` aus `origin/main` | 2026-09-20 | 7A5FBDBEAF29 | GÜLTIG | Projektregeln; lokaler Blob bytegleich zu origin/main |
| `02_app\docs\project\DOCUMENT_AUTHORITY.md` aus `origin/main` | 2026-09-10 | E1A5D571CCB5 | GÜLTIG | D-GOV-001-Autoritätsmatrix |
| `02_app\docs\project\CURRENT_STATE.md` aus `origin/main` | 2026-09-10 | C9B97F3AE164 | GÜLTIG | auf main dokumentierter Lieferstand; keine M03-Lieferung |
| `02_app\docs\project\MASTERPLAN.md` aus `origin/main` | 2026-08-13 | 2E021EAEA22B | GÜLTIG | Reference-only Ziel-/Roadmapquelle, keine Mission |
| `02_app\docs\project\NON_LOSS_REGISTER.md` aus `origin/main` | 2026-08-06 | 0FEA83C9CDF8 | GÜLTIG | schützt Kontroll-/Planbarkeitsziel, startet keinen Bau |
| `02_app\docs\project\MODULARITY_STRATEGY.md` aus `origin/main` | 2026-08-01 | C28301FF638A | ÜBERHOLT | Architektur durch D-ARCH-009/Path 1 supersediert |
| `02_app\docs\project\linie\ARCHITEKTUR_MODULE_PATH1.md` aus `origin/main` | 2026-09-21 | 7421775EA5E5 | GÜLTIG | Hostmodul-/Fassaden-/CI-Regeln |
| `02_app\docs\project\linie\MODULKARTE_KANON.md` aus `origin/main` | 2026-09-21 | 68FCCB2AB17E | GÜLTIG | formaler aktueller Scope; M03-Nachzug durch OP-02 offen |
| `02_app\docs\project\linie\KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` | 2026-09-21 | 96C91AB9210F | GÜLTIG | laut OP-01 maßgebliche Repo-Kopie, enthält D-UI-V5-003 |
| `00_BIBEL\KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` | 2026-09-21 | 10122CDBB5F2 | ÜBERHOLT | abweichende Kopie ohne D-UI-V5-003; Master-first-Merge offen |
| `02_app\docs\project\linie\00_UI_REFERENZEN_PFADE.md` | 2026-09-21 | 5B36CF1841A6 | GÜLTIG | UI-Wahrheitsweg |
| `02_app\docs\project\linie\ui\00_UI_REFERENZ_KANONISCH.md` | 2026-09-20 | 5AD0F70AB796 | GÜLTIG | kanonische UI-Zuordnung |
| `02_app\docs\project\linie\ui\CURRENT_DESIGN_REFERENCE.json` | 2026-09-21 | CDB573268ABB | GÜLTIG | aktueller Designreferenzstand |
| `02_app\docs\project\linie\ui\KREILE_GESAMTMOCK_V5_2026-09-14.html` | 2026-09-14 | 75258FF3BD4C | GÜLTIG | Designquelle; kein M03-Anker, Mockdaten nicht übernehmen |
| `02_app\docs\project\linie\ui\KREILE_STARTSEITE_ROLF_V8_2026-08-20.html` | 2026-08-20 | 878FAD351778 | GÜLTIG | Rolf-Kontext; kein Leadership-Screen |

## Widersprüche und Duplikate

1. **Registerdivergenz:** Repo `96C91A…` gilt; 00_BIBEL `10122C…` ist überholt. OP-01 verlangt später Master-first-Bytegleichheit.
2. **M03-Scope:** Repo-Modulkarte enthält noch „Analyse/KPI-Cockpit entfällt“ und kennt M03 nicht. D-LEADERSHIP-001, Slotentscheid und OE-2609-05 sind neuer, aber formal noch nicht kanonisiert; bis OP-02 bleibt M03 ohne Route/Adoption.
3. **Ausgrauen:** Modulkarte verbietet „kommt bald“-Flächen; OE-2609-04 erlaubt neuer nur Elemente in gebauten Screens. Deshalb genau ein nicht klickbares Element, keine Fläche/Route.
4. **UI-Methode:** D-UI-V5-003 liefert die visuelle Quelle; OE-2609-03 ersetzt Mock-CSS-/1:1-Kopiermethode durch Kreile-DS-Ableitung.
5. **Auditstatus:** frühere Candidate.1/.2-Audits gelten nicht für Candidate.3. Der einzige Candidate.3-Opusversuch hatte keine Inferenz; Codex-Interimsreview ist kein unabhängiges Opus-PASS.
6. **Git/Kanon-Aktualität:** Im Nachlauf ist Git wegen `dubious ownership` nicht lesbar und wurde auftragsgemäß nicht erneut versucht. PL klärt den aktuellen `origin/main`-Stand in Q-M03-011; bis dahin kein Import, keine Adoption und in der App `In Klärung`.
