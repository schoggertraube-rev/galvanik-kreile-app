<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 06 — Entscheidungen

Diese Datei referenziert Entscheidungen; sie eröffnet keine zweite Entscheidungswahrheit.

| Register-ID / Fundstelle | Kurzform (1 Zeile) | Datum | gilt/überholt |
|---|---|---|---|
| OE-2609-09 | Alle sehen grundsätzlich alles; Admin kann je Person beschränken/erweitern. | 2026-09-26 | gilt |
| OE-2609-10 | Interne Sperren verhindern Fehler; Konflikte erscheinen nach Zuständigkeit bei Rolf oder Phillip auf der Startseite. | 2026-09-26 | gilt |
| OE-2609-13 | Termin-/Konfliktumfang aus Vorwissen ableiten und frühere Antworten nicht erneut erfragen. | 2026-09-26 | gilt |
| OE-2609-18 | Lizenzierter Kreile-Büroaccount mit Hauptkalender und delegiertem Zugriff; M365 bleibt externes Gate. | 2026-09-26 | gilt |
| OE-2609-19 | Kalender hauptsächlich Hintergrund; Abwesenheiten/Betriebstermine lesen, Auftragstermine schreiben, Startseite zeigt Anstehendes. | 2026-09-26 | gilt |
| OE-2609-21 | Pünktlichkeit ist erste Analytics-Kennzahl, aber nicht Teil der operativen G09-Kapazitätsbehauptung. | 2026-09-26 | gilt |
| OE-2609-22 | Startseite zeigt nur dringende Konflikte, Warnungen und Entscheidungen statt KPI-Kacheln. | 2026-09-26 | gilt |
| OE-2609-23 | Pünktlichkeit plus 30-Tage-Liquidität ist spätere Analyse und keine G09-Startseitenwand. | 2026-09-26 | gilt |
| D-RES-001, Entscheidungsregister Repo-Kopie | Kein Schattenmodell: Quelle erhalten, verständlicher Ausgang, Correlation-ID, sichere nächste Aktion, Receipt/Readback. | 2026-09-21 | gilt |
| D-ARCH-011, Entscheidungsregister/Architektur | Microsoft Graph hinter `CalendarPort`; Domänentermine bleiben Wahrheit; kein eigener Event-Speicher/Kalender-Engine. | 2026-09-21 | gilt |
| D-ARCH-012, Entscheidungsregister/Architektur | Provider erst nach Struktur-, Region-, Quota-, Capability-, Kosten- und Real-E2E-Gate. | 2026-09-21 | gilt |
| D-UI-V5-003, Entscheidungsregister Repo-Kopie | V5 ist aktuelle Gesamtreferenz; abweichende V6-Kopie ist verworfen. | 2026-09-21 | gilt |
| D-UI-CORE-002, Provider-Matrix/Current State | Alt-UI ist keine Lieferbasis; Ziel-Shell und Rollen-Home müssen als zusammenhängende Oberfläche abgenommen werden. | 2026-09-17 | gilt |
| D-USP-001 | Die App entlastet proaktiv, zeigt Probleme rechtzeitig und priorisiert den nächsten sinnvollen Schritt. | 2026-08-20 | gilt |
| User Twins/Rollenvertrag | Phillip führt operative Werkstattarbeit aus; Rolf verantwortet Zusagen, Geld, Ausnahmen und Eskalationen. | 2026-09-01 | gilt |
| STARTSEITEN_UI_REFERENZ_SPEC, Rolle Rolf/Phillip | Rolf bleibt Entscheidungseigentümer; Phillip kann delegierte Auftragsaufgaben zurückgeben. | 2026-09-20 | gilt |
| MODULKARTE_KANON, Kalender | Kalender ist Projektion, kein eigenes Kalenderprodukt. | 2026-09-21 | gilt |
| MODULKARTE_KANON, „Analyse/KPI entfällt“ | Durch OE-2609-21/22/23 als hinten angestellt statt vollständig entfallen korrigiert; OP-02 wartet auf Repo-Sync. | 2026-09-21 | überholt in diesem Punkt |
| Mindmap V2, Kalender/Tagesüberblick | Auftragstermine aus App plus Betriebstermine aus Outlook; Tagesüberblick aus Kalender und Aufträgen. | 2026-08-15 | gilt als Vorwissen, durch OE-2609-19 bestätigt |
| Register-Satz „Bündelung (z. B. Zink)“ | Bündelung gehört zum Entlastungsziel, aber ohne Zahlen-/Kompatibilitätsmodell nur als manuelle Prüfung. | 2026-08-28 | gilt begrenzt |
| Archiv Add-on 10, Warning Engine | Generischer Regelkatalog ist keine kanonische Produktfreigabe. | 2026-08-10 | überholt/verworfen als Produktwahrheit |
| Red-Team RT-03/06/07/08 | Kapazitätszahlen und Zuständigkeit fehlen; Legacy-Warnengine ist nicht verdrahtet und nicht kanonisch. | 2026-09-26 | gilt als Befund |
| Plan T-06/T-07/T-13 | Konflikte/Startseite bauen, Kalenderübersicht nachschlagen, toten Warncode nach Dossierentscheidung kontrolliert disponieren. | 2026-09-25 | gilt |
| OP-01 | Repo-Kopie plus D-UI-V5-003 gilt; abweichende Registerkopie wird später synchronisiert. | 2026-09-26 | gilt |
| OP-02 | Modulkarte wird später mit Owner-Entscheidungen synchronisiert; bis dahin Neueres nicht als Kanon-Backport vortäuschen. | 2026-09-26 | gilt |

## Dossier-Folgerungen ohne neue Produktentscheidung

- G09 ist eine flüchtige Projektion aus Besitzer-Ports und kein eigenes persistentes Fachmodul.
- Harte Sperren bleiben bei Commands/DB des Besitzer-Moduls.
- Gregor ist kein normaler Empfänger fachlicher Konflikte; Systemadministration bleibt außerhalb des Businessfeeds.
- Kapazität bleibt deaktiviert, bis Q-G09-001 real geklärt ist.
- Der alte Warning-Engine-Code wird nicht reaktiviert.
