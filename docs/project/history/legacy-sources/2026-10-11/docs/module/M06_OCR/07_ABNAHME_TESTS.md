<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Abnahme und Tests M06

## Status

Dies ist die verbindliche Testspezifikation für den späteren Bau. **Keiner dieser Modultests wurde in diesem Dossierauftrag ausgeführt**, weil M06 noch nicht gebaut ist und Provider-/Repo-Aktionen ausdrücklich ausgeschlossen sind. Die isolierten Azure-Tests vom 2026-09-14 sind Evidenz für Fähigkeiten und Risiken, kein Modulpass.

## Passregel

Ein M06-Modulpass erfordert:

- alle MUSS-Tests `PASS`,
- keine Quarantäneabhängigkeit oder erreichbare Demoaktion,
- nachvollziehbare Testbelege mit Commit, Manifest-SHA, Testdatenklassifizierung und Reviewer,
- unabhängigen read-only Review,
- für Provideraktivierung zusätzlich G-M06-003/005.

Synthetische Testdaten sind nur isoliert erlaubt und klar als synthetisch zu kennzeichnen. Die fachliche Evaluation braucht außerdem freigegebene, minimierte Kreile-Testdokumente.

## Funktionale Abnahmetests

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| T-M06-001 | A-M06-002 | Given: passender M06-Testkontext. When: Gültige Datei wählen, Upload finalisieren. Then: Originalreferenz, serverseitiger Hash, Größe, MIME, Tenant, Actor und Sicherungszeit vorhanden; Analyse erst danach freischaltbar. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-002 | A-M06-002 | Given: passender M06-Testkontext. When: Analyse vor Finalisierung direkt am Server anfordern. Then: Fail closed; keine Provideranfrage; verständlicher Fehler/Korrelation. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-003 | A-M06-003 | Given: passender M06-Testkontext. When: Original im Viewer drehen/zuschneiden. Then: Nur Ansicht/Arbeitskopie ändert sich; Originalhash und -datei bleiben identisch. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-004 | A-M06-004 | Given: passender M06-Testkontext. When: Strukturierte Datei mit zulässigem Parserweg erfassen. Then: Strukturierter Weg wird vor OCR gewählt und im Laufbeleg ausgewiesen. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-005 | A-M06-023/A-M06-029 | Given: passender M06-Testkontext. When: Providergate `In Klärung`; Analyse anklicken/Servercall versuchen. Then: Keine externe Anfrage; Text `Dokumentendienst in Klärung`; manueller Pfad funktioniert. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-006 | A-M06-005/A-M06-007 | Given: passender M06-Testkontext. When: Unterstütztes Format über freigegebenen Fake-Contract-Adapter im isolierten Test analysieren. Then: Adapter erhält nur tenantgebundene SourceReference und Minimalparameter; Rohresultat wird versioniert. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-007 | A-M06-001 | Given: passender M06-Testkontext. When: Nicht unterstütztes Format, übergroße Datei und zu viele Seiten je separat. Then: Vor Provideraufruf gestoppt; aktives Limit sichtbar; anderes Format/manuell angeboten. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-008 | A-M06-006/A-M06-024 | Given: passender M06-Testkontext. When: Provider liefert Timeout/429/500/ungültiges JSON. Then: Kein stiller Provider-/Modellwechsel, kein Erfolg, Original bleibt, Resume/manuell möglich. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-009 | A-M06-008 | Given: passender M06-Testkontext. When: Resultat enthält Fakt ohne `factId`, Quelle oder Disposition. Then: Gesamte Analyseversion verworfen; keine Teilfakten als Wahrheit. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-010 | A-M06-008 | Given: passender M06-Testkontext. When: Ein Fakt besitzt zwei Dispositionen. Then: Gesamte Analyseversion verworfen; Fehlerursache auditierbar. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-011 | A-M06-015 | Given: passender M06-Testkontext. When: Leeres/unklares Dokument analysieren. Then: `Keine verwertbaren Fakten erkannt`; kein erfundener Inhalt; manuelle Erfassung. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-012 | A-M06-011/A-M06-016 | Given: passender M06-Testkontext. When: Fakt mit 0,98 Konfidenz für Absender/Empfänger. Then: Trotzdem `Kritisch` und einzeln bestätigungspflichtig. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-013 | A-M06-010 | Given: passender M06-Testkontext. When: Normales Feld einmal 0,85, einmal 0,8499. Then: 0,85 `Vorausgewählt`, 0,8499 `Prüfen`; beide nicht automatisch gespeichert/zugeordnet. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-014 | A-M06-013 | Given: passender M06-Testkontext. When: Nutzer korrigiert Wert. Then: Rohwert/Quelle bleiben sichtbar; Endwert, Actor, Zeit und Ledgerversion ändern sich nachvollziehbar. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-015 | A-M06-008/A-M06-011 | Given: passender M06-Testkontext. When: Offener kritischer Konflikt, dann `Fakten geprüft`. Then: Bestätigung abgelehnt; Fokus/Fehler springt zum Konflikt. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-016 | A-M06-008 | Given: passender M06-Testkontext. When: Dokument mit 24 Fakten, alle vier Dispositionsarten. Then: Coverage reproduzierbar 24/24; keine verlorenen/doppelt gezählten Fakten. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-017 | A-M06-017 | Given: passender M06-Testkontext. When: Kandidatenport liefert drei echte Treffer. Then: Maximal drei Karten mit Treffergrund plus `Nicht zuordnen`; keine automatische Auswahl. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-018 | A-M06-018/A-M06-019 | Given: passender M06-Testkontext. When: Kandidatenport liefert leer/Fehler. Then: `NO_VERIFIED_DB_MATCH`/Fehler; keine erfundene ID; ungeklärter Eingang bleibt möglich. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-019 | A-M06-017 | Given: passender M06-Testkontext. When: Gewähltes Ziel wird vor Bestätigung gelöscht oder gesperrt. Then: erneute Serverprüfung blockiert; keine Zuordnung/Aktion. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-020 | A-M06-020 | Given: passender M06-Testkontext. When: Modellresultat enthält unbekannten `actionKey`. Then: Kein ausführbarer Button; Vorschlag verworfen; Abschluss ohne Aktion möglich. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-021 | A-M06-020 | Given: passender M06-Testkontext. When: Bekannter `actionKey`, aber fehlendes Recht/Vorbedingung. Then: Serverkatalog markiert gesperrt; kein Kommando. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-022 | A-M06-021/A-M06-022 | Given: passender M06-Testkontext. When: Gültige Aktion bestätigen und Doppelklick/Refresh auslösen. Then: Genau ein Fachkommando; identisches Receipt/Idempotenzresultat. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-023 | A-M06-022 | Given: passender M06-Testkontext. When: Kommando antwortet, Readback fehlt oder widerspricht. Then: Kein grüner Erfolg; `Aktion nicht bestätigt`; `Status prüfen`. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-024 | A-M06-024 | Given: passender M06-Testkontext. When: Browser nach Original, Analyse, Review und Kommando jeweils schließen/neu öffnen. Then: letzter sichere Checkpoint; keine verlorenen bestätigten Daten; kein Doppelkommando. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-025 | A-M06-023 | Given: passender M06-Testkontext. When: Manueller Pfad ohne Provider. Then: Original, Faktenprüfung, Zuordnung, Command/Receipt/Readback besitzen dieselben Schutzregeln. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |

