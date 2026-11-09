# Eingang V04 E2 – Arbeitsstand, keine Abnahme

Ein Ergebnislayout im bestehenden IntakeSituation.tsx wird von Capture und den Köpfen von QuoteGoodsDialog, PackageOnsiteEditor und IncomingInvoiceDialog verwendet. Katalog und vorhandene Leser liefern Status, fehlende Angaben und Fakten; es wird kein Ergebnis gespeichert oder ein zweiter Schreibweg angelegt.

- Erstes gesichertes Original, tatsächlicher +n-Zähler, vorhandener OriginalDialog. Signierte Bild-/PDF-Vorschau über denselben Original-Leser; bei Lesefehler bleibt das Öffnen des Originals erreichbar.
- Fakten als dl, graue Bezeichnung/dunkler Wert, Preis/Betrag hervorgehoben. Fehlende Werte bleiben fehlend. Die bestehenden Formulare und Klickwege bleiben erhalten.
- Capture-Hauptaktion im gemeinsamen Fuß rechts; Kandidaten bleiben explizite Auswahl, keine automatische Zuordnung. Bestehende Editor-Füße verwenden weiterhin dieselben Callbacks und Kennungen.
- Erledigt nur aus tatsächlichem Leserzustand. Ein lediglich angelegter Kunden-/KV-Zwischenstand wird nicht als erledigter Auftrag ausgegeben.
- Rechnungsadapter ergänzt ausschließlich den bereits vorhandenen öffentlichen Original-Leser. Keine neue Tabelle, Migration, Schreibaktion oder Rechteableitung.

## Lokale Nachweise

22 Ergebnis-/Katalogfälle nach dem letzten Umbau grün, darin gesicherte erste Datei, tatsächlicher Seitenzähler, fehlende Fakten ohne Ersatzwerte, ausgeführter bestehender Klick und Erledigt nur bei übergebenem Zustand. Zuvor 23 bestehende KV-/Waren-/Katalogfälle grün; die durch den letzten Umbau unveränderten Editorfälle wurden nicht erneut gestartet. Typprüfung und gezieltes Lint grün. Scope und Whitespace vor Commit erneut geprüft.

## Noch offen

Dieser Zweig startet unabhängig von main. E1 (#206) muss vor der finalen Abnahme integriert werden; dessen Rückbau/Text/OCR-Regeln dürfen beim Zusammenführen nicht verloren gehen. Kein fertiger Sicht-PASS, kein unabhängiger PL-PASS und keine Merge-Bitte. Die Preview entsteht ausschließlich aus Git. Original-/Faktenabgleich 1220/768/390, vollständige genaue CI und bestehende Fehlerwege werden am endgültigen Kandidaten dokumentiert.

Keine neuen DB-Schreibwege; die vorhandenen Writer und Verträge bleiben unverändert. Die lokale Datenbankstörung wird nicht durch Wiederholungsschleifen umgangen. Kein Dev-Migrations-Gleichstand oder Provider-Erfolg behauptet.

## Lokale Verfeinerung vor finalem Kandidaten

Die drei Köpfe lesen weiterhin dieselben Daten: KV-Teile/Termin/Arbeitszeit aus dem vorhandenen KV-Leser; Rechnungsbetrag über den vorhandenen Cent-Vertrag formatiert. Keine geschätzten Preise oder Ersatzzahlen. Verwaiste alte Kopf-/Thumbnail-Stile und ein nicht konsumierter optionaler Link wurden aus dem ersetzten Ergebnisrenderer entfernt. Typprüfung und gezieltes Lint dieses Standes sind grün.

Noch ausdrücklich nicht fertig: Zusatzangaben als echte antippbare Chips vollständig durchbinden, abschließende Original-/Faktenansicht prüfen und nach E1-Merge dessen alte separate Capture-Ergebnisprojektion ohne Verlust der sieben Fehler-Auswege in die gemeinsame Ansicht integrieren. Deshalb bleibt dieser PR Entwurf, unabhängig von grünen Einzelchecks.
