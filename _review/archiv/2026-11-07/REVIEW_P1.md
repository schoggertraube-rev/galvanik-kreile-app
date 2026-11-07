# Review P1 · Datenfundament

Prüfer: Claude · 25.10.2026 22:10 · Branch `kreile/s1-p1-daten` · Produkt-SHA `38054e64`, Kopf `08d1e67f` · PR #153 (Draft, Basis `kreile/b1-shell`)

## IDs

| ID | Urteil | Beleg |
|---|---|---|
| S01 Firmendaten | PASS (Funktion) / FAIL (Optik) | Felder Name…Logo, Pflicht + Zahlungsziel 1–365: `src/modules/fundament/server/systemSettingsPort.ts:49-64`; UI `src/app/settings/SettingsAdminClient.tsx:38-39`; Nummernkreise nur Anzeige `systemSettingsPort.ts:36-39`, `SettingsAdminClient.tsx:40`. Logo nur als Pfad-Textfeld, kein Upload. Nur UPDATE – fehlt die Zeile, schlägt Speichern fehl |
| S02 Leistungskatalog | PASS (teilweise, P2-Anteil offen) | Modul `src/modules/katalog/**` mit `public.ts`/`server-public.ts`/Manifest; Tabelle `catalog_services` Migration `20261025182920_s1_p1_datenfundament.sql:5-30` (alle Pflichtspalten); Test `catalogServicePort.test.ts`. Angebote lesen noch nicht (P2) |
| S03 Nutzer & Rollen | FAIL (teilweise) | Rolle/PIN/Sperre bestehender Nutzer `systemSettingsPort.ts:73-86`; Neuanlage fehlt, Text „In Klärung“ `SettingsAdminClient.tsx:55` als Fließtext, nicht als ausgegraute V8-Stelle. Owner-Entscheid steht in OWNER_TODO |
| A06 Kunde vollständig | PASS | Pflicht Straße/PLZ/Ort/Land/Zahlungsbedingung im DB-Befehl Migration `:101-125`, Update `:202-226`; Intake-Neukunde `src/lib/server/commands/orderIntakeCommand.ts:198-220`; Kundenkarte `CustomerCardView.tsx` (+26 Z.); Test `createCustomerCommand.test.ts` |
| E02 Auftrag vollständig | PASS (Code) / FAIL (Abnahme) | Liefertermin + 1–20 Katalogpositionen mit Preis/Steuer Pflicht `orderIntakeCommand.ts:154-188`, Abgleich gegen Katalog `:473-485`, Schreiben `promised_due_date` `:513-520`, Items mit Preis/Steuer `:535-542`; Abnahme-E2E `e2e/f1-4-immutable-invoice.real.spec.ts` NICHT grün (ABGABE §5) |
| A04 Terminänderung mit Grund | FAIL (teilweise) | DB-Funktion `private.update_order_promised_due_date_v1` mit Grund 3–500 Zeichen + Ereignis, Migration `:265-291`; keine UI, kein sichtbarer Verlauf, kein Test genannt |

## Pflichtfelder / Abhängigkeiten

- Kunde: im Code erzwungen (Befehl + Intake). DB-Check `customers_payment_preference_s1_chk` ist `NOT VALID` (Altbestand ungeprüft) – ok, aber: Auftrag auf **bestehenden** Altkunden ohne Adresse ist weiter möglich (`orderIntakeCommand.ts:193-196`) → Rechnung blockiert später = Sackgasse.
- Intake-Neukunde wird mit `customer_number = NULL` angelegt (`orderIntakeCommand.ts:378`) – prüfen, ob Rechnung/Kundenkarte das verkraftet.
- Abnahme „nach fertig ohne Nacharbeit abrechenbar“ nicht belegt (E2E rot).

## Verbote

- Keine Änderung an `scripts/quality`, `.github/workflows`, `AGENTS.md`, `missions`, `quality` im P1-Diff. Genau eine neue Migration, keine alte geändert. PASS.
- Keine Demo-Daten im Produktpfad gefunden; Live-DB laut Abgabe unberührt (nicht unabhängig prüfbar).
- Hinweis PIN: Test `src/modules/fundament/__tests__/systemSettingsPort.test.ts:56` nutzt `"7315"` – identisch mit Phillip-PIN in E2E-Fixtures (`e2e/path1-v5-shell-smoke.real.spec.ts:20`). Falls das die echte PIN ist: Secret im Repo.

## Optik

- FAIL: `/settings` neu mit eigenem `src/app/settings/settings.module.css` (harte Farben `#14253f`, `#f4b44a`, eigene Karten/Buttons), keine V8-Bausteine `field`/`row`/`pi`/`modstrip`, keine Tokens aus `designsystem_v1_1/`.
- FAIL: Kundenkarte-Formular `.commercialForm` in `customers.module.css` mit harten Farben statt V2/Designsystem.
- Keine Screenshots geliefert.

## Deploy / CI

