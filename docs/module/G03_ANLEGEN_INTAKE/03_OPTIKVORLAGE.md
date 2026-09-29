<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Optikvorlage

Verbindliche Quelle ist `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`, SHA-256 `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`. D-UI-V5-003 bindet den vollständigen Sieben-Schritte-Fluss und seine Klarstellungen. V6 ist verworfen. Die Referenz liefert einen Desktop-Grundaufbau und einen Handy-Breakpoint; eine eigenständig abgenommene Tablet-Komposition sowie die vollständigen sieben Zustände fehlen und werden in Designphase 1 festgelegt. Mock-CSS wird nicht in Produktcode kopiert.

## Sieben Schritte

1. `+ Anlegen`
2. `Kunde anlegen` oder `Auftrag/KV anlegen`
3. Bestandskunde suchen/auswählen oder Neukunde vollständig erfassen
4. KV oder direkter Auftrag mit Positionen
5. Termin, Eingangsart, Zahlungsmodus, Express und optionales Eingangsfoto
6. Speichern mit Receipt und Fresh-Readback
7. Bestätigungsansicht und Auftragskarte öffnen

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| Globales `+` und Auswahl | V5-Komposition belegt | fehlt → Designphase 1 | V5-CSS ≤560 px belegt, Owner-UX ausstehend | Daten; weitere 6 fehlen → Designphase 1 | V5 `+ Anlegen`, Auswahldialog |
| Bestandskunde suchen | bestehender Product-Screen belegt, V5-Klarstellung bindend | fehlt → Designphase 1 | bestehender Flow responsiv, Sichtprüfung fehlt | lädt/leer/Fehler/Daten/gesperrt belegt; 2 fehlen | `GlobalCreateFlow.tsx`; D-UI-V5-003 |
| Neukunde anlegen | V5 belegt | fehlt → Designphase 1 | V5-CSS belegt, Feldreihenfolge prüfen | Daten; weitere 6 fehlen → Designphase 1 | V5 Screen `Kunde anlegen` |
| Kunde gespeichert | V5 belegt | fehlt → Designphase 1 | V5-CSS belegt | Daten; weitere 6 fehlen → Designphase 1 | V5 Screen `Kunde angelegt` |
| KV anlegen/fortsetzen | V5 belegt | fehlt → Designphase 1 | V5-CSS belegt, Dichte prüfen | Daten/leer/Fehler/In Klärung teilweise belegt; Rest fehlt | V5 Screen `Kostenvoranschlag`; GlobalCreateFlow |
| KV gespeichert/vergeben | V5 belegt | fehlt → Designphase 1 | V5-CSS belegt | Daten/In Klärung teilweise; Rest fehlt | V5 Screen `KV gespeichert` |
| Direkter Wareneingang | V5-Felder belegt; heutiger Flow weicht ab | fehlt → Designphase 1 | V5-CSS plus bestehende responsive Form, Sichtprüfung fehlt | Daten/lädt/Fehler/gesperrt belegt; 3 fehlen | V5 Screen `Auftrag anlegen`; OrderIntakePanel |
| Eingangsfoto je Position | bestehender Produkt-Screen belegt, nicht im globalen V5-Fluss integriert | fehlt → Designphase 1 | bestehende `sm`-Komposition, Owner-UX fehlt | Daten/lädt/Fehler/In Klärung; 3 fehlen | `OrderIntakePanel.tsx`; D-UI-V5-003 |
| Auftrag bestätigt | V5 und bestehende Receipt-Ansicht belegt | fehlt → Designphase 1 | V5-CSS belegt | Daten; weitere 6 nicht anwendbar beziehungsweise fehlen | V5 Screen `Auftrag angelegt`; D-RES-001 |
| OCR / Outlook passiv | ausgegraute Zeile/Chip, keine Route | fehlt → Designphase 1 | fehlt → Designphase 1 | gesperrt/In Aufbau; übrige Zustände erst in M04/M06 | OE-2609-04/19; OP-09/11 |

## Designsystem-Übergabe

- Typografie: Fraunces für prägende Überschriften, Inter für Bedienung und Fließtext gemäß OE-2609-03.
- Produktkomponenten dürfen keine `mock-*`-Klassen oder aus dem HTML kopierte Inline-Styles übernehmen.
- Die endgültigen `kr`-Komponenten, Tokens, Fokus-, Fehler- und Disabled-Zustände werden nach Designphase 1 ergänzt.
- Mindestprüfung: Tastaturfokus, Escape/Zurück, Touch-Ziele, keine verdeckten Aktionen, keine Rohstatusschlüssel und keine doppelte Information auf 1914×917, 1220×880 und 390×844.