## Tenant-, Sicherheits- und Datenschutztests

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| T-M06-026 | A-M06-027 | Given: passender M06-Testkontext. When: IDs/URLs zwischen zwei Tenants austauschen. Then: 404/403 nach Projektkonvention; keine Metadaten, Vorschau, Kandidaten oder Timingauskunft über Fremddaten. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-027 | A-M06-027 | Given: passender M06-Testkontext. When: Session/Tenant während geöffnetem Lauf wechseln. Then: UI-Cache/Vorschau geleert, Servercall gesperrt, keine Wiederverwendung der alten SourceReference. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-028 | A-M06-002/A-M06-027 | Given: passender M06-Testkontext. When: Signierte Original-URL ablaufen/weitergeben. Then: kurzlebig und zweckgebunden; nach Ablauf unbrauchbar; nicht in Logs. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-029 | A-M06-028/A-M06-036 | Given: passender M06-Testkontext. When: Audit/Telemetrie nach realistischem Dokumentlauf prüfen. Then: Korrelation, Status, Dauer, Zähler vorhanden; kein Name, Dokumenttext, Adresse, E-Mail, Telefon, Betrag, URL oder Secret. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-030 | A-M06-027 | Given: passender M06-Testkontext. When: Client sendet fremden Tenant/Actor/Rolle/`confirmed=true`. Then: Server ignoriert/validiert; keine Rechte- oder Bestätigungseskalation. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-031 | A-M06-030 | Given: passender M06-Testkontext. When: Quarantäne-Importscan und Laufzeittest. Then: Keine erreichbare Abhängigkeit zu Gemini, Klippa, ManualProvider, MockOcrProvider, `simulateScan` oder Demo-Beleg. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-032 | A-M06-037 | Given: passender M06-Testkontext. When: Provideradapter versucht lokalen Key-/Secretwert an Client/Log zu geben. Then: Build/Test scheitert; ausschließlich Serverauth, Secretredaktion. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-033 | A-M06-028/A-M06-029/A-M06-043 | Given: passender M06-Testkontext. When: Ergebnislöschung nach Analyse über freigegebenen Provideradapter testen. Then: Delete-Receipt oder expliziter Fehler auditierbar; kein falscher Löschstatus; Produktoriginal bleibt gemäß dokumentartbezogener Hostfrist erhalten. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-034 | A-M06-029 | Given: passender M06-Testkontext. When: Providerregion/-modell/-API-Version weicht von freigegebener Konfiguration ab. Then: Fail closed vor Dokumenttransfer; Konfigurationsabweichung sichtbar. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |

