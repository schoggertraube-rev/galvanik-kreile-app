<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Funktionen und Abläufe M06

## Rollen

| Rolle | Darf | Darf nicht |
|---|---|---|
| Angemeldeter Mitarbeiter | Original erfassen, Vorschläge prüfen/korrigieren, Kandidaten wählen, erlaubte Aktion bestätigen | Rechte umgehen, Provider konfigurieren, fremde Tenant-Daten sehen |
| Rolf / Phillip | wie Mitarbeiter; zusätzlich fachliche Konflikte entscheiden | technische Administration ohne passende Adminberechtigung |
| Admin | Provider-/Modulstatus ansehen und technisch administrieren, sofern separat berechtigt | fachliche Werte allein kraft Adminrolle bestätigen |
| Provideradapter | Dokument analysieren und Ergebnis zurückgeben | Fach-ID erfinden, Datenbank ändern, Aktion ausführen |
| Host/Fachmodul | Rechte prüfen, Original speichern, Kandidaten liefern, Kommando ausführen, Receipt/Readback liefern | unbestätigten Modelloutput als Wahrheit speichern |

## End-to-End-Ablauf

1. Nutzer öffnet **„Dokument / Info erfassen“**.
2. Er wählt Quelle und Zweck oder lässt den Zweck zunächst **„Unklar“**.
3. Host reserviert eine tenantgebundene Aufnahme. Die Datei wird unverändert hochgeladen; Hash, Größe und MIME-Typ werden serverseitig bestätigt.
4. M06 zeigt das gesicherte Original. Erst jetzt kann der Nutzer **„Vorschläge erzeugen“** wählen, sofern der Provider freigegeben ist.
5. Der Server prüft Format, Seiten-/Größenlimit, Zweck, Rechte und Providerstatus. Er wählt die günstigste zulässige Stufe; kein stiller Fallback.
6. Der Adapter liefert Rohoutput. Die Orchestrierung erstellt ausschließlich quellennachweisbare Fakten und prüft die Faktendisposition vollständig.
7. Nutzer prüft Original und Fakten. Werte unter 85 %, Konflikte und kritische Rollen/Felder sind besonders markiert; alle fachlich wirksamen Werte bleiben bestätigungspflichtig.
8. Nutzer bestätigt **„Fakten geprüft“**. Ungeklärte Fakten bleiben sichtbar und verhindern eine fachliche Aktion, nicht das Sichern des Originals.
9. Der Server liest echte Kunden-/Auftrags-/Belegkandidaten. Nutzer wählt genau ein Ziel oder **„Nicht zuordnen“**.
10. Die App zeigt eine serverseitig bestimmte Aktion mit Wirkung und Vorbedingungen. Nutzer bestätigt separat.
11. Der Server führt genau ein idempotentes Fachkommando aus, zeigt Receipt und liest die tatsächliche Fachwahrheit zurück.
12. Bei Abbruch kann derselbe Lauf ohne erneuten Upload und ohne Doppelkommando fortgesetzt werden.

Die folgenden wörtlichen Texte sind Abnahmetexte. Ein Builder ersetzt sie nicht durch generische Toasts.

### F-M06-001 – Original aufnehmen und sichern

**Auslöser:** Nutzer wählt in `Dokument / Info erfassen` eine Datei oder ein Dokumentfoto.

**Personen:** Alle angemeldeten Kreile-Mitarbeiter; Admin kann die Fähigkeit je Person sperren/erweitern.

**Schritte:** 1. Quelle wählen. 2. Metadaten/Format prüfen. 3. tenantgebundene Aufnahme reservieren. 4. Original über Host-Speicherweg hochladen. 5. serverseitig finalisieren und Hash prüfen. 6. Originalbeleg anzeigen.

**Ergebnis + Receipt/Readback:** `original-secured`-Beleg mit Source-ID/Version/Hash; Readback liest Metadaten aus dem Hostspeicher zurück. Noch keine Analyse oder Fachmutation.

