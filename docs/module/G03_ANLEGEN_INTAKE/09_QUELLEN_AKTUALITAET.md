<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Quellen und Aktualität

Prüfgrenze ist der lokal vorhandene Tracking-Snapshot `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`. `git fetch origin` konnte nicht ausgeführt werden, weil die geschützte `.git`-Struktur read-only ist; `git ls-remote` scheiterte an gesperrtem SSH-Port 22. Daher sind Aussagen zu `origin/main` exakt für diesen Snapshot belegt, nicht für einen möglicherweise neueren Remote-Stand.

| Pfad | Datum | SHA-256 (12) | Status | ersetzt durch |
|---|---|---|---|---|
| `../00_ANLEITUNG_MODULDOSSIER.md` | 2026-09-26 | `893D264A026A` | GÜLTIG | — |
| `AUFTRAG_DOSSIER.md` | 2026-09-26 | `7B1FACC83B24` | GÜLTIG | — |
| `../00_PROJEKT/OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` | 2026-09-26 | `F04B248EE23D` | GÜLTIG | — |
| `../00_PROJEKT/REDTEAM_BUILDER_2026-09-26.md` | 2026-09-26 | `4369457A4C5A` | GÜLTIG | — |
| `../00_PROJEKT/PLAN_JETZT_BIS_LIVEGANG_2026-09-25.md` v1.1 | 2026-09-26 | `F7C6CA06FF9B` | GÜLTIG | — |
| `../00_PROJEKT/00_OFFENE_PUNKTE_KREILE.md` | 2026-09-26 | `7C92FEBC4A8F` | GÜLTIG | — |
| `../00_PROJEKT/QUELLEN/00_QUELLENREGISTER.md` | 2026-09-26 | `23640B17DC55` | GÜLTIG | — |
| `../00_PROJEKT/QUELLEN/PRIOR_QUELLEN_EINDEUTIG.md` | 2026-09-26 | `F46163CD3576` | GÜLTIG | — |
| `../00_PROJEKT/QUELLEN/KREILE_MODUL_MINDMAP_2026-08-15.pdf` | 2026-08-15 | `80051E940E72` | GÜLTIG | für Textprüfung durch gleichregistrierte V2-HTML-Quelle ergänzt |
| `../00_PROJEKT/QUELLEN/KREILE_MODUL_MINDMAP_V2_2026-08-15.html` | 2026-08-15 | `B792DEF27F89` | GÜLTIG | — |
| `Temp/kreile_digest/PL_01a0ce4b.md` | 2026-09-25 | `732833CE3190` | ÜBERHOLT | nur Provenienz; Entscheidungen durch Owner-Datei und Repo-Kanon ersetzt |
| `Temp/kreile_digest/KOORD_late.md` | 2026-09-25 | `3856CCF611C8` | ÜBERHOLT | nur Provenienz; Entscheidungen durch Owner-Datei und Repo-Kanon ersetzt |
| `Temp/kreile_digest/KOORD_01a07c58.md` | 2026-09-25 | `33FEB6DBDCCA` | ÜBERHOLT | nur Provenienz; Entscheidungen durch Owner-Datei und Repo-Kanon ersetzt |
| `origin/main:AGENTS.md` | 2026-09-10 | `7A5FBDBEAF29` | GÜLTIG | — |
| `origin/main:docs/project/CURRENT_STATE.md` | 2026-09-10 | `C9B97F3AE164` | GÜLTIG | laufende Codewahrheit zusätzlich am Snapshot geprüft |
| `origin/main:docs/project/MASTERPLAN.md` | 2026-09-10 | `2E021EAEA22B` | GÜLTIG | aktueller 26.09.-Plan präzisiert Reihenfolge/Gates |
| `origin/main:docs/project/DOCUMENT_AUTHORITY.md` | 2026-09-10 | `E1A5D571CCB5` | GÜLTIG | — |
| `origin/main:docs/project/linie/MODULKARTE_KANON.md` | 2026-09-21 | `68FCCB2AB17E` | GÜLTIG | Owner-Entscheidungen 26.09. präzisieren Rollen/Kalender/Zahlung |
| `origin/main:docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md` | 2026-09-15 | `7421775EA5E5` | GÜLTIG | — |
| `origin/main:docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` | 2026-09-21 | `96C91AB9210F` | GÜLTIG | OP-01 bindet diese Kopie einschließlich D-UI-V5-003 |
| `00_BIBEL/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` | 2026-09-21 | `10122CDBB5F2` | ÜBERHOLT | Repo-Kopie `96C91AB9210F` plus D-UI-V5-003 |
| `origin/main:docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` | 2026-09-14 | `75258FF3BD4C` | GÜLTIG | — |
| `KREILE_GESAMTMOCK_V6*` | — | — | VERWORFEN | V5 `75258FF3BD4C` |
| `origin/main:missions/F1_ORDER_TO_CASH_PILOT_001.yml` | 2026-09-21 | `FD918EA4F729` | GÜLTIG | `missions/MISSION_TEMPLATE.yml` fehlt im Snapshot; Mission als Ist-Gate gelesen |
| `origin/main:src/components/layout/GlobalCreateFlow.tsx` | 2026-09-24 | `D9E7976D7FF7` | GÜLTIG | Ist-Beleg; Zielumbau nach `src/modules/erfassung/` |
| `origin/main:src/app/GlobalCreateAppAdapter.tsx` | 2026-09-16 | `2E48304973B6` | GÜLTIG | Ist-Beleg; bleibt dünner HostAdapter |
| `origin/main:src/components/erfassung/OrderIntakePanel.tsx` | 2026-09-15 | `5C0275447321` | GÜLTIG | Ist-Beleg für Receipt/Foto; UI in kanonischen G03-Flow konsolidieren |
| `origin/main:src/lib/server/commands/orderIntakeCommand.ts` | 2026-09-14 | `0409B46490A4` | GÜLTIG | Ist-Beleg; V2-Vertrag ergänzt Wunsch/Zusage/Eingang/Zahlung |
| `origin/main:src/lib/server/orderIntakeRead.ts` | 2026-09-14 | `A221D5DA2FD6` | GÜLTIG | Ist-Beleg; Ziel-Readback erweitern |
| `origin/main:src/modules/customers/server/createCustomerCommand.ts` | 2026-09-15 | `991696E616AE` | GÜLTIG | Ist-Beleg; Adresse/Notiz im Public-Vertrag ergänzen |
| `origin/main:src/modules/quotes/server/quoteCommands.ts` | 2026-09-16 | `B4EE0EB9CF28` | GÜLTIG | — |
| `origin/main:src/modules/customers/customers.manifest.json` | 2026-09-25 | `63F9F9BA042C` | GÜLTIG | — |
| `origin/main:src/modules/quotes/quotes.manifest.json` | 2026-09-16 | `83B48043CD95` | GÜLTIG | — |
| `origin/main:docs/architecture/modules/erfassung.manifest.json` | 2026-08-07 | `B5E2ED819109` | ÜBERHOLT | Ziel `src/modules/erfassung/erfassung.manifest.json`; OCR-Verantwortung geht an M06 |
| `origin/main:supabase/migrations/20260812133649_f1_order_intake_contract.sql` | 2026-08-13 | `1A9D69BA9647` | GÜLTIG | nur vorwärts migrieren |
| `origin/main:supabase/migrations/20260905201850_f1_5_payment_mode_intake_contract.sql` | 2026-09-06 | `4D61ED0800DF` | GÜLTIG | OE-2609-07/11 verlangt Zielerweiterung der Command-Regel |
| `origin/main:supabase/migrations/20260914100000_path1_customer_persistence_contract.sql` | 2026-09-15 | `0FD379886555` | GÜLTIG | nur vorwärts migrieren |
| `origin/main:supabase/migrations/20260914110000_path1_quote_persistence_contract.sql` | 2026-09-15 | `AE82314EB68D` | GÜLTIG | — |
| `origin/main:supabase/migrations/20260916090000_path1_quote_product_lifecycle.sql` | 2026-09-16 | `DA29633EAB78` | GÜLTIG | — |
| `origin/main:src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx` | 2026-09-18 | `D32EFC869C76` | GÜLTIG | Teilbeleg, kein Gesamt-E2E |
| `origin/main:src/test/f1_order_intake.integration.test.ts` | 2026-09-06 | `B82BFCD5CC8D` | GÜLTIG | Teilbeleg |
| `origin/main:src/test/path1_customer_persistence.integration.test.ts` | 2026-09-15 | `8B4DD31A65FB` | GÜLTIG | Teilbeleg |
| `origin/main:src/test/path1_quote_to_order.integration.test.ts` | 2026-09-16 | `5D1AB9418F8C` | GÜLTIG | Teilbeleg |
| `00_BIBEL/.../sources/01_PROZESSABLAUF_WERKSTATT_APP.md` | 2026-09-01 | `A246C57C60EA` | GÜLTIG | als durch `PRIOR_QUELLEN_EINDEUTIG.md` bestätigte Vorwissensquelle; spätere Owner-Regeln gehen vor |
| `00_BIBEL/.../KREILE_USER_TWIN_MICHAEL.md` | 2026-09-01 | `CF6366711D3C` | GÜLTIG | als Vorwissensquelle für schnellen Telefon-/Wareneingang; sichtbare Personen durch OE-2609-02 ersetzt |

## Aktualitätsurteil

- **Aktuell und bindend:** Auftrag/Nachträge, Anleitung 1.1, Owner-Entscheidungen, 26.09.-Plan/OP/Red-Team, Repo-Kanon im benannten Snapshot und V5.
- **Nur Herkunft, nicht Steuerung:** Chat-Digests; sie wurden auf bereits beantwortete Punkte durchsucht, aber durch konsolidierte Owner-/Kanon-Dateien ersetzt.
- **Altquellen:** nur über die priorisierte Vorwissensliste und nur dort verwendet, wo keine spätere Entscheidung widerspricht (schneller Wareneingang, kein langes Formular, Foto-Hinweis).
- **Code-Ist:** Kern-Transaktion, Idempotenz, Nummernlock, Kunde/KV, Receipts und Foto-Evidenz existieren; Rollenmodell, vollständige Kundendaten, Zielzahlung, Eingangsart, Wunsch/Zusage-Doppelung, Katalogmodus, kanonische Foto-Integration, Offline und vollständige Zustands-/Responsive-Abnahme fehlen ganz oder teilweise.
