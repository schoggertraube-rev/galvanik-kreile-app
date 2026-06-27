# Non-Loss Register

Stand: 2026-06-27

Dieses Register schützt bestätigte Produktziele, verschobene Missionen und verwertbare Alt-Arbeit vor stiller Verwerfung. Ein Eintrag darf nur mit belegter Produktentscheidung entfernt werden.

## Statuswerte

- `ACTIVE`: aktuell in Arbeit oder unmittelbar als Nächstes.
- `READY_AFTER_DEPENDENCY`: fachlich bestätigt, wartet auf benannte Abhängigkeit.
- `BLOCKED`: externer oder technischer Blocker ist benannt.
- `DEFERRED_WITH_REASON`: bewusst später, Grund dokumentiert.
- `PROTECTED_BACKLOG`: bestätigter Produktumfang, noch nicht terminiert.
- `DONE_VERIFIED`: live und end-to-end nachgewiesen.

## Aktive Stabilitäts- und Sicherheitsmissionen

| ID | Ziel | Status | Abhängigkeit / Nachweis |
|---|---|---|---|
| `LIVE-AUTH-001` | Abgelaufene Sitzung schließt Erfassung, löscht App-Session und führt nach `/start`. | `ACTIVE` | Production ausgerollt; realer Ablauf mit abgelaufener Sitzung noch vollständig zu bestätigen. |
| `AUTH-IDENTITY-002` | Benutzerwechsel MK → Admin → MK ohne alte Rolle, Initialen, Rechte oder Sessionreste. | `ACTIVE` | Nächste Code-Mission. |
| `OFFLINE-SHELL-001` | Eine Service-Worker-Registrierung; HTML, CSS, JS, Fonts und Kernassets offline nutzbar. | `READY_AFTER_DEPENDENCY` | Nach `AUTH-IDENTITY-002`. |
| `OFFLINE-48H-001` | 48 Stunden arbeitsfähig mit Outbox, Neustart, Konflikt- und Wiederholschutz. | `READY_AFTER_DEPENDENCY` | Benötigt stabile Shell und Offline-Datenvertrag. |
| `SEC-PIN-002` | PIN-Hashing, kein Default-PIN, Bestandsmigration und Fehlversuchsschutz. | `READY_AFTER_DEPENDENCY` | Nach Identitätsstabilisierung. |
| `SEC-STORAGE-001` | MIME-, Größen-, Pfad-, Tenant- und Storage-Limits für Fotos/Dokumente. | `READY_AFTER_DEPENDENCY` | Mit Capture-/Storage-Vertrag. |
| `BACKUP-RESTORE-001` | Daten, Dokumente, Fotos, Audit und Wiederherstellung nachweisbar sichern. | `PROTECTED_BACKLOG` | Vor Verkauf/Go-live vollständig testen. |

## Erfassung und Wareneingang

| ID | Ziel | Status | Abhängigkeit / Nachweis |
|---|---|---|---|
| `CAPTURE-ORIGINAL-001` | Eine kanonische Originalerfassung vor OCR und Zuordnung. | `READY_AFTER_DEPENDENCY` | Identität und Offline-Shell stabil. |
| `OFFLINE-CAPTURE-001` | Foto/Datei offline sichern, Neustart überstehen und genau einmal synchronisieren. | `READY_AFTER_DEPENDENCY` | `CAPTURE-ORIGINAL-001`, `OFFLINE-48H-001`. |
| `APP-0001D-A` | Echte Kamera und Datei-Upload als getrennte, verständliche Wege. | `READY_AFTER_DEPENDENCY` | Salvage aus `feature/capture-auth-tenant`. |
| `APP-0001D-B` | OCR, privater Storage, `item_photos`, Signed URLs und Orphan-Cleanup. | `BLOCKED` | Remote-Schema ↔ Migrationen ↔ Drizzle zuerst abgleichen. |
| `OCR-REVIEW-001` | Konfidenz je Feld; nur unsichere Felder prüfen. | `READY_AFTER_DEPENDENCY` | OCR-Vertrag. |
| `CAPTURE-ASSIGN-001` | Kunde, Auftrag und Teilgruppe sicher vorschlagen/zuordnen. | `READY_AFTER_DEPENDENCY` | Original- und OCR-Vertrag. |
| `LABEL-QR-001` | QR-/Etiketterkennung als schneller Zuordnungsweg. | `PROTECTED_BACKLOG` | Nach stabilem Capture. |
| `WARENEINGANG-EVENT-001` | Aufnahme erzeugt nachvollziehbares Wareneingangsereignis. | `READY_AFTER_DEPENDENCY` | Zuordnung steht. |
| `FIRST-PRODUCTION-CARD-001` | Erster vollständiger Eingang bis sichtbarer Produktionskarte. | `READY_AFTER_DEPENDENCY` | Wareneingangsereignis und Timeline. |
| `AI-PHOTO-001` | Optionale Teile-/Zustandsanalyse mit Quellen, Konfidenz und Review. | `DEFERRED_WITH_REASON` | Erst nach belastbarer Original-, Storage- und Zuordnungsbasis. |
| `APP-PHOTO-002` | Wiederholungs- und Nacharbeitsfotos ohne Duplikat-/Verlustpfad. | `READY_AFTER_DEPENDENCY` | `APP-0001D-B`. |