**Fehlerfälle:** Ungültiges Format, Größen-/Seitenlimit, Hashabweichung, abgelaufene Uploadfreigabe, Tenant-/Sessionwechsel oder Sicherheitsbefund stoppen vor Analyse.

**Sperren/Konflikte:** S-M06-002, S-M06-004; bei abweichendem Original K-M06-006.

#### Zustände

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Statusansicht; Primäraktion `Vorschläge erzeugen` | **„Original gesichert“** – „Die unveränderte Datei ist gespeichert. Jetzt können Sie Vorschläge erzeugen oder manuell fortsetzen.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| lädt | Statusansicht; Primäraktion `Upload abbrechen` | **„Original wird gesichert …“** – „Fenster geöffnet lassen. Es wurde noch keine Analyse gestartet.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| leer | Statusansicht; Primäraktion `Datei auswählen` | **„Noch kein Dokument ausgewählt“** – „Foto, Scan, PDF oder unterstützte Office-Datei auswählen.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| Fehler | Statusansicht; Primäraktion `Erneut versuchen` | **„Original konnte nicht gesichert werden“** – „Nichts wurde analysiert. Prüfen Sie die Datei und versuchen Sie es erneut. Referenz: {correlationId}.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| gesperrt | Statusansicht; Primäraktion `Zur Startseite` | **„Aufnahme gesperrt“** – „Ihre Sitzung oder Berechtigung reicht für diesen Vorgang nicht aus.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Klärung | Statusansicht; Primäraktion `Andere Datei wählen` | **„Dateiformat in Klärung“** – „Diese Datei bleibt lokal ausgewählt und wird nicht hochgeladen.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Aufbau | Statusansicht; Primäraktion `Datei auswählen` | **„Aufnahme in Aufbau“** – „Diese Quelle ist noch nicht verfügbar. Nutzen Sie derzeit Datei oder Foto.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |

### F-M06-002 – Analyseweg bestimmen und ausführen

**Auslöser:** Gesichertes Original; Nutzer wählt `Vorschläge erzeugen`.

**Personen:** Alle angemeldeten, für das Original berechtigten Mitarbeiter; Admin kann sperren/erweitern.

**Schritte:** 1. strukturierte Quelle prüfen. 2. Format/Zweck gegen Adapterfähigkeiten prüfen. 3. Provider-/Kosten-/Rechtegate prüfen. 4. expliziten Analyseweg anzeigen. 5. Analyse mit Korrelation starten und Status lesen. 6. Rohbeleg versioniert übernehmen.

**Ergebnis + Receipt/Readback:** Providerreceipt mit Job-, Modell-, API- und Regionskennung; Status wird beim Provider nachgelesen. Keine Fachmutation.

**Fehlerfälle:** Provider fehlt, Format/Limit unzulässig, Timeout/429/500 oder ungültige Antwort; kein stiller Wechsel, manueller Pfad bleibt.

**Sperren/Konflikte:** S-M06-002 bis S-M06-005; K-M06-005.

#### Zustände

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Statusansicht; Primäraktion `Vorschläge prüfen` | **„Vorschläge sind bereit“** – „Prüfen Sie jeden Wert am Original. Es wurde noch nichts zugeordnet oder gebucht.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| lädt | Statusansicht; Primäraktion `Später fortsetzen` | **„Dokument wird analysiert …“** – „Das Original ist bereits sicher gespeichert. Sie können später fortsetzen.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| leer | Statusansicht; Primäraktion `Vorschläge erzeugen` | **„Noch keine Vorschläge“** – „Starten Sie die Analyse oder erfassen Sie die Werte manuell.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| Fehler | Statusansicht; Primäraktion `Manuell fortsetzen` | **„Analyse fehlgeschlagen“** – „Das Original ist sicher. Es wurde kein anderer Anbieter verwendet. Referenz: {correlationId}.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| gesperrt | Statusansicht; Primäraktion `Manuell fortsetzen` | **„Analyse nicht freigegeben“** – „Der externe Dokumentendienst ist für die App noch nicht freigegeben.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Klärung | Statusansicht; Primäraktion `Manuell fortsetzen` | **„Dokumentendienst in Klärung“** – „Datenschutz, Betrieb und Kosten werden noch entschieden. Es werden keine Daten gesendet.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Aufbau | Statusansicht; Primäraktion `Manuell fortsetzen` | **„Analyse in Aufbau“** – „Der echte Providerpfad ist noch nicht angeschlossen.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |

