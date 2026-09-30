<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G08_SUCHE — Steckbrief

**Zweck:** Globale, tenantgebundene Kreile-Suche über reale Auftrags- und Kundendaten mit belegten Treffern und sicheren Rückwegen.  
**Stufe:** Grundstamm  
**Dossier-Status:** BAUBEREIT  
**Modul-Status:** ADOPTIERT — Kern auf `origin/main`, Ziel-Shell-Anbindung und vollständige Route noch nicht abgenommen  
**Zuständige Session:** PL `01a0ce4b`  
**Arbeitsordner:** `02_app/src/modules/suche`  
**Code-Pfad:** `src/modules/suche/`; Kreile-Komposition nur über typisierte `*AppAdapter.tsx`-/Server-Port-Adapter  
**Braucht:** G01 Identity/Capability/Tenant, G02 Ziel-Shell, G04 Orders-Read-/Karten-Port, G05 Customers-Read-/Karten-Port, Designphase 1  
**Wird gebraucht von:** F1.6 Pilotgate und später M07 über den öffentlichen Vertrag  
**Anbindungszeitpunkt + Gate:** T-04 nach T-01 bis T-03; Fresh-Tenant-, Full-Route- und Owner-UX-Abnahme auf Desktop/Tablet/Handy  
**Bis dahin im Grundstamm:** `Suche — In Aufbau`, gedämpft, nicht klickbar, keine Route; Dokumentquelle `Dokumente — In Klärung`  
**Übertragbarkeit:** Kern app-neutral: ja; Kreile-Rechte, Quellen, Texte und Navigation ausschließlich im Kreile-HostAdapter  
**Rate-Stellen:** RT-18, RT-19, RT-22, RT-25, RT-27, RT-29  
**Stand:** 2026-09-26  
**Bearbeiter:** Codex

## Zweck

G08 liefert die globale, tenantgebundene Kreile-Suche für reale Auftrags- und Kundendaten. Sie beginnt deterministisch und strukturiert, nennt Trefferquelle, Trefferfeld, Zusammenhang, Datenstand und Abdeckungsgrenze und öffnet dieselbe Auftragskarte V8 beziehungsweise Kundenkarte V2 wie Liste und Deep-Link. Der Kern bleibt frei von Kreile-Fachbegriffen; Kreile-spezifische Read-Ports, Berechtigung, Beschriftungen und Navigation liegen im Kreile-HostAdapter.

## Gehört hinein

- neutraler Vertrag für Anfrage, normalisierte Suchphrase, erweiterbare Quellenliste, Ergebnis, Ranking, Kappung und Fehler;
- Dialog mit Tastatur-, Touch- und responsivem Verhalten;
- lokale Dialogzustände und fail-closed Fehlerdarstellung;
- Kreile-Read-Ports für Aufträge und Kunden;
- Öffnen von Originalkarten über den einen app-seitigen Overlay-/Backstack-Adapter;
- Kontext-Rückkehr mit Filter und Scrollposition;
- Anschlussstelle für spätere Quellen, aber keine Quelle ohne öffentlichen Port des besitzenden Moduls.

## Gehört nicht hinein

- eigene Tabellen, eigene Fachwahrheit, Suchindex als Primärwahrheit oder Mutationen;
- KI-, semantische oder natürlichsprachliche Suche in V1;
- Provider, Azure, Graph, OCR, Secrets oder kostenpflichtige Dienste;
- eine zweite Auftrags-/Kundenkarte, Parallelroute oder Demo-/Mockdaten;
- Dokumentensuche ohne den offenen, autorisierten Dokument-Port L4;
- Anforderungen, Begriffe, Zeitmodelle, Daten oder Ressourcen anderer Zielapps.

## Abhängigkeiten und Anschluss

| Beziehung | Modul/Gate | Verbindlicher Anschluss |
|---|---|---|
| braucht | G01 Fundament | serverseitiger Identity-/Capability-Snapshot, Tenantbindung und RLS vor Retrieval |
| braucht | G02 Ziel-Shell | globaler Trigger in der kanonischen Kopfzeile auf Desktop, Tablet und Handy |
| braucht | G04 Orders | öffentlicher, tenantgebundener Read-Port; Öffnen derselben V8-Auftragskarte |
| braucht | G05 Customers | öffentlicher, tenantgebundener Read-Port; Öffnen derselben V2-Kundenkarte |
| braucht | Designphase 1 / T-01 bis T-03 | freigegebene `kr-`-Bausteine; kein Kopieren von Mock-CSS |
| baut an bei | T-04 | Suche in Kopfzeile, AppAdapter, Backstack und vollständige Route |
| wird gebraucht von | F1.6 und später M07 | reale Suche ist Pflicht vor Pilot; M07 darf nur über den öffentlichen Suchvertrag ergänzen |

