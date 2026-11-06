# AP-ABS – Absprachen und Eigenheiten

Stand 06.11.2026: **Prüfung noch nicht abgeschlossen; nicht als merge-reif melden.**

- Geprüfter Produktstand: `0111464516fbbe8e00685c21f299abb686aa74c7`.
- READY-Preview dieses Produktstands: https://galvanik-kreile-werkstatt-ccsve4ohs.vercel.app
- Die Preview zeigt den genannten Produktstand; der später veröffentlichte PR-Kopf und seine Prüfungen sind gesondert gegen dessen SHA nachzuweisen.
- Zuletzt veröffentlichter Prüfkopf vor diesem Nachtrag: `de717840b0a6592fb418b8bcd7f1919ef8d0ef5a`, READY-Preview https://galvanik-kreile-werkstatt-i4xsnxhlj.vercel.app. Der Produktcode ist gegenüber `01114645` unverändert; seitdem wurden Nachweise ergänzt.
- Die AP-ABS-Migration wurde nach Owner-Freigabe und erfolgreicher Abbruchprobe auf Dev angewendet. Der Versionsabgleich ist vollständig; der fachliche Sichtlauf steht noch aus.

## Änderung

Die Kundenkarte bietet Absprachen und Eigenheiten. Typisierte Absprachen für Zahlung und Übergabe werden über die bestehenden Kunden-, Auftrags- und Warenausgangswege gespeichert und gelesen. Der vollständige Rechnungsentwurf für Sammelrechnungen ist dem Folgepaket AP-ABS-b zugeordnet; bis dahin zeigt Der Tag den Anschluss als nicht ausführbar.

## Daten und Nachweise

- `supabase/migrations/20261106013106_abs_absprachen.sql`, SHA-256 `76C0614464F36A12A3E1015ED82619DB89A4BB1571EB65A08D569B3BE72EC193`: additive AP-ABS-Tabellen, Ereignisse und bestehender Kundenschreibweg. Nach bestandener Abbruchprobe einzeln auf Dev angewendet; die im Ledger hinterlegte SQL stimmt mit der Datei überein (MD5 `a5ae9128d077ccb3b2deb6d811514521`). Die neuen Tabellen sind leer; vorhandene Kunden, Aufträge und Ereignisse blieben beim Vergleich unverändert. RLS ist für Kundenabsprachen aktiv, `authenticated` hat kein DELETE-Recht.
- Migrationsabgleich zum Produktstand: **80 von 80** Versionen auf Dev. Die zuvor fehlenden Main-Migrationen `20261105224000` und `20261106024500` wurden nach P96 einzeln mit Abbruchprobe angewendet; ihre Ledger-SHA-256 stimmen mit den Dateien überein. Die zweite Migration berechnete die Ausgabefreigabe fertiger Aufträge neu; die Zahl freigegebener Aufträge stieg von 0 auf 1.
- Der bestehende Lieferanten-Schreibweg mit ausschließlich Geld-Recht wurde in der noch nicht auf Dev angewendeten Migration erhalten. Der unveränderte H18-Fall „3.8 Geld alone“ bestand lokal gegen Replay-DB inklusive Rücklesen.
- CI am Produktstand: Quality, agentur-gate, Fresh Supabase replay, Ratchet und Vercel bestanden. H16: 79/79 H18-Tests und 26/26 Akzeptanztests bestanden; im generierten Gesamtlauf 333/334, G04 hatte einen Locator-Timeout. Ein einmaliger H16-Neustart desselben SHA läuft. Lokal bestand G04 im gezielten Nachlauf; ein Eintrag als erwarteter Fehler wurde deshalb nicht übernommen.
- ABS-01–20 wurden lokal auf einem früheren Kandidaten mit frischem Build geprüft; die endgültige Einordnung und der Sichtnachweis am PR-Kopf stehen noch aus. ABS-13/14 sind gemäß P79 dem Folgepaket AP-ABS-b zugeordnet.
- Der lokale Sichtlauf nutzt einen frischen App-Build, eine isolierte Replay-Datenbank und synthetische Nutzer. Die temporären Aufrufrouten öffnen die vorhandenen Kunden-, Auftrags- und Warenausgangsansichten; es wurden keine Dev-Daten verwendet.
- Kundenbearbeitung: In beiden geprüften Zuständen und allen drei Größen wurden 15 von 15 Elementen gefunden, jeweils ohne roten Befund; die gelben Befunde betreffen Auswahlfarben und Fokusreihenfolge.
- Absprache: Für den Leerzustand und für bestehende Absprachen wurden getrennte synthetische Kunden verwendet. Der Prüfer sucht beim Knopf `ganzer-kunde-kunde-west` den festen Beispielnamen aus dem Sichtvertrag; die App zeigt stattdessen den tatsächlichen Kundennamen. Die Abweichung der Hauptaktion in Leer- und Widerrufszustand ist gemäß P80 als `Endversion-Angleich absprache Hauptaktion` einzuordnen.
- Kundenkarte, Auftragskarte und Warenausgang wurden ebenfalls geöffnet; der vollständige Sichtvertrag meldet dort weitere rote Kennungen. Ihre Zuordnung zum geänderten Paketumfang beziehungsweise zum späteren R53-Angleich ist noch offen. Diese Ansichten gelten damit noch nicht als abgenommen.

## Owner-Klickweg nach Abschluss der Prüfungen

1. Preview öffnen, als Person mit Kunden- und Geld-Recht anmelden und **Kunden & Kontakt** wählen.
2. Einen vorhandenen Kunden öffnen, **Absprachen & Eigenheiten** aufrufen und eine Absprache erfassen. Nach Speichern die Kundenkarte erneut öffnen und denselben Eintrag kontrollieren.
3. Für einen geeigneten Auftrag den Warenausgang öffnen und kontrollieren, dass eine passende gültige Absprache angezeigt wird. Widerruf und erneutes Öffnen der Kundenkarte anschließend prüfen.
4. Sammelrechnung: Den ausgewiesenen Anschluss unter **Der Tag** prüfen; die Rechnungserstellung selbst gehört zu AP-ABS-b.

## Noch offen

- Abschließender H16- und CI-Status am veröffentlichten Kopf; exakte READY-Preview dieses Kopfs.
- Sichtprüfung der betroffenen Ansichten und zugelassene Gelb-Befunde.
- Sichtprüfung und abschließender CI-Status am veröffentlichten Kopf; keine Aussage über Produktionsbereitschaft.
