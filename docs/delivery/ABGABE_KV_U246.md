# KV U-246 – Serverfolge, keine neue Oberfläche

Produkt-SHA: `991c86a1a01b3d2e9456c6b1cf9e14ea00745faa`. Exakter Abgabekopf, CI und Git-Preview werden im PR gebunden. Kein Merge durch Codex.

- Angenommene Menge steuert denselben createOrderIntake-Writer und denselben Warenbeleg; Preis aus unverändertem KV exakt anteilig, einmal je Zeile auf Cent gerundet.
- Nullposition erzeugt kein Auftragsteil. Sie bleibt im bestehenden KV-Warenbeleg gespeichert und im KV-Leseport als expectedPositions sichtbar; keine neue Datenwelt.
- Planstunden bei gleichem Mengenfaktor proportional; verschiedene Faktoren ohne Zeitaufteilung je Position ergeben ausdrücklich fehlt/null. Keine erfundene Ist-Zeit.
- Direktweg mit Bestands-/Neukunde verbindet ausschließlich bestehende Kunden-, KV-, Waren-, Zusage- und Auftragswriter. Vor-Ort-Zusage braucht den echten eigenen Warenbeleg; kein fingierter Versand.
- Eine bestätigte Anfrage erhält einen unveränderlichen Intent und feste Phasenschlüssel im vorhandenen Journal. Wiederholung liest den fertigen Beleg; andere Eingaben mit derselben Kennung ergeben Konflikt. Bei Teilausgang werden Phase sowie vorhandene Kunde-/KV-IDs zurückgegeben; Zwischenschritte werden nicht als vollständiger Auftrag ausgegeben.
- Die bestehende Kopiervorbereitung übernimmt tatsächliche Auftragsmengen und Preise statt alter KV-Mengen.

## Gezielt geprüft

Echte lokale Replay-Actions mit DB/Ereignissen/Ansicht: Mengen 3/4/5 statt KV4; Bestands-/Neukunden-Direktweg, letzterer mit zusätzlicher Nullposition; Vor-Ort-Zusage ohne Versand und falscher Warenbeleg gesperrt; Wiederholung und geänderter Intent. Keine Geschäfts-, Auth- oder DB-Mocks. Original-Fotos sind ausdrücklich isolierte synthetische DB-Vorbedingungen, kein externer Uploadclaim.

Typen, gezieltes Lint, sechs bestehende Quote-Command-Tests, H18 und No-Fake grün. Keine lokale Gesamtsuite. Modulprüfung hat nur die unveränderte fremde DESIGN_POINTER_PAGE_BINDING-Abweichung im Planungs-Arbeitsbaum; CI prüft gebundene Quellen.

## Geänderte Assertions

- Bisheriger Fehlerfall Menge3 statt4 → nun positiver U246-Fall; ungültige Null-Gesamtlieferung bleibt verweigert. Nichtanlage-/Receipt-/Versionsassertionen bleiben.
- Bestehender Viererfall bleibt erhalten; Dreier-/Fünferfälle zusätzlich. Erwartete Auftrags-, Kopier- und Preismengen folgen dem tatsächlich gebuchten Wert.
- Quote-Command-Unit-Fixture um die echte kanonische Mengenabfrage ergänzt; Hash-/Versions-/Rechteassertionen unverändert.

Keine neue Migration, keine Dev-Echtdatenmutation. Noch keine Freigabe der V04-Oberfläche und kein behaupteter vollständiger Go-live. Planungs-Diffreview und CI am Abgabekopf erforderlich. U247 Termin-/Texteingabe folgt getrennt.
