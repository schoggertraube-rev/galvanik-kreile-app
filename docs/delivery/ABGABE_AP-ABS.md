# AP-ABS – Absprachen und Eigenheiten

Stand 06.11.2026: **Prüfung noch nicht abgeschlossen; nicht als merge-reif melden.**

- Geprüfter Produktstand: `0111464516fbbe8e00685c21f299abb686aa74c7`.
- READY-Preview dieses Produktstands: https://galvanik-kreile-werkstatt-ccsve4ohs.vercel.app
- Die Preview zeigt den genannten Produktstand; der später veröffentlichte PR-Kopf und seine Prüfungen sind gesondert gegen dessen SHA nachzuweisen.
- Die AP-ABS-Migration ist auf Dev noch **nicht** angewendet. Ein erfolgreicher fachlicher Klicktest auf der Preview ist daher nicht zugesichert. Keine Migration auf Dev ohne den vorgeschriebenen Freigabeweg.

## Änderung

Die Kundenkarte bietet Absprachen und Eigenheiten. Typisierte Absprachen für Zahlung und Übergabe werden über die bestehenden Kunden-, Auftrags- und Warenausgangswege gespeichert und gelesen. Der vollständige Rechnungsentwurf für Sammelrechnungen ist dem Folgepaket AP-ABS-b zugeordnet; bis dahin zeigt Der Tag den Anschluss als nicht ausführbar.

## Daten und Nachweise

- `supabase/migrations/20261106013106_abs_absprachen.sql`, SHA-256 `76C0614464F36A12A3E1015ED82619DB89A4BB1571EB65A08D569B3BE72EC193`: additive AP-ABS-Tabellen, Ereignisse und bestehender Kundenschreibweg. Ausschließlich auf die lokale Replay-DB angewendet.
- Der bestehende Lieferanten-Schreibweg mit ausschließlich Geld-Recht wurde in der noch nicht auf Dev angewendeten Migration erhalten. Der unveränderte H18-Fall „3.8 Geld alone“ bestand lokal gegen Replay-DB inklusive Rücklesen.
- CI am Produktstand: Quality, agentur-gate, Fresh Supabase replay, Ratchet und Vercel bestanden. H16: 79/79 H18-Tests und 26/26 Akzeptanztests bestanden; im generierten Gesamtlauf 333/334, G04 hatte einen Locator-Timeout. Ein einmaliger H16-Neustart desselben SHA läuft. Lokal bestand G04 im gezielten Nachlauf; ein Eintrag als erwarteter Fehler wurde deshalb nicht übernommen.
- ABS-01–20 wurden lokal auf einem früheren Kandidaten mit frischem Build geprüft; die endgültige Einordnung und der Sichtnachweis am PR-Kopf stehen noch aus. ABS-13/14 sind gemäß P79 dem Folgepaket AP-ABS-b zugeordnet.
- Der gebundene Sichtprüfer hat derzeit keinen Routeintrag für `absprache`; ein vollständiger Sichtnachweis für die betroffenen Bereiche steht aus. Die Abweichung der Hauptaktion in Leer- und Widerrufszustand ist gemäß P80 als `Endversion-Angleich absprache Hauptaktion` einzuordnen.

## Owner-Klickweg nach Datenbankfreigabe

1. Preview öffnen, als Person mit Kunden- und Geld-Recht anmelden und **Kunden & Kontakt** wählen.
2. Einen vorhandenen Kunden öffnen, **Absprachen & Eigenheiten** aufrufen und eine Absprache erfassen. Nach Speichern die Kundenkarte erneut öffnen und denselben Eintrag kontrollieren.
3. Für einen geeigneten Auftrag den Warenausgang öffnen und kontrollieren, dass eine passende gültige Absprache angezeigt wird. Widerruf und erneutes Öffnen der Kundenkarte anschließend prüfen.
4. Sammelrechnung: Den ausgewiesenen Anschluss unter **Der Tag** prüfen; die Rechnungserstellung selbst gehört zu AP-ABS-b.

## Noch offen

- Abschließender H16- und CI-Status am veröffentlichten Kopf; exakte READY-Preview dieses Kopfs.
- Sichtprüfung der betroffenen Ansichten und zugelassene Gelb-Befunde.
- Owner-Freigabe und Prüfung des Dev-Migrationswegs; keine Aussage über Produktionsbereitschaft.