## Bau- und Zwischenzustand

- Bis T-04 beginnt, bleibt die Ziel-Kopfzeile ohne aktive Scheinsuche. Wird der reservierte Grundstamm-Platz während des Baus sichtbar, lautet er wörtlich **„Suche — In Aufbau“**, ist gedämpft, nicht klickbar und hat keine Route.
- Die Dokumentquelle lautet, falls sie als reservierte Quelle gezeigt werden muss, wörtlich **„Dokumente — In Klärung“**, ist gedämpft, nicht klickbar und hat keine Route. Sie wird nicht als geprüft gemeldet.
- Erst nach realer Portanbindung, vollständiger Route und Abnahme in `1914x917`, `1220x880` und `390x844` darf die Suche aktiv erscheinen.

## Ist-Wahrheit am 2026-09-26

| Befund | Einstufung | Beleg |
|---|---|---|
| `searchTenant`, `SearchDialog` und `suche.manifest.json` liegen auf `origin/main` | GEBAUTER KERN | `src/modules/suche/`, Commit-Historie vom 2026-09-16 |
| Orders- und Customers-Suche ist deterministisch, tenantgebunden und read-only | GEBAUTER KERN | Unit- und lokale Fresh-DB-Integrationstests |
| Ziel-Shell bindet `GlobalSearch` nicht ein | FEHLT | `MockAppFrame.tsx`: Suche ausdrücklich weggelassen; `KreileAppShell.tsx` rendert keine Suche |
| Overlay-Stack kann Auftrag→Kunde→Auftrag und Kunde→Auftrag | TEILWEISE GEBAUT | `EntityOverlayStack.p3.test.tsx` |
| Ausgangskontext, Filter und Scrollposition sind im Stack nicht modelliert | FEHLT | `overlayStore.ts` enthält nur Entity-Typ und ID |
| Aktiver Missionstext und `CURRENT_STATE.md` nennen noch einen Kandidatenstatus | DOKU-DRIFT | Quelle ist älter als der Code auf `origin/main`; keine UI-Lieferbehauptung daraus ableiten |
| `SearchDialog` besitzt intern sieben Zustände: idle, loading, empty, data, denial, error, conflict | VERIFIZIERT | `src/modules/suche/ui/SearchDialog.tsx`; das PL-Vorwissen „6 Zustände“ ist überholt |

## Übertragbarkeit

**Kern app-neutral:** Anfrage, Source-Registry, Ergebnis-Typen, Ranking, Abdeckung, Dialogzustände und Backstack-Vertrag.  
**Kreile-HostAdapter:** Kreile-Rechte, Auftrags-/Kunden-Read-Ports, V8-/V2-Zielkarten, deutsche Kreile-Texte, Routen und Telemetrie.  
Andere Apps implementieren ausschließlich ihren eigenen HostAdapter und eigene Ressourcen; dieses Dossier beschreibt nur Kreile.

## Relevante Red-Team-Punkte

| ID | Bedeutung für G08 | Behandlung |
|---|---|---|
| RT-18 | vorhandene Adapter und Alt-UI nicht ungeprüft übernehmen | verwertbaren Kern behalten; Alt-Shell und Parallelpfade inventarisieren |
| RT-19 | Nulltreffer und Rückwege müssen eindeutig sein | exakte Leertexte und sichere Alternativen in `02`; Backstack in `02`/`07` |
| RT-22 | alle Zustände pro Screen | sieben Pflichtzustände je Funktion in `02` |
| RT-25 | Mock-CSS ist kein Ziel-Designsystem | Designphase-1-Gate und `kr-`-Bausteine in `03` |
| RT-27 | Header-/Backstack-Ticket fehlte | T-04 im Plan ist der verbindliche Baupunkt |
| RT-29 | Doppelungen brauchen Cleanup-Ticket | T-13; genaue Pfade in `11` |
