# Review Q06 · KV → Auftrag

Prüfung: 27.10.2026 12:28 Berlin (11:28 UTC) · Branch kreile/s1-p2-eingang · SHA c0692892 · Abgabe-Status „Prüfung auf Preview läuft“

## Urteil: keine Blocker, noch kein PASS (Preview-Klicktest + SQL-Zeile fehlen)

Geprüft:
- quoteCommands.ts normalizeConvert: handoverMode/paymentMode Pflicht, exactKeys erweitert, `abholung` nur mit `pickup` serverseitig erzwungen. OK.
- hashOrderIntent enthält Übergabe + Zahlungsart → abweichende Wiederholung nicht still gleich. OK.
- Konvertierung nutzt weiter `customer: EXISTING` über den bestehenden Auftragseingang → Pflichtdaten-Prüfung des Eingangs greift (kein zweiter Neukunden-Schreibweg). OK.
- GlobalCreateFlow: Zuschlagsblock mit Übergabe/Zahlungsart, Vorbelegung aus Kunden-Zahlungsbedingung, Versand sperrt „Bar/Karte bei Abholung“. OK.
- Keine Migration, keine Hex-Farben, kein verbotener Pfad.

Für PASS nachreichen: ein TEST-KV auf Preview bezuschlagt, Auftragszeile mit payment_mode/handover_mode, Owner-Abnahme (5 Minuten).

Hinweis (nicht Blocker, Arbeitsbaum lokal): uncommittete Änderungen an GlobalCreateAppAdapter/GlobalCreateFlow/realRender-Test – erst nach Commit prüfbar.


## Nachtrag 27.10. 12:32 UTC – Amend 411481ec (Abgabe-Produkt-SHA 7a603655)

Urteil: **PASS**

- Preview-Klicktest (Rolf, KV-2026-0002 → A-2026-0006, Versand/Vorkasse/22.12.2026), PDF HTTP 200 und SQL-Readback in ABGABE_Q06 belegt, Screenshot Q06_KV_ZU_AUFTRAG.png vorhanden.
- 3 neue Migrationen (q6_quote_conversion_retry, _event_contract, _readback_contract): nur private Funktionen/View, SECURITY DEFINER mit search_path = '', View nur service_role; kein drop/delete/truncate. Remote 45 = origin 45 SQL, synchron.
- Pflichtdaten: KV-Weg nutzt bestehenden vollständigen Kunden, Termin/Übergabe/Zahlungsart werden in den einen Auftragseingang durchgereicht – kein zweiter Schreibweg.
- Keine Hex-Farben in neuen src-Zeilen, kein verbotener Pfad.
- Rest (offener TEST-KV-2026-0001 bleibt stehen) kein Blocker.
