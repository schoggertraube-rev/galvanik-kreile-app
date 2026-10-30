# Abgabe Korrektur Der Tag 03

## Befund

Im Feld **Handlungsbedarf** fehlten der fallbezogene Grund und eine konkrete Hauptaktion; insbesondere war **Kunde vorwarnen** nicht erreichbar.

## Neu gemacht

- Die bestehende Tagesableitung unterscheidet jetzt die aktuell belegbaren Fälle: heute/überfällig, fertig und wartend, knapper noch nicht begonnener Auftrag sowie gemeldetes Risiko (`src/lib/server/todayDashboardPolicy.ts`).
- Jeder dieser Fälle liefert genau einen Grund und genau eine Hauptaktion: **Fertig melden**, **Ware raus**, **Kunde vorwarnen** oder **Problem lösen** (`src/lib/server/todayDashboard.ts`).
- Die Tageskarte zeigt Auftragsnummer und Fall als Titel sowie Kunde und konkreten Grund in der zweiten Zeile. Die Hauptaktion kommt aus der serverseitigen Ableitung (`src/components/home/RolfHomeClient.tsx`).
- Solange die neuen F3–F6-Zieldialoge gesperrt sind, öffnet jede Aktion den vorhandenen Auftragspfad mit genau der vorhandenen `orderId`. Es wurde kein zweiter Schreibweg angelegt.

## Datenbank-Nachweis

- Dieses Paket ändert weder Schema, Migrationen noch Datenbankzugriffe.
- Die neue Ableitung arbeitet ausschließlich auf dem bereits geladenen Auftragsvertrag; der Diff enthält keinen Datenbankpfad.
- Alle vier Hauptaktionen öffnen nur die vorhandene Auftrags-Ebene. Der Klick selbst ruft keine schreibende Action auf und verändert deshalb weder Auftrag, Status noch Ereignisse.

## Klickweg für den Owner

Branch-Preview: `https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app` · Rolle Rolf.

1. **Der Tag → Handlungsbedarf** öffnen. Jeder Auftrags-Eintrag muss unter der Auftragsnummer einen verständlichen Fall und darunter Kunde plus Grund zeigen.
2. Einen heute fälligen, noch nicht fertigen Auftrag prüfen: Hauptaktion **Fertig melden**.
3. Einen fertigen, überfälligen Auftrag prüfen: Hauptaktion **Ware raus**.
4. Einen knappen Auftrag in Eingang/Wareneingang prüfen: Hauptaktion **Kunde vorwarnen**.
5. Einen anderweitig als riskant markierten Auftrag prüfen: Hauptaktion **Problem lösen**.
6. Eine Hauptaktion wählen und die Ebene ohne Bestätigung schließen. Es muss genau der betroffene Auftrag öffnen; Status und Datenbank bleiben unverändert.

## Prüfergebnis

- `npx vitest run src/lib/server/__tests__/todayDashboard.test.ts`: **1 Datei / 4 Tests grün**.
- `npx tsc --noEmit --incremental false`: **grün**.
- ESLint der vier betroffenen Produkt-/Testdateien: **0 Fehler**.
- `node scripts/ui/spec-check.mjs --screens=tag`: **1 erwartet / 1 gefunden / 0 fehlend**.
- `git diff --check`: **grün**.
- Der vollständige Unit-Lauf überschritt das 60-Sekunden-Fenster und wurde nach Regel 4e nicht weiter verfolgt; der letzte vollständige Lauf vor dieser Korrektur war grün.
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d; der Owner führt den obigen Preview-Klickweg aus.

## Abgrenzung

- Die Hauptaktionen öffnen bis zur Baureife der Ziel-Dialoge den bestehenden objektgebundenen Auftragspfad. Sie schreiben noch keine fachliche Bestätigung.
- Weitere BAUPLAN-Fälle, deren Eingangsdaten heute nicht im Auftragsvertrag liegen, werden nicht erfunden.
- Keine Migration, keine Datenänderung, kein Merge und kein Production-Deploy.
