# PATH1 UI Convergence V5 – globales Plus, Kunde, KV und F1.1-Auftrag

Status: `CANDIDATE_EXACT_SHA_CI_PREVIEW_AND_INDEPENDENT_REVIEW_PENDING`

Diese Evidence belegt ausschließlich den sichtbaren Vertikalschnitt globales Plus → Kunde → persistenter KV → bestehender F1.1-Auftrag. Sie behauptet weder einen Gesamt-PASS der UI-Konvergenz noch Merge- oder Produktionsreife.

## Kanonische Gestaltung

- Ablauf-/Zwischenschritt-Referenz: `docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`
- SHA-256: `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`
- Seitenwahrheiten bleiben die vier in `docs/project/linie/00_UI_REFERENZEN_PFADE.md` gebundenen Einzelreferenzen.
- Keine HTML-Demodaten und keine Provider-, KI-, OCR-, Mail- oder Sprachfunktion wurden in den Produktpfad übernommen.

## Reale Vertragskette

Der Browserlauf `e2e/path1-ui-convergence-v5-global-create.spec.ts` verwendet auf einer frisch zurückgesetzten lokalen Supabase-Instanz zwei klar synthetische, fest konfigurierte AppUser-IDs: Rolf mit der technischen Rolle `meister` und Phillip mit der technischen Rolle `werkstatt`. Der signierte Session-Actor wird nach jeder PIN-Anmeldung gegen genau diese ID geprüft. Rollen allein erzeugen keine sichtbare Produktidentität.

1. PIN-Anmeldung über `/start`; der vom Server signierte HttpOnly-Sessionwert wird für den lokalen HTTP-Transport unverändert mit `secure=false` weiterverwendet. Payload und Signatur werden nicht erzeugt oder verändert.
2. Das globale orange Plus öffnet auf Desktop die Wahl. `Kunde anlegen` erreicht im zweiten Klick das fokussierte erste Eingabefeld.
3. `createCustomerAction` persistiert den Kunden. Erfolg wird erst nach Customer-Receipt und Customer-Readback gezeigt. Kundenkarte, Kundenliste und Reload lesen denselben Kunden zurück.
4. `createQuoteAction` persistiert einen KV mit echter Kundenreferenz, Position, Menge, Material, Oberfläche, Preis, Termin und Notiz. Nach Reload wird der KV erneut aus dem kanonischen Read-Port geladen.
5. `convertQuoteToOrderAction` bestätigt den Zuschlag idempotent und erzeugt genau einen verknüpften Auftrag über den bestehenden F1.1-Vertrag. Quote-Conversion-Receipt und F1.1-Order-Receipt werden angezeigt.
6. `/orders/[id]` liest den kanonischen Anfangszustand `station=wareneingang`, `status=angenommen` als dieselbe V8-Auftragskarte und bietet den Rückweg nach `/orders`.
7. Phillip erreicht die Werkstatt-Startseite ohne Anlegen-Schaltfläche. Der Browserlauf bietet dort keinen Customer-/KV-/Auftrag-Command an.

Persistenzzählung nach dem Browserlauf: genau ein passender Kunde, ein KV, ein `QUOTE_CREATED_V1`, ein `QUOTE_AWARDED_V1`, ein Conversion-Receipt, ein Auftrag und ein `ORDER_INTAKE_CREATED_V1`.

## Receipt-Readback des lokalen PASS-Laufs

- Customer receipt: `965b7e22-2f00-421d-bbc8-6f203f84e83c`; Event: `12bbcb33-152b-4b0b-aa66-a1540cf2e21f`
- Quote `KV-2026-0006`; Quote receipt: `0d898bba-e450-41d8-a18b-046339792cb6`; Event: `98b5e26a-366b-4738-8343-19e817562fc0`
- Conversion receipt: `9fd95a97-2263-472a-be60-c57af1edf816`; Event: `3a94fa36-cf14-4faf-92ee-86d0f2bc35cd`
- Auftrag `A-2026-0005`; die Zählung im Real-DB-Readback belegt genau ein `ORDER_INTAKE_CREATED_V1` für diesen Auftrag.
- Actor: klar synthetischer lokaler Rolf/Meister-Nutzer; keine Production- oder Remote-Daten.

## Browserbelege der gebauten App

