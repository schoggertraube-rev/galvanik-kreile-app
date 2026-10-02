<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Funktionen und Abläufe

## F-G03-01 — Globales Anlegen öffnen

- **Auslöser:** Nutzer wählt auf einer Kernseite `+ Anlegen` oder einen belegten Wareneingang-Einstieg.
- **Personen:** Rolf, Phillip und Gregor; alle standardmäßig erlaubt, sofern G01/Admin nicht ausdrücklich blockiert.
- **Ablauf:** (1) Shell sendet einen Create-Intent, (2) G03 prüft Session und Fähigkeit, (3) zeigt die V5-Auswahl `Kunde anlegen` / `Auftrag/KV anlegen`, (4) bringt den Fokus in den Dialog, (5) erreicht spätestens mit dem zweiten Klick das erste manuelle Feld.
- **Ergebnis + Receipt/Readback:** Das Öffnen selbst schreibt nichts. Erst eine nachfolgende Mutation darf Erfolg samt Receipt und fachlichem Readback melden.
- **Fehler:** Kein Dialog bei ungültiger Session; kein Provider- oder Legacy-Modal als stiller Fallback.
- **Konflikte:** Mehrere Create-Intents fokussieren denselben Flow statt parallele Formulare zu öffnen.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Zwei belegte Startoptionen | `Kunde anlegen` / `Auftrag/KV anlegen` | V5 |
| lädt | Kurzer Fokus-/Berechtigungszustand | FEHLT → Q-G03-001 | Designphase 1 |
| leer | Kein eigener Leerzustand; die Auswahl bleibt verfügbar | `Kunde anlegen` / `Auftrag/KV anlegen` | V5 |
| Fehler | Dialog kann nicht sicher initialisiert werden | FEHLT → Q-G03-001 | Designphase 1 |
| gesperrt | Profil ist ausdrücklich blockiert | `Diese Handlung gehört zu einem anderen Profil.` | `GlobalCreateFlow.tsx` |
| In Klärung | Noch nicht freigegebene Detailentscheidung ist passiv | `In Klärung` | OE-2609-04 |
| In Aufbau | Spätere Fähigkeit ist deaktiviert | `In Aufbau` | OE-2609-04 |

## F-G03-02 — Bestandskunde wählen oder Kunden anlegen

- **Auslöser:** Nutzer startet Kunde, KV oder direkten Intake.
- **Personen:** Rolf, Phillip und Gregor, soweit nicht adminseitig gesperrt.
- **Ablauf:** (1) Suche ab zwei Zeichen, (2) kanonische Treffer nach Name/Kundennummer/Ort, (3) Treffer wählen oder bewusst Neuanlage starten, (4) Dublettenwarnung bestätigen, (5) Kundendaten erfassen, (6) Command ausführen, (7) Receipt frisch lesen.
- **Ergebnis + Receipt/Readback:** Bestehende Kunden-ID wird unverändert verwendet oder genau ein neuer Kunde mit `K-JJJJ-NNNN`, Event, Receipt und Readback erzeugt.
- **Fehler:** Suche und Mutation sind getrennt; Suchfehler erzeugt keine scheinbar leere Trefferliste und keine Neuanlage im Hintergrund.
- **Konflikte:** Gleiche Anfrage mit anderem Intent wird abgewiesen; plausible Dublette wird nur gewarnt, nie automatisch zusammengeführt.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Suchfeld und kanonische Treffer | `Kunde suchen` | `GlobalCreateFlow.tsx` |
| lädt | Belegter Lesezustand | `Kundenstamm wird sicher gelesen …` | `GlobalCreateFlow.tsx` |
| leer | Belegter leerer Kundenstamm | `Noch kein belegter Kunde` | `GlobalCreateFlow.tsx` |
| Fehler | Suche konnte nicht sicher gelesen werden | `Der Kundenstamm konnte nicht sicher gelesen werden. Es wurde nichts angelegt.` | `GlobalCreateFlow.tsx` |
| gesperrt | Admin-Sperre greift | `Diese Handlung gehört zu einem anderen Profil.` | `GlobalCreateFlow.tsx`; OE-2609-09 |
| In Klärung | Dublettenbewertung wartet auf Nutzer | `Mögliche Dublette erkannt` | `DuplicateWarning.tsx` |
| In Aufbau | Provider-Anreicherung ist deaktiviert | `Anreicherung — In Aufbau` | OE-2609-04; Wortlaut durch Q-G03-001 finalisieren |

