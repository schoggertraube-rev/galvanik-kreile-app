# KV-Preisfolge U-246/247

Server-Folgefix im bestehenden Quote-Modul. Keine neue Oberfläche, Tabelle, Migration oder Preisablage.

## Preisregel

Rüsten bleibt fest; Arbeitszeit und Material folgen der Menge. Textvorschlag und Warenleser verwenden dieselbe Rechenfunktion. Eine Position: KV 4 Stück, 4 Stunden × 10 EUR, Rüsten 12 EUR, Material 9 EUR = 61 EUR. Sowohl „3 statt 4“ als auch echte Annahme von drei Stück ergeben **48,75 EUR** (3 Stunden, Rüsten 12 EUR, Material 6,75 EUR).

Mehrpositionen: Der um 10:24 vorgeschlagene Verteilungsvertrag gilt nach BAUREGELN 3.1 seit 11:24 ohne PL-Gegenentscheid. Rüstanteile werden einmal nach ursprünglichen KV-Zeilensummen verteilt; der Centrest geht deterministisch an die größte Zeile. Nur der verbleibende variable Anteil folgt dem Mengenfaktor. Rüstanteile ausgelassener Nullpositionen bleiben am Auftrag, ohne künstliche Werkstattteile zu erzeugen. Bei gleichem Mengenfaktor kommt der Gesamtpreis aus der gemeinsamen Stunden-/Materialkalkulation; Rundungsreste bleiben centgenau zugeordnet.

Bei unterschiedlichen Faktoren bleiben Gesamtplanstunden null. Der Textvorschlag zeigt die richtigen Preise, verlangt aber weiterhin eine ausdrückliche Stunden-/Positionsbestätigung und kann ohne sie nichts schreiben. Keine erfundene Arbeitszeit und keine gelockerte Schreibvalidierung. Anwendung ausschließlich über bestehenden updateQuote-Writer.

## Gezielte Nachweise

| Prüfung | Ergebnis |
|---|---|
| Einzelposition: tatsächliche Waren-/Auftragsaktionen → DB/Event/Auftragskarte/Kopiervorbereitung/Retry, mit Rüsten/Material ungleich null | PASS |
| Einzelposition: echte Texterkennung/Vorschlag/Update → DB/Event/KV-Ansicht, Preisziel/Termin/Zusage/Fehlergrenzen | PASS |
| Mehrpositionen: echter Vor-Ort-Direktweg über vorhandene Writer → DB/Event/zwei echte Auftragspositionen/Auftragskarte/Retry und gleicher Textpreis | PASS, 10,21 s |
| Vergleich Mehrpositionen: ursprüngliche Zeilen 40/20 EUR, Rüsten 12 EUR; Mengenfaktoren 3/4 und 1 → 32/20 EUR = 52 EUR, Planstunden null | PASS |
| Gleicher Faktor 3/4 → 48 EUR; eine Nullposition → 36 EUR, Rüsten bleibt vollständig | gezielte Rechenfälle PASS |
| Anschlussregression Einzelposition Text/Ware und vorhandener Nullpositions-Direktweg | 3 echte Replay-Fälle PASS, 11,10 s |
| Bestehende plus neue Rechenfälle | 7 PASS |
| Typprüfung, gezieltes Lint, Produkt-Diff-Leerzeichenprüfung | PASS |

Tests: src/test/acceptance/kv_v04_server.integration.test.ts und src/modules/quotes/__tests__/quoteCalculation.test.ts. Keine Originalassertion abgeschwächt. Öffentlicher Modul-Port statt Tiefimport. Modul-Gate meldet ausschließlich bekannte fremde DESIGN_POINTER_PAGE_BINDING aus uncommitteter Planung; keine neue Produktverletzung.

Keine Dev-/Produktionsdatenänderung. Replay-Daten isoliert und synthetisch. Die neue Preisregel ist aus dem unveränderten KV plus tatsächlichem Warenbeleg abgeleitet, kein zweites gespeichertes Preisbild.

## Freigabestand

Früherer Kopf 4dee75b4 nach einmaligem Infrastruktur-Neustart vollständig grün (Storage-Upstream-502); dessen READY-Preview und Sichtlauf 0 Rot/21 bekannte Gelb sind historisch. Nach dem Mehrpositionsnachtrag müssen CI und READY exakt am neuen Kopf neu gebunden werden. Keine neue Oberfläche, kein erneuter Sichtlauf als Sicherheitswiederholung.

Unabhängige PL-Diffprüfung vor Merge-Bitte erforderlich. Kein Merge durch Codex.
`n## CI-Nachtrag A04`nSchema/Browserlauf scheiterte ausschließlich in A04 vor dem ersten Nachrichten-Knopf (5-s-Ankunftswarten). Isolierter Testadapter wartet nun auf das vorhandene aria-busy=false der echten Nachrichten-Abfrage und das echte Bedienelement; Produkt und Originalassertions unverändert. A04 einzeln gegen Replay-Browser/DB PASS (26,4 s), gezieltes ESLint/Diff PASS. Kein pauschaler CI-Neustart oder Produktumbau.
