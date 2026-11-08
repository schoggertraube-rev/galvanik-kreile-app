# Review Korrektur Eingang-01/02/03 (Prüfer Claude, 27.10.2026 22:27 UTC)

Branch `kreile/s1-p2-eingang`, Commits 16591e41 (01), 9c88e1cf (02), b61ba21a (03). Erste Prüfung.
ABGABE_KORREKTUR_EINGANG_04 liegt nur lokal/uncommitted -> nächster Lauf.

## Urteil

- **Eingang-01: PASS.** Default `rechnung_14` entfernt (Migration 20261027230000 nur `DROP DEFAULT`, keine Datenänderung; Remote = Repo, synchron). `resolveCustomer` lehnt Bestandskunden ohne `payment_preference` ab -> kein stilles Zahlungsziel, Pflichtdaten gewahrt.
- **Eingang-02: FAIL (1 Blocker, zusammen mit 03).**
- **Eingang-03: FAIL (derselbe Blocker).** Intake-Command, Katalog und KV sind korrekt an `geld` gebunden.

## Blocker 1 – Zahlungsbedingung/Ziel über Kunden-Update ohne Geldrecht änderbar (Sicherheit/Rechte)

Der neue Server-Guard (`intakePaymentContract`) vergleicht nur mit der gespeicherten Kundenbedingung. Diese Bedingung schreibt der Eingang aber vorher selbst über `updateCustomerCommercialAction` – ohne Geldrecht und ohne Ziel-Sperre:

1. `src/modules/customers/server/updateCustomerCommercialCommand.ts:31` (bzw. `src/app/actions/customers.actions.ts:97`): Capability um `canManageMoney = areas.includes("geld")` ergänzen. Im Command den aktuellen `payment_preference` lesen und
   - ohne `geld`: jede Änderung von `paymentPreference` mit `FORBIDDEN` ablehnen (Wert muss dem gespeicherten entsprechen; bei leerem gespeicherten Wert ebenfalls ablehnen),
   - mit `geld`: Wechsel auf `rechnung_*` nur zulassen, wenn der gespeicherte Wert bereits `rechnung_*` ist (sonst „Ziel nicht freigeschaltet.“). Eine echte Ziel-Freischaltung bleibt einem eigenen, späteren Weg vorbehalten.
2. `src/components/layout/GlobalCreateFlow.tsx:1493` (onWert „Übergabe“): ohne `ports.canManageMoney` `paymentPreference` NICHT verändern. Sonst überschreibt ein Werkstatt-Login beim Wechsel auf „Versand“ still die Zahlungsbedingung des Kunden (bar -> vorkasse).
3. Ein Test je Fall in `src/modules/customers/__tests__` (oder bestehendem Command-Test): ohne `geld` Änderung abgelehnt; mit `geld` vorkasse -> rechnung_14 abgelehnt.

Belegt durch Code: `updateCustomerCommercialCommand.ts:24` akzeptiert `rechnung_*` für jeden Kunden, `:31` prüft nur `perm_data_customers`; danach liefert `paymentModeFromPreference` „rechnung“ und der Intake-Guard lässt es durch.

Eine Korrekturrunde. Zweite Prüfung prüft nur diesen Blocker.


---

# Zweite Prüfung Eingang-02/03 + erste Prüfung Eingang-04/05/06 (Prüfer Claude, 28.10.2026 01:27 UTC)

Branch `kreile/s1-p2-eingang`, Kopf a962c123. Commits 6edc447e (04), 513592eb (05), fb969a35 (06), cc23cf8c (Kunde-02, enthält Blocker-Korrektur).

## Urteil

- **Eingang-02/03: PASS (zweite Prüfung).** Blocker 1 behoben:
  1. `updateCustomerCommercialCommand.ts`: liest `payment_preference` `FOR UPDATE`; ohne `canManageMoney` jede Änderung (auch leer → Wert) `FORBIDDEN`; mit Geld jeder Wechsel in/aus `rechnung_*` `FORBIDDEN`. `customers.actions.ts` setzt `canManageMoney` aus Bereich `geld`.
  2. `GlobalCreateFlow.tsx` (6edc447e): Kunden-Zahlungsbedingung und Auftrags-Zahlungsmodus getrennt; Übergabe-Wechsel speichert keinen Bestandskunden mehr.
  3. Tests `customerPaymentGuards.test.ts` (ohne geld abgelehnt; vorkasse→rechnung abgelehnt; Freischaltung ohne geld abgelehnt).
  Eine Korrekturrunde eingehalten.
- **Eingang-04: PASS.** Server prüft Ziel-Freischaltung weiter verbindlich, Bar/Karte bei Versand abgewiesen.
- **Eingang-05: PASS.** Suche tenant-gebunden (`security_invoker`, `app.tenant_id`, nur service_role), max. 10 Treffer, Dublettenhinweis. Migration nur View-Neuaufbau.
- **Eingang-06: PASS.** `execution_requested` additiv mit Check-Constraint, Server validiert.

DB: Remote 54 = Repo 54 SQL. Synchron. Keine Hex-Farben, kein verbotener Pfad.


## Prüfung 28.10. 11:32 UTC – EINGANG_07 bis _11 (dce52ad1, a617cba8, 075f96e2, bbd4270b, 48a5db9b)

Urteil: **PASS** je Abgabe (Owner-Klick offen). Alle fünf vor H8 (Eingang-Freeze 12:40 Berlin) committet; ab571095 friert weitere Eingang-Korrekturen ein – korrekt.

- Pflichtdaten: kein Schreibweg geändert, der Pflichtfelder lockert. bbd4270b ergänzt nur termStatus/intakeSource (optional, Whitelist, fail-closed bei falschen Werten); 075f96e2 liest nur lastHandoverMode als Vorbelegung.
- Migrationen 20261028101001 (company_settings.tagesleistung_eur, DEFAULT 800) und 20261028115500 (Spalten + Constraints, View/Funktion neu angelegt, Altzeilen NULL): additiv, kein DELETE/TRUNCATE, Remote angewandt.
- Farben: nur var(--…) aus tokens.css (alle 18 verwendeten Tokens vorhanden).
- a617cba8 ändert `.github/workflows/eslint-ratchet.yml` (Checker-SHA) und `scripts/quality/check-authoritative-sources.mjs` (+ `KORREKTUREN_STAND.md` im Register). Kein Blocker: fällt unter die freigegebene Register-Umstellung (OWNER_ENTSCHEIDUNGEN 26.10.) und die von H5 verlangte Datei. Hinweis in DEZEMBER_LISTE (gehört in eigenen Commit/Abgabe).
- Preview Kopf ab571095: galvanik-kreile-werkstatt-on638odmt.vercel.app READY.