## F-G03-03 — KV anlegen, fortsetzen und ändern

- **Auslöser:** Nach Bestandskundenwahl oder bestätigter Kundenneuanlage wird `Kostenvoranschlag anlegen` gewählt beziehungsweise ein offener KV geöffnet.
- **Personen:** Rolf, Phillip und Gregor, sofern nicht blockiert.
- **Ablauf:** (1) Kundenzuordnung, (2) 1–20 Positionen Katalog oder Freitext, (3) Preise und Terminwunsch, (4) Notiz, (5) persistenter Create/Update-Command mit Version, (6) Receipt und Readback, (7) Entwurf nach Reload wieder öffnen.
- **Ergebnis + Receipt/Readback:** Genau ein tenantgebundener KV `KV-JJJJ-NNNN`; Nettosumme wird serverseitig gelesen, Updates sind versionssicher.
- **Fehler:** Validierungs- und Readbackfehler halten den Entwurf sichtbar; kein grüner Erfolg bei unbekanntem Ausgang.
- **Konflikte:** Stale Version oder geänderter Intent liefert Konflikt und überschreibt nichts.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Offener KV mit Positionen | `Kostenvoranschlag anlegen` | V5 |
| lädt | Lesen offener KVs | FEHLT → Q-G03-001 | Designphase 1 |
| leer | Belegt keine offenen Entwürfe | `Noch kein offener Kostenvoranschlag` | `GlobalCreateFlow.tsx` |
| Fehler | Read konnte nicht sicher bestätigt werden | `Der gespeicherte Stand konnte nicht sicher gelesen werden. Es wurde nichts erneut gesendet.` | `GlobalCreateFlow.tsx` |
| gesperrt | Admin-Sperre greift | `Diese Handlung gehört zu einem anderen Profil.` | `GlobalCreateFlow.tsx` |
| In Klärung | Stale Version/Intent braucht Entscheidung | `In Klärung` | OE-2609-04; exakter Konflikttext FEHLT → Q-G03-001 |
| In Aufbau | Noch nicht angebundene Kalkulationshilfe | `Kalkulationshilfe — In Aufbau` | OE-2609-04; Wortlaut durch Q-G03-001 finalisieren |

## F-G03-04 — KV genau einmal in Auftrag überführen

- **Auslöser:** Nutzer wählt beim gespeicherten KV `Als Auftrag anlegen` und bestätigt den zugesagten Termin.
- **Personen:** Rolf, Phillip und Gregor, sofern nicht blockiert.
- **Ablauf:** (1) KV-Version und Status lesen, (2) zugesagten Termin erfassen, (3) Conversion mit stabiler Anfrage-ID, (4) F1.1-Intake atomar aufrufen, (5) KV-Vergabe-Receipt und Intake-Receipt prüfen, (6) beide frisch lesen, (7) Auftragskarte anbieten.
- **Ergebnis + Receipt/Readback:** Genau ein Auftrag `A-JJJJ-NNNN`; der KV verweist unveränderlich auf ihn.
- **Fehler:** Schlägt der Intake fehl, bleibt der KV unvergeben; unbekannter Ausgang wird read-only geprüft, nicht blind wiederholt.
- **Konflikte:** Parallele Doppelvergabe oder stale Version erzeugt keinen zweiten Auftrag.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Gespeicherter KV mit Vergabeaktion | `Als Auftrag anlegen` | V5 |
| lädt | Conversion und frischer Readback | FEHLT → Q-G03-001 | Designphase 1 |
| leer | Kein vergabefähiger KV | FEHLT → Q-G03-001 | Designphase 1 |
| Fehler | Vergabe nicht belegt | FEHLT → Q-G03-001 | Designphase 1 |
| gesperrt | Admin-Sperre greift | `Diese Handlung gehört zu einem anderen Profil.` | `GlobalCreateFlow.tsx` |
| In Klärung | Ausgang der Vergabe ist unbekannt | `Der gespeicherte Stand konnte nicht sicher gelesen werden. Es wurde nichts erneut gesendet.` | `GlobalCreateFlow.tsx` |
| In Aufbau | Späterer Versand des KV | `KV-Versand — In Aufbau` | OE-2609-04; Wortlaut durch Q-G03-001 finalisieren |

## F-G03-05 — Direkten Wareneingang anlegen