## Fachliche Evaluation mit repräsentativen Dokumenten

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| T-M06-035 | A-M06-007/A-M06-011 | Given: passender M06-Testkontext. When: UPS-/Logistikdokument mit Tabellen, Referenzen und Barcode Then: Bestehend: Layout Ø 0,9877, aber fachliche Rollen separat prüfen. Ziel: alle relevanten Fakten disponiert, keine Rollenvertauschung ohne sichtbaren Konflikt. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-036 | A-M06-007/A-M06-040 | Given: passender M06-Testkontext. When: gedrehter handschriftlicher Umschlag Then: Bestehend: Layout Ø 0,9627. Ziel: Qualitätswarnung, Quelle sichtbar, unklare Handschrift nicht erfunden. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-037 | A-M06-011/A-M06-016 | Given: passender M06-Testkontext. When: atypische UPS-Rechnung Then: Bestehend: Prebuilt Invoice vertauschte Absender/Empfänger. Ziel: deterministische Rollenregel/Review fängt Fehler zuverlässig ab. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-038 | A-M06-008/A-M06-039 | Given: passender M06-Testkontext. When: Mehrseiten-PDF mit relevanten und irrelevanten Seiten Then: alle Seiten/Fakten erfasst oder explizit `REFERENCE_ONLY`; keine F0-Zwei-Seiten-Annahme in Produktlogik. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-039 | A-M06-011/A-M06-016 | Given: passender M06-Testkontext. When: deutsche Rechnung mit Netto/Steuer/Brutto/Währung/Zahlungsziel Then: Beträge getrennt, rechnerisch plausibilisiert, kritisch bestätigt; keine automatische Buchung. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-040 | A-M06-007/A-M06-015 | Given: passender M06-Testkontext. When: Lieferschein/Auftragsnotiz mit Kunde, Teil, Menge, Oberfläche, Wunschdatum Then: Quellenanker und vollständige Disposition; echte Kandidaten; unklare Datumsbedeutung bleibt Konflikt. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-041 | A-M06-040 | Given: passender M06-Testkontext. When: schlechter Scan: Beschnitt, Schatten, geringe Auflösung Then: Qualitätswarnung; kein stiller Hochkonfidenz-Erfolg; neues Foto/manuell möglich. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-042 | A-M06-001 | Given: passender M06-Testkontext. When: Office-Datei je freigegebenem Read/Layout-Format Then: nur vom konkreten Modell unterstützte Formate; kein Versand an unpassendes Prebuilt-Modell. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |

Eine numerische Extraktionsquote allein genügt nicht. Pass verlangt 100 % Faktendisposition, 0 erfundene Fach-IDs, 0 unbestätigte Mutationen, 0 Rollen-/Betragsfehler ohne sichtbare Sperre und nachvollziehbare Quellen für jeden übernommenen Wert.

