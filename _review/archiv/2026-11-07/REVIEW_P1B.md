# Review P1b – Kernweg Kunde & Auftrag

Prüfer: Claude · 26.10.2026 16:35 Berlin · Branch `kreile/s1-p1-daten` · Produkt-SHA `4d655c39`, Kopf `dca77536` · PR #153 (Draft) · CI `agentur-gate` grün, Vercel Ready
Erste Prüfung P1b (eine Korrekturrunde folgt, danach nur Nachprüfung dieser Punkte).

## Geprüft, in Ordnung

- Pflichtdaten: Auftrag nur mit Kundennummer, Ansprechpartner, E-Mail, Telefon, Straße, PLZ, Ort, Land, Zahlungsbedingung – auch für Bestandskunden (`src/lib/server/commands/orderIntakeCommand.ts:328-329`). KV-Umwandlung läuft über denselben Intake (einziges `INSERT INTO public.orders` `:450`).
- Ein Neukunden-Schreibweg: `private.create_customer_v1` vergibt Kundennummer; kein zweiter Customer-Insert im Produktpfad. Interessent nur Name + Telefon zulässig (Migration `20261026180000`), Auftrag dafür gesperrt.
- Neuer Eingang 3 Schritte, Schritt 1 zeigt Kundenfelder zum Ergänzen (`GlobalCreateFlow.tsx` ~985-993).
- Ortskette antippbar (`OrderCardView.tsx:135-140, 193`), Termin mit Grund (`OrderCardView.tsx:264-275`).
- Farben: 0 Hex in TargetShell/orders/customers/settings.module.css; `src/styles/tokens.css` 0 eigene Hex.
- Verbote: einzige Änderung an `.github/workflows/eslint-ratchet.yml` (Checker-Hash) + `scripts/quality/check-authoritative-sources.mjs` = freigegebene Register-Umstellung (ff03e1f6). Keine alte Migration geändert, kein Löschen.
- DB: remote 32 = Repo 32 (bis `20261026190000`).

## Gesamturteil: FAIL (2 Blocker)

1. **Sackgasse „Fertig“ (Owner-Entscheid P1b Nr. 4 nicht umgesetzt).** `src/lib/server/commands/orderFreezeCommand.ts:368-385` verlangt `private.extra_work_hourly_rates`; keine Migration legt einen Satz an, und `setExtraWorkHourlyRateAction` (`src/app/actions/orders.actions.ts:127`) wird von keiner Oberfläche aufgerufen. Änderung: in `src/app/settings/SettingsAdminClient.tsx` (Abschnitt Firmendaten) Feld „Stundensatz Mehrarbeit (€/h)“ ergänzen, das `setExtraWorkHourlyRateAction` aufruft – oder die Prüfung in `orderFreezeCommand.ts:376-385` entfernen, wenn keine Mehrarbeit erfasst ist. Test: Fertig ohne vorher angelegten Satz bzw. nach Pflege in Einstellungen geht durch.
2. **Zahlung per Antippen mit falscher Zahlart.** `src/modules/orders/ui/OrderCardView.tsx:139` bucht beim Tippen auf „Zahlung“ sofort `onConfirmPayment("ueberweisung")` – Barzahlung wird als Überweisung gespeichert, ein Fehltipp bestätigt Geldeingang. Änderung: Tippen öffnet die vorhandene Zahlungsauswahl (Zahlart wählen + bestätigen) statt direkt zu buchen.

## Kein Blocker (→ DEZEMBER_LISTE)

- Eingangsart-Auswahl in Schritt 1 nicht an Zustand gebunden (`GlobalCreateFlow.tsx`, `<select defaultValue="anruf">`), wird nicht gespeichert.
- Preview-Kernweg nicht selbst geklickt (Rolf-Code maskiert); Gregor-Login laut Klarstellung Nr. 4 hätte genügt. Owner-Abnahme deckt es ab.
- Ladezeit Auftragskarte nicht gemessen.


## Nachprüfung 26.10.2026 17:30 Berlin – nur die 2 Blocker

Korrektur liegt nicht auf `kreile/s1-p1-daten` (unverändert dca77536), sondern auf `kreile/s1-p2-eingang` (enthält P1 vollständig), Commits 5071f3a4 + 2256d9b1, PR #154 (Draft), Preview https://galvanik-kreile-werkstatt-iij4008sb.vercel.app.

1. Stundensatz-Sackgasse: **behoben.** `src/app/settings/SettingsAdminClient.tsx` Abschnitt „Mehrarbeit“ mit Feld „Stundensatz Mehrarbeit (€/h)“ ruft `setExtraWorkHourlyRateAction`; `readExtraWorkHourlyRate` lädt den Satz; meister/admin/developer dürfen setzen.
2. Zahlung-Tipp: **behoben.** `OrderCardView.tsx` Ortskette und Dock-Knopf öffnen Dialog „Zahlart wählen und bestätigen“ (Bar/Überweisung/Karte); keine Direktbuchung mehr.

**Urteil P1b: PASS** (über Branch `kreile/s1-p2-eingang` @ 2256d9b1). Merge erst gemeinsam mit P2 bzw. nach Owner-Entscheid, da P1b-Korrektur im P2-PR steckt.
