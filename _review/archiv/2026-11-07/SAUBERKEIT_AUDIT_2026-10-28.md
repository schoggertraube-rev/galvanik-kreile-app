# Sauberkeits-Audit Kreile-App – 28.10.2026

Prüfer: Planungschat (Claude). Es wurde nur gelesen. Grundlage sind Code `kreile/s1-p2-eingang` @ 70c93ef6 und die Dev-DB `syhaigjhsbpjmtnggqka`. Die Prüfung hatte drei Teile: zwei Wahrheiten (UI ↔ Server), Mock und Schmutz, Datenbank.
Nachtrag 28.10. abends: Befunde 2–4 sind lokal mit 5a090dc0 (H11) angegangen. Was noch fehlt, steht in AKTUELLE_ANWEISUNG.md bei H11. Die Bereinigung ist durch U-216 freigegeben; die Reihenfolge ist H11 → H12 → H13 → H14 → H15 → H16.

## Gesamtbild

- **Der erreichbare Kern ist weitgehend echt.** Erfolgsmeldungen hängen an Server-Belegen. Die Bereichsliste und die Zahlungsarten der Aufträge stimmen zwischen UI, Server und DB.
- **Daneben gibt es drei Arten von Dreck:**
  1. **Zwei bis drei Regelquellen nebeneinander.** Bei Rechten, Stationen, Zahlungsbedingungen und Stufen-Schaltern prüft die Oberfläche etwas anderes als der Server.
  2. **Stille Ersatzwerte.** Ein fehlender DB-Wert sieht aus wie ein echter (19 % USt, Zahlungsziel 14 Tage, „Deutschland“, Firmendaten). Ein Speichern schreibt ihn fest.
  3. **Toter Code und Altlasten.** 370 von 630 Produktdateien (~41.000 Zeilen) sind von keiner Seite erreichbar. Dazu kommen ein zweiter Erfassungsfluss, drei Einstellungs-Clients, Mock-Datenbestände, 15 live erreichbare 503-Routen, rund 30 ungenutzte Tabellen und Testdaten ohne Kennzeichnung in derselben DB wie der spätere Echtbetrieb.

## Hoch – sofort

| # | Befund | Fundstelle |
|---|---|---|
| 1 | **„Der Tag“ wirft einen Fehler** für jeden Nutzer mit Bereich „Aufträge“: Die Abfrage nutzt die Spalte `display_name`, die es nicht gibt. Außerdem ist das Delegationsziel fest „Phillip“, und gewählt wird „der erste aktive Nutzer“. | `todayDashboard.ts:115-128`, `RolfHomeClient.tsx:92-93` |
| 2 | **Entwickler-Sonderregel:** Matrix, Auftragskarte, Schnellaktionen und Rechnungen zeigen Gregor als berechtigt. 6 Server-Befehle lehnen `role==="developer"` trotzdem ab. | `orderStationCommand.ts:236,663`, `setPaymentModeCommand.ts:283`, `confirmPaymentCommand.ts:494`, `recordGoodsOutCommand.ts:380`, `immutableInvoiceCommand.ts:903,1198` |
| 3 | **Inaktive Nutzer** sehen in den Einstellungen aus wie aktive. In der DB haben sie 19 Rechte. | `systemSettingsPort.ts:63-79`, `SettingsAdminClient.tsx:278,290` |
| 4 | **Rolf fehlt „Logins & Rechte verwalten“.** | `app_user_rights`, `settings.actions.ts:98,113,124` |
| 5 | **UI prüft einen anderen Bereich als der Server:** Kassieren wirkt im UI nicht, Inhalt bearbeiten (auftraege ↔ eingang), Kunde anlegen (eingang reicht im UI, nicht am Server), KV anlegen (Server verlangt zusätzlich geld). | `OrderCardAppAdapter.tsx:689,742`, `CustomersAppAdapter.tsx:88`, `GlobalCreateAppAdapter.tsx:40` |
| 6 | **Zahlungsziele:** Das UI bietet rechnung_14/30 an und setzt sie als Vorgabe. Der Server lehnt sie ab, also schlägt das Speichern fehl. In der DB haben 3 Kunden `rechnung_14` ohne freigeschaltetes Ziel. | `CustomerCardView.tsx:249`, `createCustomerCommand.ts:91` |
| 7 | **Stufen-Schalter ohne Wirkung:** `tenant_features` (35 Zeilen) liest niemand. Gesteuert wird fest im Code. | `proxy.ts:9`, `todayDashboard.ts:52` |
| 8 | **Stille Ersatzwerte:** Firmendaten (Zahlungsziel 14, Logo, Land), Kunde (rechnung_14, Deutschland), Position (USt 19 %, „Stück“). | `systemSettingsPort.ts:46-48,87`, `CustomerCardView.tsx:248-249`, `GlobalCreateFlow.tsx:1472,1488` |
| 9 | **Tenant-Default im Schema:** Ein Insert ohne Tenant landet still bei Kreile. `src/db/**` ist vom Lint ausgenommen. | `src/db/schema.ts` (20×) |
| 10 | **Zwei Rechnungswahrheiten:** Alt-Demo-Rechnungen (`ausgangsrechnung`, `is_demo`) speisen weiter Kundenumsatz und Offene Posten. `orders.payment_status` ist überall `unpaid`, auch bei einer bezahlten Rechnung. | `customers.actions.ts:306`, DB |
| 11 | **Testdaten nicht gekennzeichnet:** Alle 12 Kunden und 8 Aufträge sind Testdaten. Preview und Production hängen an derselben DB. | DB |

