# Review Q07 – Nutzer: eine Wahrheit

Geprüft: 27.10.2026 13:36 UTC · Branch kreile/s1-p2-eingang · Commit 05c4ca03 (Abgabe nennt Produkt-SHA 9ecc67ba)

Urteil: **PASS**

Geprüft:
- startUserRead.ts: Startkacheln nur aus app_users (Tenant, active=true); ohne Name/Rolle/PIN -> UNAVAILABLE statt Teil-Liste. Keine IDs/Hashes an den Client (loginHandle).
- auth.actions.ts loginWithPin: Kandidaten = alle aktiven Tenant-Nutzer, Rolle per isAppRole geprüft, Anzeigename aus DB. Feste Drei-Personen-Liste entfernt.
- systemSettingsPort.ts: PIN genau 4 Ziffern; Selbst-Deaktivierung, letzter aktiver Nutzer, letzter Verwalter und aktiv ohne PIN serverseitig gesperrt; Zielzeile FOR UPDATE. `developer` im Dropdown.
- Nachweis: 3 aktiv = 3 Kacheln (Gregor, Phillip, Rolf), Altkonten inaktiv; Gregors Zeile gespeichert. Deckt sich mit Prüfer-Notiz 14:05 in AKTUELLE_ANWEISUNG.
- Keine verbotenen Pfade, keine Hex-Farben, keine Migration.

Nicht-Blocker -> DEZEMBER_LISTE: Vergabe der Rolle developer durch Meister/Admin; Zählung ohne Tenant-Sperre.
