<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M07 KI-Suche — Entscheidungsverweise

| Register-ID / Fundstelle | Kurzform (1 Zeile) | Datum | gilt/überholt |
|---|---|---|---|
| D-GOV-001 | Eine Autorität je Wahrheitsart; Konflikte werden nicht still aufgelöst. | 2026-09-10 | gilt |
| D-UI-V5-001 | V5 ist Ablaufkanon; KI-/Providerfunktion bleibt ohne Vertrag unsichtbar. | 2026-09-14 | gilt |
| D-UI-V5-003 | V5 mit festem SHA ist einzige Zielvorlage; V6 ist verworfen. | 2026-09-21 | gilt |
| D-ARCH-012 | Azure/Foundry ist bevorzugter, gegateter Zielstack; alle Provider hinter neutralen Ports, kein stiller Fallback. | 2026-09-14 | gilt |
| D-AI-001 | Cheap-first, RLS vor Retrieval, Quellen/Confidence/Kosten/Audit und keine zweite Wahrheit. | 2026-09-14 | gilt |
| D-AI-002 | Quellengebundener Fakten-/Aktionsfluss mit Human-Confirm, sicherem Command und Readback. | 2026-09-14 | gilt |
| D-RES-001 | Fehler transparent, fail-closed und mit sicherer nächster Aktion/Korrelations-ID; kein Fake-Erfolg. | 2026-09-14 | gilt |
| MODULKARTE_KANON §Search Capability / KI | Suche ist Pflichtkern; KI-/semantische Suche liest nur autorisierte Ports und besitzt keine zweite Wahrheit. | 2026-09-21 | gilt |
| ARCHITEKTUR_MODULE_PATH1 §Module/Ports | Modulgrenzen, `public.ts`, Manifest, Tenantinjektion und keine Deep-Imports sind verbindlich. | 2026-09-15 | gilt |
| OE-2609-04 | Nicht angebundene Funktion nur als nicht klickbares Element „In Klärung“/„In Aufbau“. | 2026-09-25 | gilt |
| OE-2609-05 | Module bleiben erhalten, sind hinten angestellt und werden erst nach Grundstamm- und Modulabnahme angebunden. | 2026-09-25 | gilt |
| OE-2609-06 | Bau erst mit Gesamtplan, Designsystem und fehlerfreiem Umsetzungsweg; alles später über `02_app`. | 2026-09-25 | gilt |
| OE-2609-09 | Standardzugriff für alle Personen; Admin sperrt oder erweitert je Person. | 2026-09-26 | gilt |
| OE-2609-10 | Sperren verhindern Fehler; Konflikte gehen je Zuständigkeit an Rolf oder Phillip. | 2026-09-26 | gilt |
| OE-2609-15 | Einheitliches, vollständiges Moduldossier und Prüfung der App-Neutralität des Kerns sind Pflicht. | 2026-09-26 | gilt |
| OE-2609-16 | Modul-Mindmap Stand 2026-08-15 ist bekannte Strukturquelle. | 2026-09-26 | gilt |
| OE-2609-17 | Baubereite Modulkerne dürfen off-repo nach Reihenfolge/Abhängigkeit gebaut werden; Kreile-Adoption bleibt seriell. | 2026-09-26 | gilt |
| OE-2609-20 | Personenbezug wird nur so lange wie nötig/gesetzlich vorgeschrieben gehalten; Löschen/Anonymisieren nie still, sondern als Vorschlag mit Admin-Freigabe. | 2026-09-26 | gilt für M07-Datenminimierung und Aufbewahrungsgate |
| OE-2609-25 | Produktion läuft im Kreile-eigenen Microsoft-/Azure-Tenant; Owner-Dev-Ressourcen bleiben synthetischen Tests vorbehalten. | 2026-09-26 | gilt |
| OE-2609-26 | Dringende Konflikte, Warnungen und Entscheidungen stehen je Zuständigkeit oben auf der Startseite. | 2026-09-26 | gilt |
| Anleitung §6 | Kreile-Modulschalter ist bis Adoption AUS und nur Admin/Developer schalten serverseitig. | 2026-09-26 | gilt |
| HINWEIS_TRENNUNG_2026-09-26.md | Dossier beschreibt nur Kreile; Übertragbarkeit bewertet ausschließlich die App-Neutralität des Kerns. | 2026-09-26 | gilt |
| Auftrag M07, Vorwissen PL | M07 dockt über `searchTenant`; Unternehmer-KI 4.0 ist Vision, nicht MVP. | 2026-09-26 | gilt |
| Unternehmer-KI 4.0 Konzeptpaket | Persistenter Assistenz-Chat, Langzeitgedächtnis und Unternehmensmeeting als M07-MVP. | 2026-08-03 | überholt für MVP; geschützte Langzeitvision |
| alte Gemini-/Direkt-DB-Suchimplementierung | Provider-/Suchpfad direkt neben G08. | 2026-08-04 | überholt/verworfen durch D-ARCH-012, D-AI-001 und G08 |
