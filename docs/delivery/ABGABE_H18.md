# Abgabe H18 / C1a – Prüfer-Funktionstest

Stand: 29.10.2026

Produktkandidat und Exact-SHA-Preview: `1324d8bef162ab0b67eec46ced8231930a2db910`

Produktbaum: `400f872531dfbe9d7665862e073b6e68deaa9c0f` (identisch mit dem letzten Code-Commit `d133f45b`)

CI: PASS, [agentur-gate 40926306955](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/40926306955)

Exact-SHA-Preview: [https://galvanik-kreile-werkstatt-byz3i5r9n.vercel.app](https://galvanik-kreile-werkstatt-byz3i5r9n.vercel.app), Vercel-Status `READY`, Deployment `7420182725`

`1324d8be` ist der einmalige, baumgleiche Preview-Neustart nach einem fehlgeschlagenen Vercel-Lauf des Code-SHA `d133f45b`. Zwischen beiden Commits gibt es keine Code- oder Dateidifferenz.

## C1a.1 – Dev-Migration und Gleichstand

- Die additive Migration `supabase/migrations/20261029173000_h18_order_intake_due_change_integrity.sql:1` wurde mit `supabase migration up --linked --yes` auf die Dev-DB angewendet.
- Sie berücksichtigt den neuesten gültigen `ORDER_PROMISED_DUE_DATE_CHANGED_V1`-Beleg (`:28`) und berechnet daraus die Integrität des Eingangsbelegs (`:99`). Es gab keinen Datenpatch.
- Gleichstand belegt: `DEV_DB_REPO_MIGRATIONS=PASS count=61 last=20261029173000`.
- Der echte Replay-DB-Test ändert den Liefertermin über die Server-Action und öffnet die Karte anschließend erneut: `src/test/h18_settings_actions.integration.test.ts:320`.

## C1a.2–C1a.7 – Befunde und Korrekturen

2. **Wartung bleibt ausschließlich für developer fest.** Die gemeinsame Rollenprüfung sperrt `wartung` für alle anderen Rollen (`src/lib/auth/authorizationContract.ts:105`), die Oberfläche verwendet dieselbe Prüfung (`src/app/settings/SettingsAdminClient.tsx:353`), und der Server weist den Schreibversuch mit einem fachlichen Code zurück (`src/modules/fundament/server/systemSettingsPort.ts:362`). Der echte Action-/DB-Test steht in `src/test/h18_settings_actions.integration.test.ts:225`.
3. **„Der Tag“ unterscheidet vorhandene Aufträge von fehlendem Handlungsbedarf.** Die Projektion ermittelt, ob überhaupt Aufträge vorhanden sind (`src/components/home/OfficeHomeClient.tsx:74`), und zeigt bei acht Aufträgen ohne aktuelle Aufgabe „Nichts offen“ statt „Noch keine Aufträge erfasst“ (`:129`). Der echte `getOrdersDb`-/Replay-DB-Test steht in `src/test/h18_settings_actions.integration.test.ts:416`.
4. **Umbenennen aktualisiert `app_users.updated_at`.** Alle drei vorhandenen Update-Zweige setzen jetzt `updated_at=statement_timestamp()` (`src/modules/fundament/server/systemSettingsPort.ts:245`). Der echte `saveManagedUserAction`-/DB-Test prüft Name, Ereignis und vorwärts laufenden Zeitstempel (`src/test/h18_settings_actions.integration.test.ts:274`).
5. **Zahlungsbestätigung ist am Handlungsort sichtbar und im Verlauf belegt.** Der Dialog schließt nur nach erfolgreicher Action; Fehler bleiben im Dialog (`src/modules/orders/ui/OrderCardView.tsx:278`). Die Karte liest das persistierte Zahlungsereignis (`src/app/orders/OrderCardAppAdapter.tsx:133`) und zeigt es im Verlauf (`src/modules/orders/ui/OrderCardView.tsx:226`). Der echte `confirmPaymentAction`-/DB-Test prüft `payments` und `PAYMENT_CONFIRMED_V1` (`src/test/h18_settings_actions.integration.test.ts:467`).
6. **Interne Dokumentcodes sind übersetzt.** `LEGACY_SCAN_UPLOAD` erscheint als „Übernommener Scan“ und `LEGACY_RECORDED` als „Original erfasst“ (`src/modules/orders/ui/OrderCardView.tsx:104`, `:110`). Der echte `getLiveOrderCardAction`-/DB-Test liest den Bestandsbeleg aus seiner realen Datenbankzeile (`src/test/h18_settings_actions.integration.test.ts:573`).
7. **Auftragskarten lesen nur zugeordnete Mails.** `listOutlookInboxAction` leitet bei einem Auftrag in den zugeordneten Lesepfad (`src/app/actions/communications.actions.ts:31`), dessen Query auf `communication_threads.order_id` begrenzt ist (`src/lib/server/communicationPort.ts:79`, `:111`). Ohne Zuordnung erscheint der ehrliche Leerzustand (`src/components/communication/CommunicationPanel.tsx:122`). Der echte Action-/DB-Test legt einen zugeordneten und einen fremden Thread an und erwartet ausschließlich den zugeordneten (`src/test/h18_settings_actions.integration.test.ts:650`). Der Mail-Kanal selbst wurde nicht verändert oder geöffnet.

## Replay-DB-, Wächter- und CI-Nachweis

- Lokal und in CI: 13/13 H18-Integrationstests grün. Sie rufen die echten Server-Actions über die echte Sessionkette gegen eine frisch aus allen Migrationen aufgebaute lokale Replay-DB auf und prüfen die betroffenen DB-Zeilen.
- CI `h16-schema`: vollständiger Migrations-Replay, H12-SQL-Verträge und alle H18-Actiontests grün.
- CI `agentur-gate`: Delivery-Verträge, TypeScript, H16, H18.8 und vollständiger Unit-Lauf grün.
- H18.8: Inventar 249 Server-Actions, 100 Schreib-Actions, 6 mit dem neuen echten Replay-Actiontest, 94 explizite Bestandsausnahmen. Eine neue ungetestete Schreib-Action macht CI rot; die Ausnahmeliste darf nur schrumpfen.
- Lokaler Produktbuild und TypeScript-Lauf waren vor dem Push grün. Der lokale vollständige Unit-Lauf hatte ausschließlich zwei Authority-Gate-Abweichungen durch vorhandene, nicht zu diesem Auftrag gehörende Arbeitsbaumdateien; der saubere CI-Checkout ist vollständig grün.

## DB-Soll nach dem Owner-Klick

1. `supabase_migrations.schema_migrations` endet bei `20261029173000`; Repo und Dev-DB enthalten dieselben 61 Migrationen.
2. A-2026-0001 öffnet ohne `ORDER_CARD_INTAKE_RECEIPT_INVALID`; Liefertermin und neuester gültiger Terminänderungsbeleg stimmen überein.
3. Ein Wartungs-Haken für Rolf oder eine andere Nicht-developer-Rolle bleibt deaktiviert; es entsteht keine entsprechende Zeile in `public.app_user_rights`.
4. Bei vorhandenen Aufträgen ohne aktuelle Aufgabe zeigt „Der Tag“ „Nichts offen“; die acht Auftragszeilen bleiben unverändert.
5. Nach einer Login-Umbenennung enthält `public.app_users.full_name` den neuen Namen und `updated_at` ist größer als vor dem Klick.
6. Nach einer neuen erfolgreichen Zahlungsbestätigung existieren die passende Zeile in `public.payments` und genau das zugehörige `public.order_events`-Ereignis `PAYMENT_CONFIRMED_V1`; die Oberfläche zeigt Erfolg und Verlaufseintrag.
7. A-2026-0008 zeigt „Übernommener Scan · Original erfasst“; die gespeicherten Quellcodes bleiben unverändert.
8. Eine Auftragskarte zeigt nur `communication_threads`/`communication_messages` mit ihrer eigenen `order_id`; ohne Zuordnung bleibt die Liste leer. Fremde Threads erscheinen nicht.

## Owner-Klickweg

1. [Exact-SHA-Preview öffnen](https://galvanik-kreile-werkstatt-byz3i5r9n.vercel.app) und mit einem bestehenden Zugang anmelden.
2. Als Rolf `Einstellungen` → `Logins & Rechte` öffnen. Erwartet: „Wartung, Stufen & Anbindungen“ ist bei Rolf und allen Nicht-developer-Logins deaktiviert; Gregors developer-Festbereich bleibt unveränderlich.
3. Einen bestehenden Nicht-owner-Login umbenennen und speichern. Erwartet: Erfolgsmeldung direkt an der Bearbeitung; Name bleibt nach Neuladen erhalten. Danach den ursprünglichen Namen wiederherstellen und beide `updated_at`-Fortschritte in der DB prüfen.
4. Als Phillip `/` öffnen. Erwartet: Bei vorhandenen Aufträgen ohne persönliche Aufgabe steht „Nichts offen“, niemals „Noch keine Aufträge erfasst“.
5. A-2026-0001 öffnen. Erwartet: Die Karte lädt ohne `ORDER_CARD_INTAKE_RECEIPT_INVALID`.
6. A-2026-0008 öffnen und „Fotos & Dokumente“ prüfen. Erwartet: „Übernommener Scan · Original erfasst“, keine internen Codes.
7. Eine noch unbezahlte, zur Zahlungsbestätigung freigegebene Auftragskarte öffnen, Zahlung bestätigen. Erwartet: Dialog schließt nur bei Erfolg, die Erfolgsmeldung steht auf der Karte und im Verlauf erscheint „Zahlung bestätigt“ mit Zahlart. Danach die in Abschnitt „DB-Soll“ genannten Zahlungszeilen prüfen.
8. Den Mail-Bereich auf zwei Auftragskarten prüfen. Erwartet: nur dem jeweiligen Auftrag zugeordnete Mails oder „Diesem Auftrag sind keine Mails zugeordnet“; keine identische globale Rückläuferliste.

Codex hat gemäß Regel A7 keinen Owner-Klicktest ausgeführt. Außer der ausdrücklich freigegebenen additiven Dev-Migration wurden keine Dev-Produktdaten verändert; Live-/Produktionsdaten blieben unverändert. Es gab keinen Merge und keinen Production-Deploy.
