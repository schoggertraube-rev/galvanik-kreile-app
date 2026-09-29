<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Offene Fragen

Keine der folgenden Fragen darf durch erfundene Produktlogik beantwortet werden. Das Dossier bleibt BAUBEREIT, weil jede offene Stelle einen eindeutigen, nicht schreibenden oder klar gekennzeichneten Zwischenzustand besitzt; die betroffene Erweiterung besteht ihr Gate erst nach der genannten Klärung.

| Q-ID | Frage | Optionen | Empfehlung | wer klärt (Owner/PL/Designphase) | bis dahin in der App | Status |
|---|---|---|---|---|---|---|
| Q-G03-001 | Welche exakten deutschen Mikrotexte gelten für die in `02_FUNKTIONEN_ABLAEUFE.md` mit `FEHLT` markierten Lade-, Leer-, Fehler- und Konfliktzustände? Gesucht in: V5, Repo-Register D-UI-V5-001/002/003, Owner-Entscheidungen, alle drei Chat-Digests, heutiger `GlobalCreateFlow`/`OrderIntakePanel`, priorisierte Altquellen. | A: Designphase liefert ein gemeinsames Textset; B: jeder Builder formuliert screenweise. | A: vorhandene belegte Texte wiederverwenden und nur die fehlenden Texte in Designphase 1 einmal zentral festlegen. | Designphase | Nur die source-belegten Texte verwenden; für noch fehlende Erweiterungen passiv `In Klärung`, keine erfundene Erfolgsmeldung. | OFFEN — sicher gegatet |
| Q-G03-002 | Wie sieht die eigenständig abgenommene Tablet-Komposition für 1220×880 sowie die vollständige Sieben-Zustände-Darstellung je Screen aus? Gesucht in: V5-HTML/CSS, D-UI-V5-003, OE-2609-03/27, Red-Team RT-21/22/25 und PL-Digest-Abnahmematrix. | A: explizite Tablet-Komposition in Designphase 1; B: ungeprüft Desktop skalieren. | A: Tablet als eigenes Abnahmebild und Zustandsset liefern. | Designphase | Bestehende responsive Basis darf nicht als Owner-UX-belegt gelten; der Screen bleibt vor Owner-Abnahme `In Klärung`. | OFFEN — Designphase 1 |
| Q-G03-003 | Welche exakte Ähnlichkeitsregel löst eine Kundendublettenwarnung aus? Gesucht in: Red-Team RT-10, Plan T-11, V5, D-UI-V5-003, `DuplicateWarning.tsx`, Customer-Ports, Prior-Quellen und Digests; keine kanonische Schwelle gefunden. | A: nur normalisierte exakte Treffer bei E-Mail/Telefon oder Name+PLZ; B: unscharfe Namensähnlichkeit; C: externer Dienst. | A für Grundstamm: deterministisch, erklärbar, tenantgebunden; nur Warnung, nie Auto-Merge. Unscharfe Suche erst mit eigener Entscheidung. | PL | Normale Bestandskundensuche bleibt aktiv; bei exaktem Treffer wird Auswahl angeboten, ansonsten bewusste Neuanlage ohne automatisches Zusammenführen. | OFFEN — PL |
| Q-G03-004 | Wo und wie wird ein Offline-Entwurf dauerhaft gespeichert, ohne eine zweite Fachwahrheit oder unverschlüsselten Kundendatenschatten zu erzeugen? Gesucht in: Red-Team RT-11, OP-23/38, Plan Phase 3, D-RES-001, Repo-Code und Digests; kein freigegebener Schreibweg gefunden. | A: verschlüsselter lokaler Outbox-Vertrag mit Ablauf/Logout-Löschung; B: serverseitiger Draft; C: nur flüchtiger Formularzustand. | A nur nach eigener Sicherheits-/Datenentscheidung; bis dahin C und keine Offline-Erfolgsbehauptung. | Owner/PL | `Offline-Speicherung — In Aufbau`; Submit ohne Verbindung liefert keinen Erfolg, der offene Formularzustand bleibt nur in der laufenden Ansicht erhalten. | OFFEN — Phase 3 / neue Schreibwegentscheidung |
| Q-G03-005 | Welche Terminregeln erzeugen schon beim Intake eine harte Sperre und welche nur eine Warnung, insbesondere bei Kollegen-Abwesenheit, Kapazität und Betriebs-/Auftragsterminen? Gesucht in: OE-2609-13/19/26, Mindmap V2, Prozessablauf, Plan, OP-Liste und Digests; Kalenderrolle ist klar, Konfliktschwellen sind nicht festgelegt. | A: G09 liefert explizite `BLOCK/WARN/OK`-Entscheidung; B: G03 implementiert eigene Regeln. | A: G03 zeigt ausschließlich das Ergebnis des zuständigen Konfliktports und besitzt keine eigenen Schwellen. | PL | Wunschtermin erfassen; `Terminkonfliktprüfung — In Klärung` passiv anzeigen, keine automatische Sperre oder vermeintlich geprüfte Zusage behaupten. | OFFEN — sicher gegatet |

## Bereits geklärt — nicht erneut fragen

- Zahlungsregel: OE-2609-07/11.
- Bestandskunde suchen statt neu eingeben: D-UI-V5-003.
- Eingangsfoto ist optional, Fehlen sichtbar: D-UI-V5-003; vorläufiger belegter Hinweis aus Prozessquelle: `Foto fehlt. Vorschlag: Dokumentation vor Station starten ergänzen.`
- Kalender ist Hintergrundfunktion; App-Wahrheit, später M04-Projektion: OE-2609-19.
- OCR bleibt M06 und jeder Vorschlag wird menschlich bestätigt: Mindmap V2, OP-09.
- Rollenstandard: alle dürfen, Admin blockiert/erweitert: OE-2609-09.
- Kreile/Fremdapps bleiben getrennt: Owner-Nachtrag 2026-09-26 (2), OP-26.

