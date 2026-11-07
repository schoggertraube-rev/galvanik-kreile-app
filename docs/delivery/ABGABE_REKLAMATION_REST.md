# Abgabe Reklamation 4c – begrenzte Restkorrektur

Produkt-SHA: `10ef654a5410ca79007dc2bbff237ca865a1c6b1`. PR-Kopf, CI und READY-Preview werden im PR am exakten Kopf nachgeführt; bis dahin keine Merge-Reife.

## Sichtbares Ergebnis

- Betroffene Teile werden über ihre sichtbare Checkbox-Beschriftung gewählt; Doppel-Klick bleibt genau eine Aufnahme.
- Begründung, Notiz und betroffene Menge zeigen den Fehler am Feld. Keine falsche Zwischenansicht für einen einzelnen Feldfehler.
- „Nacharbeit braucht die Teile“ steht direkt bei der gesperrten Maßnahme.
- Verwerfen schließt die Rückfrage; die nächste Aufnahme ist leer. Ein verspätetes Schließen der alten Ebene kann einen neu geöffneten Vorgang nicht mehr schließen.
- Ein fehlender gespeicherter Bearbeitungsstand wird vor dem Senden benannt; keine erfundene Versionsnummer.

Bestehende Actions, Tabellen und Schreibwege bleiben bestehen. Keine neue Migration.

## Nachweise

- 12 gezielte Komponentenfälle bestanden, einschließlich echter Dialogebenen, laufender Schließanimation, Feldfokus, Gutschrift-Erfolg und Doppel-Klick. Ein fehlender Testimport wurde mechanisch korrigiert.
- Echte Replay-Action → Datenbankzeile/Event → Dialog- und Auftragsansicht: Aufnahme, identischer Retry, Entscheidung, Gutschrift, identischer Retry bestanden. Nur Konfiguration/Tenant ist im isolierten TEST angepasst; kein Geschäfts- oder Datenbank-Mock.
- Replay-Beleg vom 07.11.2026: `450a3df6-a867-411a-b47e-0bedc8dbdf02`, Nummer `RK-2026-0001`, Auftrag `18a16928-a3ea-40e3-ab10-6504af69a162`, Stand `kunde_informieren`, Version 3, Betrag `50.00`, Gutschrift `GS-TEST-REST`, 3 echte Änderungsereignisse. Tenant `test-4c-rest-3b478e11-b782-4328-a8f2-9b272e3ae339` ist ausschließlich TEST.
- Typprüfung, gezielter Lint und Leerzeichenprüfung bestanden.
- Ein vollständiger gezielter Browserlauf der acht Restfälle: L05 bestanden; sieben bekannte Abweichungen ehrlich protokolliert. Das Ergebnis „8 passed“ enthält erwartete rote Fälle und ist ausdrücklich kein vollständiger fachlicher PASS. Anschließend ausschließlich sichtbaren Marker mechanisch korrigiert und die konkret nachgewiesene Schließ-Race behoben; deren Komponentenfall besteht. Kein zweiter kompletter Browserlauf.

## Verbleibende Abweichungen

| Fälle | Konkrete Ursache / Einordnung |
| --- | --- |
| L03 | Owner/PL verlangt einen neuen Vorgang am Nacharbeitsauftrag; alter generierter Fall zählt weiterhin nur einen. |
| L04, L08 | Synthetische neue Fixture erhält jetzt ausdrücklich Version 1 im Testadapter; beide gezielten Original-Browserfälle PASS, von Rot-Liste entfernt. Produkt hat keinen Legacy-Fallback. |
| L06 | Gleiche Fixture-Version repariert; verbleibender Browserbefund ist die fehlende Kennung `reklamation.zurueckgezogen`. Auf Rot-Liste mit neuer konkreter Ursache, keine zweite Produktkorrekturrunde. |
| L09 | Verspäteter Schließ-Callback korrigiert und gezielt getestet; vollständige Browserbestätigung folgt aus CI. |
| L10, L11, L13 | Generierter `auftrag_quelle` hat Station `abgeschlossen` und Ware `da`, keinen belegten Warenausgang. Der Server verlangt einen gelieferten Auftrag. Zusätzlich erwartet der Test `blasen`, der vorhandene Auswahl-/Befehlsvertrag speichert `Blasen`. Guards und Assertions wurden nicht gelockert. |
| L12 | Unbekannter Serverausgang bleibt ungeklärt mit identischer Kennung; keine falsche Zusage „nicht gespeichert“. |

Diese Fälle stehen mit genauem Grund auf der Rot-Liste. Planung prüft die Fixture-/Vertragsabweichungen; keine pauschale Fehlerfreiheit behauptet.

## Owner-Klickweg

Gelieferter Auftrag → Mehr → Reklamation: Teil wählen, Menge zu groß → Fehler am Feld, korrigieren → aufnehmen. Beim gespeicherten Vorgang Ablehnung ohne Begründung prüfen; Gutschrift mit Betrag/Nummer vermerken. Geänderte Beschreibung → Esc → Verwerfen; danach neu öffnen: leer. Schnell schließen und neu öffnen: neue Ebene bleibt offen.

Sichtlauf/CI/Preview werden nach dem Git-Push genau am PR-Kopf ergänzt. Kein Merge durch Codex.

Mechanischer Fixture-Nachtrag nach Ablauf der 60-Minuten-Frist aus BAUREGELN 3.1 (PL-Frage 22:33): ausschließlich `_harness.ts` setzt für neue synthetische Reklamationen ausdrücklich den Sperrzähler und bildet den bestehenden Anzeigenamen Blasen auf den unveränderten Modellcode blasen ab. `_model.ts` und `reklamation.flow.spec.ts` bytegleich unverändert. Drei gezielte Fälle einmal: L04/L08 PASS, L06 bleibt aus oben genanntem Grund rot. Keine neue lokale Gesamtrunde; echter gelieferter Quellauftrag für L10/11/13 weiter offen, kein Produktguard gelockert.
