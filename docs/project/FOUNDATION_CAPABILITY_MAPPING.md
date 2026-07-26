# Foundation Capability Mapping

Stand: 2026-07-20<br>
Technische Basis: `165d0d68c564198f6e4108c52c8c6b4560f57a53`

Diese Datei ist die lesbare Projektion von `docs/project/FOUNDATION_CAPABILITIES.json`. Das JSON ist die kanonische, testgesicherte Lieferwahrheit. Es verknuepft die erhaltenen Ideen und Nutzer-Twins mit stabilen Capability-IDs, Code-/Testbelegen, ehrlichem Status und dem spaeteren Sichtbarkeitsziel.

Status bedeutet:

- `verified_local`: lokal implementiert und durch Tests belegt; noch keine Production-Behauptung.
- `rollout_required`: Code und Tests existieren, die Wirkung bleibt bis zu freigegebenem Remote-/Provider-Rollout fail-closed.
- `blocked_not_implemented`: der sichtbare oder serverseitige Pfad ist bewusst gesperrt, weil ein benoetigter Wahrheitsvertrag fehlt.
- `protected_later`: fachlich erhalten und mit Zielanschluss registriert; nicht als aktuelle Funktion ausgegeben.

| Capability | Funktion | UI-/Betriebsmodus | Status | Anschluss fuer die spaetere UI |
|---|---|---|---|---|
| `KI-IDENTITY-ACCESS-001` | Mandantengebundene Identitaet und Berechtigung | administrative | `verified_local` | Anmeldung, Rollenstatus, geschuetzte Serverpfade |
| `KI-CAPTURE-ORIGINAL-001` | Original vor OCR dauerhaft sichern | visible | `rollout_required` | Globale Erfassung und Wareneingang |
| `KI-OCR-REVIEW-ASSIGN-001` | OCR mit Feldkonfidenz, Review und Objektzuordnung | visible | `blocked_not_implemented` | Review vor Kunde, Auftrag, Teil oder Beleg |
| `KI-INQUIRY-QUOTE-001` | Anfrage in Angebot und Auftrag ueberfuehren | visible | `protected_later` | Anfrageeingang, Kundenakte, Angebotsarbeitsplatz |
| `KI-CUSTOMER-MEMORY-001` | Kundenwissen mit Beziehungen und Quellenqualitaet | visible | `protected_later` | Kundenkarte mit Kommunikation, Geld und Wissen |
| `KI-ORDER-FILE-001` | Auftrag als vernetzte Fuehrungsakte | visible | `verified_local` | Auftragsdetail und globale Auftragsnavigation |
| `KI-OPERATIONAL-EVENT-001` | Dauerhafte operative Ereignis- und Auditspur | automatic | `verified_local` | Auftragstimeline, Produktionskarte, Audit |
| `KI-PRODUCTION-NOW-001` | Aktuelle Produktion aus bestaetigten Zustaenden | visible | `verified_local` | Warendurchlauf und Stationsarbeitsplatz |
| `KI-PRODUCTION-HIERARCHY-001` | Auftrag, Position, Teilgruppe und Handling Unit | visible | `blocked_not_implemented` | Wareneingang, Produktionskarte, Stationsabschluss |
| `KI-HANDLING-UNIT-001` | Physische Einheit mit Label, Split und Zusammenfuehrung | visible | `blocked_not_implemented` | Teileetikett, Gestell, Behaelter, Charge |
| `KI-BATH-PARTICIPATION-001` | Galvanikabschluss nur mit Badbeteiligungsbeleg | visible | `blocked_not_implemented` | Galvanik-Stationsabschluss und Badprotokoll |
| `KI-BATH-MONITORING-001` | Badwerte, Grenzwerte, Pflege und Historie | later | `protected_later` | Baeder-Cockpit und Auftragsbezug |
| `KI-RESOURCE-CAPTURE-001` | Zeit und Material atomar am Auftrag buchen | visible | `rollout_required` | Stationsabschluss und Lagerhistorie |
| `KI-QUALITY-REWORK-001` | QS-Beleg, Abweichung und Nacharbeit | visible | `rollout_required` | QS, Reklamation, Nacharbeit, KVP |
| `KI-SHIPMENT-HANDOVER-001` | Versand und Uebergabe mit Receipt | visible | `verified_local` | Auftragsausgang, Versand, Abholnachweis |
| `KI-LABEL-PRINT-001` | QR- und Etikettendruck mit Objektbindung | later | `protected_later` | Wareneingang und Handling Unit |
| `KI-COMMUNICATION-MEMORY-001` | Kommunikationsverlauf am Auftrag und Kunden | visible | `rollout_required` | Auftragsdetail, Kundenkarte, Kommunikation |
| `KI-COMMUNICATION-AUTOMATION-001` | Statusmail und Mahnkommunikation ohne Scheinerfolg | automatic | `rollout_required` | Statusmail und Forderungs-Aging |
| `KI-CALENDAR-COMMITMENT-001` | Zusagen, Termine und Kalenderereignisse | visible | `rollout_required` | Home, Auftrag, Kundenkarte, Kalender |
| `KI-RELATIONAL-SEARCH-001` | Berechtigte Suche ueber vernetzte Kernobjekte | visible | `verified_local` | Globale Suche und objektgebundene Aktionen |
| `KI-ACCOUNTING-LEDGER-001` | Buchhaltungsledger mit Original, Freigabe und Audit | visible | `rollout_required` | Belege, Rechnungen, offene Posten, Audit |
| `KI-INVOICE-PAYMENT-001` | Auftrag, Rechnung, Zahlung und Mahnung verknuepfen | visible | `rollout_required` | Auftrag, Rechnung, Zahlung, Aging |
| `KI-CHEF-DAILY-COCKPIT-001` | Handlungsorientiertes Tagescockpit | visible | `protected_later` | Chef-Startseite mit Aufgaben, Geld und Zusagen |
| `KI-DECISION-ANALYTICS-001` | Kennzahlen mit Formel, Zeitraum und Datenluecke | visible | `verified_local` | Performance, Buchhaltung, Chef-Cockpit |
| `KI-LIQUIDITY-WHATIF-001` | Liquiditaets- und Was-waere-wenn-Entscheidungen | visible | `blocked_not_implemented` | Performance und Entscheidungsszenarien |
| `KI-AI-DECISION-001` | KI mit Quellen, Annahmen und menschlicher Freigabe | later | `protected_later` | Entscheidungsassistent und Quellenpanel |
| `KI-TEAM-DELEGATION-001` | Aufgaben, Verantwortung und Eskalation | later | `protected_later` | Home, Auftrag, KVP, Chef-Cockpit |
| `KI-KVP-LOOP-001` | Verbesserung bis zur Wirksamkeitspruefung | visible | `verified_local` | KVP und Auftrags-/QS-Kontext |
| `KI-AUDIT-EVIDENCE-001` | Receipts, Audit und Datenherkunft | administrative | `verified_local` | Datenherkunft, Timeline, Auditansicht |
| `KI-MARKETING-ATTRIBUTION-001` | Marketing von Aktion bis Umsatz und Marge | visible | `rollout_required` | Marketing-Wirkung, Anfrage, Auftrag, Rechnung |
| `KI-CONNECTOR-GOVERNANCE-001` | Connectorstatus, Scope, Retry und Provenienz | administrative | `rollout_required` | Betreiberbackend und Modulstatus |
| `KI-OFFLINE-48H-001` | 48 Stunden Offline-Arbeit mit Konfliktbeleg | later | `protected_later` | Globale Sync-Wahrheit und Offline-Mutationen |
| `KI-BACKUP-DATAROOM-001` | Backup, Restore und Kunden-Datenraum | administrative | `protected_later` | Betreiberbackend und Datenraum |
| `KI-ENERGY-RESOURCE-001` | Energie- und Ressourcenverbrauch am Auftrag | later | `protected_later` | Auftrag, Kostenstelle, Baeder, Performance |
| `KI-MODULAR-PORTS-001` | Module ueber Ports und Provider anschliessen | administrative | `verified_local` | Front-/Back-Bridge und UI-Komposition |

## Verbindliche UI-Regel

Die spaetere UI darf einen Capability-Status nicht selbst erfinden oder hochstufen. Sie liest den zugehoerigen Server-/Capability-Vertrag und stellt genau einen der folgenden Zustaende dar: bestaetigte Daten, bestaetigt leer, nicht konfiguriert, rollout-abhaengig, nicht verfuegbar oder geschuetzt fuer spaeter. `0`, `[]`, Erfolgstoast oder aktiver Button sind kein Ersatz fuer einen fehlenden Beleg.

Eine Idee ist damit nicht nur archiviert: Sie besitzt eine stabile ID, ein Ziel in der spaeteren Oberflaeche, einen aktuellen technischen Anschluss oder einen konkreten Blocker und einen Drift-Test. Entfernen oder Umbenennen ohne gleichzeitige Manifest- und Non-Loss-Aktualisierung laesst den Gate scheitern.
