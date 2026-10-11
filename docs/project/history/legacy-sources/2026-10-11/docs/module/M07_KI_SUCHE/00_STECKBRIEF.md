<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M07 KI-Suche — Steckbrief

**Zweck:** M07 beantwortet berechtigte natürlichsprachliche Fragen zu Kreile-Daten als providerneutraler KI-Adapter **über** dem bestehenden `searchTenant`-Vertrag. Die normale, deterministische Suche bleibt erste und eigenständig nutzbare Stufe; M07 kombiniert oder erklärt nur freigegebene Fakten, nennt Quellen, Datenstand und Unsicherheit und erzeugt niemals eine zweite Datenwahrheit.
**Stufe:** hinten angestellt
**Dossier-Status:** BAUBEREIT
**Modul-Status:** HINTEN_ANGESTELLT
**zuständige Session:** OCR/Suche/KI, Session `01a0b07f`
**Arbeitsordner:** `C:\Users\Traube\Documents\Codex\2026-09-13\wie-sieht-es-derzeit-aus-mit`
**Code-Pfad:** off-repo-Kandidat `src/modules/ki-suche` — noch nicht vorhanden, daher noch kein SHA-256; im Erstlauf belegte Basis `02_app/src/modules/suche` auf `origin/main` (`public.ts` SHA-256 `17773F401DBF`), Aktualitätsbestätigung vor Import/Adoption durch PL gemäß Q-M07-012
**braucht:** G01 Auth-/Tenant-/Personenvertrag; G02 Shell; G08 `searchTenant` und dessen öffentliche Typen; G09 Konflikt-/Sperrvertrag; G10 Modulschalter und Providerkonfiguration; ausschließlich autorisierte öffentliche Read-Ports der jeweiligen Fachmodule; optional bestätigte kanonische Fakten aus M06, niemals OCR-Rohschlussfolgerungen
**wird gebraucht von:** spätere, ausdrücklich nicht zum MVP gehörende Kreile-Vision „UNTERNEHMENSKI 4.0“; keine Abhängigkeit des Grundstamms von M07
**Anbindungszeitpunkt + Gate:** Phase 4 als siebtes Modul nach M01–M06 gemäß Kreile-Reihenfolge aus OE-2609-17; erst nach fertig abgenommenem Grundstamm einschließlich G08/G09/G10, M07-Smoke/E2E/Owner-UX, Designphase 1b, Datenschutz-/AVV-/Region-/Quota-/Kostenfreigabe, echtem Provider-E2E im Kreile-eigenen Azure-Abo, Manifest/Handshake, unabhängigem Review und Owner-Transfergate; die Owner-Dev-Umgebung bleibt synthetischen Tests vorbehalten
**Bis dahin im Grundstamm:** nur innerhalb eines bereits gebauten Grundstamm-Screens ein gedämpftes, nicht klickbares Element ohne Route und ohne Fake-Daten; wörtlicher Text: Titel „KI-Suche“, Status „In Klärung“; direkte Modul-URL liefert fail-closed/404
**Übertragbarkeit:** Kern app-neutral: ja — alle Kreile-Fachdaten, -Regeln, Auth-, Such-, Budget- und Providerbindungen treten ausschließlich über den Kreile-HostAdapter ein
**Rate-Stellen aus Red-Team:** RT-22, RT-23, RT-24; RT-27 war im Erstlauf hinsichtlich Suchintegration auf `origin/main` erledigt, bleibt aber als Aktualitätswiderspruch dokumentiert und unterliegt Q-M07-012
**Stand:** 2026-09-26
**Bearbeiter:** Codex im Auftrag Cowork-PL

## Abgrenzung

- M07 ist kein Ersatz und kein Nebenweg für G08; ohne M07 bleibt `searchTenant` vollständig bedienbar.
- Persistente Chat-Threads, Langzeitgedächtnis, externe Websuche, Meetings und der „digitale Betriebsleiter“ sind geschützte Langzeitvision, aber ausdrücklich nicht M07-MVP.
- M07 besitzt im MVP keine fachlichen Tabellen, keinen eigenen Suchindex, keine Route und keinen eigenen Schreibweg.
- Eine Modellantwort ist nie Wahrheit und nie Befehl. Fachliche Wahrheit bleibt in den Fachmodulen; eine Aktion läuft erst nach menschlicher Bestätigung über deren sicheren Command- und Receipt-/Readback-Vertrag.

## Verbindliche Baugrenze

Das Dossier ist für den off-repo, providerneutralen Kern baubereit. Die offenen Punkte in `08_OFFENE_FRAGEN.md` sind keine Ratestellen: Bis zu ihrer Freigabe bleiben sichtbare M07-UI, Providerbindung und Kreile-Adoption geschlossen und das Grundstamm-Element zeigt „In Klärung“. Die durch Q-M07-012 ausstehende PL-Prüfung von `origin/main` ist ein externes Kanon-/Git-Gate und keine Bauannahme. Eine neue Tabelle, Route, Runtime-Abhängigkeit, Provideraktivierung oder Änderung an Auth/Rollen/Session erfordert eine gesonderte freigegebene Strukturentscheidung.
