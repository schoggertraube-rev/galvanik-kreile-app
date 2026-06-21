---
name: beweis-artefakte
description: Erzwingt und sammelt maschinell prüfbare Beweis-Artefakte für jede Behauptung über fertige Arbeit. Nutze diese Skill immer, bevor eine Mission als fertig oder live gemeldet wird, und immer, wenn behauptet wird, dass Code kompiliert, Tests laufen, eine Migration angewendet wurde, in die DB geschrieben wird, die UI zum Mockup passt oder etwas live ist.
---

# Skill: Beweis-Artefakte

Diese Skill setzt die Beweispflicht der Firma technisch um. Worte zählen nicht — nur Artefakte, die eine andere Instanz unabhängig prüfen kann.

## Wann anwenden
Vor jeder Fertig-/Live-Meldung und bei jeder Behauptung aus der Beweistabelle.

## Vorgehen

1. **Ledger anlegen/öffnen:** `.claude/_evidence_aktuelle_mission.txt`. Pro Akzeptanzkriterium eine Zeile mit Beleg.

2. **Pflicht-Artefakte erzeugen** (je nach Mission):

```bash
# Kompilierung
npx tsc --noEmit 2>&1 | tee -a .claude/_evidence_aktuelle_mission.txt

# Linter
npm run lint 2>&1 | tee -a .claude/_evidence_aktuelle_mission.txt

# Tests inkl. Trace
npx playwright test --reporter=list 2>&1 | tee -a .claude/_evidence_aktuelle_mission.txt

# Geänderte Dateien + Commit-Bezug
git diff --stat | tee -a .claude/_evidence_aktuelle_mission.txt
git status --short | tee -a .claude/_evidence_aktuelle_mission.txt
```

3. **Persistenz beweisen** (wenn „schreibt in DB" behauptet wird): nach der Aktion eine SELECT-Query gegen die **echte** Supabase-DB ausführen und das Ergebnis (neuer Datensatz) ins Ledger schreiben. Lokale SQL-Datei zählt NICHT als Beweis.

4. **Migration beweisen:** Query gegen die echte DB, dass das Schema den neuen Stand hat; danach `NOTIFY pgrst, 'reload schema';`. Beleg ins Ledger.

5. **UI beweisen:** Screenshots in Ziel-Viewports (Desktop/Tablet/Mobile), Pixel-Diff gegen Mockup-HTML. Pfade ins Ledger.

6. **Live beweisen:** `curl -I <url>` (Status 200) + Vercel-Deployment-ID ins Ledger.

7. **Twin-Check:** relevante Twins konsultieren, Antwort dokumentieren, Referenz ins Ledger.

## Klassifikation
Jede Aussage erhält `FACT` (durch Artefakt belegt) oder `UNVERIFIED`. Niemals `FACT` ohne Artefakt.

## Übergabe
Ist das Ledger vollständig, geht die Mission an den **Chief Verifier (GPT-5)**. Erst dessen Gegenzeichnung erlaubt die Fertig-Meldung an den Stakeholder. Der Stop-Hook `verlange-beweis.sh` blockiert, solange Pflichtbelege fehlen.

## Verboten
Erfundene Logs, kopierte Exit-Codes ohne echten Lauf, „grün" ohne Report-Datei, nachträglich umgeschriebene Akzeptanzkriterien.
