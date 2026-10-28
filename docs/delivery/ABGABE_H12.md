# ABGABE H12 – Der Tag ohne Schemafehler und Namensersatz

Stand: 28.10.2026

Branch: `kreile/s1-p2-eingang`

Dev-Datenbank geändert: nein

Production-/Live-Daten geändert: nein

## H12.1 – vorhandene Loginspalte verwendet

- Befund: Die Delegationsabfrage sortierte nach `app_users.display_name`; diese Spalte existiert nicht und ließ „Der Tag“ für Logins mit `auftraege` mit PostgreSQL-Code 42703 abbrechen.
- Fundstelle vor der Bereinigung: `src/lib/server/todayDashboard.ts:127`.
- Änderung: Die SQL sortiert deterministisch nach der vorhandenen Spalte `app_users.full_name` und anschließend nach `app_users.id`.
- DB-Soll: keine Datenänderung. Die Abfrage liest aktive Logins mit Bereich `auftraege`; bestehende Zeilen bleiben unverändert.

## H12.2 – Delegationsziele und Namen aus der Datenbank

- Befund: Der Read wählte nur eine Ziel-ID; die Oberfläche beschriftete und verbuchte dieses Ziel fest als „Phillip“.
- Fundstellen vor der Bereinigung: `src/lib/server/todayDashboard.ts:115` und `src/components/home/RolfHomeClient.tsx:85`.
- Änderung: Der Read liefert alle anderen aktiven Logins mit Bereich `auftraege` als `{ userId, displayName }`, sortiert nach `app_users.full_name` und ID. Das Menü zeigt gemäß BAUPLAN M5 je Ziel „an {login} geben“ und übergibt genau dessen DB-ID an den bestehenden Serverbefehl. Gibt es kein Ziel, entfällt **Weitere**.
- DB-Soll: keine Datenänderung beim Lesen. Erst der Owner-Klick legt über den bestehenden Zuweisungsbefehl genau eine aktive Aufgabenzuweisung mit gewähltem Empfänger, Geber und Frist an.

## Owner-Klickweg

1. Als Rolf anmelden.
2. **Der Tag** öffnen.
3. Prüfen: Die Seite lädt ohne Fehlermeldung und zeigt den vorhandenen Tagesbestand.
4. Bei einem Auftrag **Weitere** öffnen; der Delegationsbereich darf keinen Datenbankfehler zeigen.

Erwartete DB-Zeilen: keine neue oder geänderte Zeile durch das reine Öffnen.
