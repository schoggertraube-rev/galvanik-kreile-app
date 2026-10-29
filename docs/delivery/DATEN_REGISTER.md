# Datenregister Dev-DB

Stand: 29.10.2026 · Quelle: verknüpfte Dev-DB, Schemas `public`, `private` und `drizzle`

Klassen: `stammdaten` · `bewegungsdaten` · `system` · `tot`

Das Register klassifiziert jede aktuell in der Dev-DB vorhandene Tabelle der drei Anwendungsschemas genau einmal. Für H17 sind nur ausdrücklich freigegebene `stammdaten` übertragbar. Eine Tabelle gilt nur dann als `stammdaten`, wenn aktiver Stufe-1-Code sie liest; der konkrete Leser steht in der Zusatzspalte. PIN-Werte, Bewegungsdaten, Systemdaten und tote Tabellen werden nicht kopiert.

| Tabelle | Klasse | Begründung | Leser-Nachweis für `stammdaten` |
|---|---|---|---|
| `public.ai_usage_reservations` | `system` | Technische Reservierungen für KI-Nutzung. |
| `public.aktion` | `bewegungsdaten` | Fachliche Marketing-/Aktionsvorgänge. |
| `public.app_kvp_items` | `bewegungsdaten` | Erfasste Verbesserungsfälle der App. |
| `public.app_usage_events` | `system` | Technische Nutzungsereignisse der App. |
| `public.app_user_rights` | `stammdaten` | Freigegebene Rechtezuordnung der Logins. | `src/modules/fundament/server/systemSettingsPort.ts:76` |
| `public.app_users` | `stammdaten` | Login-Stammdaten; PIN-Werte sind von einer Übernahme ausgeschlossen. | `src/modules/fundament/server/systemSettingsPort.ts:75` |
| `public.arbeitszeit_buchung` | `bewegungsdaten` | Zeitbuchungen sind betriebliche Vorgänge. |
| `public.attribution` | `bewegungsdaten` | Zuordnung eines Marketing-/Kundenvorgangs. |
| `public.audit_log` | `system` | Technischer Auditnachweis. |
| `public.ausgangsrechnung` | `tot` | Durch H14 als abgelöste Rechnungswahrheit festgestellt. |
| `public.ausgangsrechnung_position` | `tot` | Positionen der durch H14 abgelösten Rechnungswahrheit. |
| `public.bath_measurements` | `bewegungsdaten` | Messwerte sind zeitbezogene Betriebsvorgänge. |
| `public.baths` | `tot` | Kein Leser im aktiven Stufe-1-Kernweg; die Bäder-Funktion gehört nicht zur Stufe-1-Routengrenze. |
| `public.beleg` | `bewegungsdaten` | Belege gehören zu Finanzvorgängen. |
| `public.beleg_position` | `bewegungsdaten` | Positionen eines Belegvorgangs. |
| `public.bh_audit_log` | `system` | Technischer Buchhaltungs-Auditnachweis. |
| `public.bh_einstellungen` | `tot` | Kein Leser im aktiven Code. |
| `public.business_kvp_items` | `bewegungsdaten` | Betriebliche Verbesserungsvorgänge. |
| `public.calendar_events` | `bewegungsdaten` | Terminereignisse mit Zeitbezug. |
| `public.catalog_services` | `stammdaten` | Freigegebener Leistungskatalog. | `src/modules/katalog/server/catalogServicePort.ts:42` |
| `public.communication_drafts` | `bewegungsdaten` | Entwürfe gehören zu Kommunikationsvorgängen. |
| `public.communication_messages` | `bewegungsdaten` | Ein- und ausgehende Nachrichten. |
| `public.communication_threads` | `bewegungsdaten` | Verläufe von Kommunikationsvorgängen. |
| `public.communications` | `tot` | Zweite, nicht im Stufe-1-Kernweg verwendete Kommunikationswahrheit; der aktive Stufe-1-Pfad nutzt `communication_messages`. |
| `public.company_settings` | `stammdaten` | Freigegebene Firmendaten. | `src/modules/fundament/server/systemSettingsPort.ts:64` |
| `public.complaints` | `bewegungsdaten` | Reklamationen sind Kunden-/Auftragsvorgänge. |
| `public.consumable_uses` | `bewegungsdaten` | Erfasster Verbrauch im Betrieb. |
| `public.cost_positions` | `tot` | Kein Leser im aktiven Code. |
| `public.customers` | `bewegungsdaten` | Kundendaten sind laut U-219 nicht Teil der Stammdatenübernahme. |
| `public.developer_feedback` | `system` | Technisches Feedback für Wartung und Entwicklung. |
| `public.devices` | `system` | Technische Geräteregistrierung. |
| `public.einwilligung` | `bewegungsdaten` | Einwilligungen sind personenbezogene Vorgangsnachweise. |
| `public.email_templates` | `bewegungsdaten` | Mailbezogene Daten werden nach H16b als Bewegungsdaten behandelt. |
| `public.events` | `bewegungsdaten` | Fachliche Ereigniskette von Vorgängen. |
| `public.export_lauf` | `system` | Technischer Nachweis eines Exports. |
| `public.feature_flags` | `tot` | Kein Datenbankleser im aktiven Code; der Stufe-1-Schalter liest `tenant_features`. |
| `public.feedback_eingang` | `bewegungsdaten` | Eingegangenes Feedback ist ein Vorgang. |
| `public.feedback_mail` | `bewegungsdaten` | Mailbezogenes Feedback ist ein Kommunikationsvorgang. |
| `public.feedback_notes` | `bewegungsdaten` | Erfasste Feedbacknotizen sind Vorgangsdaten. |
| `public.forecast_version` | `bewegungsdaten` | Versionierter Prognosestand mit Zeitbezug. |
| `public.import_job_rows` | `bewegungsdaten` | Importierte Nutzdatenzeilen. |
| `public.import_jobs` | `system` | Technische Steuerung und Status von Importläufen. |
| `public.inquiries` | `bewegungsdaten` | Anfragen sind Kunden-/Interessentenvorgänge. |
| `public.inventory_items` | `tot` | Nur außerhalb der Stufe-1-Routengrenze gelesen; Lager gehört nicht zum aktiven Kernweg. |
| `public.invoices` | `bewegungsdaten` | Aktive Rechnungswahrheit. |
| `public.item_photo_jobs` | `system` | Technische Verarbeitung von Positionsfotos. |
| `public.item_photos` | `bewegungsdaten` | Fotos gehören zu Auftragspositionen. |
| `public.items` | `bewegungsdaten` | Auftragspositionen. |
| `public.kampagne` | `bewegungsdaten` | Marketingkampagnen mit Vorgangsbezug. |
| `public.kanal` | `tot` | Nur im Marketing-Altbereich gelesen; Marketing gehört nicht zur Stufe 1. |
| `public.kategorie` | `tot` | Nur im Kosten-/Buchhaltungs-Altbereich gelesen; kein Stufe-1-Stammdatum. |
| `public.konto` | `tot` | Kein Tabellenleser im aktiven Stufe-1-Code. |
| `public.kosten_posten` | `tot` | Kein Leser im aktiven Code. |
| `public.kostenposten` | `tot` | Nur im Kosten-/Buchhaltungs-Altbereich gelesen; kein Stufe-1-Stammdatum. |
| `public.kostensatz_default` | `tot` | Nur vom alten Erfassungs-Snapshot gelesen; kein Leser im aktiven Stufe-1-Kernweg. |
| `public.kostenstelle` | `tot` | Kein Tabellenleser im aktiven Stufe-1-Code. |
| `public.kostenstellen_energie_monat` | `bewegungsdaten` | Monatliche Energieverbrauchs-/Kostenwerte. |
| `public.kpi_cost_assumptions` | `tot` | Kein Leser im aktiven Code. |
| `public.kpi_snapshots` | `bewegungsdaten` | Zeitbezogene Kennzahlenstände. |
| `public.kraftstoff_detail` | `bewegungsdaten` | Erfasste Kraftstoffdetails. |
| `public.kvp_items` | `bewegungsdaten` | Verbesserungsfälle mit Lebenszyklus. |
| `public.lern_metrik` | `bewegungsdaten` | Zeitbezogene Lern-/Wirkungswerte. |
| `public.licenses` | `tot` | Die Fake-Lizenz-/Quota-Funktion wurde in H15 entfernt. |
| `public.lieferant` | `tot` | Kein Tabellenleser im aktiven Code. |
| `public.locations` | `tot` | Kein Leser im aktiven Code. |
| `public.marketing_asset` | `tot` | Nur als altes Schema definiert; kein aktiver Leser und nicht Stufe 1. |
| `public.marketing_touchpoints` | `bewegungsdaten` | Erfasste Marketingkontakte. |
| `public.offline_outbox` | `system` | Technische Warteschlange noch nicht synchronisierter Befehle. |
| `public.operator_control_events` | `system` | Technische Bedien-/Kontrollereignisse. |
| `public.order_cost_events` | `bewegungsdaten` | Kostenereignisse eines Auftrags. |
| `public.order_cost_positions` | `bewegungsdaten` | Kostenpositionen eines Auftrags. |
| `public.order_financials` | `bewegungsdaten` | Finanzdaten eines Auftrags. |
| `public.orders` | `bewegungsdaten` | Aktive Auftragswahrheit. |
| `public.payments` | `bewegungsdaten` | Aktive Zahlungswahrheit. |
| `public.periode` | `bewegungsdaten` | Buchungs-/Abrechnungsperiode mit Zeitbezug. |
| `public.phone_notes` | `bewegungsdaten` | Telefonnotizen zu Kunden- oder Interessentenvorgängen. |
| `public.pin_rate_limits` | `system` | Technischer Schutz der PIN-Anmeldung. |
| `public.price_agreements` | `bewegungsdaten` | Kundenbezogene Preisvereinbarungen. |
| `public.price_lines` | `bewegungsdaten` | Positionen kundenbezogener Preisvereinbarungen. |
| `public.scan_uploads` | `bewegungsdaten` | Hochgeladene Belege/Fotos eines Vorgangs. |
| `public.security_rate_limit_counters` | `system` | Technische Sicherheitszähler. |
| `public.segment` | `tot` | Nur im Marketing-Altbereich gelesen; Marketing gehört nicht zur Stufe 1. |
| `public.shipments` | `bewegungsdaten` | Versand-/Warenausgangsvorgänge. |
| `public.statistik_kennzahl` | `bewegungsdaten` | Zeitbezogene Statistikwerte. |
| `public.steuerprofil` | `tot` | Nur im Buchhaltungs-/Export-Altbereich gelesen; nicht Teil des Stufe-1-Kernwegs. |
| `public.stock_movements` | `bewegungsdaten` | Lagerbewegungen. |
| `public.teile_klassifikator` | `tot` | Nur vom alten Vorlagenpfad gelesen; kein Stufe-1-Stammdatum. |
| `public.telemetrie_event` | `system` | Technische Telemetrie. |
| `public.tenant_features` | `stammdaten` | Freigegebene Stufen-/Funktionsschalter. | `src/modules/fundament/server/tenantFeaturePort.ts:32` |
| `public.tenant_operator_controls` | `system` | Technische Bedienkontrollen je Mandant. |
| `public.touchpoint` | `bewegungsdaten` | Erfasster Kontaktpunkt. |
| `public.ui_events` | `system` | Technische UI-Ereignisse und Diagnose. |
| `public.ustva_periode` | `bewegungsdaten` | Umsatzsteuervoranmeldungsperiode mit Zeitbezug. |
| `public.vorlage_verbrauch` | `tot` | Nur vom alten Vorlagenpfad gelesen; kein Stufe-1-Stammdatum. |
| `public.vorlage_zeit` | `tot` | Nur vom alten Vorlagenpfad gelesen; kein Stufe-1-Stammdatum. |
| `public.warning_event` | `bewegungsdaten` | Fachliches Warnereignis. |
| `public.zahlung` | `tot` | Kein Tabellenleser im aktiven Code; die aktive Zahlungswahrheit ist `payments`. |

