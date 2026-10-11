<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G04 · Quellen und Aktualität

## Prüfstand

Geprüfte Repo-Lieferwahrheit ist der lokal vorhandene Remote-Ref `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9` (Commitdatum 2026-09-25). Ein read-only Remote-Abgleich per `git ls-remote` war am 2026-09-26 wegen gesperrtem SSH-Netzzugriff nicht möglich; deshalb sind Änderungen nach diesem Ref nicht behauptet. Die Projektsteuerung beschreibt den lokalen Ordner als Dirty-Worktree auf `feature/capture-auth-tenant`; tatsächlich festgestellt wurden Branch `path1/v2-k4-geld`, HEAD `e477e6b2314d5a97575a32dc35ca0d16b55625d7` und ein leerer `git status --short`. Dieser Widerspruch ändert die Regel nicht: Der lokale Branch ist nicht autoritativ und wurde nur gelesen, nie verändert.

| Pfad | Datum | SHA-256 (12) | Status | ersetzt durch |
|---|---|---|---|---|
| `_MODULDOSSIERS/00_ANLEITUNG_MODULDOSSIER.md` | 2026-09-26 | `893D264A026A` | GÜLTIG | — |
| `_MODULDOSSIERS/00_PROJEKT/OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` | 2026-09-26 | `F04B248EE23D` | GÜLTIG | — |
| `_MODULDOSSIERS/00_PROJEKT/REDTEAM_BUILDER_2026-09-26.md` | 2026-09-26 | `4369457A4C5A` | GÜLTIG | — |
| `_MODULDOSSIERS/00_PROJEKT/PLAN_JETZT_BIS_LIVEGANG_2026-09-25.md` | 2026-09-26 | `F7C6CA06FF9B` | GÜLTIG | — |
| `_MODULDOSSIERS/00_PROJEKT/00_OFFENE_PUNKTE_KREILE.md` | 2026-09-26 | `7C92FEBC4A8F` | GÜLTIG | — |
| `_MODULDOSSIERS/00_PROJEKT/QUELLEN/PRIOR_QUELLEN_EINDEUTIG.md` | 2026-09-26 | `F46163CD3576` | GÜLTIG | — |
| `_MODULDOSSIERS/00_PROJEKT/QUELLEN/00_QUELLENREGISTER.md` | 2026-09-26 | `23640B17DC55` | GÜLTIG | — |
| `_MODULDOSSIERS/00_PROJEKT/QUELLEN/KREILE_MODUL_MINDMAP_2026-08-15.pdf` | 2026-09-26 | `80051E940E72` | GÜLTIG | Struktur gültig; Termindetails konkretisiert durch OE-2609-13/-19 |
| `_MODULDOSSIERS/00_PROJEKT/QUELLEN/KREILE_MODUL_MINDMAP_V2_2026-08-15.html` | 2026-09-05 | `B792DEF27F89` | DUPLIKAT | PDF-Fassung `KREILE_MODUL_MINDMAP_2026-08-15.pdf` |
| `00_BIBEL/_archiv_2026-09-05/neuer chat zusammenführung/KREILE_PHASE0_HANDOVER/sources/01_PROZESSABLAUF_WERKSTATT_APP.md` | 2026-09-01 | `A246C57C60EA` | ÜBERHOLT | D-ARCH-010 und OE-2609-13/-19; nur Feld-/Alarm-Ursprung als Hinweis |
| `00_BIBEL/_bibel_historie_2026-08/entscheidungen/KREILE_LEITPRINZIP_D-USP-001_ENTLASTUNG_2026-08-20.md` | 2026-09-05 | `851CB7247F97` | GÜLTIG | — |
| `00_BIBEL/_bibel_historie_2026-08/KREILE_BIBEL_V2_2026-08-17/02_PRODUKT_USP_TWINS.md` | 2026-09-05 | `DF0BBDBBF3A8` | ÜBERHOLT | D-USP-001, D-ARCH-010 und Ownerentscheidungen; nur Ursprungskontext |
| `00_BIBEL/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` | 2026-09-21 | `10122CDBB5F2` | DUPLIKAT | Repo-Kopie plus D-UI-V5-003 gemäß OP-01 |
| `02_app/AGENTS.md` aus `origin/main` | 2026-09-10 | `7A5FBDBEAF29` | GÜLTIG | — |
| `02_app/docs/project/DOCUMENT_AUTHORITY.md` aus `origin/main` | 2026-09-10 | `E1A5D571CCB5` | GÜLTIG | — |
| `02_app/docs/project/MASTERPLAN.md` aus `origin/main` | 2026-09-10 | `2E021EAEA22B` | GÜLTIG | Detailplanung durch Plan 2026-09-26 konkretisiert |
| `02_app/docs/project/CURRENT_STATE.md` aus `origin/main`, Tabellenzeile „Orders/Auftragskarte V8“ | 2026-09-10 | `C9B97F3AE164` | ÜBERHOLT | PR #111/`origin/main@21a23567…`; Datei behauptet noch `NOT_DELIVERED` |
| `02_app/docs/project/linie/MODULKARTE_KANON.md` aus `origin/main`, Abschnitt „KANON“, Eintrag „ORDERS — Auftragskarte“ | 2026-09-21 | `68FCCB2AB17E` | GÜLTIG | — |
| `02_app/docs/project/linie/MODULKARTE_KANON.md` aus `origin/main`, Abschnitt „KANON“, Eintrag „KALENDER“ | 2026-09-21 | `68FCCB2AB17E` | ÜBERHOLT | OE-2609-13/-19; Kanon-Abgleich Q-G04-005 |
| `02_app/docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` aus `origin/main` | 2026-09-21 | `96C91AB9210` | GÜLTIG | — |
| `02_app/docs/project/linie/ui/00_UI_REFERENZ_KANONISCH.md` aus `origin/main` | 2026-09-10 | `5AD0F70AB796` | GÜLTIG | V5-Ziel durch D-UI-V5-003/OE-2609-03 konkretisiert |
| `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` | 2026-09-14 | `75258FF3BD4C` | GÜLTIG | Struktur; Designsystem/Stil durch OE-2609-03/-27 |
| `02_app/docs/project/linie/ui/KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html` | 2026-09-06 | `C4F74528ED4D` | GÜLTIG | nur Einzelkontrolle; fachliche Demotexte durch D-UI-V5-003/OE übersteuert |
| `00_BIBEL/MOCK_BAUANLEITUNG_V5.md` | 2026-09-24 | `FDED519ED887` | DUPLIKAT | abgeleitete Textfassung; bei Widerspruch V5-HTML und Ownerentscheidungen |
| `02_app/docs/project/linie/ui/` — `KREILE_GESAMTMOCK_V6_*` FEHLT | 2026-09-26 | `nicht vorhanden` | VERWORFEN | V5 mit Hash `75258FF…`; V6 entfernt und nicht zu verwenden |
| `02_app/src/app/orders/OrdersAppAdapter.tsx` aus `origin/main` | 2026-09-25 | `F51F61217195` | GÜLTIG | Ist-Code; visuell durch Designsystem-Umbau T-02 zu ersetzen |
| `02_app/src/app/orders/OrderCardAppAdapter.tsx` aus `origin/main` | 2026-09-16 | `86068952275E` | GÜLTIG | Ist-Code; Receipt-/Capability-Verhalten nachzuschärfen |
| `02_app/src/modules/orders/ui/OrderCardView.tsx` aus `origin/main` | 2026-09-16 | `E3E2AC44E2A3` | GÜLTIG | Ist-Code; Designsystem-/Terminumbau offen |
| `02_app/src/modules/orders/ui/orders.module.css` aus `origin/main` | 2026-09-25 | `B1A10ED5B60D` | ÜBERHOLT | Kreile-Designsystem nach OE-2609-03/T-02 |
| `02_app/src/modules/orders/server/types.ts` aus `origin/main` | 2026-09-24 | `AC30C3F2CA75` | GÜLTIG | um Schedule-/KPI-Verträge zu ergänzen |
| `02_app/src/modules/orders/public.ts` aus `origin/main` | 2026-09-24 | `CB35CF82E90E` | GÜLTIG | öffentliche Server-Fassade fehlt noch |
| `02_app/src/modules/orders/orders.manifest.json` aus `origin/main` | 2026-09-24 | `ED89E729F100` | ÜBERHOLT | reale Tabellen/Events/Ports nach Q-G04-008 deklarieren |
| `02_app/src/db/schema.ts` aus `origin/main` | 2026-08-11 | `5A581DFAEC15` | ÜBERHOLT | neuere F1.3/F1.5-Migrationen; für Baseline-Felder nur Gegenprüfung |
| `02_app/src/modules/quotes/server/types.ts` aus `origin/main` | 2026-09-16 | `6AFD957CB47C` | GÜLTIG | — |
| `02_app/src/lib/server/commands/orderIntakeCommand.ts` aus `origin/main` | 2026-09-14 | `0409B46490A4` | GÜLTIG | in G04-Server-Fassade zu kapseln |
| `02_app/src/lib/server/commands/__tests__/orderIntakeCommand.test.ts` aus `origin/main` | 2026-09-06 | `913A01D7B487` | GÜLTIG | um echte Parallel-/Fresh-DB-Probe zu ergänzen |
| `02_app/src/modules/orders/__tests__/OrderSurfaces.v8.test.tsx` aus `origin/main` | 2026-09-24 | `17910CEEFEDA` | GÜLTIG | Designsystem-/Sieben-Zustände-Regressionsfälle ergänzen |
| `02_app/src/modules/orders/__tests__/buildOrdersHomeProjection.test.ts` aus `origin/main` | 2026-09-18 | `C2607F7E3DBC` | GÜLTIG | Termin-/Konfliktfakten ergänzen |
| `02_app/supabase/migrations/20260812133649_f1_order_intake_contract.sql` | 2026-08-13 | `1A9D69BA9647` | GÜLTIG | — |
| `02_app/supabase/migrations/20260817120000_f1_2_order_lifecycle_contract.sql` | 2026-08-17 | `0BF7E300A1F9` | GÜLTIG | — |
| `02_app/supabase/migrations/20260820133000_f1_3_extra_work_contract.sql` | 2026-08-21 | `3A38310E5E57` | GÜLTIG | — |
| `02_app/supabase/migrations/20260820140000_f1_3_order_freeze_contract.sql` | 2026-08-21 | `781C3D12EECD` | GÜLTIG | — |
| `02_app/supabase/migrations/20260905100000_f1_5_payment_goods_out_contract.sql` | 2026-09-05 | `04AAF5F4DC3D` | GÜLTIG | durch V2 additiv konkretisiert |
| `02_app/supabase/migrations/20260905201850_f1_5_payment_mode_intake_contract.sql` | 2026-09-06 | `4D61ED0800DF` | GÜLTIG | — |
| `02_app/supabase/migrations/20260909170000_f1_5_payment_goods_out_v2_contract.sql` | 2026-09-09 | `C0C123B3A1F0` | GÜLTIG | — |
| `02_app/supabase/migrations/20260909180000_f1_5_goods_out_ui_read_contract.sql` | 2026-09-09 | `17EE781C8238` | GÜLTIG | — |
| `C:/Users/Traube/AppData/Local/Temp/kreile_digest/PL_01a0ce4b.md` | 2026-09-25 | `732833CE3190` | ÜBERHOLT | Repo-Mergezustand plus OE-2609-03/-09/-13/-19/-21/-27 |
| `C:/Users/Traube/AppData/Local/Temp/kreile_digest/KOORD_late.md` | 2026-09-25 | `3856CCF611C8` | ÜBERHOLT | Owner-Entscheidungsdatei 2026-09-26; fremde Modulideen nicht übernehmen |
| `C:/Users/Traube/AppData/Local/Temp/kreile_digest/KOORD_01a07c58.md` | 2026-09-25 | `33FEB6DBDCCA` | ÜBERHOLT | Repo-Mergezustand plus Owner-Entscheidungsdatei 2026-09-26 |

## Fehlende Governance-Quelle

`missions/MISSION_TEMPLATE.yml` ist im geprüften `origin/main`-Ref FEHLT. Das ist eine Governance-Lücke, keine erfundene G04-Quelle; dieses Dossier leitet daraus keine Gate-Ausnahme ab.