### F-M06-003 – Faktenledger erzeugen und validieren

**Auslöser:** Valider Provider-Rohbeleg oder Beginn des manuellen Pfads.

**Personen:** System verarbeitet; alle berechtigten Mitarbeiter sehen das Ergebnis; Admin kann nicht fachlich bestätigen.

**Schritte:** 1. Fakten normalisieren. 2. Quellenanker anhängen. 3. Rollen/Beträge trennen. 4. exakt eine Disposition je Fakt setzen. 5. Coverage reproduzieren. 6. Ledgerversion versiegeln.

**Ergebnis + Receipt/Readback:** versioniertes FactLedger; Readback berechnet Zähler erneut aus den Fakten. Noch keine fachliche Wahrheit.

**Fehlerfälle:** fehlende ID/Quelle/Disposition, doppelte Disposition, erfundene Fach-ID, unzulässiger Action-Key oder Inkonsistenz verwirft die gesamte Version.

**Sperren/Konflikte:** S-M06-005/S-M06-006; K-M06-001 bis K-M06-005.

#### Zustände

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Statusansicht; Primäraktion `Fakten prüfen` | **„Fakten vollständig aufgeteilt“** – „Jeder erkannte Wert hat Quelle und Bearbeitungsstatus.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| lädt | Statusansicht ohne Aktion | **„Vorschläge werden geprüft …“** – „Quelle, Rollen und Vollständigkeit werden kontrolliert.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| leer | Statusansicht; Primäraktion `Manuell erfassen` | **„Keine verwertbaren Fakten erkannt“** – „Das Original bleibt erhalten. Erfassen Sie benötigte Werte manuell.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| Fehler | Statusansicht; Primäraktion `Manuell fortsetzen` | **„Vorschläge unvollständig“** – „Der Analyselauf wurde verworfen; das Original ist unverändert verfügbar. Referenz: {correlationId}.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| gesperrt | Statusansicht; Primäraktion `Zur Startseite` | **„Faktenprüfung gesperrt“** – „Dieser Analyselauf gehört nicht zu Ihrer aktuellen Berechtigung.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Klärung | Statusansicht; Primäraktion `Einen Wert klären` | **„Feldbedeutung in Klärung“** – „Mindestens ein Wert kann keiner sicheren Rolle zugeordnet werden.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Aufbau | Statusansicht; Primäraktion `Manuell erfassen` | **„Faktenprüfung in Aufbau“** – „Dieser Dokumenttyp ist noch nicht für automatische Vorschläge freigegeben.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |

### F-M06-004 – Fakten am Original prüfen

**Auslöser:** FactLedger im Zustand `REVIEW_REQUIRED`.

**Personen:** Alle berechtigten Mitarbeiter; fachliche Konflikte werden an Rolf/Phillip gegeben; Admin kann sperren/erweitern.

**Schritte:** 1. Feld wählen. 2. Originalquelle sehen. 3. Roh-/Normalwert/Konfidenz prüfen. 4. korrigieren oder Disposition setzen. 5. kritische Fakten einzeln bestätigen. 6. `Fakten geprüft` bestätigen.

**Ergebnis + Receipt/Readback:** Reviewreceipt mit Actor/Zeit/Ledgerversion; Readback prüft Coverage und offene Konflikte erneut.

**Fehlerfälle:** offene kritische Fakten, Konflikte, Versionskonflikt oder fehlende Quellenprüfung verhindern Bestätigung; Entwurf bleibt wiederaufnehmbar.

**Sperren/Konflikte:** S-M06-006/S-M06-010; K-M06-001 bis K-M06-004.

