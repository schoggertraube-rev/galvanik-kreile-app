<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 06 – Entscheidungen

Stand: 2026-09-26  
Modul: M02 Analyse

Diese Datei dokumentiert ausschließlich bereits gefällte Entscheidungen und verweist auf ihre Quelle. Sie erzeugt keine neue Produktwahrheit.

| Register-ID / Fundstelle | Kurzform (1 Zeile) | Datum | gilt/überholt |
|---|---|---|---|
| OE-2609-05 | Analyse ist nicht entfallen, sondern nur nach hinten gestellt; die Entfall-Markierung darf nicht zur Löschung führen. | 2026-09-25 | gilt; Repo-Kanon noch OP-02 |
| OE-2609-06 | Auslieferung ausschließlich über `02_app`; Plan-, Designsystem- und Dossier-Gates gehen dem Bau voraus. | 2026-09-25 | gilt |
| D-UI-V5-003; OE-2609-03 | Dashboard V5 ist verbindlich, V6 verworfen; M02-Screens entstehen erst in Designphase 1b. | 2026-09-25 | gilt |
| OE-2609-04 | Nicht angebundene Elemente sind grau, nicht klickbar und zeigen `In Klärung` beziehungsweise nach Start `In Aufbau`. | 2026-09-25 | gilt |
| OE-2609-09 | Grundsätzlich dürfen alle zugreifen; Einschränkungen kommen aus Admin-/Hostregeln, nicht aus einer M02-Rollenmatrix. | 2026-09-26 | gilt |
| OE-2609-10 | Fachliche Konflikte werden je Zuständigkeit auf der Startseite von Rolf beziehungsweise Phillip angezeigt. | 2026-09-26 | gilt |
| OE-2609-15 | Modulübergaben folgen dem einheitlichen Dossierstandard; Übertragbarkeit wird nur als app-neutrale Kerngrenze bewertet. | 2026-09-26 | gilt; präzisiert durch Trennungshinweis 2026-09-26 |
| OE-2609-17 | Höchstens zwei Modulcores dürfen nach BAUBEREIT off-repo parallel gebaut werden; M02 folgt M01, die Kreile-Anbindung bleibt seriell. | 2026-09-26 | gilt |
| OE-2609-20 | Personenbezug wird fristgerecht und nur nach Freigabe entfernt; anonymisierte/aggregierte Analysedaten dürfen unbefristet bleiben. | 2026-09-26 | gilt; Vor-Live-Bestätigung externes Gate |
| OE-2609-21 | Erste Analyse-Kennzahl ist Termintreue aus zugesagtem und tatsächlichem Fertig-/Abholtermin. | 2026-09-26 | gilt; klärt Q-M02-003 für die erste Scheibe |
| OE-2609-22 | Analyse erhält nach Anbindung einen eigenen Menüpunkt; Werte erscheinen zusätzlich an Auftrag/Kunde, Startseite nur für Dringendes. | 2026-09-26 | gilt; klärt Q-M02-001 |
| OE-2609-23 | Liquidität 30 Tage ist die zweite M02-Kennzahl nach M01 und wird mit Termintreue für M03 betrachtet. | 2026-09-26 | gilt; präzisiert OE-2609-21 |
| OE-2609-24 | Liquidität startet mit manuellem Kontostand, Kostenliste, offenen Posten und Personalkosten-Summen; Veraltung erzeugt Warnung. | 2026-09-26 | gilt; Schwelle Q-M02-008 |
| OE-2609-26 | Startseite zeigt oben Dringendes je Zuständigkeit und darunter den V5-Tagesüberblick; Analyse liefert keine Kennzahl-Kacheln. | 2026-09-26 | gilt; präzisiert OE-2609-22 |
| Core V1.1 `RUNTIME_TRUTH.md`/Manifest | Genau ein öffentlicher Read-Port; keine Command-, Storage-, Provider- oder Fachfaktenfunktion. | 2026-09-17 | gilt für Off-Repo-Kandidat |
| Core V1.1 `SOURCES_AND_REQUIREMENTS.md`/Admission | Fakten nur über `domain-fact-adapter/v1.1`, Metriken nur über zugelassenes Metric-Pack. | 2026-09-17 | gilt für Off-Repo-Kandidat |
| `OPUS_DISC_SCOPE_CLOSURE_CHECK.json` | P1 der sekundären Disclosure-Unterdrückung ist im engen externen Reaudit geschlossen; keine offenen P0/P1. | 2026-09-17 | gilt; ersetzt alten Auditstatus |
| Nutzerauftrag; OP-01 | Bei den abweichenden Registerkopien gilt die Repo-Kopie zusammen mit D-UI-V5-003. | 2026-09-26 | gilt bis kanonische Zusammenführung |
| `ARCHITEKTUR_MODULE_PATH1.md`; `MODULKARTE_KANON.md` | Legacy-Analyse-/Cockpit-/Performance-Oberflächen sind keine Produkt- oder UI-Wahrheit. | 2026-09-21 | gilt; Löschung separat freizugeben |
| Core `SOURCES_AND_REQUIREMENTS.md`; `KPI_RESEARCH_AND_ADMISSION.md` | Der Core verlangt vollständige, snapshotgebundene Fakten und zugelassene Metric-Packs ohne Null-/Legacy-Fallback. | 2026-09-17 | gilt für Off-Repo-Kandidat |
