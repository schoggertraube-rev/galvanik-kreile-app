# WAHRHEITSSYSTEM UND BEWEISPFLICHT

**Das ist das Herzstück.** Es löst deine Hauptsorge: nicht angelogen zu werden. Die Lösung ist nicht „mehr Vertrauen", sondern **maschinell prüfbare Artefakte statt Worte**.

---

## 1. Das Grundprinzip

> Eine Behauptung zählt nur, wenn sie an ein Artefakt gebunden ist, das eine andere Instanz unabhängig nachprüfen kann.

„QA hat geprüft" ist wertlos. „Hier ist der Playwright-Trace, Exit-Code 0, Screenshot im Anhang" ist ein Beweis. Der Chief Verifier (GPT-5, anderes Modell als der Builder) bekommt **die Artefakte, nicht die Worte** — und kann nur freigeben, wenn sie aufgehen.

---

## 2. Klassifikation jeder wichtigen Aussage

| Kennzeichnung | Bedeutung |
|---|---|
| `FACT` | direkt durch Artefakt belegt |
| `ASSUMPTION` | plausibel, nicht bestätigt |
| `HYPOTHESIS` | zu prüfende Ursache/Wirkung |
| `RECOMMENDATION` | fachlicher Vorschlag |
| `DECISION` | verbindlich freigegeben |
| `UNVERIFIED` | nicht ausreichend belegt |

Verboten: erfundene Ergebnisse · fingierte Freigaben · pauschale Zustimmungshäkchen · Mockdaten als reale Daten · statische Zahlen als Live-Auswertung · „fertig" ohne End-to-End-Beleg · „live" ohne Produktionsnachweis · stillschweigend reduzierte Anforderungen.

---

## 3. Beweistabelle — was jede Behauptung belegen MUSS

| Behauptung | Erforderliches Artefakt (maschinell prüfbar) |
|---|---|
| „Code geschrieben" | `git diff --stat` + geänderte Dateipfade + Commit-Hash |
| „Kompiliert sauber" | `npx tsc --noEmit` → Exit 0 (Log) |
| „Linter sauber" | `npm run lint` → Exit 0 (Log) |
| „Tests laufen" | Playwright/Vitest-Report-Datei + Exit 0 |
| „Migration angewendet" | `psql`/Supabase-Query-Output gegen die **echte** DB, nicht die lokale SQL-Datei |
| „Schema aktuell" | `NOTIFY pgrst, 'reload schema'` + Drizzle-Introspect-Diff |
| „Schreibt in DB" | SELECT-Query nach der Aktion zeigt den neuen Datensatz |
| „UI passt zu CI-Mockup" | Screenshot + Pixel-Diff gegen die Mockup-HTML |
| „Funktioniert auf Tablet/Mobile" | Screenshots in den Ziel-Viewports |
| „Rollen/Rechte greifen" | Testlauf mit zwei Rollen, RLS-Query-Beweis |
| „User-Twin akzeptiert" | Twin-File-Referenz + dokumentierte Twin-Antwort |
| „Live verifiziert" | URL + `curl -I` Response (200) + Vercel-Deployment-ID |
| „Stabil im Betrieb" | Sentry: Fehlerfreies Fenster nach Deploy |
| „Wird genutzt / wirkt" | PostHog-Event-Daten + Vorher/Nachher |
| „Marktanalyse aktuell" | Datum + Quellen-URLs + Diff zum letzten Scan |

Fehlt das Artefakt → der Status ist `UNVERIFIED`, niemals `FACT`. Der Verifier blockiert.

---

## 4. Definition of Done (eine Mission ist fertig, wenn …)

```
[ ] tsc --noEmit  Exit 0
[ ] lint          Exit 0
[ ] Tests grün    (Report-Datei vorhanden)
[ ] Persistenz    (Schreiben → Reload → Datensatz da, per Query bewiesen)
[ ] Rollen        (mit ≥2 Rollen getestet, RLS-Beweis)
[ ] Tablet/Mobile (Screenshots in Ziel-Viewports)
[ ] Twin-Check    (relevante Twins konsultiert, Antwort dokumentiert)
[ ] Visual Pitch  (bei UI-Änderung: vom Stakeholder abgesegnet)
[ ] Live-Beweis   (URL + curl 200 + Deployment-ID) — falls Mission bis Live geht
[ ] Verifier       hat alle Artefakte geprüft und gegengezeichnet
```

Erst wenn **alle** Haken durch Artefakte gedeckt sind, meldet der Mission Coordinator „fertig". Eine Selbst-Freigabe des Builders ist ausgeschlossen.

---

## 5. Übergangsregel Antigravity → Claude Code

- **Claude Code:** Beweispflicht wird durch **Hooks** technisch erzwungen (siehe `04_CLAUDE_CODE_SETUP/.claude/hooks/`). Ein „Stop ohne Beweis" wird blockiert.
- **Antigravity 2.0.4** (kennt keine hooks.json): Beweispflicht wird durch den **PRÜFPHASE-Block** am Ende jedes Build-Prompts erzwungen — `tsc --noEmit`, `lint`, `git diff --stat`, `git status --short`, plus Beweis pro Akzeptanzkriterium **vor** jeder Fertig-Meldung. Antigravity committet nie selbst; alle Git-Commits und Supabase-Migrationen führt der Stakeholder manuell aus.

Beide Wege erzeugen dieselben Artefakte. Der Verifier prüft identisch, egal welcher Builder.

---

## 6. Drift-Muster, die aktiv blockiert werden

Aus der Projekt-Erfahrung bekannt und per Hook/PRÜFPHASE zu verhindern:

- voreilige Fertig-Meldung,
- Akzeptanzkriterien umschreiben, statt gegen das Original zu prüfen,
- Planungsdateien schreiben statt Code,
- Mock-Daten oder `Math.random()` nach Entfernung wieder einführen,
- unautorisierte Löschungen / Scope-Verletzungen,
- hartkodierte Hex-Werte statt CI-Tokens, englische Labels in deutscher UI,
- Navigation/Sidebar ohne explizite Anweisung ändern,
- DB-Passwort inline in PowerShell.

Jeder Verstoß → Mission blockiert, Befund ins `RISK_REGISTER`.