#### Zustände

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Statusansicht; Primäraktion `Weiter zur Zuordnung` | **„Alle erforderlichen Fakten geprüft“** – „Sie können jetzt ein Fachziel wählen. Es wurde noch keine Aktion ausgeführt.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| lädt | Statusansicht ohne Aktion | **„Prüfstand wird gespeichert …“** – „Ihre Änderungen bleiben am Original nachvollziehbar.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| leer | Statusansicht; Primäraktion `Feld hinzufügen` | **„Keine Felder zur Prüfung“** – „Erfassen Sie mindestens Dokumentzweck und die für die Zuordnung nötigen Angaben.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| Fehler | Statusansicht; Primäraktion `Erneut speichern` | **„Prüfstand konnte nicht gespeichert werden“** – „Bleiben Sie auf dieser Seite und versuchen Sie es erneut. Referenz: {correlationId}.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| gesperrt | Statusansicht; Primäraktion `Lauf neu laden` | **„Prüfung gesperrt“** – „Der Lauf wurde geändert oder Ihre Berechtigung ist abgelaufen. Ihre Eingaben wurden nicht übernommen.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Klärung | Statusansicht; Primäraktion `Einen Wert klären` | **„Prüfung noch offen“** – „Klären Sie markierte Rollen, Beträge oder unzugeordnete Fakten.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Aufbau | Statusansicht; Primäraktion `Original öffnen` | **„Prüfansicht in Aufbau“** – „Für diesen Dokumenttyp fehlt noch die freigegebene Feldansicht.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |

### F-M06-005 – Fachziel zuordnen

**Auslöser:** Fakten sind bestätigt; Nutzer öffnet die Zuordnung.

**Personen:** Alle berechtigten Mitarbeiter; mehrdeutige fachliche Fälle an Rolf/Phillip; Admin kann sperren/erweitern.

**Schritte:** 1. echte Kandidaten serverseitig lesen. 2. bis zu drei Treffergründe zeigen. 3. Ziel oder `Nicht zuordnen` wählen. 4. Existenz/Rechte erneut prüfen. 5. Zuordnungsentwurf bestätigen.

**Ergebnis + Receipt/Readback:** Assignmentreceipt oder ungeklärter Eingang; Readback liest das Ziel beziehungsweise den offenen Eingang nach.

**Fehlerfälle:** kein Treffer, gelöschtes/gesperrtes Ziel, fehlendes Recht oder Kandidatenfehler; niemals Modell-ID.

**Sperren/Konflikte:** S-M06-007/S-M06-008; K-M06-001/K-M06-002.

#### Zustände

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Statusansicht; Primäraktion `Zuordnung prüfen` | **„Zuordnungsziel gewählt“** – „Prüfen Sie Ziel und Treffergrund vor der Bestätigung.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| lädt | Statusansicht ohne Aktion | **„Passende Ziele werden gesucht …“** – „Es werden nur echte, für Sie sichtbare Datensätze geprüft.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| leer | Statusansicht; Primäraktion `Nicht zuordnen` | **„Kein passendes Ziel gefunden“** – „Das Dokument bleibt im ungeklärten Eingang. Es wird keine ID erfunden.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| Fehler | Statusansicht; Primäraktion `Erneut suchen` | **„Ziele konnten nicht geladen werden“** – „Es wurde nichts zugeordnet. Referenz: {correlationId}.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| gesperrt | Statusansicht; Primäraktion `Anderes Ziel wählen` | **„Ziel nicht verfügbar“** – „Das gewählte Ziel existiert nicht mehr oder ist für Sie gesperrt.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Klärung | Statusansicht; Primäraktion `An Rolf geben` | **„Zuordnung in Klärung“** – „Mehrere Ziele passen. Rolf oder Phillip muss die Zuordnung entscheiden.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Aufbau | Statusansicht; Primäraktion `Nicht zuordnen` | **„Zuordnung in Aufbau“** – „Dieser Zieltyp ist noch nicht angeschlossen.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |

### F-M06-006 – Fachaktion bestätigen, ausführen und nachlesen

**Auslöser:** Bestätigte Fakten und Zuordnung; Nutzer wählt eine serverseitig erlaubte Aktion.

