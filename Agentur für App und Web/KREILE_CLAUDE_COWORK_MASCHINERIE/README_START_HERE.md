# Kreile Claude-Cowork-Maschinerie

## Zweck

Dieses Paket verbindet Analyse, Planung, Bau, Prüfung und Freigabe zu einem kontrollierten System.

Es verhindert insbesondere:

- isolierte Spezialistenberichte,
- vergessene Ideen,
- unbelegte Erfolgsmeldungen,
- Bauen ohne Datenvertrag,
- vorzeitiges „fertig“,
- unkontrollierte Architekturänderungen,
- Mock- und Scheinfunktionen,
- destruktive Git- oder Datenbankbefehle,
- Scope-Chaos,
- Entscheidungen ohne zuständige Fachrollen.

## Zwei Ebenen

### Ebene A – Claude Cowork

Cowork führt Quellenanalyse, Projektarchäologie, Register, Befehlskette, Entscheidungsvorlagen, Bauplanung, Connector-Bewertung, Dokumentation und Fortschrittssteuerung.

Dafür zuerst `00_COWORK_STARTPROMPT.md` in Cowork verwenden und die Dateien dieses Pakets als Projektwissen beziehungsweise Arbeitsdateien bereitstellen.

### Ebene B – Claude Code / ausführender Coding-Agent

Der Ordner `claude_code/.claude/` enthält projektbezogene Subagenten, Skills, Stop- und Completion-Hooks sowie Schutz vor destruktiven Befehlen.

Diesen `.claude`-Ordner erst nach Git-Snapshot kontrolliert in das Wurzelverzeichnis des Kreile-Projekts übernehmen.

## Wichtig

Ein Cowork-Prompt kann diszipliniertes Verhalten verlangen, ist jedoch kein technischer Stop-Hook. Die realen Hook-Dateien dieses Pakets gehören zur Claude-Code-Ebene.

## Startreihenfolge

1. Projekt sichern.
2. `00_COWORK_STARTPROMPT.md` in Cowork ausführen.
3. Quellen- und Registerstruktur anlegen lassen.
4. den beschriebenen Sofort-Audit durchführen.
5. Ergebnisse im Steuerungsboard konsolidieren.
6. erst dann neue große Baupakete starten.
7. `.claude/` für den Coding-Agenten integrieren.
8. jedes Baupaket über Analyse → Freigabe → Bau → unabhängige Abnahme führen.

## Harte Wahrheit

Keine Idee darf verloren gehen. Das bedeutet nicht, dass jede Idee sofort oder ungeprüft gebaut wird.

Jede Idee muss erfasst, vervollständigt, analysiert, bewertet, entschieden und bei Annahme umgesetzt werden. Verschiebung oder Ablehnung müssen begründet sein.
