# Abgabe Q10 · Gesamtklicktest Q1–Q9

Status: **PASS**

Branch: `kreile/s1-p2-eingang`

Geprüfter Produkt-SHA: `5aece709ae6fdfcd012df79db04cc97881f0523b`

Preview: <https://galvanik-kreile-werkstatt-e3s4o16m3.vercel.app>

Vercel-Deployment: `dpl_Ej2cMgh5X1ULiNWcHSZHw94fCkwD` · Ready · Funktionen `fra1`

## Neu gemacht

- Q1 bis Q9 wurden in einer durchgehenden, echten Preview-Sitzung erneut geprüft.
- Der vorhandene Azure-Beleg wurde sichtbar geladen; die sechs bereits ausgelesenen Vorschläge wurden per SQL bestätigt. Microsoft Graph bleibt wie in Q06b belegt extern durch `GRAPH_TOKEN_401_invalid_client` blockiert und wurde nicht als Erfolg ausgegeben.
- Die nach Q7 veralteten Root-/Autorisierungstests prüfen jetzt die kanonische `app_users`-Wahrheit statt des abgelösten Drei-Profil-Resolvers.
- Die Q9-Administrator-Rückmeldung behält dasselbe Verhalten; ihre Promise-Auswertung wurde ohne Funktionsänderung an den bestehenden Fail-closed-Test angepasst.

## Preview-Klicktest

Rolle: Rolf, anschließend Gregor. Es wurden keine neuen Kunden, Aufträge, Rechnungen oder Zahlungen angelegt.

1. `/start`: exakt Gregor, Phillip und Rolf sichtbar. Als Rolf angemeldet und Einstellungen geprüft: Firmendaten, `TEST Q2 Vernickeln` zu 42,50 € und Mehrarbeit 85,00 € sichtbar.
2. Aufträge `A-2026-0002` bis `A-2026-0006` nacheinander geöffnet: Freitext/Vernickeln, fertig/Freeze, bezahlt/0,00 €/abgeholt, Abholung/offen sowie KV-Auftrag/Vorkasse sichtbar.
3. Kundenkarte `TEST Q4 Durchlauf 202610270956`: vorhandener Foto-Beleg sichtbar. Kundenkarte Sabrina Schmidt: `K-2026-0011` und `A-2026-0007` sichtbar; `Neuer Auftrag` wählte Sabrina korrekt vor.
4. `Ware raus` öffnete `/orders?station=fertig`; `Kunde anlegen` öffnete `Neukunde erfassen`. Gregor sah alle sechs freigegebenen Bereiche und keinen wirkungslosen Stufen-Schalter.
5. Bei Rolf absichtlich falsche PIN eingegeben und `Systemadministrator informieren` geklickt: `Anfrage wurde erfasst. Der Systemadministrator wurde informiert.` sichtbar.

![Q10 · sichtbare Administrator-Rückmeldung am Ende des Gesamtklicktests](../evidence/queue/Q10_GESAMTKLICKTEST.png)

## Datenbank-Nachweis

Eine aggregierte, reine Leseabfrage gegen die echte Dev-Datenbank ergab genau eine Ergebniszeile:

```text
active_users=3
active_user_names=Gregor:developer, Phillip:werkstatt, Rolf:meister
company_settings=1
active_catalog_services=1
hourly_rates=1
q1_freetext_ok=true
q3_finished_ok=true
q4_paid_goods_out_ok=true
q5_pickup_open_ok=true
q6_quote_conversion_ok=true
q6b_azure_suggestions=6
q8_legacy_customer_ok=true
q9_reset_event_id=ep9p7sao1qmdjyhfwxbm5qd3
q9_reset_created_at=2026-10-27 14:49:29.414492+00
```

Keine Migration und keine direkte Datenänderung. Remote-Migrationen bleiben Repo = Remote bis einschließlich `20261027140000`.

## Prüfungen

- Gesamtklicktest Q1–Q9 in einer Preview-Sitzung: PASS.
- Aggregierter SQL-Readback: PASS; alle Q-Booleans `true`.
- Zuvor rote Testbereiche Root-Route, zentrale Autorisierung und externer Provider: 3 Dateien, 27/27 Tests PASS.
- ESLint der drei geänderten TypeScript-/TSX-Dateien: PASS.
- Lokaler TypeScript-Gesamtlauf lieferte innerhalb von 184 Sekunden kein Ergebnis und wurde nach der Werkzeuggrenze beendet; Vercel-Build am geprüften Produkt-SHA ist PASS. Der neue GitHub-Lauf wird gemäß Spielregel 4c nicht abgewartet; ein später roter Pflichtcheck hat erneut Vorrang.

## Abweichungen / Rest

- Microsoft Graph ist weiterhin der bereits akzeptierte externe Blocker aus Q06b; Azure Document Intelligence ist belegt grün.
- Keine weitere Abweichung vom Q10-Auftrag festgestellt.

## Owner-Abnahme (5 Minuten)

Preview: <https://galvanik-kreile-werkstatt-e3s4o16m3.vercel.app> · Rollen: **Rolf**, danach **Gregor**

1. `/start` öffnen. Erwartung: exakt drei Kacheln Gregor, Phillip und Rolf.
2. Als Rolf anmelden → Aufträge → `A-2026-0004`. Erwartung: `abgeholt`, Rechnung `R-2026-0002`, `Bezahlt` und `0,00 €` sichtbar.
3. Kunden & Kontakt → Sabrina Schmidt → `Neuer Auftrag`. Erwartung: `K-2026-0011` sichtbar und Sabrina im Eingang vorausgewählt.
4. `Ware raus` klicken. Erwartung: Aufträge öffnen und Filter `Fertig` ist aktiv.
5. Neu auf `/start` als Gregor anmelden. Erwartung: alle sechs freigegebenen Bereiche sichtbar; kein Stufen-Schalter.
