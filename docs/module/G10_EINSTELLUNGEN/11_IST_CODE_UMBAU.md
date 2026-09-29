<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 11 — Ist-Code und Umbau

Inventargrundlage ist die vorhandene `origin/main`-Referenz. „entfällt“ ist eine Bau-Disposition nach Import-/Linkprüfung, keine in diesem Dossier ausgeführte Löschung. Bestandsdaten werden nie still migriert, zusammengeführt oder verworfen.

| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |
|---|---|---|---|---|---|
| `src/app/settings/page.tsx` | dünner `/settings`-Einstieg | geroutet | bleibt | `B832C15AC2ED` | nur AppAdapter rendern; keine Fachlogik ergänzen |
| `src/app/settings/SettingsAppAdapter.tsx` | Actorauflösung, Redirect, rendert Fundamentstatus | produktiv für Gregor/fail-closed | bleibt | `D5C04CD018C6` | G10-Fassade typisiert komponieren; Rolf/Phillip nur nach effektiver Capability, keine Tiefimporte |
| `src/app/settings/__tests__/SettingsAppAdapter.test.tsx` | Adapter-/Redirecttests | vorhanden | bleibt | `277ABB0D5C9D` | G10-Ports, Capability und Teilportfehler ergänzen |
| `src/app/settings/SettingsClient.tsx` | alte tabbasierte Adminoberfläche | nicht geroutet; Alt-Design/alte Permissions | entfällt | `16ED263EE398` | nicht reaktivieren oder als Bauziel stylen; verwertbare Begriffe nur gegen Dossier prüfen |
| `src/modules/fundament/ui/SystemAdminView.tsx` | Gregors realer Sessionstatus und Links | geroutet, fachlich schmal | umbauen auf Designsystem | `B8A41F340E55` | Sessionstatus bleibt Fundament; als G10-Karte über öffentliche Fundament-Fassade komponieren, nicht mit G10-Datenbesitz vermischen |
| `src/modules/fundament/ui/SystemAdminView.module.css` | aktuelle Statusansicht-Stile | Path-1-Stil, aber kein vollständiges G10 | umbauen auf Designsystem | `93ACC6AA9089` | nach Phase 1 `kr-` nutzen; keine parallelen Tokens |
| `src/modules/fundament/fundament.manifest.json` | Fundamentexports/-capabilities | vorhanden, keine Settings-/Rechteadmin-Ports | bleibt | `21F42C421462` | nur G01-eigene persönliche Capability-Ports ergänzen; G10 bekommt eigenes Manifest |
| `src/modules/settings/` | G10-Fachmodul, Manifest, Fassade, UI, Server, DB-Referenzen | fehlt | ersetzen durch Modul | Path 1 `7421775EA5E5`; Schema `94962E694CBB` | neu innerhalb freigegebener Modulstruktur; keine G10-Dateien außerhalb außer Page/AppAdapter |
| `src/components/admin/CompanySettingsForm.tsx` | altes Firmenformular | deaktiviert/`NOT_AVAILABLE`-Pfad | ersetzen durch Modul | `20CD3BC45659` | keine Default-/Demo-Firma übernehmen; Bestandszeile über G10-Readport prüfen |
| `src/app/actions/company.actions.ts` | alte Company-Actions | alle Writes `NOT_AVAILABLE` | ersetzen durch Modul | `4EF939453DB3` | serverseitiger G10-Command mit Tenant, Version, Idempotenz, Audit, Receipt, Readback |
| `src/lib/repositories/companySettingsRepository.ts` | alter Firmen-Repositorytyp | liest nur Teilfelder, F1.4-Felder fehlen | ersetzen durch Modul | `A88636ADE966` | aktive DB-Projektion vollständig typisieren; Mehrfach-/Nullzeile fail-closed |
| `src/components/admin/UserManagement.tsx` | alte Benutzerverwaltung | Read möglich, Mutationen deaktiviert | ersetzen durch Modul | `B7DD7E8701AF` | Personenidentität bleibt G01; keine parallele Benutzer-/Rechtewahrheit |
| `src/components/admin/RoleMatrix.tsx` | feste Rollenmatrix | read-only, fachlich von OE-2609-09 überholt | entfällt | `452D9E016E19` | durch persönliche `inherit/allow/deny`-Sicht ersetzen; Altrollen nur Kompatibilitätsinput |
| `src/lib/auth/authorizationContract.ts` | feste serverseitige Rollen-/Aktionsmatrix | aktive G01-Sicherheitsbasis | bleibt | `3C4AD281A2C9` | persönliche Policy serverseitig davor/darauf eindeutig integrieren; Client nie Autorität |
| `src/lib/auth/PermissionsContext.tsx` | clientseitige Permissionsanzeige | aktive UI-Hilfe | bleibt | `B9C676B0A90B` | nur effektiven Serverreadback spiegeln; kein Sicherheitsgate im Client |
| `src/db/schema.ts#app_users` | Personen, Rolle, Tenant, aktiv | vorhanden; keine persönliche Capability-Policy | bleibt | `5A581DFAEC15` | Personendaten bewahren; neue G01-Policy nicht in JSON oder Rollenstring verstecken |
| `src/db/schema.ts#feature_flags` | globale Flags plus Rollenliste | vorhanden; keine persönliche Rechtewahrheit | bleibt | `5A581DFAEC15` | nicht als Ersatz für Q-G10-002 verwenden |
| `src/db/schema.ts#company_settings` | Firmen-, Bank- und Textfelder | vorhanden, ohne F1.4-Spalten/Version/Actor im Drizzlemodell | ersetzen durch Modul | `5A581DFAEC15`; F1.4 `BE493C63FD88` | aktive Migrationen sind Wahrheit; additive G10-Version/Audit, Bestandszeile vorher prüfen |
| `supabase/migrations_legacy/0013_company_settings.sql` | Legacy-Tabelle/-Policy | nicht aktive Legacyquelle; breite Policy | entfällt | `0C9F33A93210` | niemals replayen oder RLS übernehmen; keine Bestandsdatenaktion aus dieser Datei |
| `supabase/migrations/20260821152949_f1_4_immutable_invoice_contract.sql` | Firmenpflichtfelder, VAT/Zahlungsziel, Rechnungssnapshot und `R-`-Allocator | gebaut | bleibt | `BE493C63FD88` | nicht rückwirkend ändern; additive G10-Migration muss F1.4-Tests grün halten |
| `src/app/actions/__tests__/w2cCompanySettings.failClosed.test.ts` | Firmenstammdaten fail-closed | vorhanden | bleibt | `1791038F7B74` | um genau-eine-Zeile, Updateversion und G10-Readback erweitern |
| `supabase/migrations/20260820133000_f1_3_extra_work_contract.sql` | Mehrarbeitskatalog, Stundensatz, Views, Receipts | gebaut | bleibt | `3A38310E5E57` | keine Tabelle duplizieren; G10 konsumiert Views/Commands über Modulnaht |
| `src/lib/server/commands/extraWorkAdminCommand.ts` | Katalog-/Satz-Admincommands | gebaut | ersetzen durch Modul | `458B7C330605` | fachliche Logik erhalten und in besitzendes Modul/Fassade überführen; Receipt-Semantik beibehalten |
| `src/app/actions/price-lines.actions.ts` | `price_lines` lesen; Writes deaktiviert | kein allgemeiner Katalogcommand | entfällt | `812CFA99015A` | nicht für G10 reaktivieren; `price_lines` sind auftragsbezogen |
| `src/db/schema.ts#items` | auftragsbezogene Teile/Positionen | vorhanden; kein Katalogstamm | bleibt | `5A581DFAEC15` | nicht als G10-Masterkatalog umdeuten; Q-G10-005 |
| `src/db/schema.ts#price_agreements` | alte Kundenpreisabsprache | vorhanden, schwach typisiert | ersetzen durch Modul | `5A581DFAEC15` | Besitz G05/G07 klären; kein G10-Direktwrite |
| `src/db/schema.ts#price_lines` | auftrags-/itembezogene Preiszeilen | vorhanden | bleibt | `5A581DFAEC15` | G07/Orders-Wahrheit; kein Katalogersatz |
| `src/lib/server/commands/orderIntakeCommand.ts#allocateOrderNumber` | erzeugt `A-` mittels `MAX+1` im Transaktionspfad | gebaut, RT-15-Risiko | bleibt | `0409B46490A4` | gegen parallele Vergabe testen und erforderlichenfalls DB-atomaren Allocator additiv bauen; G10 bleibt read-only |
| `supabase/migrations/20260812133649_f1_order_intake_contract.sql` | Intake-Receipt und `A-`-Formatcheck | gebaut | bleibt | `1A9D69BA9647` | Format bewahren; Sequenzread/Allocator nicht aus Receipt erfinden |
| `supabase/migrations/20260905201850_f1_5_payment_mode_intake_contract.sql` | `payment_mode` und Änderungsvertrag | gebaut, erlaubt freie `rechnung` | bleibt | `4D61ED0800DF` | G05-Kundenfreigabe additiv server-/DB-seitig härten; Bestandsmodi inventarisieren |
| `src/lib/server/paymentContract.ts` | Zahlungsmodi/-methoden und Gates | gebaut, vor OE-2609-11 | ersetzen durch Modul | `D103D05E7CB8` | G07-Fassade mit Zielrechnungsfreigabe und Policyversion; keine Rückwirkung auf Snapshots |
| `src/lib/payments/paymentProvider.ts` | generischer Payment-Intent-Port mit Tap-to-Pay-Fähigkeit | Interface vorhanden | ersetzen durch Modul | `2B8A037B8C73` | als Salvage für späteren M01-`PaymentAdapter`; erst nach Q-G10-009 endgültig typisieren |
| `src/lib/payments/mollieAdapter.ts` | deaktivierter Mollie-Stub | immer `NOT_AVAILABLE`, kein Tap-to-Pay | entfällt | `CB7EEF25D933` | nicht als Providererfolg oder Terminal wiederverwenden; echter Adapter nach Owner-Gate |
| `src/db/schema_buchhaltung.ts` | altes Buchhaltungs-/Kosten-/Planmodell | Schattenmodell, nicht aktive OE-2609-24-Wahrheit | entfällt | `0CF94EC8FF7F` | keine `kostenposten`/Gehaltsdetails übernehmen; neue Struktur erst nach Q-G10-008 |
| `src/db/schema.ts#payments` | providerbezogene Shadow-Payments | nicht kanonischer F1.5-Zahlungsweg | entfällt | `5A581DFAEC15` | nicht für Terminal/Bank verwenden; G07-Command bleibt Zahlungswahrheit |

## Bestandsdaten-Gates vor jedem G10-Write

1. Firmenstammdaten: Anzahl je Tenant, Pflichtfeldleeren, F1.4-Spalten, Dubletten und Rechnungssnapshots nur lesend inventarisieren; keine automatische Zusammenführung.
2. Rechte: vorhandene Rollen, Feature-Flags und effektive Servermatrix dokumentieren; persönliche Policy additiv und Default `inherit` einführen, ohne Zugriff still zu entziehen.
3. Zahlung: bestehende `payment_mode=rechnung`-Aufträge inventarisieren; neue Kundenfreigabe nur für künftige Entscheidungen erzwingen, historische Receipts/Snapshots nicht umschreiben.
4. Katalog: Extra-Work-Daten behalten; `items`, `price_lines`, `price_agreements` nicht verschmelzen.
5. Nummern: `A-`-/`R-`-Eindeutigkeit und Jahre prüfen; niemals Nummern neu vergeben oder Lücken aus G10 schließen.
6. Aufbewahrung/Liquidität: keine Migration aus `schema_buchhaltung.ts`; neue Tabellen/Views erst nach Q-G10-007/008 und ausdrücklichem Migrationsgate.
