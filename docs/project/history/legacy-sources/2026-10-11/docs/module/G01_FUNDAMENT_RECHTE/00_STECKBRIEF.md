<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G01_FUNDAMENT_RECHTE — Steckbrief

**Zweck:** Das Fundament stellt den persönlichen, tenantgebundenen Einstieg, die serverseitige Autorisierung, sichere Sitzungen sowie Commands mit Receipt und Readback bereit. Ziel dieses Dossiers ist der Umbau von festen Rollenrechten zu personenbezogenen Rechten: fachliche Rechte sind standardmäßig erlaubt, Gregor kann sie je Person ausdrücklich erlauben, verweigern oder auf den Standard zurücksetzen; jede Änderung ist append-only auditiert.
**Stufe:** Grundstamm
**Dossier-Status:** BAUBEREIT
**Modul-Status:** ADOPTIERT
**zuständige Session:** Grundstamm-PL 01a0ce4b
**Arbeitsordner:** `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app` (nur `origin/main` ist Lieferwahrheit)
**Code-Pfad:** `src/modules/fundament`; zu konsolidierender Bestand zusätzlich in `src/lib/auth`, `src/lib/server/{authorization,appSession,authBootstrap,productActorReadiness,pinLoginHandle,pinRateLimit}.ts`, `src/app/actions/{auth,auth.actions,admin.actions,start.actions}.ts`, `src/components/{start,admin}` und `src/app/settings`
**braucht (Module/Ports):** Kreile-HostAdapter für Tenant, Transaktions-/DB-Port, Supabase-Auth-Port für Gregor, serverseitigen Cookie-/Secret-Port, Uhr/UUID sowie die vorhandenen sicheren Fach-Commands
**wird gebraucht von:** Shell und Startseiten sowie allen Fachmodulen, Commands, Read-Ports, Provider-Adaptern und Aufbewahrungs-/Löschfreigaben
**Anbindungszeitpunkt + Gate:** Auth-/Tenant-Bestand bleibt aktiv; der Rechte-Umbau erfolgt in Phase 2, Ticket T-05, nach Kreile-Designsystem P-DS und Designphase 1b. Abnahme nur mit S0/S1-Modulgates, Fresh-Replay, Tenant-/Autorisierungs-Negativmatrix, echter Login-/Session-Kette, Receipt/Readback und unabhängiger Exact-SHA-Prüfung; keine Remote-Migration ohne Freigabe.
**Bis dahin im Grundstamm:** In den Einstellungen nur ein nicht klickbares Element mit Titel „Personen & Rechte“ und Status `In Aufbau`; keine aktive Rechteänderung, keine tote Route und kein sichtbarer `NOT_AVAILABLE`-Text.
**Übertragbarkeit:** Kern app-neutral: ja; Permission-Entscheidungen, Sessions, Idempotenz und Audit sind fachneutral. Kreile-spezifische Produktidentitäten, Tenant-Konfiguration und UI-Texte liegen ausschließlich im Kreile-HostAdapter beziehungsweise in der App-Komposition.
**Rate-Stellen aus Red-Team:** RT-05, RT-21, RT-22, RT-23, RT-24, RT-25
**Stand:** 2026-09-26
**Bearbeiter:** Codex

## Abgrenzung

- Sichtbare Produktidentitäten bleiben Rolf, Phillip und Gregor; Michael ist ein historischer Prozess-/User-Twin, aber kein sichtbares Produktprofil und erhält ohne neue Owner-Entscheidung keinen Login.
- Die sechs technischen Rollen bleiben nur als kompatibler Auth-, Routing- und Auditvertrag erhalten. Sie vergeben nach dem Umbau keine fachlichen Rechte mehr.
- `AdminAuthority` ist der exakt konfigurierte Gregor-Produktaktor mit serverseitig bestätigter Rolle `admin|developer`. Diese Sicherheitsautorität ist nicht über die Personen-Rechtematrix erteilbar oder entziehbar.
- Keine allgemeine Benutzeranlage, keine neue sichtbare Rolle, kein Provider, keine Deployment- oder Datenbankaktion ist durch dieses Dossier freigegeben.
