# BAUREGELN Kreile-WerkstattCockpit (ab Neustart 07.11.2026 – ersetzt AKTUELLE_ANWEISUNG, MACHTWORT und alle P-Einträge)

Eine Seite. Wer baut, liest nur diese Datei, `WARTESCHLANGE.md` und das Paket. Alles in `_review/archiv/` ist Geschichte.

## 1. Rollen
- **Codex** baut (einziger Schreiber im Repo). **Endversion-Chat** liefert das WAS (Bauplan + UI-Wahrheit). **Planungschat (Claude)** plant, entscheidet offene Punkte, prüft jeden PR-Diff vor der Merge-Bitte. **Owner** merged und klickt.
- Owner-Ziel: schlank, schnell, zielgerichtet bauen – richtig beim ersten Mal, optisch und funktional nach Bauplan. Kein Pingpong.

## 2. Was gilt
- **Gebunden ist nur, was auf `origin/main` liegt.** Lieferungen des Endversion-Chats gehen nach `_review/lieferung_<runde>/`; erst der Planungschat bindet sie nach Owner-Freigabe. Änderungen im Arbeitsbaum unter `docs/project/endversion/**` sind nie Bauvorgabe.
- **Welche Quelle für welche Seite gilt, steht in `_review/SEITENHOHEIT.md`.**
- **Für die V04-Seiten (Eingang, Nachrichten-Anliegen, Werkstatt-Übersicht, KV) ist die Owner-Vorschau `_review/quellen/minimodule_v04/` die UI-Wahrheit**, die Pakete stehen in `_review/pakete/`. Sonst: **Bauplan** `docs/project/endversion/codex/BAUPLAN.json` und **UI-Wahrheit** `docs/project/endversion/ui/` (Optik exakt, CSS eingebunden, Texte wörtlich). Owner-Entscheidungen `_review/OWNER_ENTSCHEIDUNGEN.md`.
- **Eine Wahrheit:** vorhandene Tabellen, Befehle, Lese-Ports nutzen; neue Version ersetzt die alte im selben Paket; keine parallelen Wege, keine Mocks, keine Musterdaten im Produkt.
- **Nichts still entfernen:** Ein Element/Klickweg fällt nur weg, wenn Bauplan oder Owner es ausdrücklich streichen.

## 3. Ablauf je Paket (ein Paket = ein PR gegen main, Ziel 4 h)
1. **Vor dem Bau (max. 15 min):** Paket gegen Bauplan und Code lesen, Schwachstellen in **einer** Zeile in `BAULOG.md`. Technisches selbst entscheiden und vermerken. Fragen an den PL nur bei Produktverhalten ≠ Bauplan, Lücke im Bauplan, Kosten, Datenschutz, neuem Anbieter, Echtdaten/Produktion – **immer mit Vorschlag**. Antwortet der PL nicht binnen 60 min, **gilt dein Vorschlag** (außer Kosten/Datenschutz/Anbieter/Echtdaten: dann den Teil auf die Rot-Liste `PL offen <Thema>` und weiter). Nie stehen bleiben: gibt es im Paket nichts mehr, nächster Punkt der Warteschlange.
2. **Bauen** – vollständig nach Bauplan, optisch und funktional, inkl. aller Wege (Speichern, Abbrechen, Zurück, Fehler, ohne Recht, Doppelklick).
3. **Testen schlank:** je neuem/geändertem Schreibweg **ein** echter Test gegen die lokale Replay-DB (Ergebnis in DB + Ansicht nachgelesen); gezielte Unit-Tests nur für geänderte Logik. **Keine** lokalen Gesamtläufe, keine Wiederholungsläufe „zur Sicherheit“. CI macht den Rest.
4. **Sicht einmal** je PR auf den berührten Seiten (`pruefe_sicht --nur <Seiten>`); bestanden = kein neues Rot an berührten Stellen. Rot an unberührten Stellen, Musterdaten im Sichtvertrag, fehlende Route → Gelb mit Grund, nie Stopp.
5. **Fehlschlag:** je Befund ein Fixversuch; danach Fall auf `e2e/generated/_erwartet_rot.json` mit Grund und weiter. Keine Reparaturschleifen.
6. **Fertig:** Pflicht-Checks `quality` + `agentur-gate` + `Fresh Supabase replay` grün (Fresh rot nur wegen Infrastruktur, z. B. 502/Timeout: einmal neu starten) → Draft aus, Auto-Merge an, **eine** Merge-Bitte an die Owner (PR-Link, in einfacher Sprache was drin ist, Preview genau des SHA). Danach sofort das nächste Paket.

## 4. Freigaben (stehen, nie nachfragen)
- Dev-DB `syhaigjhsbpjmtnggqka` und lokale Replay-DB sind Testsysteme: Migrationen (neue Datei, nie bestehende ändern; Abbruchprobe, dann anwenden, Gleichstand Repo = Dev belegen) und **als TEST markierte** Testdaten frei. Vorhandene Daten nicht ändern/löschen.
- `_review/**` pflegt der Planungschat. Codex staged dort nichts – außer einmal im Governance-PR #189 (Neuordnung) und eigene Zeilen in `BAULOG.md` werden nie committet.
- Git: eigene Branches, Push, PR anlegen/ändern, Rebase – frei. **Nie:** Merge, Production, Secrets in Dateien, Vercel-CLI-Deploys (Previews nur aus Git), `git stash`.
- Preview-Zugang für Sichtläufe über die bestehende Vercel-Anmeldung (kurzlebiger OIDC nur im Prozess) – kein Warten auf Freigabelinks.
- **Nachtbetrieb:** keine Owner-Popups zwischen 22:00 und 07:30 außer der Merge-Bitte; die Merge-Bitte darf liegen bleiben – nach dem Push sofort das nächste Paket auf eigenem Branch von main (nicht gestapelt auf den offenen PR; ein Rebase nach dem Merge ist erlaubt).

## 5. Melden
- **Owner-Popups nur** für die eine Merge-Bitte je PR und echte Owner-Entscheidungen (Abschnitt 3.1). Alles andere eine Zeile in `BAULOG.md`.
- `BAULOG.md`: eine Zeile je Commit/Entscheidung (Zeit, SHA, was, Ergebnis). Kein Prosa-Bericht, keine Wiederholung.
- Der Planungschat antwortet im selben Log unter **PL** und arbeitet offene Punkte innerhalb von 60 min ab.
