# Abgabe Korrektur Kunde anlegen 01

## Befund

> „3.1 nicht nach Spec gebaut: Alt-Formular (Kundentyp Firma/Privat/Institution vorbelegt, Land Freitext, Zahlung Rechnung frei wählbar entgegen U-111, keine Dublettenprüfung/Prüfliste/Erfassen, Abbrechen ohne Entwurf-Rückfrage, Erfolg führt zum Alt-KV).“

Beleg aus dem Bauplan: `src/components/layout/GlobalCreateFlow.tsx:224–249,1627–1647`.

## Neu gemacht

- „Kunde anlegen“ ist jetzt ein breiter V1.1-Werkbank-Dialog statt des Alt-Overlays (`src/components/layout/GlobalCreateFlow.tsx:1727`).
- Eigenständige Kundenanlage und Neuer Eingang verwenden dieselbe `CustomerFormFields`-Komponente (`src/components/layout/GlobalCreateFlow.tsx:231`, `:1886`).
- Kundentyp hat keine Vorbelegung und bietet nur **Gewerbe** oder **Privat**. Land ist eine Auswahl; bei Zahlung stehen nur **Vorkasse** und **Bar oder Karte bei Abholung** zur Verfügung. Ohne Geld-Recht bleibt das Zahlungsfeld unsichtbar und der Schreibwert Vorkasse.
- Die rechte Prüfliste trennt die drei Interessenten-Pflichten von den Angaben, die erst für einen Auftrag vollständig sein müssen (`src/components/layout/GlobalCreateFlow.tsx:1794`).
- Die bestehende Kundensuche prüft Name/Firma, Telefon, E-Mail und Ort mit 250 ms Verzögerung. Ein Treffer verlangt die ausdrückliche Entscheidung „Vorhandenen öffnen“ oder „Trotzdem neu anlegen“ (`src/components/layout/GlobalCreateFlow.tsx:1764`).
- „Abbrechen“ schließt unveränderte Eingaben direkt; nach einer Änderung erscheint vor dem Verwerfen eine Rückfrage (`src/components/layout/GlobalCreateFlow.tsx:636`).
- Nach erfolgreicher Anlage öffnet direkt die Kundenkarte. Der alte KV-Erfolgszwischenschritt ist aus diesem Weg entfernt (`src/components/layout/GlobalCreateFlow.tsx:1051`).
- Migration `20261028010000_customer_type_institution_to_business.sql` ordnet historische `institution`-Kunden einmalig Gewerbe zu. Unveränderliche Belege werden nicht umgeschrieben.

## Datenbank-Nachweis

- Frischer lokaler Supabase-Replay einschließlich `20261028010000`: **grün**.
- Dev-Projekt `syhaigjhsbpjmtnggqka`: Migration `20261028010000` angewendet; lokale und entfernte Migrationsliste sind bis zu diesem Stand gleich.
- Read-only REST-Nachweis nach der Migration: `public.customers` mit `type = 'institution'`: **0 Zeilen** (`Content-Range: */0`).
- Nach dem Owner-Klick muss genau der neue TEST-Kunde mit automatisch vergebener Kundennummer, `type = 'business'` oder `type = 'privat'` und `payment_preference = 'vorkasse'` beziehungsweise `'bar'` vorhanden sein.

## Klickweg für den Owner

1. In der Preview als Rolf **Anlegen → Kunde anlegen** öffnen. Der Dialog muss „Kunde anlegen“, eine Prüfliste und die ungewählten Schalter **Gewerbe / Privat** zeigen; „Institution“ und „Rechnung auf Ziel“ dürfen nicht vorkommen.
2. **Gewerbe**, Name **TEST Dublette Neu GmbH** und eine Telefonnummer eines vorhandenen Kunden eingeben. Es muss „Ähnlicher Kunde vorhanden“ mit „Vorhandenen öffnen“ und „Trotzdem neu anlegen“ erscheinen.
3. „Trotzdem neu anlegen“ wählen, nur Name und eine neue TEST-Telefonnummer belassen und **Als Interessent speichern** wählen.
4. Direkt danach muss die Kundenkarte des neuen Kunden geöffnet sein; der alte Bildschirm „Kunde gesichert“ beziehungsweise ein KV-Einstieg darf nicht erscheinen.
5. Datenbank prüfen: genau dieser TEST-Kunde besitzt eine neue `K-…`-Nummer, `type = 'business'`, `payment_preference = 'vorkasse'`; es existiert weiterhin kein Kunde mit `type = 'institution'`.

## Prüfergebnis

- Typprüfung: **grün**.
- Gezielte UI-Prüfung: **1 Datei / 20 Tests grün**.
- ESLint der betroffenen UI- und Testdatei: **0 Fehler**.
- `node scripts/ui/spec-check.mjs --screens=kundeneu`: **2 erwartet / 2 gefunden / 0 fehlend**.
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d; der Owner führt den obigen Preview-Klickweg aus.

## Abgrenzung

- Der separate, im Bauplan als mittlere Korrektur geführte transaktionale Notizvertrag und der eigene Entwurfstyp „Kunde“ werden nicht in diese schwere Oberflächenkorrektur vorgezogen.
- Visitenkarten- und Mail-Signatur-Erfassung sind im Bauplan als neue Funktionen markiert und im nicht baureifen F1-Abschnitt noch gesperrt. Diese Abgabe erfindet dafür keinen scheinbar funktionierenden Knopf; die Werkbank nutzt bis zur Baureife die reale manuelle Erfassung.