**Personen:** Alle für das konkrete Fachkommando berechtigten Mitarbeiter; Admin kann sperren/erweitern, besitzt dadurch nicht automatisch Fachrecht.

**Schritte:** 1. `actionKey` serverseitig auflösen. 2. Wirkung/Risiko/Vorbedingungen zeigen. 3. separat bestätigen. 4. genau ein idempotentes Kommando. 5. Receipt lesen. 6. Fachwahrheit nachlesen.

**Ergebnis + Receipt/Readback:** CommandReceipt plus konsistenter Readback; erst dann Erfolg.

**Fehlerfälle:** Rechte-/Vorbedingungsänderung, Idempotenzkonflikt, Command- oder Readbackfehler; kein grüner Erfolg.

**Sperren/Konflikte:** S-M06-008/S-M06-009; K-M06-003/K-M06-004.

#### Zustände

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Statusansicht; Primäraktion `Ergebnis öffnen` | **„Aktion bestätigt und nachgelesen“** – „{readbackSummary}. Beleg: {receiptId}.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| lädt | Statusansicht ohne Aktion | **„Bestätigte Aktion wird ausgeführt …“** – „Nicht erneut klicken. Die Ausführung ist idempotent.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| leer | Statusansicht; Primäraktion `Ohne Aktion abschließen` | **„Keine Aktion ausgewählt“** – „Sie können das geprüfte Dokument ohne Folgeaktion speichern.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| Fehler | Statusansicht; Primäraktion `Status prüfen` | **„Aktion nicht bestätigt“** – „Ein Erfolg konnte nicht nachgelesen werden. Referenz: {correlationId}.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| gesperrt | Statusansicht; Primäraktion `Zuordnung prüfen` | **„Aktion nicht erlaubt“** – „Recht oder Vorbedingung hat sich geändert. Es wurde nichts ausgeführt.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Klärung | Statusansicht; Primäraktion `An Rolf geben` | **„Aktion in Klärung“** – „Wirkung oder Konflikt muss vor der Ausführung von Rolf oder Phillip entschieden werden.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Aufbau | Statusansicht; Primäraktion `Ohne Aktion abschließen` | **„Aktion in Aufbau“** – „Für diesen Vorschlag gibt es noch kein freigegebenes Fachkommando.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |

### F-M06-007 – Lauf wiederaufnehmen und Fehler beheben

**Auslöser:** Nutzer öffnet einen eigenen/erlaubten offenen Lauf oder folgt `Status prüfen`.

**Personen:** Alle für den Lauf berechtigten Mitarbeiter; fachliche Übergabe an Rolf/Phillip; Admin kann sperren/erweitern.

**Schritte:** 1. Lauf tenantgebunden laden. 2. Version/Checkpoint prüfen. 3. letzten sicheren Stand anzeigen. 4. passende Aktion anbieten. 5. ohne Doppelwirkung fortsetzen.

**Ergebnis + Receipt/Readback:** Resumebeleg mit Checkpoint/Version; vorhandene Receipts werden nachgelesen statt Kommandos zu wiederholen.

**Fehlerfälle:** Tenant-/Actorabweichung, ungültige Version oder fehlende Originalreferenz sperrt; keine Rekonstruktion aus Modelltext.

**Sperren/Konflikte:** S-M06-009/S-M06-010; K-M06-004/K-M06-006.

#### Zustände

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Statusansicht; Primäraktion `Fortsetzen` | **„Vorgang kann fortgesetzt werden“** – „Letzter sicherer Stand: {checkpointLabel}.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| lädt | Statusansicht ohne Aktion | **„Sicherer Stand wird geladen …“** – „Es wird keine Aktion erneut ausgelöst.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| leer | Statusansicht; Primäraktion `Neues Dokument` | **„Kein offener Vorgang“** – „Beginnen Sie eine neue Dokumentaufnahme.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| Fehler | Statusansicht; Primäraktion `Original öffnen` | **„Vorgang konnte nicht wiederhergestellt werden“** – „Das Original wird nicht aus Modelltext rekonstruiert. Referenz: {correlationId}.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| gesperrt | Statusansicht; Primäraktion `Zur Startseite` | **„Vorgang gesperrt“** – „Tenant, Version oder Berechtigung stimmt nicht mit dem gespeicherten Stand überein.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Klärung | Statusansicht; Primäraktion `Status prüfen` | **„Fortsetzung in Klärung“** – „Der letzte Fachschritt muss vor dem Fortsetzen geprüft werden.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Aufbau | Statusansicht; Primäraktion `Manuell fortsetzen` | **„Wiederaufnahme in Aufbau“** – „Dieser ältere Vorgang kann nur über das Original manuell fortgesetzt werden.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |

