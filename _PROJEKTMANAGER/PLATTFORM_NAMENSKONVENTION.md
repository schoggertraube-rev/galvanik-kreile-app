# PLATTFORM-NAMENSKONVENTION
## Verbindliche Regel für alle Entwicklungsarbeiten

---

## Grundprinzip

Der Kreile-Codebase ist der erste Aufbau einer wiederverwendbaren Unternehmensplattform.

Die hier entwickelten Module werden später in weiteren Apps eingesetzt.

**Diese zukünftigen Projektnamen haben im Kreile-Code nichts zu suchen.**

Keine Pfade, keine Variablen, keine Kommentare, keine Dateinamen dürfen auf zukünftige Kundenprojekte hinweisen.

---

## Was verboten ist

Folgende Begriffe dürfen im Kreile-Codebase **nie** auftauchen:

- `lerninsel`
- `hotel`
- sowie jeder weitere zukünftige Kundenname

**Auch nicht als Kommentar, Beispiel, Platzhalter oder TODO.**

---

## Was stattdessen gilt

Alle Module werden mit **neutralen, funktionalen Namen** entwickelt.

| Statt | Neutral |
|-------|---------|
| `galvanik-kreile` als hartkodierter Tenant | `tenant_id` aus Session/Config |
| `VALID_SLUGS = ["wareneingang", ...]` | `WORKFLOW_STATIONS` aus Mandantenkonfiguration |
| `galvanikStation` | `processStation` |
| `auftrag` als hartkodierter Begriff | konfigurierbarer `vorgangLabel` pro Mandant |
| `beschichtung` als Stationsname | Stationsname aus DB-Konfiguration |

---

## Warum

Ein Modul, das `galvanik` im Namen trägt, kann in einer Lerninsel oder einem Hotel nicht ohne Umbenennung eingesetzt werden — auch wenn die Logik identisch ist.

Ein Modul namens `ProcessFlowModule` mit einer Konfigurationsdatei für Galvanik kann ohne einen einzigen Code-Commit in jedem anderen Betrieb verwendet werden.

---

## Umsetzungsregel für Claude

Bei jeder Codeänderung oder Neuentwicklung:

1. Enthält der Name eine Branchenbezeichnung? → neutralisieren.
2. Ist ein Wert hartkodiert, der mandantenspezifisch ist? → in Konfiguration auslagern.
3. Ist ein Kommentar vorhanden, der auf ein zukünftiges Projekt hinweist? → entfernen.
4. Ist eine neue Variable allgemein genug, dass sie in einer Schule oder einem Hotel genauso funktioniert? → Namensgebung beibehalten.

---

*Angelegt: 2026-06-19 | Gilt ab sofort für alle Entwicklungsarbeiten im Kreile-Projekt*
