# Datenregister Dev-DB

Stand: 29.10.2026 · Quelle: verknüpfte Dev-DB, Schema `public`

Klassen: `stammdaten` · `bewegungsdaten` · `system` · `tot` · `?` (noch fachlich zu klären)

Das Register klassifiziert jede aktuell in der Dev-DB vorhandene Public-Tabelle genau einmal. `?` ist bewusst kein Ersatzurteil: Diese Tabellen werden vor einer späteren Übernahme fachlich geklärt. Für H17 sind nur ausdrücklich freigegebene `stammdaten` übertragbar; PIN-Werte, Bewegungsdaten, Systemdaten, tote und ungeklärte Tabellen werden nicht kopiert.

| Tabelle | Klasse | Begründung |
|---|---|---|
| `public.ai_usage_reservations` | `system` | Technische Reservierungen für KI-Nutzung. |
| `public.aktion` | `bewegungsdaten` | Fachliche Marketing-/Aktionsvorgänge. |
| `public.app_kvp_items` | `bewegungsdaten` | Erfasste Verbesserungsfälle der App. |
| `public.app_usage_events` | `system` | Technische Nutzungsereignisse der App. |
| `public.app_user_rights` | `stammdaten` | Freigegebene Rechtezuordnung der Logins. |
| `public.app_users` | `stammdaten` | Login-Stammdaten; PIN-Werte sind von einer Übernahme ausgeschlossen. |
| `public.arbeitszeit_buchung` | `bewegungsdaten` | Zeitbuchungen sind betriebliche Vorgänge. |
| `public.attribution` | `bewegungsdaten` | Zuordnung eines Marketing-/Kundenvorgangs. |
| `public.audit_log` | `system` | Technischer Auditnachweis. |
| `public.ausgangsrechnung` | `tot` | Durch H14 als abgelöste Rechnungswahrheit festgestellt. |
| `public.ausgangsrechnung_position` | `tot` | Positionen der durch H14 abgelösten Rechnungswahrheit. |
| `public.bath_measurements` | `bewegungsdaten` | Messwerte sind zeitbezogene Betriebsvorgänge. |
| `public.baths` | `?` | Fachliche Rolle und künftige Nutzung der Bad-Stammdaten sind noch nicht geklärt. |
| `public.beleg` | `bewegungsdaten` | Belege gehören zu Finanzvorgängen. |
| `public.beleg_position` | `bewegungsdaten` | Positionen eines Belegvorgangs. |
| `public.bh_audit_log` | `system` | Technischer Buchhaltungs-Auditnachweis. |
| `public.bh_einstellungen` | `stammdaten` | Konfiguration der Buchhaltung. |
| `public.business_kvp_items` | `bewegungsdaten` | Betriebliche Verbesserungsvorgänge. |
| `public.calendar_events` | `bewegungsdaten` | Terminereignisse mit Zeitbezug. |
| `public.catalog_services` | `stammdaten` | Freigegebener Leistungskatalog. |
| `public.communication_drafts` | `bewegungsdaten` | Entwürfe gehören zu Kommunikationsvorgängen. |
| `public.communication_messages` | `bewegungsdaten` | Ein- und ausgehende Nachrichten. |
| `public.communication_threads` | `bewegungsdaten` | Verläufe von Kommunikationsvorgängen. |
| `public.communications` | `?` | Verhältnis zur aktiven Nachrichtenwahrheit ist noch nicht geklärt. |
| `public.company_settings` | `stammdaten` | Freigegebene Firmendaten. |
| `public.complaints` | `bewegungsdaten` | Reklamationen sind Kunden-/Auftragsvorgänge. |
| `public.consumable_uses` | `bewegungsdaten` | Erfasster Verbrauch im Betrieb. |
| `public.cost_positions` | `?` | Abgrenzung zu den weiteren Kostenpositionstabellen ist noch nicht geklärt. |
| `public.customers` | `bewegungsdaten` | Kundendaten sind laut U-219 nicht Teil der Stammdatenübernahme. |
| `public.developer_feedback` | `system` | Technisches Feedback für Wartung und Entwicklung. |
| `public.devices` | `system` | Technische Geräteregistrierung. |
| `public.einwilligung` | `bewegungsdaten` | Einwilligungen sind personenbezogene Vorgangsnachweise. |
| `public.email_templates` | `bewegungsdaten` | Mailbezogene Daten werden nach H16b als Bewegungsdaten behandelt. |
| `public.events` | `bewegungsdaten` | Fachliche Ereigniskette von Vorgängen. |
| `public.export_lauf` | `system` | Technischer Nachweis eines Exports. |
| `public.feature_flags` | `?` | Verhältnis zu `tenant_features` ist vor Übernahme zu klären. |
| `public.feedback_eingang` | `bewegungsdaten` | Eingegangenes Feedback ist ein Vorgang. |
| `public.feedback_mail` | `bewegungsdaten` | Mailbezogenes Feedback ist ein Kommunikationsvorgang. |
| `public.feedback_notes` | `bewegungsdaten` | Erfasste Feedbacknotizen sind Vorgangsdaten. |
| `public.forecast_version` | `bewegungsdaten` | Versionierter Prognosestand mit Zeitbezug. |
| `public.import_job_rows` | `bewegungsdaten` | Importierte Nutzdatenzeilen. |
| `public.import_jobs` | `system` | Technische Steuerung und Status von Importläufen. |
| `public.inquiries` | `bewegungsdaten` | Anfragen sind Kunden-/Interessentenvorgänge. |
| `public.inventory_items` | `?` | Künftige Lagerwahrheit und Übernahme sind noch nicht geklärt. |
| `public.invoices` | `bewegungsdaten` | Aktive Rechnungswahrheit. |
| `public.item_photo_jobs` | `system` | Technische Verarbeitung von Positionsfotos. |
| `public.item_photos` | `bewegungsdaten` | Fotos gehören zu Auftragspositionen. |
| `public.items` | `bewegungsdaten` | Auftragspositionen. |
| `public.kampagne` | `bewegungsdaten` | Marketingkampagnen mit Vorgangsbezug. |
| `public.kanal` | `stammdaten` | Konfigurierter Kommunikationskanal. |
| `public.kategorie` | `stammdaten` | Fachlicher Kategoriekatalog. |
| `public.konto` | `stammdaten` | Konfiguration eines Buchhaltungskontos. |
| `public.kosten_posten` | `?` | Abgrenzung zu `kostenposten` und `cost_positions` ist ungeklärt. |
| `public.kostenposten` | `?` | Abgrenzung zu `kosten_posten` und `cost_positions` ist ungeklärt. |
| `public.kostensatz_default` | `stammdaten` | Freigegebener Standard-Kostensatz. |
| `public.kostenstelle` | `stammdaten` | Kostenstellenkatalog. |
| `public.kostenstellen_energie_monat` | `bewegungsdaten` | Monatliche Energieverbrauchs-/Kostenwerte. |
| `public.kpi_cost_assumptions` | `stammdaten` | Konfigurierte Annahmen für Kostenkennzahlen. |
| `public.kpi_snapshots` | `bewegungsdaten` | Zeitbezogene Kennzahlenstände. |
| `public.kraftstoff_detail` | `bewegungsdaten` | Erfasste Kraftstoffdetails. |
| `public.kvp_items` | `bewegungsdaten` | Verbesserungsfälle mit Lebenszyklus. |
| `public.lern_metrik` | `bewegungsdaten` | Zeitbezogene Lern-/Wirkungswerte. |
| `public.licenses` | `tot` | Die Fake-Lizenz-/Quota-Funktion wurde in H15 entfernt. |
| `public.lieferant` | `stammdaten` | Lieferantenstamm. |
| `public.locations` | `stammdaten` | Standortkatalog. |
| `public.marketing_asset` | `stammdaten` | Wiederverwendbare Marketingvorlage bzw. -ressource. |
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
| `public.segment` | `stammdaten` | Segmentkatalog. |
| `public.shipments` | `bewegungsdaten` | Versand-/Warenausgangsvorgänge. |
| `public.statistik_kennzahl` | `bewegungsdaten` | Zeitbezogene Statistikwerte. |
| `public.steuerprofil` | `stammdaten` | Steuerliche Grundkonfiguration. |
| `public.stock_movements` | `bewegungsdaten` | Lagerbewegungen. |
| `public.teile_klassifikator` | `stammdaten` | Klassifikationskatalog für Teile. |
| `public.telemetrie_event` | `system` | Technische Telemetrie. |
| `public.tenant_features` | `stammdaten` | Freigegebene Stufen-/Funktionsschalter. |
| `public.tenant_operator_controls` | `system` | Technische Bedienkontrollen je Mandant. |
| `public.touchpoint` | `bewegungsdaten` | Erfasster Kontaktpunkt. |
| `public.ui_events` | `system` | Technische UI-Ereignisse und Diagnose. |
| `public.ustva_periode` | `bewegungsdaten` | Umsatzsteuervoranmeldungsperiode mit Zeitbezug. |
| `public.vorlage_verbrauch` | `stammdaten` | Vorlage für Verbrauchserfassung. |
| `public.vorlage_zeit` | `stammdaten` | Vorlage für Zeiterfassung. |
| `public.warning_event` | `bewegungsdaten` | Fachliches Warnereignis. |
| `public.zahlung` | `?` | Verhältnis zur aktiven Zahlungswahrheit `payments` ist ungeklärt. |

## Zählung

- Public-Tabellen in der Dev-DB: **97**
- Registerzeilen: **97**
- Fehlende Tabellen: **0**
- Doppelte Tabellen: **0**
- Zusätzliche Tabellen: **0**
- Ungeklärt (`?`): **8**
