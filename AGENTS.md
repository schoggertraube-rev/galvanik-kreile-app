# Kreile-WerkstattCockpit — verbindliche Bauregeln

Arbeitsort ist ausschließlich dieses Repository `02_app`. Codex ist der einzige Writer.

## Aktive Steuerung

1. Vor jeder Arbeit `_review/BAUREGELN.md` lesen.
2. Danach `_review/WARTESCHLANGE.md` und ausschließlich das jeweilige Paket im Bauplan lesen.
3. BAUREGELN bestimmen Ablauf, Quellen, Prüfungen, Branches und Abgabe. Die Warteschlange bestimmt die Priorität.
4. Fortschritt ausschließlich als eine Zeile je Commit oder Entscheidung in `_review/BAULOG.md` festhalten.
5. `_review/archiv/` und frühere Steuerungen sind historischer Nachweis und kein Bauauftrag.

Der frühere Plan `docs/delivery/KREILE_VERKAUFSSTUFE_1.md` bleibt ausschließlich historischer Nachweis; ausführbar sind die oben genannten BAUREGELN und die Warteschlange.

## Arbeitsgrenzen

- Keine zusätzlichen Clones, Worktrees oder Writer; fremde Änderungen bewahren.
- Vorhandene Tabellen, Befehle und öffentliche Modul-Ports nutzen; keine zweite fachliche Wahrheit.
- Bestehende Modulgrenzen aus `docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md` bleiben erhalten; die Arbeitssteuerung erfolgt ausschließlich durch BAUREGELN.
- Kein Merge oder Production-Deploy durch Codex; keine Secrets in Dateien.
- Technische Entscheidungen innerhalb des Auftrags selbst treffen. Produktkonflikte gemäß BAUREGELN an den Planungschat melden und am ausführbaren Rest weiterarbeiten.
- Die Owner erhält je PR genau eine Merge-Bitte nach den Kriterien der BAUREGELN.
