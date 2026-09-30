<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Checkliste Vollständigkeit

Prüfstand: 2026-09-26. Grundlage: Anleitung Version 1.1, Abschnitt 7.

1. ✓ Alle 12 Pflichtdateien `00` bis `11` und der Bericht sind vorhanden; die vorgeschriebenen Haupttabellen verwenden die verlangten Kopfzeilen.
2. ✓ Der Steckbrief enthält Zweck, Stufe, beide Statusangaben, Session, Arbeits-/Code-Pfade, Abhängigkeiten, Anbindung/Gates, wörtliche Graustatus-Texte, Übertragbarkeit und alle relevanten Red-Team-Rate-Stellen.
3. ✓ Jede Anforderung A-G02-001 bis A-G02-025 besitzt Quelle, testbares Abnahmekriterium und zulässigen Stand.
4. ✓ Jede Funktion F-G02-001 bis F-G02-005 enthält alle sieben Zustände. Alle Zustandszeilen in `02_FUNKTIONEN_ABLAEUFE.md` wurden auf das eindeutige Muster geprüft: belegter wörtlicher Text mit Quelle oder ausschließlich `FEHLT → Q-…`. Die zuvor gemischte Sperrzeile in F-G02-005 weist nun ausschließlich auf Q-G02-001.
5. ✓ Die Optikvorlage nennt V5 mit vollständigem SHA-256, Anker und Einzelmock-Kontrollen; jede Screenzeile enthält drei Geräte oder „fehlt → Designphase 1“, und fehlende Screens haben ein vollständiges Designbriefing.
6. ✓ Host-Ports, Events/Readback, Feldliste mit Soll-Ist, Datenbesitzer, Manifest-/Handshake-Stand, Provider, Secret-Namen-Grenze und Übertragbarkeit sind dokumentiert.
7. ✓ Jeder Konflikt K-G09-001 bis K-G09-017 hat in G02 eine eindeutige Zuständigkeit und einen Anzeigeort. `05_REGELN_SPERREN_KONFLIKTE.md` benennt zusätzlich die referenzierbaren, belegten Anzeigeorte: Rolf „Das braucht dich“, Phillip „Heute sichern“ und Gregor „Einstellungen“ mit dem Hinweis „Microsoft-Verbindung abgelaufen“; für Gregor wird kein unbelegter allgemeiner G09-Konfliktbereich erfunden.
8. ✓ `06_ENTSCHEIDUNGEN.md` enthält ausschließlich Verweise, Kurzform, Datum und Geltung/Überholung.
9. ✓ Quellen sind mit Datum, Hash und zulässigem Status inventarisiert; beide Registerkopien, beide Startseiten-Specs, archivierte Navigation/Reviews, Mock-CSS und Mindmap-Duplikat sind ausdrücklich bewertet.
10. ✓ Jede offene Frage enthält Optionen, eine Empfehlung, Zuständigkeit, geprüfte Fundstellen, sicheren Zwischenzustand und Status; frühere Owner-Antworten wurden nicht erneut gefragt.
11. ✓ Für alle aktiven und relevanten alten Codebestandteile ist entschieden: bleibt, Umbau auf Designsystem, Ersatz durch Besitzer-Modul oder entfällt aus Runtime; Datenmigrationen sind abgegrenzt.
12. ✓ Es wurden keine Secret-Werte, keine Provideraktion, kein Code und keine Repo-Datei geschrieben; Dossiertexte sind UTF-8 ohne BOM, ohne Mojibake und verwenden Datumsformat `JJJJ-MM-TT`.
13. ✓ Build-Frage: Ein fremder Builder kann G02 aus diesem Ordner ohne fachliches Raten bauen; ungeklärte Copy-/Design-/Providerpunkte haben eine konkrete Empfehlung und bleiben bis zum jeweiligen Gate nicht klickbar „In Aufbau“/„In Klärung“ oder vollständig absent.

## Zusätzliche Selbstprüfungen

- ✓ G02 legt keine zweite Fachwahrheit, Tabelle, Migration, Runtime-Abhängigkeit oder Providerverbindung fest.
- ✓ Kreile und andere Zielapps sind strikt getrennt; Übertragbarkeit ist nur als app-neutraler Kern plus Kreile-HostAdapter beschrieben.
- ✓ Die lokale `origin/main`-Referenz und der nicht mögliche Fetch sind transparent; es gibt keine Behauptung aktueller Remote- oder Production-Lieferung.
- ✓ Die unabhängige Prüfung durch Sonnet vom 2026-09-26 ist in `AUFTRAG_NACHARBEIT_2026-09-26.md` belegt; ihre zwei Feststellungen sind nachgearbeitet. Eine erneute unabhängige Nachprüfung dieser Änderungen wird nicht behauptet.
