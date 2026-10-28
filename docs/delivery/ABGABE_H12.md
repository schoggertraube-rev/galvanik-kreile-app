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

## H12.3 – verkleinerter F0/F2-Schema-Gate

- Befund: Die F0/F2-Reads wurden in CI nicht gemeinsam gegen die frisch replayte Datenbank geplant; eine nicht vorhandene Spalte konnte deshalb bis zur Laufzeit gelangen.
- Fundstellen: `scripts/quality/check-f0-f2-schema.mjs:1`, `package.json` und `.github/workflows/quality.yml` direkt nach dem frischen P3-Replay.
- Änderung: Zehn benannte SQL-Verträge aus Login, Rechte und „Der Tag“ laufen per PostgreSQL `EXPLAIN` gegen die frische Replay-Datenbank. Der Selbsttest fragt absichtlich `definitely_missing_h12_column` ab und ist nur grün, wenn der Gate diese Spalte ablehnt.
- Abgrenzung U-217: Der Gate umfasst nur F0/F2. Die Ausweitung auf SQL in allen gegen `main` geänderten Dateien gehört ausschließlich zu H16.
- DB-Soll: reiner Schema-Read; keine Zeile wird angelegt, geändert oder gelöscht.

## Owner-Klickweg

1. Als Rolf anmelden.
2. **Der Tag** öffnen.
3. Prüfen: Die Seite lädt ohne Fehlermeldung und zeigt den vorhandenen Tagesbestand.
4. Bei einem Auftrag **Weitere** öffnen; der Delegationsbereich darf keinen Datenbankfehler zeigen.

Erwartete DB-Zeilen: keine neue oder geänderte Zeile durch das reine Öffnen.
