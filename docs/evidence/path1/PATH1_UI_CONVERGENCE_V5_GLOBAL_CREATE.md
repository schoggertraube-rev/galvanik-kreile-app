# PATH1 UI Convergence V5 – globales Plus, Kunde, KV und F1.1-Auftrag

Status: `CANDIDATE_EXACT_SHA_CI_PREVIEW_AND_INDEPENDENT_REVIEW_PENDING`

Diese Evidence belegt ausschließlich den sichtbaren Vertikalschnitt globales Plus → Kunde → persistenter KV → bestehender F1.1-Auftrag. Sie behauptet weder einen Gesamt-PASS der UI-Konvergenz noch Merge- oder Produktionsreife.

## Kanonische Gestaltung

- Ablauf-/Zwischenschritt-Referenz: `docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`
- SHA-256: `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`
- Seitenwahrheiten bleiben die vier in `docs/project/linie/00_UI_REFERENZEN_PFADE.md` gebundenen Einzelreferenzen.
- Keine HTML-Demodaten und keine Provider-, KI-, OCR-, Mail- oder Sprachfunktion wurden in den Produktpfad übernommen.

## Reale Vertragskette

Der Browserlauf `e2e/path1-ui-convergence-v5-global-create.spec.ts` verwendet einen klar synthetischen lokalen Testnutzer mit Rolle `buero` und einen klar synthetischen Nutzer mit Rolle `readonly` im Testtenant `galvanik-kreile`.

1. PIN-Anmeldung über `/start`; der vom Server signierte HttpOnly-Sessionwert wird für den lokalen HTTP-Transport unverändert mit `secure=false` weiterverwendet. Payload und Signatur werden nicht erzeugt oder verändert.
2. Das globale orange Plus öffnet auf Desktop die Wahl. `Kunde anlegen` erreicht im zweiten Klick das fokussierte erste Eingabefeld.
3. `createCustomerAction` persistiert den Kunden. Erfolg wird erst nach Customer-Receipt und Customer-Readback gezeigt. Kundenkarte, Kundenliste und Reload lesen denselben Kunden zurück.
4. `createQuoteAction` persistiert einen KV mit echter Kundenreferenz, Position, Menge, Material, Oberfläche, Preis, Termin und Notiz. Nach Reload wird der KV erneut aus dem kanonischen Read-Port geladen.
5. `convertQuoteToOrderAction` bestätigt den Zuschlag idempotent und erzeugt genau einen verknüpften Auftrag über den bestehenden F1.1-Vertrag. Quote-Conversion-Receipt und F1.1-Order-Receipt werden angezeigt.
6. `/orders/[id]` liest den kanonischen Anfangszustand `station=wareneingang`, `status=angenommen` als dieselbe V8-Auftragskarte und bietet den Rückweg nach `/orders`.
7. `readonly` erhält im Dialog eine verständliche Denial-Meldung und den sicheren Profilwechsel; kein Customer-/Quote-/Order-Command wird angeboten.

Persistenzzählung nach dem Browserlauf: genau ein passender Kunde, ein KV, ein `QUOTE_CREATED_V1`, ein `QUOTE_AWARDED_V1`, ein Conversion-Receipt, ein Auftrag und ein `ORDER_INTAKE_CREATED_V1`.

## Receipt-Readback des lokalen PASS-Laufs

- Customer receipt: `16e3b434-4217-466e-b48b-fd541b663c20`; Event: `8c4fbb1a-789b-4369-a4cb-341a4fe84a03`
- Quote `KV-2026-0009`; Quote receipt: `2e73aaac-3fe6-4b68-89fe-d29c8251c86a`; Event: `aef4a65a-dadb-4779-b7ae-20c8aec87fc5`
- Conversion receipt: `fcf21a9e-8e35-4862-acaa-31ea1fab93a8`; Event: `9d8a0c4a-3be3-40ab-85fa-9d5446220816`
- Auftrag `A-2026-0007`; F1.1 receipt: `e10815bc-bb8b-464b-9069-37f535ec6680`; Event: `5ab55492-46b4-40f2-908d-de4b6ca72f95`
- Actor: `b544150d-59bd-4214-b854-264d9106b7d5` (synthetischer lokaler Büro-Nutzer)

## Browserbelege der gebauten App

Die Bilder wurden aus dem lokal gebauten Production-Client erzeugt; Public-Supabase-URL und DB waren vor Build und Lauf auf `127.0.0.1` gebunden. Kein Dev-Overlay und kein Production-/Remote-Datenzugriff.

| Zustand | Viewport | Lokales Artefakt | SHA-256 |
| --- | --- | --- | --- |
| Globales Plus / Auswahl | 1914×917 | `test-results/path1-v5-global-create/v5-global-plus-desktop-1914x917.png` | `a750f2c835c87395a9f03e44280a89b40f6b6305fdb74d13b6660a6f6aa53d6e` |
| Manuelles KV-Formular | 768×1024 | `test-results/path1-v5-global-create/v5-kv-form-tablet-768x1024.png` | `108b9fedb64245442570c10e83ddcdaed21135015b73de64dc1461b15fda66fe` |
| Persistierter KV nach Reload | 390×844 | `test-results/path1-v5-global-create/v5-kv-readback-mobile-390x844.png` | `c6bf78e229cd55d47c990ec88c41415380718f3ccbcafcf73fcd7ab90cb80904` |
| Quote- und F1.1-Receipts | 390×844 | `test-results/path1-v5-global-create/v5-order-receipts-mobile-390x844.png` | `68ec4be5363ffa1ab34e374a3bca9833360186d144afa2f8b8c47f3509090ed6` |
| Readonly-Denial | 390×844 | `test-results/path1-v5-global-create/v5-create-denied-mobile-390x844.png` | `53a3f67b1264ed88fc7103336aa67d1f4dc3c0a1917792ba73fcfd154e73d7b1` |

Der Test prüft für jeden Screenshot zusätzlich `scrollWidth <= clientWidth`; Plus, Dialog und Aktionen bleiben damit ohne horizontalen Überlauf erreichbar.

## D-RES-001 und Negativverträge

Die fokussierten Komponententests belegen Validierungsfehler, Konflikt, unklaren Netz-/Serverausgang, stabilen `clientEventId` bei expliziter Wiederholung, erhaltene Eingaben, ausbleibenden falschen Erfolg, Readonly-Denial, Fokusführung und Escape. Die Real-DB-Verträge belegen Replay, Intent-/Versionskonflikte, Tenant-Isolation und exakt eine Order-Konvertierung.

## Lokale Gates

- Fresh Supabase Reset bis `20260914110000_path1_quote_persistence_contract.sql`: PASS
- WU1 Customer + WU2 Quote→F1.1: 2 Dateien, 10/10 Tests PASS
- F1.3 Live Card einschließlich `wareneingang/angenommen`, Receipt-Inkonsistenz, Stationsalias und Fremdtenant: 9/9 PASS
- Global-Create-Komponententest: 6/6 PASS
- Production Build mit lokal eingebetteten Public-Werten: PASS
- Production-Browser-E2E: 1/1 PASS

Exact-SHA-CI, Preview und unabhängiger Review bleiben das nächste Gate.
