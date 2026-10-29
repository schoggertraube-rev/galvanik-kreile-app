# Abgabe H18 – Schreibaktionen ohne Wirkung

Stand: 29.10.2026  
Produktkandidat: `3e5e211e985bd89de25d1438a4dfebb590dce459`  
CI: PASS, [agentur-gate 40908805264](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/40908805264)  
Exact-SHA-Preview: [https://galvanik-kreile-werkstatt-97wn1k17y.vercel.app](https://galvanik-kreile-werkstatt-97wn1k17y.vercel.app), Vercel-Status `READY`/Deployment `7417639246`

## Befund und gemeinsame Ursache H18.1–H18.3

Die Actions kamen am Server an. Der eigentliche Schreibfehler lag innerhalb derselben DB-Transaktion: Die `UPDATE`-/`INSERT`-Operation wurde beim anschließenden `ui_events`-Write vollständig zurückgerollt, weil die von Drizzle gebundenen Werte in `jsonb_build_object` keinen eindeutigen PostgreSQL-Typ hatten. Deshalb blieben sowohl Nutzerdaten als auch Ereigniszeile unverändert. Die UI zeigte die zurückgegebene Fehlermeldung zugleich hinter der offenen Aktionsfläche; für die Owner wirkte der Klick daher folgenlos.

- Typfeste Event-Writes: `src/modules/fundament/server/systemSettingsPort.ts:250`, `:322`, `:382`, `:406`.
- Serverlog mit stabilem Fehlercode an allen Settings-Port-Catches: `src/modules/fundament/server/systemSettingsPort.ts:60`, `:132`, `:253`, `:385`, `:409`.
- Action-/Sessionpfad: `src/app/actions/settings.actions.ts:41`, `:122`, `:159`.
- Meldung an der aktiven Fläche und Schließen nur nach Erfolg: `src/app/settings/SettingsAdminClient.tsx:111`, `:246`, `:333`, `:348`; zentraler Baustein `src/ui/kr/Dialog.tsx:25`.

H18.4 ist laut BAUPLAN F0 vorgesehen: Name, Kürzel, Bezeichnung, Code und Aktivstatus sind bearbeitbar. Eine reine Namensänderung hält die eigene Sitzung gültig; eine Code-/Aktivänderung erneuert beziehungsweise entzieht die betroffene Sitzung wie vorgesehen.

H18.5 hat jetzt einen echten Rückweg über `Schließen` auf die aufrufende Route; belegt mit `/orders`.

## Auftragskarte H18.6–H18.7

- Ursache H18.6: Der Integritäts-View akzeptierte nur den Liefertermin des Eingangsbelegs und berücksichtigte einen späteren gültigen `ORDER_PROMISED_DUE_DATE_CHANGED_V1`-Beleg nicht.
- Additive Korrektur ohne Datenpatch: `supabase/migrations/20261029173000_h18_order_intake_due_change_integrity.sql:28` bindet den neuesten gültigen Terminänderungsbeleg ein.
- Die Kartenlesung gibt einen stabilen Code zurück: `src/lib/server/orderCardRead.ts:733`.
- `getOrdersDb` behält jede operative Zeile und ergänzt den Lesecode: `src/app/actions/orders.actions.ts:369`.
- Die Liste zeigt den Auftrag rot als `Lesefehler · <CODE>` statt ihn auszublenden: `src/app/orders/OrdersAppAdapter.tsx:103`.

## Replay-DB- und CI-Nachweis

- `src/test/h18_settings_actions.integration.test.ts`: H18.1–H18.7 rufen die echten Server Actions in echter Next-Request-/Session-Kette auf und prüfen die realen DB-Zeilen.
- `src/test/h18_settings_client.integration.test.tsx`: H18.1–H18.3 und H18.5 prüfen die sichtbaren Aktionsmeldungen, Erfolgs-Schließen und den Rückweg mit echten Action-Antworten.
- Lokal: 10/10 H18-Tests grün; TypeScript grün.
- CI: frischer Replay aller Migrationen, exakte Repo-/DB-Migrationsliste, H12-Verträge, H18-Integration, H16, H18.8 und 1.038 Unit-Tests grün.
- H18.8: `scripts/quality/check-h18-server-actions.mjs:148`; Inventar 249 Actions, 100 Schreib-Actions, davon 5 mit neuem Replay-Test und 95 explizite Bestandsausnahmen. Die Bestandsliste darf nach der Einführung nur schrumpfen.
- H16.2: Die Server-Port-Ausnahmen für `communicationPort.ts` und `microsoftGraph.ts` sind leer; alle Server-Port-Catches loggen jetzt mit Code.

## DB-Soll nach dem Owner-Klick

1. Nach „Mein Code“ existiert genau ein neues `public.ui_events`-Ereignis `own_pin_changed` für Gregor; der neue Hash verifiziert den eingegebenen Code.
2. Nach dem Rechte-Haken existiert die neue beziehungsweise aktualisierte Zeile in `public.app_user_rights`; `granted_by` verweist auf Rolfs `app_users.id`.
3. Eine Namensänderung steht in `public.app_users.full_name`; eine reine Metadatenänderung widerruft keine Sitzung.
4. A-2026-0001 öffnet trotz des Terminänderungsbelegs; `orders.due_date`, `orders.promised_due_date` und der neueste Terminänderungsbeleg stimmen überein.
5. Ein fachlich nicht lesbarer Auftrag bleibt in der Auftragsliste sichtbar und trägt seinen `ORDER_CARD_*`-Code.

## Owner-Klickweg

1. [Exact-SHA-Preview öffnen](https://galvanik-kreile-werkstatt-97wn1k17y.vercel.app) und mit dem bestehenden Rolf-Zugang anmelden.
2. `Einstellungen` → `Logins & Rechte` → beim eigenen Login `Mein Code`; Code zweimal eingeben und speichern. Erwartet: Dialog schließt erst nach Erfolg, Meldung „Neuer Code gespeichert“ ist sichtbar.
3. Erneut anmelden, `Einstellungen` → `Logins & Rechte` → einen anderen Login `Ändern`; Name und neuen Code speichern. Erwartet: Meldung direkt an der Bearbeitung und gespeicherter Name.
4. In derselben Ansicht einen erlaubten Rechte-Haken für den anderen Login setzen. Erwartet: „Recht ist sofort wirksam.“
5. `Schließen` wählen. Erwartet: Rückweg nach `/orders`, kein funktionsloser Button.
6. A-2026-0001 öffnen. Erwartet: Auftragskarte lädt. Liefertermin ändern, Karte schließen und erneut öffnen. Erwartet: Karte lädt weiterhin mit dem neuen Termin.
7. Auftragsliste öffnen. Erwartet: Kein Auftrag verschwindet still; ein Lesefehler wäre als rote Zeile mit Code sichtbar.

Codex hat gemäß Regel 4d keinen Owner-Klicktest und keine Mutation der Live-/Dev-Produktdaten ausgeführt. Die Schreibnachweise liefen ausschließlich auf der lokalen Replay-DB. Kein Merge und kein Production-Deploy wurden ausgeführt.
