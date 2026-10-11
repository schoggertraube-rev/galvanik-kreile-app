<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 06 — Entscheidungen

Diese Datei enthält nur Fundstellen und Kurzverweise. Der vollständige Wortlaut bleibt in den jeweiligen Registern und Owner-Entscheidungen.

| Register-ID / Fundstelle | Kurzform (1 Zeile) | Datum | gilt/überholt |
|---|---|---|---|
| D-GOV-001 / `DOCUMENT_AUTHORITY.md` | Liefer- und Entscheidungswahrheit folgt der kanonischen Kette; Status nur aus `CURRENT_STATE.md`. | 2026-09-10 | gilt |
| D-ARCH-009 / MODULKARTE ACCOUNTING | G07 ist Accounting-minimal mit Rechnung, Zahlung, offenem Betrag und kleinem Ausgangs-Export. | 2026-09-06 | gilt, durch OE-2609-14 ergänzt |
| D-ARCH-011 / `ARCHITEKTUR_MODULE_PATH1.md` §4b | Provider liegen hinter tenantneutralen Ports und besitzen keine Domänenwahrheit. | 2026-09-10 | gilt |
| Register §3 F1.4 | Rechnung: Freeze, Snapshot, `R-`-Nummer, echtes PDF, Unveränderlichkeit und Storno/Neuausstellung. | 2026-08-28 | gilt |
| Register §7 #2 und #4 | Auftrags- und Rechnungsnummer sind getrennte Kreise; `R-` erst bei `createInvoice`. | 2026-09-06 | gilt |
| Register §7 #5 | Skonto 2 Prozent/10 Tage, danach netto 30. | 2026-09-06 | überholt durch OE-2609-11 beim Zahlungsziel |
| D-F15-001 | Zahlungs-Gate je Vorkasse, Abholung und Rechnung. | 2026-08-28 | gilt, durch OE-2609-07/11 präzisiert |
| D-F15-002 | Zahlungsmodus bei Annahme, grundsätzlich Vorkasse, später änderbar. | 2026-09-05 | überholt durch OE-2609-07/11 |
| D-F15-003 | Zielrechnung erlaubt Warenausgang vor Rechnung über ehrliche V2-Belege. | 2026-09-09 | gilt nur bei Kundenfreigabe nach OE-2609-11 |
| D-UI-CORE-001/002 | Rechnung und Zahlung bleiben in der einzigen Auftragskarte; G07-Liste ist realer Zielweg. | 2026-09-10 | gilt |
| D-UI-V5-002 | Enge sichtbare Rollen- und Rechteannahmen. | 2026-09-14 | überholt durch OE-2609-09 |
| D-UI-V5-003 / Repo-Register | V5 ist alleinige Ablauf-/Zwischenschritt-Referenz; V6 ist verworfen. | 2026-09-21 | gilt |
| OE-2609-03 | Designsystem wird aus V5 abgeleitet; Mock-CSS ist keine Lieferbasis. | 2026-09-25 | gilt |
| OE-2609-04 | Nicht verfügbare Elemente sind gedämpft, nicht klickbar und ehrlich markiert. | 2026-09-25 | gilt |
| OE-2609-05 | M01 und weitere Module sind hinten angestellt und werden erst nach Transfergate angebunden. | 2026-09-25 | gilt |
| OE-2609-07 | Abholung bedeutet bar oder Karte; sonst gilt Vorkasse. | 2026-09-25 | gilt, durch OE-2609-11 ergänzt |
| OE-2609-09 | Alle Personen haben Zugriff, außer Admin steuert persönliche Einschränkungen/Erweiterungen. | 2026-09-26 | gilt |
| OE-2609-10 | Interne Sperren verhindern Fehler; Konflikte gehen zuständig an Rolf oder Phillip. | 2026-09-26 | gilt |
| OE-2609-11 | Zielrechnung nur je Kunde freigeschaltet; 2 Prozent/10 Tage und 14 Tage gelten nur dort. | 2026-09-26 | gilt |
| OE-2609-12 | Integriertes Kartenterminal später über PaymentAdapter; bis dahin manuelle Kassenbestätigung. | 2026-09-26 | gilt |
| OE-2609-14 | ZUGFeRD muss vor Livegang im Grundstamm G07 fertig sein. | 2026-09-26 | gilt |
| OE-2609-20 | Rechnungen/Belege mindestens acht Jahre plus Ablaufhemmung; danach Personenbezug nur vorgeschlagen und nach Admin-Freigabe entfernen, Geschäftszahlen erhalten. | 2026-09-26 | gilt; Werte vor Live durch Steuerberater/Datenschutz bestätigen |
| Owner-Nachtrag „Trennung Kreile / andere Zielapps“ | App-neutraler Kern, Kreile-Spezifika nur im Kreile-HostAdapter; keine fremden Daten/Ressourcen. | 2026-09-26 | gilt |
| F1.4-Bauvertrag V1 | Referenzvertrag für unveränderliche Rechnung und PDF. | 2026-08-21 | gilt als Referenz, spätere Owner-Entscheidungen gehen vor |
| F1.5-Bauvertrag V1 | Referenzvertrag für Zahlungseingang und Warenausgang. | 2026-08-21 | gilt als Referenz, spätere Owner-Entscheidungen gehen vor |
