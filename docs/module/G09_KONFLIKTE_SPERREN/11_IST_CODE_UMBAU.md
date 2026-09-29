<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 11 — IST-Code und Umbau

Bewertung ausschließlich gegen `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`. „Bleibt“ bedeutet erhalten und regressionssicher anbinden, nicht in diesem Dossierauftrag geändert.

| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |
|---|---|---|---|---|---|
| `src/lib/server/authorization.ts` und Session-/Capability-Pfade | serverseitige Actor-/Tenant-/Rollenprüfung | gebaut | **bleibt** | F0/F1; A-G09-001 | G09 nutzt nur autorisierte Besitzer-Ports; keine Clientrolle als Wahrheit. |
| `src/lib/server/commands/orderStationCommand.ts` | atomarer Stationsübergang mit Version, Idempotenz, Receipt | gebaut und belegt | **bleibt** | SHA `9E835B092419` | Nicht duplizieren; Konfliktdarstellung um Result/Readback ergänzen. |
| `src/modules/orders/domain/orderLifecycleContract.ts` | kanonische Folge `angenommen → galvanik → fertig → abgeholt` | gebaut | **bleibt** | origin/main Ist-Code | Status nicht als Termin-, Zahlungs- oder Kapazitätswahrheit umdeuten. |
| `src/lib/server/commands/orderTaskAssignmentCommand.ts` | auftragsbezogene Zuweisung/Rückgabe | gebaut und belegt | **bleibt** | SHA `C54C5C1D299C`; F1.3 | Nur bestehende Felder verwenden; keine Erwartung/Frist/Rückgabegrund vortäuschen. |
| `src/lib/server/orderTaskAssignmentRead.ts` und `private.v_order_task_assignment_v1` | gemeinsamer Assignment-Readback | gebaut | **bleibt** | SHA `F16FFE473254`; Migration `69A198974BE3` | Für Rollenfeed über Orders-server-public kapseln. |
| `src/lib/server/commands/recordGoodsOutCommand.ts` | Warenausgang mit Lifecycle-/Payment-Gate | gebaut | **bleibt** | SHA `C9D55BBB2DD3` | Sperrgrund aus Command/Payment Summary übernehmen; G07-Kunden-Ausnahme nicht lokal erfinden. |
| `src/lib/server/paymentSummaryRead.ts` und Payment Views | kanonischer Zahlungs-/Goods-out-Read | gebaut | **bleibt** | SHA `B0A8B8C936F7`; F1.5 | Nur `integrity_ok`-Read verwenden; `UNAVAILABLE` fail-closed. |
| weitere F1-Commands für Extra Work, Freeze, Invoice, Payment Mode/Receipt | versionierte, idempotente Fachänderungen | gebaut | **bleibt** | CURRENT_STATE/F1-Evidenz | Konfliktadapter darf nur verlinken, nicht Regeln nachbauen. |
| `supabase/migrations/20260807090000_f0_05_rls_contract_hardening.sql` | tenantgebundene RLS-Härtung | angewandt/belegt laut CURRENT_STATE | **bleibt** | SHA `D7DF069F7312`; F0-Evidenz | Keine Remote-Migration in diesem Auftrag. |
| Event-/Receipt-/Freeze-/Invoice-/Assignment-Immutable-Trigger | UPDATE/DELETE/TRUNCATE-Schutz | gebaut | **bleibt** | F0/F1-Migrationen | Regressionstest bei jeder Migration. |
| `src/modules/orders/domain/getUrgency.ts` | klassifiziert überfällig sowie heute/morgen als `kritisch/gefaehrdet` | gebaut, semantisch zu grob | **umbauen auf objektive Fristlabels** | SHA `9EDFEDF24DCF`; A-G09-014 | `morgen` ist keine belegte Gefährdung; Berlin-Zeitzone explizit machen. |
| `src/modules/orders/domain/buildOrdersHomeProjection.ts` | sortiert Orders-Priorität und dominante Karte | gebauter Kandidat; Zielhome nicht geliefert | **umbauen/teilen** | SHA `337B8DE72B00`; CURRENT_STATE | Reine Orders-Projektion behalten, generische Konflikte über neutralen Vertrag; risk-Freitext nicht als Wahrheit. |
| `src/modules/orders/public.ts` | browser-sichere Orders-Fassade | gebaut | **bleibt und gezielt erweitern** | origin/main | Neutrale UI-/Domainexports; server-only Read nicht hier importieren. |
| geplantes `src/modules/orders/server-public.ts` | begrenzter Conflict-Facts-Port | fehlt | **ergänzen innerhalb Orders-Modul** | `04` Vertrag | Nur autorisierte Read-Fakten; keine DB-Typen/privaten Views nach außen. |
| `src/modules/accounting/public.ts` | Accounting-UI-Fassade | gebaut | **bleibt; server-only Fassade ergänzen** | origin/main | Payment Conflict Facts aus bestehendem Read kapseln. |
| `src/modules/customers/server-public.ts` | server-only Kunden-Fassade | gebaut | **bleibt und gezielt erweitern** | origin/main | Nur explizite Dubletten-/Kontaktdatenfakten; keine Fuzzy-Autofusion. |
| `src/modules/fundament/public.ts` | browser-sichere Grundlagen-Fassade | gebaut | **bleibt und um neutralen G09-Vertrag ergänzen** | origin/main | Nur DTO/Validator/Sortier-/Deduplogik; keine Kreile-Begriffe und keine IO. |
| `src/modules/werkstatt/*`, `werkstatt.manifest.json` | geliefertes Werkstatt-Innenmodul mit View/Loading | Innenmodul geliefert, Shell offen | **bleibt; auf Designsystem und Ports anbinden** | CURRENT_STATE; S4 | Bestehende echte Projektion bewahren; WIP ehrlich benennen; G09-Hinweise via Props/Public Port. |
| `src/app/warendurchlauf/page.tsx` | Route zum Werkstatt-Innenmodul | vorhanden, Gesamt-Shell nicht abgenommen | **umbauen auf Designsystem/AppAdapter** | CURRENT_STATE; Provider-Matrix | Keine private G09-Logik in Route; nur Komposition. |
| `src/app/page.tsx` | aktuelle Root-/Home-Komposition | vorhanden, Ziel-Rollenhome NOT_DELIVERED | **ersetzen durch Ziel-AppAdapter innerhalb G02** | CURRENT_STATE; D-UI-CORE-002 | Rolf/Phillip-Feed aus Public-Ports; Settings separat. |
| `src/components/home/RolfHome.tsx` und `RolfHomeClient.tsx` | Legacy-Rolf-Startseite | vorhanden, nicht Zielwahrheit | **ersetzen durch Modul/auf Designsystem neu bauen** | CURRENT_STATE; Rolf V8 | Nur belegte Nicht-UI-Logik nach Einzelprüfung salvagen; keine CSS-Reparatur. |
| `src/components/home/WerkstattHome.tsx` | Legacy-Phillip-/Werkstatt-Home | vorhanden, nicht Zielwahrheit | **ersetzen durch Modul/auf Designsystem neu bauen** | CURRENT_STATE; Phillip V4 | Target-Werkstatt-Innenmodul verwenden; keine parallele Wahrheit. |
| `src/components/home/ImportantTodayPanel.tsx` | Legacy-Heute-Panel | vorhanden | **ersetzen durch Rollenfeed-Modul** | Import-/UI-Befund | Kein zweites Aufgabenboard; Konfliktkarten aus Besitzer-Ports. |
| `src/components/home/HomeKpiCard.tsx` | KPI-Karte auf Home | vorhanden | **entfällt auf Rollenstartseiten** | OE-2609-22 | Falls Analyse später kommt, eigenes Modul; nicht nach G09 verschieben. |
| `src/components/home/DayTimeline.tsx` | Legacy-Tages-/Kalenderdarstellung | vorhanden, Provider nicht real | **ersetzen durch CalendarPort-Projektion** | OE-2609-19; D-ARCH-011 | Kein Lesen von `calendar_events` als Zielwahrheit; bis M04 „In Aufbau“. |
| `src/app/__tests__/w2cB2m5u.homeDueTruth.realRender.test.tsx` | prüft vorhandene Home-Due-Truth | vorhanden | **umbauen/erweitern** | origin/main | Neue Rollen-/Frist-/Zustandsverträge testen; Test ist kein Ziel-UI-Beleg. |
| `src/components/home/__tests__/RolfHome.realRender.test.tsx` | Legacy-Rolf-Renderbeleg | vorhanden | **ersetzen durch Zielhome-Tests** | origin/main | V8/G09 auf allen drei Geräten plus Zustände prüfen. |
| `src/lib/warnings/engine.ts` | generische Expression-/Cooldown-Engine | Altcode, keine produktive Fachquelle | **entfällt nach T-13-Linkprüfung** | SHA `EAEFDE4097CB`; Red-Team | Nicht reaktivieren; erforderliche Regeln in Besitzer-Ports neu bauen. |
| `src/lib/warnings/ruleRegistry.ts` | 18 hardcodierte Archivregeln | Altcode, `isActive`, nicht kanonisch | **entfällt nach T-13-Linkprüfung** | SHA `ECB588B55B86`; Disposition `05` | Keine Schwelle übernehmen, solange nicht aktuell belegt. |
| `src/lib/warnings/store.ts` | Browser-Local-Storage-Warnzustand | Altcode/Schattenwahrheit | **entfällt nach T-13-Linkprüfung** | SHA `C8F1041C0A09` | Konflikte lösen sich aus Owner-Readback, nicht lokaler Bestätigung. |
| `src/lib/warnings/hooks.ts` | React-Hooks auf Legacy-Store | Altcode | **entfällt nach T-13-Linkprüfung** | Importgraph-Befund | Nicht an neue UI anbinden. |
| `src/components/warnings/WarningBell.tsx` | Glocke für Legacy-Warnungen | vorhanden, nicht in Produktkomposition gerendert | **entfällt/ersetzen durch Rollenbereiche** | SHA `6A89623F1798`; Red-Team | Keine globale Glocke als zweites Backlog. |
| `src/components/warnings/WarningDrawer.tsx` | Drawer für Legacy-Warnungen | nur von Bell referenziert | **entfällt** | SHA `EF12C2ACAE43`; Red-Team | Keine Altregel-UI übernehmen. |
| `src/types/warnings.ts` | Legacy-Warntypen | nur Legacy-Paket | **entfällt nach Linkprüfung** | origin/main | Durch neutralen `ConflictItemV1` ersetzen, ohne Expression/Cooldown-Produktwahrheit. |
| `src/lib/hardware/printQueue.ts` | simulierte lokale Printqueue, schreibt Legacy-Warning-Store | Legacy/simuliert | **entfällt aus G09-Graph; separat quarantänisieren** | Importgraph; Produktwahrheit | Kein Hardwarefehler in G09, solange kein realer Provider/Receipt existiert. |
| `src/db/schema.ts::orders` | Inventar mit Version, `dueDate`, `promisedDueDate` | vorhanden; zwei Terminspalten | **bleibt, aber Besitzervertrag klären** | SHA `5A581DFAEC15`; Q-G09-007 | G09 liest nur `committedDueAt` aus Orders-Port; keine lokale Priorisierung. |
| `src/db/schema.ts::items.surfaceRequested` | Freitext-Oberflächenwunsch | vorhanden | **bleibt; nur manuellen Hinweis ableiten** | SHA `5A581DFAEC15` | Gleiches Freitextlabel ist keine technische Kompatibilität. |
| `src/db/schema.ts::calendarEvents` / `public.calendar_events` | Legacy-interne Kalenderzeilen | vorhanden und RLS-gehärtet, aber nicht Zielarchitektur | **entfällt als G09-/Ziel-Kalenderquelle** | D-ARCH-011; MODULKARTE | Nicht löschen in diesem Auftrag; kontrollierte spätere Disposition/Migration separat. |
| `private.order_task_assignment_state` und Views | auftragsbezogene Assignment-Wahrheit | gebaut | **bleibt** | Migration SHA `69A198974BE3` | Kein generisches Konflikt-/Snooze-Modell hineininterpretieren. |
| `public.events` und private Receipt-Views | unveränderliche Domainereignisse/Readback | gebaut | **bleibt** | F0/F1 | Geplante Terminänderung nutzt dasselbe Aggregat-/Receipt-Muster. |
| Microsoft-365-`CalendarPort` | Kalenderprojektion/Provideradapter | fehlt, `M365_NOT_CONNECTED` | **ersetzen durch Modul** (M04) | Provider-Matrix; D-ARCH-011; OE-2609-18/19 | Keine Implementierung/Secrets in G09; echtes Provider-E2E ist Gate. |
| Kapazitätsmodell/-grenzen | Bedarf, Verfügbarkeit, Schwellen | **kein Codefund** | **entfällt bis Q-G09-001; dann eigenes freigegebenes Besitzerpaket** | Red-Team; Repo-Suche 2026-09-26 | WIP-Zahl nicht als Kapazität labeln. |
| Bündelungslogik | automatische Gruppierung/Optimierung | **kein Codefund** | **nur read-only Prüfhinweis ergänzen** | Register; Phillip V4 | Keine Optimierung, Ersparnis, Kompatibilität oder Auto-Write. |
| generische G09-Tabelle/Warning-Tabelle | Konfliktpersistenz | fehlt | **entfällt** | D-RES-001 | Absichtlich nicht anlegen; Konflikte bleiben Projektion. |

## Umbau-Reihenfolge

1. Bestehende Sperr-/Receipt-/Readback-Tests einfrieren und grün halten.
2. Neutralen Contract in Fundament und begrenzte server-only Besitzer-Ports ergänzen.
3. Objektive Fristprojektion und Kreile-Zuständigkeitsadapter bauen; keine Kapazitätsprognose.
4. G02-Rollenflächen auf V5/Rolf V8/Phillip V4 und das Designsystem umsetzen.
5. WIP und manuelle Bündelprüfung read-only anbinden.
6. M365-Anteile erst nach M04-Gate integrieren.
7. Legacy-Warning-Paket in T-13 nach Importgraph-/Reviewerbeleg entfernen; nie still wiederverwenden.
