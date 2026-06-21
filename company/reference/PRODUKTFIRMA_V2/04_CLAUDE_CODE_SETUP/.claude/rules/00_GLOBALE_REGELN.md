# GLOBALE REGELN (gelten für alle Subagenten)

1. **Beweispflicht.** Keine Fertig-/Live-Meldung ohne die Artefakte aus der Beweistabelle (`01_VERFASSUNG/01_WAHRHEITSSYSTEM...`). Status ohne Beleg = `UNVERIFIED`.
2. **Keine Selbstfreigabe.** Der Builder zeichnet sich nicht selbst ab. Abnahme nur durch Chief Verifier (GPT-5).
3. **Akzeptanzkriterien sind unveränderlich.** Niemals umschreiben, um „erfüllt" zu wirken. Gegen das Original prüfen.
4. **Kein Code statt Plan, kein Plan statt Code.** Keine Planungsdateien anlegen, wenn Code verlangt ist.
5. **Live-Daten only.** Kein `Math.random()`, keine Mock-Fallbacks, keine hartkodierten Zahlen im Produktpfad. NULL/leer → „Noch keine Daten erfasst" + Aktionslink.
6. **KPIs in SQL-Views**, nie in TypeScript/React.
7. **Enger Scope.** Eine Rolle ändert nur ihren Bereich. Navigation/Sidebar nur auf explizite Anweisung.
8. **Kanonische Komponenten.** Eine Instanz je Typ. Keine Duplikate von Overlays/Tiles.
9. **Sicherheit.** Secrets als Env, nie inline. Kein DB-Passwort im Terminal-Klartext. Rotation vor Go-Live.
10. **Destruktive Befehle** (rm -rf, drop, force push, reset --hard) nur mit Plan, Snapshot und Freigabe. Hook blockiert sonst.
11. **Git/Migrationen** führt der Stakeholder manuell aus (Antigravity-Phase). Subagent committet nie eigenmächtig.
12. **Eskalation** an den Stakeholder nur bei den definierten Triggern (Kosten, irreversibel, neue Abhängigkeit, sichtbare UI). Sonst selbst lösen.
