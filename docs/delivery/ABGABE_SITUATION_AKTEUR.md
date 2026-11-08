# AP-SITUATION-AKTEUR — laufender Bau, keine Merge-Abgabe

Frischer Branch von main ba6e0d94. Die Korrektursammlung wurde zum Paketstart gelesen. Eingang-Oberfläche bleibt wegen SEITENHOHEIT gesperrt; die dazu und zu fremden Personenstatistiken gebündelten PL-Fragen stehen im BAULOG. Kein stilles Bauen gegen die Vorschau.

## Erster fertiger Schritt: Auftragsakteure

Ein reiner öffentlicher Auftrags-Leseport projiziert Anlage und letzte Handlung aus vorhandenen Ereignissen mit tatsächlichem Login, Person und Zeit. Mail-Akteur bleibt als Original-Absender unterscheidbar. Keine neue Tabelle, kein Schattenmodell, kein erfundener Systemnutzer. Unvollständige Altbelege werden ausdrücklich als solche angezeigt. Finanzbeträge und freie Ereignistexte verlassen diesen Port nicht.

Zuständigkeit kommt zunächst vom ersten Ereignis. Bestehende aktive Auftragszuweisungen überschreiben das über ihren bisherigen geprüften Leseport. „Übernehmen“ nutzt ausschließlich den vorhandenen assignOrderTaskAction und dessen Writer, Ereignis und Zustand. Fehler/Speicherbestätigung stehen am Knopf, Retry-Kennung bleibt erhalten, Doppelklick wird abgefangen; nach Erfolg wird dieselbe Karte neu gelesen. Keine zweite Zuständigkeitsablage.

Reine Statistikgrundlage vorerst nur für den eigenen aktuellen Login, je Zeitraum und Handlung aus echten Ereignissen; keine Statistikoberfläche und keine fremde Leistungsdatenfreigabe. Auftragskarte bleibt bei einem separaten Akteur-Lesefehler erreichbar und zeigt die konkrete Fehlermeldung.

Gezielter echter Replayfall: A legt über createOrderIntake an; B übernimmt über den bestehenden Zuweisungswriter; DB-Zeile und Ereignis mit B geprüft, Retry ohne Doppelereignis, A liest Anlage durch A/letzte Handlung und Zuständigkeit B; eigene Statistik wird vom echten Leseport gelesen. PASS4.83s. Ein gezielter Renderfall belegt beide Personen und Fehler direkt am Knopf, keine doppelte Meldung; PASS6.19s. Typen, Lint, Scope und Diff geprüft. Keine lokale Gesamtsuite.

## Noch offen

KV, Reklamation, Eingang und Beleg: Akteur-/Zuständigkeitsanschlüsse, Deins-zuerst, Ereigniswächter. SAA-Situationswege nur soweit die Seitenhoheit wirklich freigegeben ist; Belegautomatik bleibt eigenes Paket. Vollständige Paketabnahme, exakter Preview-/CI-Nachweis und Owner-Merge-Bitte stehen aus. Kein Gesamtfertig- oder Livefähigkeitsclaim.
