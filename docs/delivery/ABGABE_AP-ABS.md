# AP-ABS – Absprachen und Eigenheiten

Stand 06.11.2026: **Prüfung noch nicht abgeschlossen; nicht als merge-reif melden.**

- Geprüfter Produktstand: `0111464516fbbe8e00685c21f299abb686aa74c7`.
- READY-Preview dieses Produktstands: https://galvanik-kreile-werkstatt-ccsve4ohs.vercel.app
- Die Preview zeigt den genannten Produktstand; der später veröffentlichte PR-Kopf und seine Prüfungen sind gesondert gegen dessen SHA nachzuweisen.
- Die AP-ABS-Migration wurde nach Owner-Freigabe und erfolgreicher Abbruchprobe auf Dev angewendet. Der vollständige Migrationsgleichstand und der fachliche Sichtlauf stehen noch aus.

## Änderung

Die Kundenkarte bietet Absprachen und Eigenheiten. Typisierte Absprachen für Zahlung und Übergabe werden über die bestehenden Kunden-, Auftrags- und Warenausgangswege gespeichert und gelesen. Der vollständige Rechnungsentwurf für Sammelrechnungen ist dem Folgepaket AP-ABS-b zugeordnet; bis dahin zeigt Der Tag den Anschluss als nicht ausführbar.

## Daten und Nachweise

- `supabase/migrations/20261106013106_abs_absprachen.sql`, SHA-256 `76C0614464F36A12A3E1015ED82619DB89A4BB1571EB65A08D569B3BE72EC193`: additive AP-ABS-Tabellen, Ereignisse und bestehender Kundenschreibweg. Nach bestandener Abbruchprobe einzeln auf Dev angewendet; die im Ledger hinterlegte SQL stimmt mit der Datei überein (MD5 `a5ae9128d077ccb3b2deb6d811514521`). Die neuen Tabellen sind leer; vorhandene Kunden, Aufträge und Ereignisse blieben beim Vergleich unverändert. RLS ist für Kundenabsprachen aktiv, `authenticated` hat kein DELETE-Recht.
- Migrationsabgleich zum PR-Kopf: **78 von 80** Versionen auf Dev. Die bereits auf Main liegenden Versionen `20261105224000` und `20261106024500` fehlen; die gesonderte Freigabe ihrer Anwendung steht aus. Kein Gleichstand behauptet.
- Der bestehende Lieferanten-Schreibweg mit ausschließlich Geld-Recht wurde in der noch nicht auf Dev angewendeten Migration erhalten. Der unveränderte H18-Fall „3.8 Geld alone“ bestand lokal gegen Replay-DB inklusive Rücklesen.
- CI am Produktstand: Quality, agentur-gate, Fresh Supabase replay, Ratchet und Vercel bestanden. H16: 79/79 H18-Tests und 26/26 Akzeptanztests bestanden; im generierten Gesamtlauf 333/334, G04 hatte einen Locator-Timeout. Ein einmaliger H16-Neustart desselben SHA läuft. Lokal bestand G04 im gezielten Nachlauf; ein Eintrag als erwarteter Fehler wurde deshalb nicht übernommen.
- ABS-01–20 wurden lokal auf einem früheren Kandidaten mit frischem Build geprüft; die endgültige Einordnung und der Sichtnachweis am PR-Kopf stehen noch aus. ABS-13/14 sind gemäß P79 dem Folgepaket AP-ABS-b zugeordnet.
- Der gebundene Sichtprüfer hat derzeit keinen Routeintrag für `absprache`; ein vollständiger Sichtnachweis für die betroffenen Bereiche steht aus. Die Abweichung der Hauptaktion in Leer- und Widerrufszustand ist gemäß P80 als `Endversion-Angleich absprache Hauptaktion` einzuordnen.

## Owner-Klickweg nach Abschluss der Prüfungen

1. Preview öffnen, als Person mit Kunden- und Geld-Recht anmelden und **Kunden & Kontakt** wählen.
2. Einen vorhandenen Kunden öffnen, **Absprachen & Eigenheiten** aufrufen und eine Absprache erfassen. Nach Speichern die Kundenkarte erneut öffnen und denselben Eintrag kontrollieren.
3. Für einen geeigneten Auftrag den Warenausgang öffnen und kontrollieren, dass eine passende gültige Absprache angezeigt wird. Widerruf und erneutes Öffnen der Kundenkarte anschließend prüfen.
4. Sammelrechnung: Den ausgewiesenen Anschluss unter **Der Tag** prüfen; die Rechnungserstellung selbst gehört zu AP-ABS-b.

## Noch offen

- Abschließender H16- und CI-Status am veröffentlichten Kopf; exakte READY-Preview dieses Kopfs.
- Sichtprüfung der betroffenen Ansichten und zugelassene Gelb-Befunde.
- Freigabe und Anwendung der zwei fehlenden Vorgängerversionen, anschließend erneuter Migrationsabgleich; keine Aussage über Produktionsbereitschaft.
