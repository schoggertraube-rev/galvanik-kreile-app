<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G01_FUNDAMENT_RECHTE — Checkliste Vollständigkeit

**Prüfstand:** 2026-09-26  
**Prüfgrundlage:** Anleitung 1.1 §7

| Nr. | Ergebnis | Prüfung | Begründung |
|---|---|---|---|
| 1 | ✓ | Alle 12 Pflichtdateien + Bericht vorhanden, Tabellen mit exakten Kopfzeilen. | `00` bis `11` und `BERICHT_2026-09-26.md` sind vorhanden; die verlangten Kerntabellen verwenden die Anleitungskopfzeilen. |
| 2 | ✓ | Steckbrief vollständig inkl. Anbindung, Gate, Ausgrau-Element + Text, Übertragbarkeit, Rate-Stellen. | `00_STECKBRIEF.md` enthält alle Pflichtfelder, T-05/P-DS-Gate, „Personen & Rechte · In Aufbau“, HostAdapter-Grenze und RT-Nummern. |
| 3 | ✓ | Jede Anforderung besitzt Quelle, Abnahmekriterium und Stand. | `01_ANFORDERUNGSKATALOG.md` enthält A-G01-001…038 mit Muss/Soll, Fundstelle, testbarem Kriterium und erlaubtem Stand. |
| 4 | ✓ | Jede Funktion enthält alle 7 Zustände mit Wortlaut oder `FEHLT → Q`. | F-G01-001…006 enthalten je sieben Zeilen; nicht belegte Zieltexte verweisen auf Q-G01-001/Q-G01-002. |
| 5 | ✓ | Optikvorlage enthält Quelle + SHA und drei Geräte oder Designphase. | V5-Vollhash und Anker sind genannt; fehlende Gregor-/Rechtescreens stehen explizit auf Designphase 1b mit vollständiger Inhaltsliste. |
| 6 | ✓ | Schnittstellen enthalten Host-Ports, Feldliste mit Soll-Ist, Datenbesitz, Provider und Secret-Namen. | `04_SCHNITTSTELLEN_DATEN.md` dokumentiert Browser-/Serverfassade, acht Host-Ports, Bestands-/Zieldatenmodell, Manifest und Providergrenzen. |
| 7 | ✓ | Jeder Konflikt besitzt Zuständigkeit und Anzeigeort. | K-G01-001…009 nennen Gregor beziehungsweise betroffene Person und den konkreten System-/Login-/Fachkontext. |
| 8 | ✓ | Entscheidungen sind nur Verweise mit Datum. | `06_ENTSCHEIDUNGEN.md` enthält ausschließlich Fundstelle, Kurzform, Datum und Gültigkeit. |
| 9 | ✓ | Quellen besitzen Datum, SHA und Status; Duplikate/Widersprüche sind markiert. | `09_QUELLEN_AKTUALITAET.md` führt Auftrag, Stagingquellen, Digests, Kanon, Code und Archive; beide Registerkopien/V6/RoleMatrix-Widerspruch sind klassifiziert. |
| 10 | ✓ | Offene Fragen enthalten Empfehlung und „bis dahin in der App“. | Q-G01-001…003 enthalten Optionen, genau eine Empfehlung, Zuständigkeit, Vorwissensuche und sicheren Zwischenzustand. |
| 11 | ✓ | Für jeden vorhandenen Code-Bestandteil ist der Umbau entschieden. | `11_IST_CODE_UMBAU.md` deckt Modul, Auth/Session, Login, Admin-UI, DB, Call-Sites und Tests ab; Alt-Wahrheiten werden nicht parallel weitergeführt. |
| 12 | ✓ | Keine Secrets, keine Mojibake, nur eigener Ordner beschrieben, Datum `JJJJ-MM-TT`. | Nur Secret-/Konfigurationsnamen stehen im Dossier; Schreibprüfung und Zeichensuche sind Teil der Abschlussprüfung; keine Quelle/Repo-Datei wurde geändert. |
| 13 | ✓ | Build-Frage: fremder Builder kann ohne Raten bauen. | Daten-, Port-, Permission-, Command-, Audit-, Migrations-, Umbau- und Testvertrag sind vollständig. Fehlende Optik/Device-Entscheidung sind als echte Gates mit „In Aufbau“/„In Klärung“ abgesichert und dürfen nicht improvisiert werden. |

## Prüffrage

**Könnte ein fremder Builder dieses Modul allein mit diesem Ordner bauen, ohne zu raten?**  
**Ja**, für alle freigegebenen Bauanteile und in der festgelegten Reihenfolge. Der Builder darf die fehlenden Zielscreen-Texte und die Device-Challenge nicht selbst erfinden; er baut bis zum dokumentierten Gate und verwendet bis dahin exakt die angegebenen passiven Zustände.

## Noch erforderlicher unabhängiger Schritt

Nach Anleitung §9 prüft ein unabhängiger read-only Reviewer dieses Dossier gegen alle 13 Punkte und mit mindestens fünf Stichproben an den echten Quellen. Dieses nachgelagerte Review ist Import-/Warteschlangen-Gate, ändert aber nicht den hier selbstgeprüften Dossierstatus.