## Geschützte Produktroadmap

| Bereich | Geschütztes Ziel | Status |
|---|---|---|
| Kontroll-Cockpit | Cash, offene Aufträge, Engpässe, Termine, Verspätungen und erwartete Einnahmen als handlungsorientierte Chefansicht. | `PROTECTED_BACKLOG` |
| Planbarkeit | Investitions-, Personal-, Fahrzeug- und Liquiditätsentscheidungen mit Schwellenwerten, Prognosen und Gesamtkosten. | `PROTECTED_BACKLOG` |
| Auftragstimeline | Vollständiger Verlauf von Kontakt und Eingang bis Rechnung, Zahlung, Versand, Reklamation und Folgeauftrag. | `PROTECTED_BACKLOG` |
| Buchhaltung | Belege, Rechnungen, Zahlungen, DATEV/CSV/ZIP, UStVA, Audit und Senden-Button mit realen Daten. | `PROTECTED_BACKLOG` |
| Such-Gehirn | Suche über Kunden, Aufträge, Teile, Dokumente, Kommunikation und Geld mit Beziehungsart und belegten Quellen. | `PROTECTED_BACKLOG` |
| KI-Entscheidungen | Antworten mit Quellen, Links, Stichworten, Graphiken, Kostenfreigabe und nachvollziehbarer Unsicherheit. | `PROTECTED_BACKLOG` |
| Kundenkarte | Kundenwissen, Beziehungen, Freitext, Quellenqualität und optionale Deep-Research-Anreicherung. | `PROTECTED_BACKLOG` |
| Kommunikation | Telefonnotiz, E-Mail, Bilder, Rückruf, Anfrage und Kundenkontext in einer Arbeitsfläche. | `PROTECTED_BACKLOG` |
| Marketing | Aktion → Reichweite → Klick → Anfrage → Auftrag → Umsatz/Marge mit Attribution und Lernschleife. | `PROTECTED_BACKLOG` |
| Lager/Bäder/Energie/QS/KVP | Operative Bestände, Badwerte, Energie, Qualität, Reklamationen und Verbesserungen mit realen Daten. | `PROTECTED_BACKLOG` |
| Performance | Flüssige Tablet-/Desktop-Nutzung, kein Jank, keine flackernden oder unkontrolliert schließenden Overlays. | `PROTECTED_BACKLOG` |
| Modularer Kern | Tenant-Begriffe, Verträge und Konfiguration zentral; keine tiefen Modulimporte oder zweite Wahrheiten. | `PROTECTED_BACKLOG` |

## Nutzer-Twins als Abnahmeregel

- **Rolf:** Desktop primär; Kontrolle, Geld, Termine, Freigaben und Planbarkeit ohne KPI-Wand.
- **Philipp:** Tablet primär; Produktion und Zahlen ohne zusätzliche Büroarbeit.
- **Michael:** stark geführte Aufnahme, Telefon, E-Mail, Eingang und Ausgang; geringe Technikroutine.

Keine Mission gilt als produktreif, wenn der relevante Nutzer-Twin den Kernweg nicht ohne versteckte Entwicklerkenntnisse ausführen kann.

## Salvage-Schutz

Folgende lokale Quellen bleiben bis zur kontrollierten Verwertung erhalten:

- Dirty-Worktree `feature/capture-auth-tenant`, bekannter HEAD `0e87cf65c69d50ed50977ac1b20dffba8485f047`.
- Offline-Diagnose `diagnose/auth-session-permissions-2026-06-17`, bekannter HEAD `1621702`.
- Nicht versionierte Capture-/Foto-/Testarbeit im Dirty-Worktree.

Keine dieser Quellen ist Lieferwahrheit. Übernahme erfolgt ausschließlich über kleine neue PRs gegen `main`.