## Zustands-, UI- und Barrierefreiheitstests

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| T-M06-043 | A-M06-026 | Given: passender M06-Testkontext. When: Alle F-M06-001…008 in Daten/lädt/leer/Fehler/gesperrt/In Klärung/In Aufbau rendern. Then: Wortlaut aus Datei 02, passende Primäraktion, kein leerer/generischer Zustand. | Owner-UX | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-044 | A-M06-034 | Given: passender M06-Testkontext. When: Tastaturtest aller Ansichten/Dialoge. Then: logische Reihenfolge, Fokus sichtbar/gefangen/rückkehrend, keine Mauspflicht. | Owner-UX | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-045 | A-M06-034 | Given: passender M06-Testkontext. When: Screenreader/Status ohne Farbe. Then: Name, Rolle, Status, Konfidenztext und Fehlerbezug verständlich. | Owner-UX | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-046 | A-M06-035 | Given: passender M06-Testkontext. When: 320–1440 px und Werkstatt-Tablet. Then: keine verdeckten Primäraktionen; Original/Felder umschaltbar; Entwurf bleibt. | Owner-UX | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-047 | A-M06-026 | Given: passender M06-Testkontext. When: Cockpit vor Adoption. Then: Titel `Dokument / Info erfassen`, Chip `In Klärung`, grau, nicht klickbar, keine Route. | Owner-UX | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-048 | A-M06-030 | Given: passender M06-Testkontext. When: UI auf Fake-/Demo-/Mock-Strings und zufällige Daten prüfen. Then: keine erreichbare Produktfunktion; Testfixtures bleiben isoliert und gekennzeichnet. | Owner-UX | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |

## Integrations- und Strukturtests

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| T-M06-049 | A-M06-031/A-M06-036 | Given: passender M06-Testkontext. When: Manifest-/Handshake-Schema und SHA gegen Commit. Then: exakt, reproduzierbar, Ports/Tabellen/Routen stimmen. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-050 | A-M06-005/A-M06-031 | Given: passender M06-Testkontext. When: Importgrenzen. Then: Client importiert kein Servermodul/Provider-SDK; M06 importiert keine fremden Interna. | Smoke | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-051 | A-M06-032 | Given: passender M06-Testkontext. When: Schemaabgleich Baseline vs. Drizzle vs. Persistenzadapter. Then: dokumentierte Feldabbildung oder genehmigtes Gate; keine zweite Tabelle/Blindmigration. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-052 | A-M06-033 | Given: passender M06-Testkontext. When: Consumer-Test Suche/KI-Chat. Then: nur bestätigte, berechtigte Projektionen; Rohoutput/Konflikte ausgeschlossen; kein Schreibweg am Command-Vertrag vorbei. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-053 | A-M06-024 | Given: passender M06-Testkontext. When: Modul deaktivieren/rollbacken. Then: Cockpit wieder grau/geschlossen; Originale/Auditbelege bleiben; keine destruktive Löschung. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-054 | A-M06-024/A-M06-029 | Given: passender M06-Testkontext. When: Kosten-/Failure-Injection mit Rate Limit, Timeout, Jobverlust. Then: begrenzte Retries, keine Doppelanalyse/-aktion, messbare Kosten, manueller Pfad. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-055 | A-M06-043 | Given: abgelaufene, je Dokumentart konfigurierte Frist. When: Aufbewahrungslauf bewertet Original, Arbeitskopie, bestätigte Fakten und Auditbelege. Then: nur Lösch-/Anonymisierungsvorschlag; keine stille Änderung; Adminfreigabe und Receipt erforderlich; gesetzlich/fachlich weiter benötigte Belege bleiben gesperrt. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |
| T-M06-056 | A-M06-044 | Given: Providerkonfiguration für Dev und Produktion. When: Umgebungs- und E2E-Gate geprüft werden. Then: F0-Dev akzeptiert ausschließlich gekennzeichnete synthetische Daten; Produktion verweist auf das Kreile-eigene Azure-Abo im freigegebenen S0-Zuschnitt; vor Livegang ist der E2E-Nachweis im Kreile-Tenant vorhanden. | E2E | Test/Commit/Hash nach Bau: FEHLT; Spezifikation 2026-09-26 |

## Nicht ausreichende Nachweise

- Provider-HTTP 200 oder hohe Durchschnittskonfidenz.
- Screenshot aus Azure-Portal.
- Bestehender V5-Prototyp mit synthetischen Daten.
- Unit-Test nur gegen Mock ohne Contract-/Failure-Test.
- „Keine Fehler gesehen“ ohne Tenant-, Idempotenz-, Receipt- und Readback-Nachweis.
- Ein bestandener Happy Path ohne die sieben UI-Zustände.
