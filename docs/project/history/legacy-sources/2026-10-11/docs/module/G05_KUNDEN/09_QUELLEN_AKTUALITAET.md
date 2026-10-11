<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G05 Kunden — Quellen und Aktualität

## Prüfstand

- Geprüft am 2026-09-26 gegen den lokal vorhandenen Remote-Tracking-Stand `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9` (Commitdatum 2026-09-25, Merge PR #112 „Path1 k3 customers“).
- `git fetch origin` wurde einmal versucht und scheiterte read-only an `02_app/.git/FETCH_HEAD: Permission denied`. Es wurde nicht wiederholt; der genannte Stand ist deshalb **lokal gecacht**, nicht am 2026-09-26 remote bestätigt.
- Der lokale Dirty-Worktree wurde weder als Autorität verwendet noch verändert.
- `CURRENT_STATE.md` nennt für Customers noch `NOT_DELIVERED`, ist aber durch die Customer-Commits vom 2026-09-25 sachlich überholt. Architektur-/Governanceaussagen daraus bleiben nur dort nutzbar, wo kein neuerer Beleg widerspricht.
- Die Mindmap-PDF wurde über Quellenregister/Hash und ihre HTML-Quelldatei geprüft. In der verfügbaren Umgebung fehlte ein funktionierender PDF-Text-/Renderpfad; deshalb wurde keine visuelle PDF-Gleichheit behauptet.

| Pfad | Datum | SHA-256 (12) | Status | ersetzt durch |
|---|---|---|---|---|
| `_MODULDOSSIERS/00_ANLEITUNG_MODULDOSSIER.md` | 2026-09-26 | `893D264A026A` | GÜLTIG | Version 1.1; ersetzt die im Auftrag genannte Version 1.0 |
| `_MODULDOSSIERS/00_PROJEKT/REDTEAM_BUILDER_2026-09-26.md` | 2026-09-26 | `4369457A4C5A` | GÜLTIG | — |
| `_MODULDOSSIERS/00_PROJEKT/PLAN_JETZT_BIS_LIVEGANG_2026-09-25.md` | 2026-09-26 | `F7C6CA06FF9B` | GÜLTIG | — |
| `_MODULDOSSIERS/00_PROJEKT/00_OFFENE_PUNKTE_KREILE.md` | 2026-09-26 | `7C92FEBC4A8F` | GÜLTIG | — |
| `_MODULDOSSIERS/00_PROJEKT/OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` | 2026-09-26 | `F04B248EE23D` | GÜLTIG | präzisiert/ersetzt ältere Antworten gemäß OE-IDs |
| `_MODULDOSSIERS/00_PROJEKT/QUELLEN/PRIOR_QUELLEN_EINDEUTIG.md` | 2026-09-26 | `F46163CD3576` | GÜLTIG | — |
| `_MODULDOSSIERS/00_PROJEKT/QUELLEN/00_QUELLENREGISTER.md` | 2026-09-26 | `23640B17DC55` | GÜLTIG | — |
| `_MODULDOSSIERS/00_PROJEKT/QUELLEN/KREILE_MODUL_MINDMAP_2026-08-15.pdf` | 2026-08-15 (Inhaltsstand; Ablage 2026-09-26) | `80051E940E72` | GÜLTIG | Strukturbild, durch Entscheidungen/Kanon begrenzt |
| `_MODULDOSSIERS/00_PROJEKT/QUELLEN/KREILE_MODUL_MINDMAP_V2_2026-08-15.html` | 2026-08-15 (Dateiablage 2026-09-05) | `B792DEF27F89` | GÜLTIG | Quelldatei zur PDF laut Quellenregister |
| `C:/Users/Traube/Downloads/kreile-modul-mindmap.pdf` | 2026-09-26 | `80051E940E72` | DUPLIKAT | Ablagekopie im Quellenordner |
| `C:/Users/Traube/Desktop/kreile-modul-mindmap.pdf` | 2026-09-06 | `52DEC8D8B5EE` | ÜBERHOLT | Ablagekopie `.../QUELLEN/KREILE_MODUL_MINDMAP_2026-08-15.pdf` |
| `C:/Users/Traube/AppData/Local/Temp/kreile_digest/PL_01a0ce4b.md` | 2026-09-25 | `732833CE3190` | GÜLTIG | nur als Vorwissens-/Fundstellenbeleg; neuere Owner-/Kanonquelle hat Vorrang |
| `C:/Users/Traube/AppData/Local/Temp/kreile_digest/KOORD_late.md` | 2026-09-25 | `3856CCF611C8` | GÜLTIG | nur als Vorwissens-/Fundstellenbeleg; neuere Owner-/Kanonquelle hat Vorrang |
| `C:/Users/Traube/AppData/Local/Temp/kreile_digest/KOORD_01a07c58.md` | 2026-09-25 | `33FEB6DBDCCA` | GÜLTIG | nur als Vorwissens-/Fundstellenbeleg; neuere Owner-/Kanonquelle hat Vorrang |
| `02_app/AGENTS.md` auf `origin/main` | 2026-09-10 | `7A5FBDBEAF29` | GÜLTIG | — |
| `02_app/docs/project/DOCUMENT_AUTHORITY.md` auf `origin/main` | 2026-09-10 | `E1A5D571CCB5` | GÜLTIG | — |
| `02_app/docs/project/CURRENT_STATE.md` auf `origin/main` | 2026-09-10 | `C9B97F3AE164` | ÜBERHOLT | für G05-Lieferstand ersetzt durch `origin/main@21a23567d51e` und Customer-Code vom 2026-09-25 |
| `02_app/docs/project/MASTERPLAN.md` auf `origin/main` | 2026-09-10 | `2E021EAEA22B` | GÜLTIG | — |
| `02_app/docs/project/NON_LOSS_REGISTER.md` auf `origin/main` | 2026-09-10 | `0FEA83C9CDF8` | GÜLTIG | — |
| `02_app/docs/project/linie/MODULKARTE_KANON.md` auf `origin/main` | 2026-09-21 | `68FCCB2AB17E` | GÜLTIG | — |
| `02_app/docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` auf `origin/main` | 2026-09-21 | `96C91AB9210F` | GÜLTIG | maßgebliche Repo-Kopie; D-UI-V5-003 gilt |
| `00_BIBEL/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` | 2026-09-21 | `10122CDBB5F2` | ÜBERHOLT | Repo-Kopie `96C91AB9210F` gemäß OP-01 und Auftrag |
| `02_app/docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md` auf `origin/main` | 2026-09-15 | `7421775EA5E5` | GÜLTIG | — |
| `02_app/docs/project/linie/ui/00_UI_REFERENZ_KANONISCH.md` auf `origin/main` | 2026-09-10 | `5AD0F70AB796` | GÜLTIG | durch D-UI-V5-003/Owner-Präzisierungen begrenzt |
| `02_app/docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json` auf `origin/main` | 2026-09-21 | `CDB573268ABB` | GÜLTIG | — |
| `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` auf `origin/main` | 2026-09-14 | `75258FF3BD4C` | GÜLTIG | Grundsystem-/Ablaufreferenz; keine Demo-Daten oder Mock-CSS übernehmen |
| `02_app/docs/project/linie/ui/KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html` auf `origin/main` | 2026-09-06 | `8B655B19B5DB` | GÜLTIG | Informationsarchitektur; durch MODULKARTE und D-UI-V5-003 begrenzt |
| `02_app/missions/F1_ORDER_TO_CASH_PILOT_001.yml` auf `origin/main` | 2026-09-21 | `FD918EA4F729` | GÜLTIG | Missionsstand vor Customer-Merge; Code-Lieferstand für G05 ist neuer |
| `02_app/src/modules/customers/customers.manifest.json` auf `origin/main` | 2026-09-25 | `63F9F9BA042C` | GÜLTIG | — |
| `02_app/src/modules/customers/public.ts` auf `origin/main` | 2026-09-25 | `737CFE48C6A0` | GÜLTIG | — |
| `02_app/src/modules/customers/server-public.ts` auf `origin/main` | 2026-09-15 | `66F5F8D431D9` | GÜLTIG | — |
| `02_app/src/modules/customers/server/createCustomerCommand.ts` auf `origin/main` | 2026-09-15 | `991696E616AE` | GÜLTIG | — |
| `02_app/supabase/migrations/20260914100000_path1_customer_persistence_contract.sql` auf `origin/main` | 2026-09-15 | `0FD379886555` | GÜLTIG | nicht remote ausführen; nur Ist-Beleg |
| `02_app/src/app/actions/customers.actions.ts` auf `origin/main` | 2026-09-15 | `09E90F661B94` | GÜLTIG | Updatepfad darin ist bewusst `NOT_AVAILABLE` |
| `02_app/src/app/customers/CustomersAppAdapter.tsx` auf `origin/main` | 2026-09-25 | `29054864491E` | GÜLTIG | funktionaler Ist-Beleg; visuell umzubauen |
| `02_app/src/app/customers/CustomerCardAppAdapter.tsx` auf `origin/main` | 2026-09-14 | `C04F613B41CD` | GÜLTIG | funktionaler Ist-Beleg; visuell umzubauen |
| `02_app/src/modules/customers/ui/CustomerCardView.tsx` auf `origin/main` | 2026-09-16 | `5F6D5BB6FEFB` | GÜLTIG | funktionaler Ist-Beleg; visuell umzubauen |
| `02_app/src/components/layout/GlobalCreateFlow.tsx` auf `origin/main` | 2026-09-24 | `D9E7976D7FF7` | GÜLTIG | Customer-Anlage real; Felder/Dubletten unvollständig |
| `02_app/src/modules/customers/__tests__/CustomerSurfaces.v2.test.tsx` auf `origin/main` | 2026-09-25 | `79C3071191A6` | GÜLTIG | — |
| `02_app/src/modules/customers/__tests__/createCustomerCommand.test.ts` auf `origin/main` | 2026-09-15 | `E72EB254D38B` | GÜLTIG | — |
| `02_app/src/test/path1_customer_persistence.integration.test.ts` auf `origin/main` | 2026-09-15 | `8B4DD31A65FB` | GÜLTIG | — |
| `02_app/src/test/path1_customers_read_states.test.tsx` auf `origin/main` | 2026-09-25 | `7161B683B749` | GÜLTIG | — |
| `02_app/e2e/path1-ui-convergence-v5-global-create.spec.ts` auf `origin/main` | 2026-09-24 | `D8CDD026FEE3` | GÜLTIG | — |
| `02_app/src/components/erfassung/shared/DuplicateWarning.tsx` auf `origin/main` | 2026-08-04 | `5C3DCF8499C6` | ÜBERHOLT | nicht verdrahteter Legacy-Bestand; ersetzen durch freigegebenen G05-Port nach Q-G05-001 |
| `02_app/src/app/api/erfassung/customer-search/route.ts` auf `origin/main` | 2026-08-10 | `088388E91906` | ÜBERHOLT | liefert `notAvailable`; öffentliche G05-Reads/kommender Duplicate-Port |
| `02_app/src/components/telefonnotiz/TelefonnotizDesktop.tsx` auf `origin/main` | 2026-08-10 | `EDC329FDE6D9` | ÜBERHOLT | FoundationUnavailable-Stub; sicherer G05/Intake-Vertrag nach Q-G05-003 |
| `02_app/src/app/actions/phoneNotes.actions.ts` auf `origin/main` | 2026-08-10 | `0684A6E7F7D0` | ÜBERHOLT | alle Schreibwege `NOT_AVAILABLE`; später G05 server-public nach Q-G05-003 |
| `02_app/src/app/actions/analyzePhoneNote.ts` auf `origin/main` | 2026-08-10 | `5E383618962C` | ÜBERHOLT | liefert `null`; kein Provider-Fallback |
| `02_app/src/hooks/usePhoneNoteAnalysis.ts` auf `origin/main` | 2026-08-04 | `0AA20A524CBC` | ÜBERHOLT | Mock-/unverdrahteter Hook; kein Produktbeleg |
| `02_app/src/components/telefonnotiz/FloatingParkedCall.tsx` auf `origin/main` | 2026-08-04 | `2E5BADD6E4B3` | ÜBERHOLT | LocalStorage-Legacy; nicht als sichere Telefonnotiz übernehmen |
| `02_app/src/db/schema.ts` auf `origin/main` | 2026-08-11 | `5A581DFAEC15` | GÜLTIG | Schema-Inventar, nicht automatisch freigegebener Produktvertrag |
| `02_app/src/lib/privacy/dsgvoAnonymizer.ts` auf `origin/main` | 2026-05-28 | `DA5E86F464B3` | ÜBERHOLT | nutzt nicht verfügbaren Repository-Updateweg; Q-G05-006 |

## Nicht auffindbare oder bewusst nicht verwendete Quellen

- `02_app/missions/MISSION_TEMPLATE.yml` ist weder auf dem gecachten `origin/main` noch im lokalen Baum vorhanden. Es wurde nicht ersetzt oder erfunden; die aktive Mission wurde geprüft.
- Der Dirty-Worktree und Archivcode wurden nur für die in `08` dokumentierte Vorwissenssuche inventarisiert, nicht als Produktwahrheit übernommen.
- V6-UI-Beschlüsse sowie Anforderungen anderer Zielapps sind verworfen und nicht Bestandteil von G05.

## Aktualitätsurteil

Die aktuellste belegte Produktwahrheit für G05 ist die Kombination aus Owner-Entscheidungen/Anleitung vom 2026-09-26, Kanonstand vom 2026-09-21 und realem Customer-Code auf dem gecachten `origin/main` vom 2026-09-25. Keine offene Frage beruht ausschließlich auf einer älteren Quelle.
