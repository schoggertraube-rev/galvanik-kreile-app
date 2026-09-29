<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G06 KV / Angebot — Steckbrief

**Zweck:** G06 bildet ein Angebot als eigenständigen, tenantgebundenen und versionierten Kostenvoranschlag vor dem Auftrag ab. Ein bestätigter Zuschlag übernimmt Kunde und Positionen und erzeugt über den bestehenden F1.1-Auftragseingang atomar und idempotent genau einen verknüpften Auftrag; KV-Wunschtermin und zugesagter Auftragstermin bleiben getrennt.
**Stufe:** Grundstamm
**Dossier-Status:** BAUBEREIT
**Modul-Status:** ADOPTIERT
**zuständige Session:** Grundstamm-PL 01a0ce4b
**Arbeitsordner:** `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app` (nur gelesen; Lieferwahrheit lokales `origin/main` bei `21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`)
**Code-Pfad:** `src/modules/quotes` (Manifest SHA-256 `83B48043CD95`); Kreile-Komposition derzeit in `src/components/layout/GlobalCreateFlow.tsx` und `src/app/GlobalCreateAppAdapter.tsx`
**braucht (Module/Ports):** G01 Autorisierung/Tenant/Receipts, G03 Global-Plus-Komposition, G04 F1.1-Auftragseingang und Auftragsnavigation, G05 Kundenlese-/Kundenanlage-Port, G07 Zahlungsregel, G09 Konfliktprojektion, G10 Katalog-/Preis- und Personenrechte; M05 nur später für belegten Versand
**wird gebraucht von:** G02 Handlungsbedarf, G04 Auftrag, G07 Rechnung/Zahlung, G08 Suche/Backstack, G09 Konflikte sowie später M05 Kommunikation
**Anbindungszeitpunkt + Gate:** Der persistente Kern ist bereits adoptiert. Der Zielumbau erfolgt in Phase 2 erst nach Kreile-Designsystem-Gate P-DS und stabilen G01/G03/G04/G05-Verträgen; Abnahme verlangt Fresh-Supabase-E2E, Exact-SHA-CI, unabhängigen Read-only-Review und Owner-UX auf 1914×917, 1220×880 und 390×844. Keine Remote-Migration und kein Livegang ohne gesonderte Freigabe.
**Bis dahin im Grundstamm:** Persistentes Erstellen, Öffnen, Bearbeiten und Zuschlag→Auftrag bleiben aktiv; der nicht angebundene Versand erscheint ausschließlich als nicht klickbarer Knopf mit dem wörtlichen Text `KV senden · In Aufbau`, ohne Route und ohne Fake-Erfolg. Ungeklärte Zusatzdaten beim Zuschlag erscheinen als `Auftragsdetails · In Klärung`.
**Übertragbarkeit:** Kern app-neutral: ja — Quote-Aggregat, Idempotenz, Versionierung, Receipts und Konvertierungsport enthalten keine Kreile-Personen oder Provider. Kreile-Begriffe, Rechte, Zahlungsstandard, Navigation und G01–G10-Kopplung liegen ausschließlich im Kreile-HostAdapter; Anpassungen anderer Zielapps gehören nicht in dieses Dossier.
**Rate-Stellen aus Red-Team:** RT-05 Rechte-Modell, RT-09 Terminmodell, RT-18 Adapter weiterverwenden, RT-19 unklare Mock-Punkte, RT-22 sieben Zustände, RT-23 Ausgrau-Standard, RT-25 Design-Tokens, RT-28 Umbau von Mock-CSS auf Designsystem
**Stand:** 2026-09-26
**Bearbeiter:** Codex, Selbstprüfung nach `00_ANLEITUNG_MODULDOSSIER.md` Version 1.1

