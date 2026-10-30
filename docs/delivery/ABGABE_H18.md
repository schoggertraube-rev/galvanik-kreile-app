# Abgabe H18.8 – Schreibaktionen gegen die Replay-DB

Stand: 30.10.2026, 01:10 Uhr

Produktkandidat: `617e776ac7e497bba410ca05fc1dd5194db2d333`

Exact-SHA-Preview: [https://galvanik-kreile-werkstatt-ouqtv2eth.vercel.app](https://galvanik-kreile-werkstatt-ouqtv2eth.vercel.app)  
Vercel-Status: `READY` / GitHub-Deployment `7427230666`

PR: [#154](https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154), Basis `main`, nicht gemergt.  
PR #152 und #153 wurden mit dem Vermerk „in #154 enthalten“ geschlossen; ihre Branches wurden nicht gelöscht.

## Ergebnis

- H18.8: `34 von 100` Schreibaktionen mit echten Action-/Replay-DB-Tests belegt; Ausnahmeliste von 94 auf 66 geschrumpft.
- Frische lokale Replay-DB: 65 Migrationen, 8/8 H18-Dateien, 29/29 Tests grün.
- Jeder gelistete Test ruft die öffentliche Server-Action wie die UI auf, prüft DB-Zeile und Ereignis und liest anschließend die zugehörige Ansicht beziehungsweise den Beleg neu.
- Dev-DB: Repo = Dev `65/65`, letzter Stand `20261030005000`.
- Neue additive Migration: `supabase/migrations/20261030005000_invoice_number_suffix_width.sql`.
- Ursache des gefundenen Produktfehlers: PostgreSQL `lpad(v_number::text, 4, '0')` kürzte Rechnungsnummern ab fünf Stellen und konnte dadurch eine bereits vorhandene Nummer erneut ausgeben.

## Aktionstabelle

| Aktion | Test | gefundener Fehler | Commit |
|---|---|---|---|
| `cancelInvoiceAction` | grün | keiner | `3bc0634b` Test |
| `issueInvoiceAction` | grün | Nummernsuffix ab fünf Stellen abgeschnitten | `617e776a` Fix |
| `setInvoiceItemPricesAction` | grün | keiner | `3bc0634b` Test |
| `createQuoteAction` | grün | keiner | `b43c345b` Test/Fix |
| `updateQuoteAction` | grün | keiner | `b43c345b` Test/Fix |
| `convertQuoteToOrderAction` | grün | normalisierter Beauftragungsinhalt wurde vor dem Hash nicht einheitlich behandelt | `b43c345b` Fix |
| `createCustomerAction` | grün | keiner | `a90590c0` Test |
| `updateCustomerCommercialAction` | grün | keiner | `a90590c0` Test |
| `updateCustomerNoteAction` | grün | keiner | `a90590c0` Test |
| `recordGoodsOutAction` | grün | keiner | `c63a2dbe` Test |
| `correctGalvanikToWareneingangAction` | grün | Korrekturbeleg verwendete nicht die kanonische Station | `e001a00c` Fix |
| `freezeOrderAction` | grün | keiner | `c63a2dbe` Test |
| `setOrderItemFinishedAction` | grün | keiner | `c63a2dbe` Test |
| `transitionWareneingangToGalvanikAction` | grün | keiner | `c63a2dbe` Test |
| `setPaymentModeAction` | grün | Eingangs-Readback erkannte belegten Zahlungsmodus nicht | `829f9f63` Fix |
| `assignOrderTaskAction` | grün | keiner | `470454a2` Test |
| `changeOrderContentAction` | grün | keiner | `470454a2` Test |
| `changeOrderItemExtraWorkAction` | grün | keiner | `470454a2` Test |
| `configureExtraWorkCatalogPositionAction` | grün | keiner | `470454a2` Test |
| `handBackOrderTaskAction` | grün | keiner | `470454a2` Test |
| `reopenFrozenOrderAction` | grün | keiner | `470454a2` Test |
| `changeOrderPromisedDueDateAction` | grün | keiner im Nachtlauf | vorhandener H18-Test |
| `confirmPaymentAction` | grün | Testfixture belegte den aktuellen Rechnungsnummernraum; auf Jahr 2099 isoliert | `1fcbecf6` Testfix |
| `setExtraWorkHourlyRateAction` | grün | keiner | `7d658bb9` Test |
| `saveCatalogServiceAction` | grün | Audit-Ereignis schrieb an der Modulgrenze vorbei | `0ee0ab91` Fix |
| `saveCompanySettingsAction` | grün | Firmendaten hatten mehr als einen Schreibvertrag | `e074f2f4` Fix |
| `changeOwnPinAction` | grün | keiner im Nachtlauf | vorhandener H18-Test |
| `createManagedUserAction` | grün | neue Logins erhielten Rechte nicht im selben bestätigten Schreibweg | `f2af7b6f` Fix |
| `saveManagedUserAction` | grün | Umbenennen aktualisierte `updated_at` nicht | `b0fc1f8a` Fix |
| `setManagedUserAreaAction` | grün | Rechte waren ohne ausdrücklichen Speicherweg uneindeutig | `e8e87e46` Fix |
| `notifyAdminPinReset` | grün | keiner | `66e97ac4` Test |
| `saveTodayPreferencesAction` | grün | Layoutpräferenz war nicht revisionssicher persistiert | `730d896d` Fix |
| `saveTodayReminderAction` | grün | Erinnerung schrieb kein Audit-Ereignis | `f31c2c0d` Fix |
| `createOrderIntakeAction` | grün | keiner im Nachtlauf | vorhandener H18-Test |

Testdateien:

- `src/test/h18_invoice_actions.integration.test.ts`
- `src/test/h18_quote_actions.integration.test.ts`
- `src/test/h18_customer_actions.integration.test.ts`
- `src/test/h18_workshop_actions.integration.test.ts`
- `src/test/h18_masterdata_actions.integration.test.ts`
- `src/test/h18_order_admin_actions.integration.test.ts`
- `src/test/h18_settings_actions.integration.test.ts`
- `src/test/h18_settings_client.integration.test.tsx`

## Verbleibende 66 Ausnahmen

Die verbliebenen Einträge sind nicht als getestete Schreibaktionen ausgegeben:

- 3 Cookie-/Session-Actions ohne fachliche DB-Zeile,
- 12 eingefrorene Eingang-/Mail-Actions,
- 44 ausdrücklich nicht verfügbare, ersetzte oder Stufe-2-Stubs,
- 6 reale Legacy-Actions außerhalb Verkaufsstufe 1,
- 1 bis nach Go-live gesperrte Action.

Die erforderlichen Bauplan-Entscheidungen sind in `_review/MELDUNG_PLANUNGSCHAT.md` gemeldet. Die Ausnahmeliste wurde nicht vergrößert.

## DB-Nachweis

- Lokal: vollständiger Neuaufbau aus allen 65 Migrationen erfolgreich.
- Dev: `20261030005000_invoice_number_suffix_width.sql` additiv angewendet.
- Gleichstand: 65 lokale und 65 entfernte Versionsnummern, keine Abweichung; letzte Version lokal/Dev jeweils `20261030005000`.
- H18-Testlauf: 29/29 grün; `quality:h18-server-actions:selftest` und `quality:h18-server-actions` grün.
- Es wurden keine Live-/Produktionsdaten geändert.

## CI am Produktkandidaten

BF-006-Ursache in einer Zeile: Die aktuelle App lief im Fresh-Replay noch gegen den historischen F1.3-Migrationsstand und der HTTP-Test behandelte die inzwischen kanonische Leerrechte-Rolle `readonly` weiterhin als nicht anmeldbar.

Lokaler Fixnachweis: vollständiges 65/65-Replay vor dem aktuellen App-HTTP-Vertrag; echter Meister- und Readonly-PIN-Login, echtes Session-Cookie, `UNAUTHENTICATED`/`FORBIDDEN` und unveränderte sieben Geschäftstabellen jeweils grün. Der eingefrorene Eingangscode wurde nicht geändert.

F1.4-Replay-Ursache in einer Zeile: Der unveränderte historische Rechnungstest lief auf dem F1.5-Schema mit dem heutigen, erst später eingeführten `app_user_rights`-Resolver; er ist nun per Vorfahr- und Blob-Prüfung an seinen bytegleichen Quellstand gebunden, während der aktuelle Rechnungsweg weiter im vollständigen H18-Replay läuft.

Mechanische Folgearbeit: Dieselbe harte Vorfahr-/Blob-Bindung gilt für die unveränderten historischen F1.5-Verträge und den ausdrücklich historischen F1.3-Live-Card-Gate; aktuelle Vollschema-Verträge laufen danach unverändert weiter.

| Check | Stand | Einordnung |
|---|---|---|
| Vercel | grün | Exact-SHA-Preview READY |
| `agentur-gate` (2 Läufe) | grün | Action-/Produktgate |
| `h16-schema` (2 Läufe) | grün | 29/29 H18-Tests und Replay-Schema |
| Fresh Supabase replay | läuft | historischer Gesamtreplay |
| `quality` | rot | Retargeting-Vertrag erwartet Branch `kreile/b1-shell` und B1-Allowlist |
| `ratchet` | rot | `main` hat den neuen Authority-Checker-Hash noch nicht vorautorisiert |

Die beiden roten Checks sind keine durch einen Produktfix lösbaren H18-Fehler. Ein stilles Erweitern der Allowlist oder Umschreiben der geschützten Hashprüfung wäre ein Austricksen der Wächter und wurde nicht vorgenommen. #154 ist daher nicht mergebereit.

## Owner-Klickweg

1. [Exact-SHA-Preview öffnen](https://galvanik-kreile-werkstatt-ouqtv2eth.vercel.app) und mit einem bestehenden Büro-/Meister-Zugang anmelden.
2. `Geld & Rechnungen` öffnen und bei einem fertigen Auftrag die Positionspreise speichern. Erwartet: Erfolgsmeldung, Preise nach Neuladen unverändert.
3. Rechnung ausstellen. Erwartet: Erfolgsmeldung; Rechnung erscheint nach Neuladen einmalig und die PDF lässt sich öffnen.
4. Rechnung ändern über den vorhandenen Preisweg vor Ausstellung prüfen; eine ausgestellte Rechnung bleibt unveränderlich. Storno mit Grund ausführen. Erwartet: Storno-Beleg und Storno-PDF nach Neuladen.
5. In der DB prüfen: eine `public.invoices`-Zeile, genau ein `INVOICE_CREATED_V1`-Ereignis, nach Storno genau ein `INVOICE_CANCELLED_V1`-Ereignis; `invoice_number` ist nicht abgeschnitten.
6. Einen KV anlegen und in Auftrag umwandeln; Kundenanlage/-bearbeitung, Zahlungsziel, Teil fertig, Station, Ware raus und Zahlungsmodus jeweils speichern und die Ansicht neu laden.
7. Firmendaten, Katalog und Stundensatz speichern; jeweils Erfolgsmeldung und frischen Readback prüfen.

Codex hat gemäß Warteschlange keinen Owner-Klicktest ausgeführt, nicht gemergt und nicht nach Production deployt.