Die Bilder wurden aus dem lokal gebauten Production-Client erzeugt; Public-Supabase-URL und DB waren vor Build und Lauf auf `127.0.0.1` gebunden. Kein Dev-Overlay und kein Production-/Remote-Datenzugriff.

| Zustand | Viewport | Lokales Artefakt | SHA-256 |
| --- | --- | --- | --- |
| Produktprofile auf `/start` | 1914×917 | `test-results/path1-v5-global-create/v5-start-identities-desktop-1914x917.png` | `2d4a5c903a49b233c677bce33f7213ee66eeabfdfd71d75c0cf9033a105e3d58` |
| Rolf, leerer Datenstand | 1914×917 | `test-results/path1-v5-global-create/v5-rolf-empty-desktop-1914x917.png` | `785ce8e051c5e9ede8a31c72583dfd2bbc97411e40d83788c21f6f5d845a71f2` |
| Rolf, Wareneingang-Readback | 1914×917 | `test-results/path1-v5-global-create/v5-rolf-intake-readback-desktop-1914x917.png` | `e753fc107d4dffa35298ce60914fcbfbb0b4cb0b400cab3e5582607b5ea8f0ca` |
| Rolf, operative Daten | 1220×880 | `test-results/path1-v5-global-create/v5-rolf-data-tablet-1220x880.png` | `cc65c57efd165b4da8ccfc5f80ff8a7c2e595b156c0880b24bf90202009b6244` |
| Rechnungen in der Ziel-Shell | 1024×768 | `test-results/path1-v5-global-create/v5-invoices-target-shell-1024x768.png` | `7eb5509db0e56a9d44fcf7092a26618b82ca8e810a107f7c575e1ff4a4d4777d` |
| Globales Plus / Auswahl | 1024×768 | `test-results/path1-v5-global-create/v5-global-plus-desktop-1914x917.png` | `8c2edec6bb37d93bc9048d11b7d8a4367c22e87ed20128d24ba11cf577b7440d` |
| Manuelles KV-Formular | 768×1024 | `test-results/path1-v5-global-create/v5-kv-form-tablet-768x1024.png` | `d67d28d5db2467851ec55681f04b2f139ca22643e1a94fc310778d84b7514f46` |
| Persistierter KV nach Reload | 390×844 | `test-results/path1-v5-global-create/v5-kv-readback-mobile-390x844.png` | `b5ca0951a9af73f17e97d9f180e6d859ef37a70872a814357ed8eafd39d86e6c` |
| Quote- und Auftrags-Readback | 390×844 | `test-results/path1-v5-global-create/v5-order-receipts-mobile-390x844.png` | `454c946e5ca8ac468737e1541a6ff0333bf5cd1d05f4dfd623058e49ca5fed22` |
| Phillip, begrenzter Werkstattzugang | 390×844 | `test-results/path1-v5-global-create/v5-phillip-limited-mobile-390x844.png` | `927fa52714b2a8680f2b4a34b890a5aac061a18f033099ebcd5b5f793346eddc` |

Der Test prüft für jeden Screenshot zusätzlich `scrollWidth <= clientWidth`; Plus, Dialog und Aktionen bleiben damit ohne horizontalen Überlauf erreichbar.

## D-RES-001 und Negativverträge

Die fokussierten Komponententests belegen Validierungsfehler, Konflikt, unklaren Netz-/Serverausgang, stabilen `clientEventId` bei expliziter Wiederholung, erhaltene Eingaben, ausbleibenden falschen Erfolg, Readonly-Denial, Fokusführung und Escape. Die Real-DB-Verträge belegen Replay, Intent-/Versionskonflikte, Tenant-Isolation und exakt eine Order-Konvertierung.

## Lokale Gates

- Fresh Supabase Reset bis `20260914110000_path1_quote_persistence_contract.sql`: PASS
- WU1 Customer + WU2 Quote→F1.1: 2 Dateien, 10/10 Tests PASS
- F1.3 Live Card einschließlich `wareneingang/angenommen`, Receipt-Inkonsistenz, Stationsalias und Fremdtenant: 9/9 PASS
- Global-Create-Komponententest: 6/6 PASS
- Production Build mit lokal eingebetteten Public-Werten: PASS
- Production-Browser-E2E ohne feste Wartezeit und mit Actor-ID-Abgleich: 1/1 PASS (26,8 s)

Exact-SHA-CI, Preview und unabhängiger Review bleiben das nächste Gate.