- **Auslöser:** Nutzer wählt `Neuer Eingang` oder startet den direkten Auftrag im globalen Flow.
- **Personen:** Rolf, Phillip und Gregor, sofern nicht blockiert.
- **Ablauf:** (1) Kunde wählen/anlegen, (2) Eingangsart, Zahlungsmodus und Express erfassen, (3) Terminwunsch und Zusagetermin, (4) 1–20 Positionen, (5) optionale Notiz, (6) serverseitig validierter Command in einer Transaktion, (7) Receipt und Arbeitslisten-/Auftrags-Readback.
- **Ergebnis + Receipt/Readback:** Genau ein Auftrag mit eindeutiger Nummer, Kunde, Daten, Zahlungs-/Eingangsmodus und Positionen; UI zeigt beide Termine erst nach Fresh-Readback.
- **Fehler:** Unvollständige oder manipulierte Eingaben werden vor oder in der Transaktion abgewiesen; kein Teilwrite.
- **Konflikte:** Idempotenz-ID mit geändertem Intent, Nummernkonkurrenz und paralleler Submit liefern keinen Doppelauftrag.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Formular und nach Erfolg Receipt-Zusammenfassung | `Digitaler Wareneingang` | `OrderIntakePanel.tsx` |
| lädt | Readback läuft | `Gespeicherter Beleg und Arbeitsliste werden frisch bestätigt.` | `OrderIntakePanel.tsx` |
| leer | Leere Arbeitsliste nach belegtem Read | FEHLT → Q-G03-001 | Designphase 1 |
| Fehler | Readback nicht bestätigt | `Speicherung konnte nicht durch einen frischen Readback bestätigt werden.` | `OrderIntakePanel.tsx` |
| gesperrt | Admin-Sperre greift | `Diese Handlung gehört zu einem anderen Profil.` | `GlobalCreateFlow.tsx` |
| In Klärung | Ausgang unbekannt, Anfrage-ID bleibt erhalten | `In Klärung` | OE-2609-04; Detailtext FEHLT → Q-G03-001 |
| In Aufbau | Offline-Outbox noch nicht geliefert | `Offline-Speicherung — In Aufbau` | OP-23; Wortlaut durch Q-G03-001 finalisieren |

## F-G03-06 — Eingangsfoto sicher zuordnen

- **Auslöser:** Nach Auftragserfolg wählt der Nutzer optional je Position ein Originalfoto.
- **Personen:** Rolf, Phillip und Gregor, sofern nicht blockiert.
- **Ablauf:** (1) MIME/Größe lokal prüfen, (2) Evidenz-Reservierung anfordern, (3) Hash und erwarteten Pfad prüfen, (4) unveränderlich hochladen, (5) finalisieren, (6) Evidenz frisch lesen, (7) exakte Zuordnung zur Auftragsposition bestätigen.
- **Ergebnis + Receipt/Readback:** Genau ein finalisiertes Originalbeleg-Receipt mit Hash und Zielposition; fehlendes Foto bleibt nicht blockierender Hinweis.
- **Fehler:** Falscher MIME-Typ, >12 MiB, Hash-/Pfadabweichung oder fehlender Readback zeigt Fehler und verändert den Auftragsstatus nicht.
- **Konflikte:** Doppelte Finalisierung oder unklare Zuordnung wird nicht als Erfolg ausgegeben.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Fotoauswahl je bestätigter Position | `Originalfotos sicher zuordnen` | `OrderIntakePanel.tsx` |
| lädt | Reservierung/Upload läuft | `Original wird geprüft und reserviert.` | `OrderIntakePanel.tsx` |
| leer | Kein Foto gewählt; Auftrag bleibt gültig | `Foto fehlt. Vorschlag: Dokumentation vor Station starten ergänzen.` | Vorwissen `01_PROZESSABLAUF_WERKSTATT_APP.md`, durch Prior-Quellenliste bestätigt; D-UI-V5-003 präzisiert: nicht blockierend |
| Fehler | Ungültiges Format/Größe | `Nur JPEG, PNG oder WebP bis 12 MiB sind erlaubt.` | `OrderIntakePanel.tsx` |
| gesperrt | Evidenzrecht fehlt | `Diese Handlung gehört zu einem anderen Profil.` | Zielzustand nach OE-2609-09; exakter Foto-Sperrtext FEHLT → Q-G03-001 |
| In Klärung | Finalisierung nicht eindeutig | `Original konnte nicht sicher gespeichert werden.` | `OrderIntakePanel.tsx` |
| In Aufbau | Automatische Fotoanalyse/OCR fehlt | `Fotoanalyse — In Aufbau` | OE-2609-04; M06 |