## Mittel

- DB-Ausfall erscheint als „Sitzung nicht verfügbar“ (`resolveAuthorization().catch(() => null)`, 13 Stellen).
- Kundenliste ohne Bereichsprüfung am Server (`getCustomersDb`, `customers.actions.ts:166-176`).
- Zweiter Erfassungsfluss (`src/components/erfassung/**`) mit dauerhaft gesperrten Knöpfen und `alert("… (WIP)")`/„(Demo)“. Er ist im Layout eingehängt, aber nicht erreichbar.
- Vier Stationsspalten je Auftrag und drei Stationslisten im Code. Das Event schreibt `wareneingang`, der Auftrag `angenommen`.
- Fünf Rollenlisten. `ROLE_PERMISSIONS` (`authorizationContract.ts:128`) ist eine zweite Rechtematrix. `app_users.role` hat keinen CHECK.
- 15 Stub-API-Routen sind live erreichbar (503, `quarantine.ts`), dazu ~10 Stub-Actions. Fake-Lizenz/Quota (`license.config.ts`) hängt im Root-Layout.
- 47 Constraints sind `NOT VALID`. `calendar_events` zeigt auf gelöschte Aufträge (kein FK).
- Drizzle-Schema und DB weichen ab (~35 Spalten). `lager_artikel`/`qs` stehen im Schema, existieren aber nicht. Deshalb sind `/lager`, `/kontrolle` und `/performance` kaputt.
- Tenant per Konstante statt aus der Sitzung (`operationalOrders.ts`, `startUserRead.ts`, `pinRateLimit.ts`).

## Niedrig

Mock-Namen in Produktiv-CSS, `NODE_ENV==="test"`-Zweige im Produktcode, Arbeitsmüll im Repo (`*.bak`, `*.disabled`, Logs), doppelte Suche, Event-Rauschen (`USER_LAST_SEEN` 182 von 231).

## Warum das passiert ist

Gebaut wurde lange ohne verbindliche Vorgabe und ohne Wächter, die Widersprüche automatisch finden. Jede neue Schicht (Rollen → Rechte, Altfluss → neuer Fluss) kam **neben** die alte statt **an ihre Stelle**. Die alte Schicht blieb aktiv, oder zumindest im Code.

## Damit es nie wieder passiert: automatische Wächter (CI rot bei Verstoß)

1. **Eine Rechte-Quelle:** `can(nutzer, aktion)` wird nur aus Bereichen abgeleitet. Server-Befehle und UI nutzen ausschließlich diese Funktion, und das UI bekommt das Ergebnis vom Server. **Paritätstest:** Für jeden aktiven Nutzer und jede Aktion muss gelten: Matrix-Haken ⇔ `can()` ⇔ Server-Ergebnis.
2. **Lint-Verbote:** `role ===` außerhalb von `can()`; `ROLE_PERMISSIONS`; Personennamen (Rolf/Phillip/Gregor) im Code; `alert(`, „WIP“/„Demo“/„mock“; stille `catch` (`catch {}`, `.catch(() => null|[])`); Ersatzwerte (`??`/`||` mit Literal) auf Geschäftsfeldern; Tenant-Literal-Default in `src/db`.
3. **Enum-Parität:** CHECK-Werte aus der DB = Konstanten im Code = Auswahllisten im UI (Zahlungsarten, Zahlungsbedingungen, Stationen, Rollen, Bereiche, Stufen-IDs). Fehlende CHECKs werden ergänzt (`app_users.role`, `orders.station`).
4. **Schema-Test:** Alle SQL-Abfragen laufen per `EXPLAIN` gegen eine frische DB. Drizzle und DB werden verglichen. Jede referenzierte Tabelle muss existieren. (Das hätte den Fehler in „Der Tag“ sofort gefunden.)
5. **Dead-Code-Gate** (`knip`): keine unerreichbaren Dateien oder Exporte, keine `src/app`-Ordner ohne Seite, keine `*.bak`/`*.disabled`/Logs. Stub-Routen ohne Aufrufer sind verboten.
6. **Aktiv-Regel:** Jede Abfrage auf Nutzer filtert `active`, außer in der Verwaltung, und dort mit sichtbarem Inaktiv-Kennzeichen.
7. **Stufen aus der DB:** Freischaltungen von Routen und Feldern werden aus `tenant_features` abgeleitet, nichts fest im Code.
8. **Nächtlicher Konsistenzbericht** (reines SQL): verwaiste Zeilen, Station-Spiegel, Zahlung ↔ Rechnung, Rechte Inaktiver, Testdaten in Produktansichten. Alles muss 0 sein, sonst Meldung an den Planungschat.
9. **Umgebungs-Schutz:** Die Preview startet nicht, wenn sie auf die Produktions-DB zeigt. Das gehört zu Thema 6, getrennte Produktions-DB.
