# Review Korrektur F0-01 / F0-02 (Prüfer Claude, 27.10.2026 22:27 UTC)

Branch `kreile/s1-p2-eingang`, Commits 72e1f5b3 (F0-01), 1994c1e0 (F0-02). Erste Prüfung.

## Urteil: **PASS** (keine Blocker)

- F0-01: genau ein Bearbeitungsentwurf (SettingsAdminClient), Anzeige-Zeilen mit „Ändern“, Übernahme erst nach Server-OK. Kein Rechte-/Datenverlust.
- F0-02: `createManagedUser` gibt bestätigten Login (id, vergebenes Kürzel, Rolle, Bereiche) zurück, kein `window.location.reload()`. Kein PIN/Hash in der Rückgabe. Keine Migration.
- Farben: nur Token-Variablen; keine verbotenen Pfade.

Offen: Owner-Klickweg laut Abgabe; CI-Nachweis am Kopf vor Merge PR #154 (siehe DEZEMBER_LISTE).


## ABGABE_KORREKTUR_F0_03 (54cd80f7, 28.10. 07:28 UTC) – **PASS**

- systemSettingsPort.ts: Bezeichnung beim Anlegen/Ändern 0–120 Zeichen, leer -> NULL (DB-Constraint erlaubt NULL, kein Leertext). Feldgenaue Fehlermeldungen. Rechteprüfung (canManage) unverändert vorn.
- Lesen: bezeichnung NULL -> "" (kein Absturz beim Ändern eines Logins ohne Bezeichnung).
- SettingsAdminClient.tsx: nur Label „(optional)“ + Trennpunkt-Darstellung; keine Farben.
- Keine Migration, keine verbotenen Dateien. DB 54 = Repo 54 synchron.
- Owner-Klickweg (6 Schritte) offen.


## Prüfung 28.10. 08:28 UTC · KORREKTUR_F0_04 / F0_05 / F0_06 (Kopf 8e40eed1)

### F0_04 Loginanlage mit Kürzel (1d5c5915) — **PASS**
Formular erst über „Login anlegen“, Kürzel vorbelegt/änderbar, Server prüft 1–3 Zeichen bei Anlage und Änderung. Keine Migration. Kein Blocker. (Hinweis -> DEZEMBER_LISTE: DB-Check erlaubt weiter 8 Zeichen.)

### F0_05 Kassieren bei Abholung (df9a6720) — **PASS**
Bereich `kassieren`/`perm_cash_pickup`; ohne Geldrecht nur mit Auftragsrecht, nur `payment_mode=abholung` und `station=fertig`, Betragsgrenze bleibt, Developer ausgeschlossen. Migration 20261028081227 additiv (Constraint ersetzt, INSERT … ON CONFLICT DO NOTHING), nichts gelöscht; Remote angewandt (55 = Repo 55). Oberfläche folgt mit F3.

### F0_06 Mein Code als Dialog (abab98c6 + 8e40eed1) — **FAIL, 1 Blocker**
Funktion korrekt: Nicht-Verwalter erhalten serverseitig nur die eigene Zeile (`users.filter(isCurrent)`), Dialog statt Dauerblock.

1. **Farbe nicht aus tokens.css** — `src/app/settings/settings.module.css:112` `background: rgb(21 34 48 / 48%);` ist frei erfunden. Änderung: `background: var(--scrim);` und, da `--scrim` in `src/styles/tokens.css` fehlt, dort exakt den Wert aus `docs/project/linie/ui/designsystem_v1_1/tokens.css:39` ergänzen: `--scrim: rgba(18,22,31,.55);`. Sonst nichts ändern (eine Korrekturrunde).


## Zweite Prüfung 28.10. 09:28 UTC – KORREKTUR_F0_06 (Kopf a6b3fa46)

**PASS** – Blocker 1 behoben: `settings.module.css:112` jetzt `background: var(--scrim);`, `src/styles/tokens.css` ergänzt `--scrim:rgba(18,22,31,.55);` exakt wie `designsystem_v1_1/tokens.css:39`. Ein Commit, 2 Zeilen, keine weiteren Änderungen, keine Migration. Owner-Klickweg (Mein Code) offen.
