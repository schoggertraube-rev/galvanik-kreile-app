<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G04 · Ist-Code und Umbau

## Ausgangspunkt

Autoritative Codebasis dieser Prüfung ist `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`. Der lokale Branch/Worktree wurde ausschließlich gelesen, nicht geändert, gestaged, gestasht, resettet oder committed. Bestehende produktive Daten werden in diesem Dossier weder gelesen noch verändert; Test-/Beispieldaten sind nur als synthetische Bestände zulässig.

| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |
|---|---|---|---|---|---|
| `src/app/orders/page.tsx` | dünne Listenroute | GEBAUT | bleibt | origin/main; PR #111 | Nur Adapter rendern; keine Fachlogik hinzufügen. |
| `src/app/orders/[id]/page.tsx` | dünne Detailroute | GEBAUT | bleibt | origin/main; PR #111 | Stabile URL/Deep-Link behalten, auch wenn V5 die Karte als Overlay zeigt. |
| `src/app/orders/OrdersAppAdapter.tsx` | Session, Read, Suchzustand, Listenkomposition | GEBAUT mit Mock-Treue | umbauen auf Designsystem | SHA `F51F61217195…`; OE-2609-03; T-02 | Echte Reads und Sessionzustände erhalten; Mockklassen/-layout entfernen; Such-/Filter-/Scrollzustand und sieben Zustände belegen. |
| `src/app/orders/OrderCardAppAdapter.tsx` | Detailread und Command-Orchestrierung | GEBAUT | ersetzen durch Modul | SHA `86068952275E…`; D-ARCH-008 | Als dünne Hostkomposition erhalten, Fachreads/-commands nur über `src/modules/orders/server-public.ts` (FEHLT) führen; feste Rollenchecks durch Person-Capabilities ersetzen; `AUSGANG_UNGEKLÄRT` explizit führen. |
| `src/modules/orders/ui/OrderCardView.tsx` | Auftragskarte | GEBAUT, Teilmenge V8 | umbauen auf Designsystem | SHA `E3E2AC44E2A3…`; V8/V5 | Reale Felder und Zustände erhalten; Terminblock, Verlauf, Teileaktionen ergänzen; keine generelle Fotopflicht, keine Demo-Teile, keine doppelten Überschriften. |
| `src/modules/orders/ui/OrderQueueRow.tsx` | kompakte Auftragszeile | GEBAUT | umbauen auf Designsystem | Modulbestand; OE-2609-03 | Kanonischen Termin und nächste Handlung aus Read-DTO, keine eigene Risiko-/Datumstruth. |
| `src/modules/orders/ui/OrderStationAttachmentPanel.tsx` | Dokument-/Fotoanzeige | GEBAUT | ersetzen durch Modul | D-ARCH-008; Datenbesitz im Evidenz-Fundament | Öffentlichen Evidenz-Referenzport nutzen; keine kopierten Dokumentmetadaten. |
| `src/modules/orders/ui/orders.module.css` | mocknahe Modulstyles | GEBAUT | umbauen auf Designsystem | SHA `B1A10ED5B60D…`; RT-25/RT-28 | Nach `kr-`-Freigabe Tokens/Komponenten verwenden; keine HTML-Mockklasse als Vertrag. |
| `src/styles/mock/mock-kreile-compat.css` | globale Mock-Kompatibilität | Legacy | entfällt für G04 | Plan T-13; OE-2609-03 | G04-Imports entfernen; Datei nur im separat freigegebenen Cleanup löschen, nicht in diesem Dossierauftrag. |
| `src/modules/orders/domain/orderLifecycleContract.ts` | vier Zustände und Übergänge | GEBAUT | bleibt | D-ARCH-010; F1.2 | Keine internen Galvanikstationen ergänzen. |
| `src/modules/orders/domain/buildOrdersHomeProjection.ts` | Start-/Werkstattprojektion | GEBAUT | bleibt | Test SHA `C2607F7E3DBC…` | Termin-/Konfliktfakten ergänzen; Zuständigkeitsanzeige im Host, keine fiktive Kapazität. |
| `src/modules/orders/domain/getUrgency.ts` | Dringlichkeit aus Terminstatus | GEBAUT | ersetzen durch Modul | bestehende Fail-closed-Tests | Auf eine kanonische `due_date`-Projektion und explizite Missing-Reasons begrenzen; keine Legacy-Doppelwahrheit. |
| `src/modules/orders/server/types.ts` | DTOs für List/Card/Home | GEBAUT | bleibt | SHA `AC30C3F2CA75…` | Schedule-, Konflikt- und KPI-Fakt-DTOs additiv ergänzen; Quellen-/Missing-Reason-Felder vorsehen. |
| `src/modules/orders/public.ts` | öffentliche UI-/Domain-Fassade | GEBAUT | bleibt | SHA `CB35CF82E90E…` | Nur client-sichere Typen/Komponenten exportieren; keine Server-/DB-Abhängigkeiten hineinziehen. |
| `src/modules/orders/server-public.ts` | serverseitige Fassade | FEHLT | ersetzen durch Modul | D-ARCH-008; Q-G04-008 | Neu innerhalb des bestehenden Moduls; kapselt Reads/Commands, kein neuer Provider oder Datenbesitz. |
| `src/modules/orders/orders.manifest.json` | Moduldeklaration | GEBAUT, sachlich unvollständig | ersetzen durch Modul | SHA `ED89E729F100…`; leere Besitz-/Eventlisten | Nach Q-G04-008 reale Tabellen-/Event-/Portbezüge deklarieren; kein Gate durch falsche Leereinträge bestehen lassen. |
| `src/modules/orders/capability.manifest.json` | Fähigkeiten | FEHLT | ersetzen durch Modul | OE-2609-09 | Additiv im bestehenden Modul anlegen; Capability-Namen aus `04` übernehmen. |
| `src/modules/orders/INTEGRATION_HANDSHAKE.json` | angebotene/benötigte Ports | FEHLT | ersetzen durch Modul | D-ARCH-008 | Fail-closed-Verhalten, Eventversionen und M04-Asynchronität deklarieren. |
| `src/app/actions/orders.actions.ts` | App-Actions für Reads/Commands | GEBAUT | ersetzen durch Modul | Ist-Code | Route darf dünne Server-Actions behalten, aber Implementierung ruft ausschließlich `src/modules/orders/server-public.ts` (FEHLT) auf. |
| `src/lib/server/commands/orderIntakeCommand.ts` | Annahme, Nummer, Receipt/Readback | GEBAUT | ersetzen durch Modul | SHA `0409B46490A4…`; Advisory-Locks belegt | Verhalten unverändert hinter Modulfassade übernehmen; keine Neuimplementierung der Nummernlogik. |
| `src/lib/server/commands/orderStationCommand.ts` | Statusübergang `angenommen → galvanik` | GEBAUT | ersetzen durch Modul | `origin/main:src/lib/server/commands/orderStationCommand.ts`; `ORDER_STATION_MOVED_V1` | Schrittweise hinter G04-Fassade kapseln. |
| `src/lib/server/commands/orderFreezeCommand.ts` | Statusübergang `galvanik → fertig` und Freeze | GEBAUT | ersetzen durch Modul | `origin/main:src/lib/server/commands/orderFreezeCommand.ts`; `ORDER_FROZEN_V1` | Schrittweise hinter G04-Fassade kapseln. |
| `src/lib/server/commands/recordGoodsOutCommand.ts` | Warenausgang/Abholung `fertig → abgeholt` | GEBAUT | ersetzen durch Modul | `origin/main:src/lib/server/commands/recordGoodsOutCommand.ts`; `ORDER_PICKED_UP_V1`/`ORDER_PICKED_UP_V2` | Schrittweise hinter G04-Fassade kapseln; G07-Gate bleibt Fremdport, keine Kopie. |
| `src/lib/server/orderIntakeRead.ts` und Order-Reads | Auftragsreadmodelle | GEBAUT | ersetzen durch Modul | Ist-Code | Eine kanonische DTO-Abbildung; Tenant-/Integrity-Checks erhalten. |
| `src/db/schema.ts` | Drizzle-Baseline | ÜBERHOLT gegenüber Migrationen | bleibt als generierter/zentraler Hostbestand | SHA `5A581DFAEC15…`; neuere Migrationen | Nach additiver Migration synchronisieren; nicht als alleinige Wahrheit für F1.5 verwenden. |
| `supabase/migrations/` (acht exakte Vertragsdateien in `09_QUELLEN_AKTUALITAET.md`) | Intake, Lifecycle, Mehrarbeit, Freeze, Zahlungs-/Warenausgangsverträge | GEBAUT | bleibt | Exakte Pfade und Hashes in `09_QUELLEN_AKTUALITAET.md` | Keine bestehende Migration umschreiben; Fresh Replay muss grün bleiben. |
| neue additive Migration `pickup_due_date` + Schedule-Event-Vertrag | Abholtermin/Terminänderung | FEHLT | ersetzen durch Modul | OE-2609-13/-21 | Nur neue Migration; in diesem Auftrag nicht erstellen/ausführen. Vorher read-only Legacy-Termindifferenzbericht, keine automatische Konfliktauflösung. |
| `orders.promised_due_date`-Nutzung in Legacy-Analyse | alte Zusageterminquelle | Legacy | entfällt | Schema/Ist-Suche; OE-2609-21 | M02 konsumiert künftig `getOrderTimelinessFacts`; bis Q-G04-001 keine Daten löschen. |
| `src/lib/demoDataGenerator.ts` und sonstige Demo-/Mock-Orderquellen | synthetische Entwicklungshilfe | Legacy | entfällt aus Produktpfaden | Produktwahrheit; RT-19 | Falls für isolierte Tests behalten, klar synthetisch und niemals Produktionsfallback oder Seed für Abnahme. |
| `src/modules/orders/__tests__/OrderSurfaces.v8.test.tsx` | Oberflächen-/Contract-Regression | GEBAUT | bleibt | SHA `17910CEEFEDA…` | Auf sieben Zustände, Designsystem und neue Termin-Gates erweitern; Mock-CSS-Erwartungen entfernen. |
| `src/modules/orders/__tests__/buildOrdersHomeProjection.test.ts` | Homeprojektion | GEBAUT | bleibt | SHA `C2607F7E3DBC…` | Konfliktfakten/Zuständigkeit ergänzen; keine Kapazität ohne Regel. |
| `src/lib/server/commands/__tests__/orderIntakeCommand.test.ts` | Intake/Receipt/Idempotenz | GEBAUT | bleibt | SHA `913A01D7B487…` | Paralleltest gegen echte Fresh-DB ergänzen; keine Mockdaten als Erfolgsbeweis. |