## F-G03-07 — Termin im Hintergrund führen und später spiegeln

- **Auslöser:** Auftrag wird angelegt oder sein Termin wird im zuständigen Grundstamm-Modul geändert.
- **Personen:** Rolf, Phillip und Gregor sehen den fachlichen App-Stand; M04 arbeitet nur als freigegebener Adapter.
- **Ablauf:** (1) G03 publiziert den bestätigten Auftrags-/Terminstand, (2) App-Terminkern upsertet idempotent, (3) Startseite/Werkstatt lesen ihn, (4) M04 projiziert später in das Kreile-Büropostfach, (5) Projektionsstatus bleibt getrennt von der App-Wahrheit.
- **Ergebnis + Receipt/Readback:** App-Receipt ist maßgeblich. Ein späteres Outlook-Receipt bestätigt nur die Projektion und enthält keine neue Fachwahrheit.
- **Fehler:** Fehlendes M04 blockiert den Intake nicht; Projektionsfehler erscheint als Handlungsbedarf, nicht als Kalenderzwang.
- **Konflikte:** Bei Abweichung gewinnt der bestätigte App-Termin; M04 darf keine fremden Kalenderdaten in den Auftrag zurückschreiben.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Terminwunsch und Zusagetermin im Auftrag | `Terminwunsch` / `Zugesagter Termin` | `GlobalCreateFlow.tsx`; OE-2609-19 |
| lädt | Hintergrundprojektion, falls M04 freigegeben | FEHLT → Q-G03-001 | M04-Designphase |
| leer | Kein optionaler Outlook-Projektionsbeleg | Kein zusätzlicher G03-Leertext; App-Termin bleibt sichtbar | OE-2609-19 |
| Fehler | Projektion fehlgeschlagen, App-Daten bleiben | FEHLT → M04-Dossier | OE-2609-19 |
| gesperrt | M04-Gate/Consent fehlt | `Outlook-Synchronisierung — In Aufbau` | OP-11; OE-2609-04 |
| In Klärung | Projektionsstatus nicht eindeutig | `In Klärung` | OE-2609-04 |
| In Aufbau | M04 ist noch nicht angebunden | `Outlook-Synchronisierung — In Aufbau` | OE-2609-19 |

## F-G03-08 — OCR-Vorschlag später übernehmen

- **Auslöser:** Erst nach freigegebener M06-Anbindung wählt der Nutzer OCR-Erfassung.
- **Personen:** Rolf, Phillip und Gregor; jeder Vorschlag muss von einem Menschen bestätigt werden.
- **Ablauf:** (1) Original sicher speichern, (2) M06 liefert Vorschläge, (3) unsichere Werte markieren, (4) Nutzer korrigiert/bestätigt, (5) G03 normalisiert in denselben manuellen Command, (6) Receipt und Readback wie beim manuellen Weg.
- **Ergebnis + Receipt/Readback:** OCR erzeugt nie direkt einen Auftrag; nur der bestätigte G03-Command schreibt.
- **Fehler:** Providerfehler lässt den manuellen Weg offen und schreibt nichts.
- **Konflikte:** OCR-Wert und Benutzerkorrektur: ausschließlich der ausdrücklich bestätigte Benutzerwert gelangt in den Intake-Snapshot.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Nach M06 bestätigbare Vorschläge | FEHLT → M06-Dossier | Mindmap V2 |
| lädt | Dokumentanalyse | FEHLT → M06-Dossier | Mindmap V2 |
| leer | Keine erkannten Werte | FEHLT → M06-Dossier | Mindmap V2 |
| Fehler | Provider hat keinen sicheren Vorschlag geliefert | FEHLT → M06-Dossier | Mindmap V2 |
| gesperrt | M06-Gate fehlt | `OCR-Erfassung — In Aufbau` | OE-2609-04; OP-09 |
| In Klärung | Unsicherer Wert wartet auf Mensch | `In Klärung` | OE-2609-04 |
| In Aufbau | M06 noch nicht verbunden | `OCR-Erfassung — In Aufbau` | Nutzer-Nachtrag; OP-09 |