- Vercel Preview Ready (`dpl_EZL2Z1ikTFTBpJ7QnmWK1qXWFZ5u`), https://galvanik-kreile-werkstatt-7wmei8xcv.vercel.app
- PR #153: `agentur-gate` fail; Vercel pass. Unit 1006/1008, `quality:module-gates` rot (Lieferdateien nicht registriert → Owner-TODO).

## Gesamturteil: FAIL

Codex behebt:
1. `e2e/f1-4-immutable-invoice.real.spec.ts` mit neu angelegtem Kunden im Fresh-Replay grün laufen lassen und Log belegen.
2. `/settings` und Kundenkarten-Formular auf V8-/Designsystem-Bausteine und Tokens umbauen; `settings.module.css` mit harten Farben entfernen.
3. S03 „Neue Zugänge“ als ausgegraute V8-Stelle („In Klärung“, nicht klickbar) statt Fließtext.
4. A04: Bearbeitungs-UI für Liefertermin mit Pflicht-Grund und sichtbarem Verlauf in der Auftragskarte; Test dazu.
5. Auftrag auf Bestandskunden ohne Straße/PLZ/Land/Zahlungsbedingung blockieren oder Ergänzung erzwingen (keine Sackgasse bis Rechnung).
6. `customer_number` für Intake-Neukunden vergeben oder belegen, warum NULL zulässig ist.
7. S01: Fall „keine company_settings-Zeile“ abdecken; Logo als Upload (privater Storage) statt Pfad-Textfeld oder als Abweichung ausweisen.
8. Test-PIN in `systemSettingsPort.test.ts` durch neutralen Wert ersetzen; bestätigen, dass `7315` keine echte PIN ist.
9. Screenshots 1914×917, 1220×880, 390×844 für `/settings` und Auftragserfassung aus dem Fresh-Replay.


---

# Nachprüfung P1 · 26.10.2026 04:10

Prüfer: Claude · Branch `kreile/s1-p1-daten` · Produkt-SHA `77be9686`, Kopf `87bdcc95` · PR #153 (Draft)
Anlass: ABGABE_P1.md aktualisiert (87bdcc95). Diff seit `08d1e67f`: nur `SettingsAdminClient.tsx` (1 Z.), `settings.module.css` (1 Z.), `SettingsAppAdapter.test.tsx` (+8), Abgabe, OWNER_TODO.

## IDs (nur Änderungen gegenüber Erstprüfung)

| ID | Urteil | Beleg |
|---|---|---|
| S03 Nutzer & Rollen | PASS (Funktion, im Owner-Scope) | „Nutzer anlegen“ als nicht klickbare Stelle mit Tag „geplant“ `src/app/settings/SettingsAdminClient.tsx:55`; Test `src/app/settings/__tests__/SettingsAppAdapter.test.tsx:71-77` (prüft „geplant“, drei Nutzer, kein „In Klärung“). Owner-Entscheid in OWNER_ENTSCHEIDUNGEN.md laut Abgabe. Optik: `.planned`/`.plannedTag` wieder mit harten Farben (`#c8b9a4`, `#eaf3fb`, `#265b85`) in `settings.module.css` statt V8-Token |
| S01, S02, A06, E02, A04 | unverändert wie Erstprüfung | kein Code-Diff |

## Verbote

- Keine Änderung an scripts/quality, .github/workflows, AGENTS.md, missions, quality, Migrationen. PASS.
- Keine Zugangswerte in Abgabe/Repo-Diff. PASS.

## Deploy / CI

- Vercel: pass am PR-Kopf, Preview laut Abgabe https://galvanik-kreile-werkstatt-p8hd4r46a.vercel.app (`dpl_3WtiqD6heDubjG3wMAcHJ5kW4t4y`, Ready).
- GitHub `agentur-gate`: **fail** (Run 40248431659). tsc und lint:full am neuen SHA laut Abgabe „UNBESTÄTIGT“ = kein Beleg.
- Paket-E2E weiter nicht grün, keine Screenshots, kein authentifizierter Smoke.

## Gesamturteil: FAIL

Codex behebt:
1. `e2e/f1-4-immutable-invoice.real.spec.ts` im Fresh-Replay grün, Log belegen.
2. `tsc --noEmit` und `lint:full` am Produkt-SHA vollständig laufen lassen und belegen.
3. `/settings` (inkl. neuer `.planned`-Stelle) und Kundenkarten-Formular auf V8-/Designsystem-Bausteine und Tokens; harte Farben raus.
4. A04: Termin-Bearbeitung mit Pflicht-Grund und sichtbarem Verlauf in der Auftragskarte, Test.
5. Auftrag auf Bestandskunden ohne Adresse/Zahlungsbedingung blockieren oder Ergänzung erzwingen (Sackgasse bis Rechnung).
6. `customer_number` für Intake-Neukunden vergeben oder NULL begründen.
7. S01: Fall „keine company_settings-Zeile“; Logo-Upload oder als Abweichung ausweisen.
8. Test-PIN `7315` in `systemSettingsPort.test.ts` neutralisieren, bestätigen, dass keine echte PIN.
9. Screenshots 1914×917, 1220×880, 390×844 für `/settings` und Auftragserfassung.
