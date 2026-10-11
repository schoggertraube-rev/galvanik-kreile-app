<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 11 — Ist-Code und Umbau

| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |
|---|---|---|---|---|---|
| `src/modules/accounting/accounting.manifest.json` | Path-1-Modulvertrag | GEBAUT, aber leer bis auf UI-Export | bleibt; reale Capabilities, Migrationen, Views, Events und Dependencies nachführen | SHA `7EE97CA50867`; D-ARCH-009 | keine zweite Manifestdatei; Änderungen gegen Schema/Gate testen |
| `src/modules/accounting/public.ts` | öffentliche Client-/UI-Fassade | GEBAUT minimal | bleibt und wird um G07-UI-Typen erweitert | SHA `C13A20BD1EA4` | Server-only Exporte getrennt in `server-public.ts` |
| `src/modules/accounting/server-public.ts` | öffentliche Server-Fassade | FEHLT | im bestehenden Modul ergänzen | `04` Portvertrag | keine neue Modul-/Datenwahrheit; zyklusfreie Exporte |
| `src/modules/accounting/ui/AccountingEntry.tsx` | einziger G07-Shell-Einstieg | GEBAUT | bleibt | SHA `0CD6A1E88189` | Redirect `/buchhaltung/rechnungen` bleibt; später direkte Modulkomposition möglich |
| `src/app/buchhaltung/rechnungen/page.tsx` | Auth/Read-Komposition der Liste | GEBAUT mit fester Rollenliste | ersetzen durch Modul-Komposition; App-Entrypoint bleibt dünn | SHA `9EAECE968B54`; OE-2609-09 | G01-Personenfähigkeit statt `buero/meister/admin`; keine Fachlogik in Route |
| `src/app/buchhaltung/rechnungen/loading.tsx` | Lade-Skelett | GEBAUT Alt-UI | umbauen auf Designsystem | SHA `87A97386E3FF`; Text belegt | `kr-` nach Phase 1, Text „Rechnungsliste wird geladen“ behalten |
| `src/app/buchhaltung/rechnungen/InvoicesClient.tsx` auf `origin/main` | reale Rechnungs-/Stornoliste | GEBAUT | ersetzen durch Modul-UI und umbauen auf Designsystem | SHA `12F327CB9987`; V5 | Fachlogik/Receiptvergleich ins Modul; echte Daten erhalten; keine Mock-CSS-Klassen |
| gleichnamiger k4-Kandidat auf `path1/v2-k4-geld@e477e6b` | V5-nahe Listenstruktur | OFF_REPO_KANDIDAT | nur gezielt salvagen, nicht als Lieferstand behaupten | SHA `CD2987C3063E`; Branch nicht gemergt | `mock-kreile-*`/`app-*` nicht als DS übernehmen; Tests/Markup einzeln prüfen |
| `src/app/buchhaltung/rechnungen/RechnungenClient.tsx` | ältere parallele Rechnungs-UI | ÜBERHOLT | entfällt nach Import-/Linkprüfung | origin/main SHA `4EAA5F9325D5`; k4-Kandidat löscht Datei | keine Bestandsdaten; Entfernung erst im autorisierten Repo-Auftrag |
| `src/app/buchhaltung/rechnungen/neu/RechnungForm.tsx` | FoundationUnavailable-Stub für neue Rechnung | FEHLT als Produktfunktion | entfällt; Direkt-URL fail-closed/404 | SHA `C0C11E4669AD`; Plan T-13 | Rechnung ausschließlich aus G04-Auftragskarte; kein Ersatzformular |
| `src/app/actions/invoices.actions.ts` | App-Aktionen Ausgabe/Storno/Reads | GEBAUT | ersetzen durch dünnen AppAdapter auf `server-public.ts` | SHA `7AA969843533` | Revalidate darf bleiben; Commands nicht tief importieren |
| `src/app/actions/payments.actions.ts` | App-Aktionen Zahlung/Modus/Ausgang | GEBAUT | ersetzen durch dünnen AppAdapter auf `server-public.ts` | SHA `B26A65C572A8` | Owner-Regeln über Modul/Host-Port, nicht Route duplizieren |
| `src/lib/server/commands/immutableInvoiceCommand.ts` | Rechnungsausgabe und Storno | GEBAUT; App-P0 vorhanden | ersetzen durch Accounting-Modulimplementierung, Logik erhalten/härten | SHA `B26DBD31C08C` | keine Big-Bang-Neuschreibung; DB-P0, 19 Prozent, neue Dokumentverträge additiv; alte Belege unverändert |
| `src/lib/server/commands/confirmPaymentCommand.ts` | manuelle Teil-/Vollzahlung | GEBAUT | ersetzen durch Accounting-Modulimplementierung | SHA `EB7E6DAB283C` | Receipt-/Readback-/Lockreihenfolge beibehalten; Skonto erst nach Q-G07-004 |
| `src/lib/server/commands/setPaymentModeCommand.ts` | Zahlungsmodus ändern | GEBAUT nach altem Vertrag | ersetzen durch Accounting-Modul + G05-Freigabeport | SHA `CEBBD2862421` | Abholung/Vorkasse-Default und serverseitiges `rechnung`-Gate; bestehende Events kompatibel lassen |
| `src/lib/server/commands/recordGoodsOutCommand.ts` | Warenausgang V1/V2 | GEBAUT | über Accounting-Fassade behalten; Kundenfreigabe ergänzen | SHA `C9D55BBB2DD3` | Auftrags-/Item-Mutation bleibt transaktional; keine neue Ausgangstabelle |
| `src/lib/server/invoiceRead.ts` | Invoice Receipts/PDF/Summaries | GEBAUT | ersetzen durch Accounting-Modul-Read-Port | SHA `8ABFC038B204` | bestehende Feldintegrität/tenantgebundene Views erhalten |
| `src/lib/server/paymentSummaryRead.ts`, `paymentContract.ts` | Payment-/Goods-out-Read-Model und Mapping | GEBAUT nach altem freien `rechnung` | ersetzen durch Accounting-Modul-Read-Port und neuen Eligibility-Vertrag | SHA `B0A8B8C936F7`, `D103D05E7CB8` | historische V1/V2-Daten weiter lesbar; neue Kundenfreigabe nicht rückwirkend erfinden |
| `src/app/api/invoices/[invoiceId]/pdf/route.ts` | Original-/Storno-PDF ausliefern | GEBAUT | bleibt als dünner Next-Entrypoint, liest Modul-Fassade | SHA `8514D6D4A9FA` | Auth/Tenant/Hash fail-closed; später ZUGFeRD-Art nur nach Q-G07-001 |
| `src/app/orders/OrderCardAppAdapter.tsx` | sichtbare Rechnung/Zahlung/Ausgang-Komposition | GEBAUT | bleibt als typisierter AppAdapter; auf öffentliche Accounting-Fassade umbauen | SHA `86068952275E` | `payment.mode==='rechnung'` nicht mehr allein als Gate; G01-Fähigkeiten statt feste Rollen |
| `src/modules/orders/ui/OrderCardView.tsx` | einzige Auftragskarte mit G07-Aktionen | GEBAUT | bleibt; auf `kr-`-DS und Zieltexte abstimmen | SHA `E3E2AC44E2A3`; MODULKARTE | G04 besitzt Karte, G07 liefert nur Ports/Modelle; keine zweite Karte |
| `src/modules/werkstatt/ui/WerkstattView.tsx` | `Ware raus`-Picker | GEBAUT | bleibt; konsumiert G07/G04-Port | SHA `FDDC39E25803` | Handyvariante/Designphase ergänzen; nur Station `fertig` |
| `src/components/warenausgang/WarenausgangQueue.tsx` | Legacy-Warenausgang mit Demo-/QR-Annahmen | VERWORFEN | entfällt nach Importprüfung | SHA `EB0DA2AFA1FF`; Red-Team | keine Daten migrieren; keine Demo-Zahlung/Legacy-Station salvagen |
| `supabase/migrations/20260821152949_f1_4_immutable_invoice_contract.sql` | additive Invoice-Wahrheit, Views, Trigger, Nummernkreis | GEBAUT | bleibt; neue additive Migrationen, alte Datei nicht ändern | SHA `BE493C63FD88` | P0-Storno-Trigger in neuer Migration; bestehende irreversible Rechnungshashes nicht ändern |
| vier F1.5-Migrationen in `supabase/migrations/20260905*`/`20260909*` | Payment, Modus, V2-Ausgang und UI-Read | GEBAUT | bleiben; neue Eligibility-/Owner-Regeln additiv versionieren | Hashes in `09` | Fresh-Replay; V1/V2-Events nicht umschreiben; keine Remote-Migration ohne Freigabe |
| `src/app/buchhaltung/actions.ts` | Eingangsbeleg-Listen und DATEV/Lexware-Aktionen | GEBAUT/NOT_AVAILABLE für anderen Scope | für G07 nicht verwenden; M01 zuordnen | SHA `7E0946409913`; Red-Team RT-13 | liest `beleg`, nicht `public.invoices`; Ausgangsexport neu aus kanonischer Wahrheit |
| `src/app/actions/mahnung.actions.ts` | Mahnungs-Stub | FEHLT/NOT_AVAILABLE | entfällt aus G07; später M01-Modul | SHA `1BC467CF66D8`; OE-2609-05 | kein G07-Button/Route außer `Mahnwesen — In Aufbau` |
| übriges `src/app/buchhaltung/**` (Belege, Cockpit, Kosten, Export, Periodenabschluss, Kacheln) | Legacy-/M01-Buchhaltungsflächen | gemischt, nicht G07-Scope | ersetzen durch M01 oder aus G07-Navigation entfernen | MODULKARTE Routendisposition; OE-2609-05 | keine pauschale Löschung in G07-Auftrag; vor späterer Disposition Import-/Dateninventar |
| `src/lib/payments/mollieAdapter.ts` | Paymentprovider-Stub, `supportsTapToPay=false` | FEHLT | ersetzen durch späteren M01-`PaymentAdapter`; nicht in G07 ausbauen | SHA `CB7EEF25D933`; OE-2609-12 | kein Secret/Providerkonto in G07; manueller Weg bleibt |
| `src/db/schema.ts` (`payments`) | Drizzle-Schattenmodell | ÜBERHOLT | nicht als G07-Wahrheit verwenden; spätere Schema-Inventarbereinigung separat | SHA `5A581DFAEC15`; F15A-Kommentar | niemals migrieren/abgleichen ohne Dateninventar und Freigabe |
| `src/db/schema_buchhaltung.ts` (`ausgangsrechnung`, `zahlung`, `erechnung_xml`) | altes Buchhaltungs-Schattenmodell | ÜBERHOLT | nicht verwenden; später M01/Schema-Governance disponieren | SHA `0CF94EC8FF7F` | `erechnung_xml` belegt keine ZUGFeRD-Funktion; keine Bestandsdaten löschen |
| `src/config/license.config.ts` | Capability-Anzeigen, u. a. E-Rechnung „bereit“ | ÜBERHOLT | an realen Capability-/Manifeststatus koppeln | SHA `D47715065BC8`; Red-Team | vor A-G07-025 niemals „bereit“/aktiv zeigen |
| `src/types/customerType.ts` | ältere Customer-/XRechnung-Typen | ÜBERHOLT für G07 | ersetzen durch G05-`CustomerBillingProfilePort` | SHA `FB07AA65A5AD`; Q-G07-003 | keine parallele Kundenfreigabe; Altverwendung inventarisieren |
| Retention-/Ablaufhemmungs-/Anonymisierungs-Command | Aufbewahrung nach OE-2609-20 | FEHLT | über G10-`RetentionPolicyPort` und G01-Audit/Freigabe anbinden; keine G07-Tabelle | OE-2609-20; Q-G07-009 | vor Live Werte und Originalbehandlung extern bestätigen; bis dahin historische immutable Belege weder überschreiben noch löschen; Bestandsinventar vor jeder späteren Migration |
| F1.4/F1.5 Unit-/Integration-/E2E-Tests | reale Verträge und synthetische Fixtures | GEBAUT | bleiben und um Owner-Regeln/P0/ZUGFeRD/Export/DS erweitern | Hashes in `07`/`09` | Testdaten klar synthetisch; keine Production-/Providerbehauptung |

## Umbau-Reihenfolge

1. P0-Storno-DB-Schicht und Fresh-DB-Negativtest, ohne UI-Ausweitung.
2. Accounting-Ownership/Fassaden herstellen, vorhandene Logik stranglerartig verschieben, Schattenpfade per Tests ausschließen.
3. G01-/G05-/G10-Host-Ports und Owner-Zahlungsregeln umsetzen; historische Events/Invoices nur lesen.
4. G07-UI in Designphase 1 auf `kr-` umbauen; eigenständigen Formularstub und parallele UI nach Importprüfung disponieren.
5. ZUGFeRD und Ausgangs-Export erst nach Q-G07-001/002/004/006/007 sowie Steuerberater-Gate.
6. Terminal ausschließlich später über M01-Transfergate.

Es wurde in diesem Dossier weder Code geändert noch eine Migration ausgeführt, ein Provider angelegt oder Bestandsdaten berührt.
