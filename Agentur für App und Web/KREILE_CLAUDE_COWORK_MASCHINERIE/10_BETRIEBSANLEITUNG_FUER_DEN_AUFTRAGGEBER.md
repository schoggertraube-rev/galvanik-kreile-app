# Bedienungsanleitung für den Auftraggeber

## Einmaliger Start in Cowork

1. Paket als Projektwissen beziehungsweise Arbeitsordner bereitstellen.
2. `00_COWORK_STARTPROMPT.md` senden.
3. Cowork zuerst nur Audit und Organisationsaufbau durchführen lassen.
4. keine neue Großfunktion freigeben, bevor das Steuerungsboard den ersten Masterplan liefert.

## Für eine neue Idee

> Erfasse diese Idee im IDEA_REGISTER. Lass Requirements, Daten, Architektur, UX, Security, Performance, Business und QA die Idee vervollständigen und bewerten. Lege mir danach eine Entscheidungsvorlage vor. Noch nicht bauen.

## Für ein Baupaket

> Starte WP-XXX nach der Pipeline. Aktiviere alle Pflichtspezialisten. Baue erst nach Pre-Build-Freigabe und liefere unabhängige Abnahme.

## Für einen Fehler

> Erfasse den Fehler als Finding. Reproduziere ihn, bestimme die Root Cause, aktiviere zuständige Spezialisten und liefere Korrektur samt Regressionstest.

## Nicht akzeptieren

- „sieht gut aus“
- „sollte funktionieren“
- „Datei erstellt“
- „Build grün“
- „Migration liegt vor“
- „Feature implementiert“

ohne End-to-End-Evidenz.

## `.claude`-Ebene

Vor Übernahme in das Projekt:

1. `git status --short`
2. Snapshot/Commit
3. vorhandene `.claude`-Dateien vergleichen
4. nicht blind überschreiben
5. Hooks mit `/hooks` prüfen
6. Agenten mit `/agents` prüfen