## Migrations- und Umbaufolge

1. Q-G04-008 durch PL bestätigen; Fassaden/Manifeste deckungsgleich machen, ohne bestehendes Verhalten umzuschreiben.
2. Read-only Bericht über `due_date` versus `promised_due_date` erzeugen; nur synthetische Testfälle in CI, Echtdatenprüfung separat autorisieren.
3. Additive `pickup_due_date`-/Schedule-Command-Migration mit Fresh Replay, Roll-forward und fail-closed Readback bauen; keine Remote-Ausführung.
4. Schedule-/KPI-Ports und Tests hinter der Modulfassade ergänzen.
5. Liste/Karte auf Designsystem umbauen; Terminflächen bleiben bis Designphase 1b ausgegraut.
6. Nach Designfreigabe Terminblock/Woche/Monat aktivieren und alle E2E-/Owner-UX-Gates durchlaufen.
7. M04 erst über das separate Transfergate anbinden; G04 bleibt auch ohne M04 vollständig fachlich nutzbar.

## Nicht übernehmen

Keine Lerninsel- oder sonstigen Fremdapp-Begriffe/Zeitsysteme, keine Bäder-/Gestell-/Timerlogik, keine V6-Vorlage, keine Demo-Aufträge, keine M365-Credentials, keine zweite Kalender- oder Terminwahrheit und keine vorhandenen lokalen Branchänderungen als Kanon.