### F-M06-008 – Manueller Kernpfad

**Auslöser:** Nutzer wählt `Manuell fortsetzen` oder Analyse ist gesperrt/fehlgeschlagen.

**Personen:** Alle berechtigten Mitarbeiter; fachliche Konflikte Rolf/Phillip; Admin kann sperren/erweitern.

**Schritte:** 1. gesichertes Original öffnen. 2. Zweck/Fakten manuell erfassen. 3. Quelle prüfen. 4. Fakten bestätigen. 5. Kandidaten/Zuordnung wie F-M06-005. 6. optionale Aktion wie F-M06-006.

**Ergebnis + Receipt/Readback:** dasselbe Review-/Assignment-/Commandreceipt und derselbe Readbackvertrag wie im Analysepfad; kein Fake-Providerbeleg.

**Fehlerfälle:** dieselben Tenant-, Fakten-, Zuordnungs-, Command- und Readbackfehler; manuell senkt keinen Schutz.

**Sperren/Konflikte:** S-M06-006 bis S-M06-010; K-M06-001 bis K-M06-006.

#### Zustände

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Statusansicht; Primäraktion `Weiter zur Zuordnung` | **„Manuelle Angaben geprüft“** – „Die Angaben sind am Original bestätigt und bereit zur Zuordnung.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| lädt | Statusansicht ohne Aktion | **„Manuelle Angaben werden gespeichert …“** – „Das Original bleibt unverändert.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| leer | Statusansicht; Primäraktion `Feld hinzufügen` | **„Noch keine Angaben erfasst“** – „Öffnen Sie das Original und tragen Sie die benötigten Werte ein.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| Fehler | Statusansicht; Primäraktion `Erneut speichern` | **„Manuelle Angaben konnten nicht gespeichert werden“** – „Es wurde nichts zugeordnet. Referenz: {correlationId}.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| gesperrt | Statusansicht; Primäraktion `Zur Startseite` | **„Manuelle Erfassung gesperrt“** – „Ihre Sitzung oder Berechtigung reicht für diesen Vorgang nicht aus.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Klärung | Statusansicht; Primäraktion `An Rolf geben` | **„Angabe in Klärung“** – „Markieren Sie den Wert als Konflikt oder geben Sie ihn an Rolf oder Phillip.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |
| In Aufbau | Statusansicht; Primäraktion `Ohne Zuordnung abschließen` | **„Feldgruppe in Aufbau“** – „Diese Fachfelder sind noch nicht freigegeben. Das Original bleibt gespeichert.“ | D-RES-001; D-AI-002; V5-Interaktionsanker; Dossier-Spezifikation 2026-09-26 |

## Navigations- und Abbruchverhalten

- Schließen vor Originalfinalisierung: Upload abbrechen, keine Analyse, kein Erfolgstext.
- Schließen nach Originalfinalisierung: Lauf als offen speichern und beim nächsten Einstieg anbieten.
- Zurück aus Faktenprüfung: Korrekturen als Entwurf speichern; Analyseversion nicht still ersetzen.
- Neuer Analyselauf: neue Version; vorherige Version bleibt auditierbar, aber nicht gleichzeitig bestätigbar.
- Tenant-/Sessionwechsel: sofort sperren und keine Vorschau aus Cache zeigen.
- Doppelklick/Refresh beim Kommando: derselbe Idempotenzschlüssel liefert dasselbe Receipt oder einen klaren Konflikt, nie eine zweite Wirkung.