## Schema `private`

| Tabelle | Klasse | Begründung | Leser-Nachweis für `stammdaten` |
|---|---|---|---|
| `private.customer_create_receipts` | `bewegungsdaten` | Receipt eines konkreten Kundenanlagevorgangs. |
| `private.customer_number_counters` | `system` | Technischer Nummernkreis; wird nie kopiert und startet leer. |
| `private.evidence_domain_links` | `bewegungsdaten` | Zuordnung eines Belegs zu einem fachlichen Vorgang. |
| `private.evidence_extraction_metadata` | `bewegungsdaten` | Extraktionsnachweis zu einem konkreten Belegvorgang. |
| `private.extra_work_catalog_positions` | `stammdaten` | Freigegebener Katalog für Mehrarbeitspositionen. | `src/lib/server/commands/extraWorkAdminCommand.ts:316` |
| `private.extra_work_hourly_rates` | `stammdaten` | Freigegebene Stundensätze für Mehrarbeit. | `src/lib/server/commands/extraWorkAdminCommand.ts:455` |
| `private.intake_drafts` | `bewegungsdaten` | Entwurf eines konkreten Eingangsvorgangs. |
| `private.invoice_number_sequences` | `system` | Technischer Rechnungsnummernkreis; wird nie kopiert und startet leer. |
| `private.order_freeze_corrections` | `bewegungsdaten` | Korrektur eines eingefrorenen Auftragsstands. |
| `private.order_freezes` | `bewegungsdaten` | Eingefrorener Stand eines konkreten Auftrags. |
| `private.order_frozen_extra_work_lines` | `bewegungsdaten` | Mehrarbeitszeilen eines eingefrorenen Auftragsstands. |
| `private.order_intake_receipts` | `bewegungsdaten` | Receipt eines konkreten Auftragseingangs. |
| `private.order_item_extra_work` | `bewegungsdaten` | Mehrarbeit an einer konkreten Auftragsposition. |
| `private.order_station_evidence` | `bewegungsdaten` | Beleg für einen Stationsschritt eines Auftrags. |
| `private.order_station_evidence_reservations` | `bewegungsdaten` | Reservierung eines Belegs für einen Stationsschritt. |
| `private.order_task_assignment_state` | `bewegungsdaten` | Zuweisungsstand eines konkreten Auftrags. |
| `private.quote_conversion_receipts` | `bewegungsdaten` | Receipt einer konkreten KV-Umwandlung. |
| `private.quote_conversion_requests` | `bewegungsdaten` | Anfrage zur Umwandlung eines konkreten KV. |
| `private.quote_create_receipts` | `bewegungsdaten` | Receipt einer konkreten KV-Anlage. |
| `private.quote_number_counters` | `system` | Technischer KV-Nummernkreis; wird nie kopiert und startet leer. |
| `private.quote_positions` | `bewegungsdaten` | Positionen eines konkreten KV. |
| `private.quote_update_receipts` | `bewegungsdaten` | Receipt einer konkreten KV-Änderung. |
| `private.quotes` | `bewegungsdaten` | Aktive KV-Vorgänge. |
| `private.today_preferences` | `bewegungsdaten` | Personenbezogene Einstellung für den aktuellen Tagesablauf. |
| `private.today_reminders` | `bewegungsdaten` | Erinnerung zu einem konkreten Tagesvorgang. |
| `private.user_last_seen` | `system` | Technischer letzter Aktivitätszeitpunkt eines Logins. |

## Schema `drizzle`

| Tabelle | Klasse | Begründung | Leser-Nachweis für `stammdaten` |
|---|---|---|---|
| `drizzle.__drizzle_migrations` | `system` | Technische Historie des Drizzle-Migrationswerkzeugs; wird nicht kopiert. |

## Zählung

- Tabellen in der Dev-DB: **public 97 · private 26 · drizzle 1**
- Registerzeilen: **124**
- Fehlende Tabellen: **0**
- Doppelte Tabellen: **0**
- Zusätzliche Tabellen: **0**
- Ungeklärt (`?`): **0**
