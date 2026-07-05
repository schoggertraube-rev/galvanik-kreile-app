# 09 · Repository-Kartierung (nachgeholt, Konduktor)

Ersetzt den ausgefallenen `repository-cartographer`. Direkt per Grep/Find am HEAD `204f3f1` erhoben (Rohbelege: `99_AUDIT_INPUT/sweep_A_*.txt`).

## Größenordnung

- **78 Seitenrouten** (`page.tsx`), **18 API-Routen**, **613** Quelldateien.
- Funktionsbreite ist enorm: Buchhaltung (28 Unterrouten inkl. BWA, Belege, Fristen, Periodenabschluss, Steuerprofil), Marketing (10 Routen inkl. Segmente/Attribution/Einwilligungen), Performance (6 Drilldown-Routen), Warendurchlauf, Cockpit, Kommunikation, Telefonnotiz, KVP, Bäder, Lager, Lieferanten.

**Wichtige Konsequenz:** Das ist **kein Fundament mehr, sondern eine breit ausgebaute App**. Für den USP „erst Fundament, dann Module" ist das ein Problem — es wurde in die Breite gebaut, bevor der Kern (Datenpfad/Tenant/Schema) stand. Sehr viele dieser 78 Routen hängen an derselben gebrochenen Verdrahtung.

## Doppelte/parallele Capture-Pfade (bestätigt & präzisiert)

PROJECT_TRUTH nannte „mindestens zwei aktive Capture-Pfade". Real sind es **mindestens vier Einstiegsfamilien**:

| Pfad | Dateien | Zweck |
|---|---|---|
| `components/erfassung/ScanFlow/*` | ScanUpload, ScanResult | Foto→OCR→Ergebnis |
| `components/erfassung/ManualFlow/*` | CustomerSection, CustomerWizard | manuelle Kunden-/Auftragsanlage |
| `components/intake/*` | CameraCapture, IntakeEntry, IntakeCompletionSummary | Kamera-Wareneingang |
| `app/scan/page.tsx` + `orders/variants/ErfassungVariant.tsx` | eigene Scan-Seite + Order-Variante | weitere Einstiege |
| Buchhaltung: `components/buchhaltung/BelegUploadOverlay` | mit **eigenem** `MockOcrProvider` | Belegerfassung |

→ Das verstößt gegen Slice-Regel 1 (genau ein kanonischer Capture-Vertrag). Konsolidierung ist Teil von Welle 4.

## Mock-Vollinventar (deutlich größer als zuvor gemeldet)

Die 3 Kernprüfer fanden die `isSupabase`-Repos. Die Vollkartierung zeigt **zwei weitere Mock-Ökosysteme**:

1. **Buchhaltungs-Mock-Stack** (eigene Provider-Architektur):
   - `lib/buchhaltung/ocr/MockOcrProvider.ts` (wählt Beleg per Dateiname **oder `Math.random`**)
   - `lib/buchhaltung/providers/MockBuchhaltungProvider.ts` (Demo-Daten)
   - `lib/buchhaltung/erechnung/MockERechnungParser.ts`
   - `buchhaltung/einstellungen/page.tsx`: OCR-Anbieter default = `"mock"`
2. **`MockOrder`/`MockCustomer` als faktischer Laufzeit-Typ** in ~7 produktiven Dateien:
   - `app/status/page.tsx`, `app/today/page.tsx`, `hooks/useLiveContext.ts`, `hooks/usePhoneNoteAnalysis.ts`, `components/kommunikation/.../useClientDossier.ts`, `components/entities/CustomerFocusView.tsx`
   - Diese Typen aus `lib/mockData` sind **das Datenmodell**, mit dem die App real arbeitet — echte DB-Daten werden per `as unknown as MockOrder[]` hineingecastet.
3. **UI-Platzhalter-Mocks**: `MOCK_MORAL`/`MOCK_STATISTIK` in `buchhaltung/zahlung`, `alert("... Mock")`-Buttons in `telefonnotiz`, „Foto anhängen (Mock)" in KVP, Fake-Camera-Overlay in CameraCapture.
4. **Ehrliches Signal:** Das Dashboard zeigt pro Aufgabe ein Badge **`LIVE` vs `DEMO`** (`page.tsx:439`) — die App weiß selbst, dass ihre Daten teils Demo sind. Das ist gleichzeitig ehrlich und ein Beleg, dass die Vernetzung unfertig ist.

**Bewertung:** Der Satz „vieles war Mock" ist **untertrieben**. Mock ist strukturell in drei Ebenen verankert (Daten-Repos, Buchhaltungs-Provider, Laufzeit-Typen). Das ist der Kern der fehlenden Vernetzung und muss in Welle 2 systematisch getilgt werden — nicht Datei für Datei, sondern durch Ersetzen der `MockOrder`/`MockCustomer`-Typen durch echte DB-Typen.

## Math.random-Vollinventar (Produktionspfad)

Über die 2 gemeldeten hinaus: `customers.actions.ts:151` (Kundennummer!), `NewCustomerForm.tsx` (Kunden-ID + Dateiname), `NewOrderForm.tsx`, `buchhaltung/belege/neu`, `SuggestedItemsPanel`, `feedbackMailService` (Tokens!), `tracking.ts`, `diagnostics`. → Kundennummern und Sicherheits-Tokens aus `Math.random` sind besonders heikel (Kollision/Ratbarkeit). Regel 17 breit verletzt.

## Git-Drift

- HEAD `204f3f1` (Branch `feature/capture-auth-tenant`) = **9 Commits vor `main`**, unmerged. PROJECT_TRUTH nennt veralteten Prüf-HEAD `5e8b399`.
- Untracked: `.agents/` (647-Datei-Klon), `KREILE_CLAUDE_COWORK_MASCHINERIE/control_plane/`.
- Root-Ballast: `_quarantine/productfirma_legacy_2026-06-22`, `scratch/`, ~15 lose Skripte, `recovered_*.txt`, `curl_output.html`.

## Tote/verdächtige Bereiche (Kandidaten für Aufräumen, nicht bauen)

- `middleware.backup.ts.disabled`, `proxy.ts` (nicht importiert), `GlobalSearch.bak.tsx.ignore`, `PinDialog.tsx` (toter Client-Bypass), `idbSync.ts` (toter Offline-Code).
- Diese gehören in Welle 0 aus dem Scan-Scope/Repo entfernt.
