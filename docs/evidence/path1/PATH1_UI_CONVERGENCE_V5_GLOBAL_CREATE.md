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

- Customer receipt: `b18988a1-b104-4ecb-8d38-d77666302b35`; Event: `835cde30-5d7f-4176-909d-9b88c537ccf4`
- Quote `KV-2026-0006`; Quote receipt: `9b8bd2ea-47d4-4f3b-ad00-d01b5174a552`; Event: `bb7ee8fd-8156-4202-b1e4-2bc8d2a190e1`
- Conversion receipt: `14570a5e-1eed-4471-b9fc-9fec9e3b7365`; Event: `92051ac4-32d5-47e9-960e-32c5ed998bfa`
- Auftrag `A-2026-0004`; F1.1 receipt: `5c76f439-940b-4c5f-985b-2358d558cf7d`; Event: `69a33c9a-6d37-4662-b464-e5dfcaa4b7b0`
- Actor: `b2a435d1-0f72-4314-adce-2acc4cc1e0cc` (synthetischer lokaler Büro-Nutzer)

## Browserbelege der gebauten App

Die Bilder wurden aus dem lokal gebauten Production-Client erzeugt; Public-Supabase-URL und DB waren vor Build und Lauf auf `127.0.0.1` gebunden. Kein Dev-Overlay und kein Production-/Remote-Datenzugriff.

| Zustand | Viewport | Lokales Artefakt | SHA-256 |
| --- | --- | --- | --- |
| Globales Plus / Auswahl | 1914×917 | `test-results/path1-v5-global-create/v5-global-plus-desktop-1914x917.png` | `53161086b496c23d3bf2196413d3a1f987acbff8a3e56503c796dd7f1d826bd5` |
| Manuelles KV-Formular | 768×1024 | `test-results/path1-v5-global-create/v5-kv-form-tablet-768x1024.png` | `95cf82bc6b6230259e772e42c51d054180230670b893b6a7d02a960ddac2d52c` |
| Persistierter KV nach Reload | 390×844 | `test-results/path1-v5-global-create/v5-kv-readback-mobile-390x844.png` | `bf8ed5b06073609c6751562e01820ddef00e2e4010fc6d3c082fdfa111fdbec2` |
| Quote- und F1.1-Receipts | 390×844 | `test-results/path1-v5-global-create/v5-order-receipts-mobile-390x844.png` | `81833d93c214b10f73acd3777b412ecba9795c6f42e100f5a2e93d4ea2ea9d8f` |
| Readonly-Denial | 390×844 | `test-results/path1-v5-global-create/v5-create-denied-mobile-390x844.png` | `507a4b6e8aeb5fe27ad518e7bfc75edc526a116be1ff3e52b021e2081982e262` |

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
