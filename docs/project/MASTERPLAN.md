<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->

# Kreile — einfacher Weg bis Live

Die maschinenlesbare und einzige ausfuehrbare Fassung ist
`docs/delivery/KREILE_LIVE_PLAN_V1.json`. Diese Seite erklaert sie nur.

Nach einem autorisierten Merge wird der fest gebundene Nachfolger auf seinem frischen
Branch ausschliesslich mit `npm run live:advance -- --apply` aktiviert. Freitext-Handoffs
oder das manuelle Auswaehlen eines anderen Pakets sind nicht Teil der Baulinie.

## Ziel

Eine verkaufbare Grundapp mit schnellem Login, Designsystem V1.1, echten Kunden- und
Auftragsdaten, durchgaengigem Eingang-bis-Zahlung-Ablauf, ehrlichem Kalenderzustand,
stabiler Performance sowie kontrolliertem Pilot, Cutover und Livegang.

## Feste Reihenfolge

| Paket | Ergebnis |
|---|---|
| KR-L01 | Login und erste Route messbar schnell |
| KR-L02 | Designsystem V1.1 als einzige Komponentenbasis |
| KR-L03 | Ziel-Shell, Rollen-Homes und Navigation |
| KR-L04 | Auftragsliste auf echten Daten |
| KR-L05 | Auftragskarte als einzige Detailwahrheit |
| KR-L06 | Kundenliste auf echten Daten |
| KR-L07 | Kundenkarte mit verlustfreiem Rueckweg |
| KR-L08 | Globales Plus: Intake bis Kunde, KV und Auftrag |
| KR-L09 | Accounting-minimal in der Zieloberflaeche |
| KR-L10 | Termine, Abholung und Konflikte als Handlungswahrheit |
| KR-L11 | Globale Suche |
| KR-L12 | Kalender-Port und ehrlicher geschlossener Zustand |
| KR-L13 | Realer M365-Kalenderadapter mit Readback |
| KR-L14 | Kalender Woche und Monat in V1.1 |
| KR-L15 | Kunden- und Auftragsaufrufe schnell |
| KR-L16 | Zusammenhaengende Gesamtoberflaeche |
| KR-L17 | Writerloses Sicherheits- und Betriebs-Gate |
| KR-L18 | Writerlose reale Pilotabnahme |
| KR-L19 | Writerloses Cutover-Gate |
| KR-L20 | Writerloser Livegang- und Uebergabenachweis |

## Produktionsprinzip

Es gibt immer nur ein aktives Paket. Bei KR-L01 bis KR-L16 schreibt der PL zuerst die
rote Abnahme, danach baut genau ein Writer nur die erlaubten Produktpfade. KR-L17 bis
KR-L20 sind reine Gates ohne Writer oder Produktdelta. Ein unabhaengiger Reviewer prueft
den exakten SHA. Eine Korrekturrunde ist erlaubt. Das folgende Paket ist bereits im Plan
festgelegt und wird nach dem realen Main-Merge aus frischem `origin/main` gestartet.

Visuelle Pakete werden in Desktop, Tablet und Mobile im Browser abgenommen. Kein Mock,
kein Demo-Fallback und kein internes Modul gilt als sichtbarer Gesamtfortschritt. Main,
Preview, Production und Remote-Datenbank bleiben getrennte, real zu belegende Wahrheiten.

Jeder Main-Merge und sein automatischer Production-Effekt werden einzeln vom Owner
freigegeben. Erst der belegte Abschluss von KR-L20 darf die Gesamtapp als live bezeichnen.
Nach einem final gescheiterten Paket oder einer im Preflight erkannten echten
Produktentscheidung gibt es keinen Nebenplan: nur eine ownerautorisierte Amendierung
desselben Pakets darf dessen Scope korrigieren. Sie darf den fokussierten Test genau
einmal ersetzen. Falls ein reines GATE einen realen Produktmangel belegt, darf genau
dieses Paket einmal zu einem eng begrenzten BUILD werden; ID und Reihenfolge bleiben fest.

Gemergte BUILD-Tests ohne externe Voraussetzung laufen dauerhaft gegen die frische lokale
Supabase-Replay-Umgebung. Externe BUILDs und GATEs bleiben receiptgebunden; kein Pakettest
darf mit `skip` oder `fixme` stillgelegt werden. Nach `LIVE_COMPLETE` bleibt das Repository
fuer normale Produkt-Hotfixes offen, waehrend Plan, Mission und Live-Steuerung geschuetzt
bleiben.

## Owner-Beruehrung

Der Owner wird nur fuer sichtbare Abnahme, Main-Merge/Production-Effekt oder eine neue
dauerhafte Produkt-/Strukturentscheidung benoetigt. Paketbildung, technische Details,
Tests, Review, Umgebungsrecovery und Start des festgelegten Nachfolgers sind Aufgabe von
PL, Writer, Reviewer und Koordinator.
