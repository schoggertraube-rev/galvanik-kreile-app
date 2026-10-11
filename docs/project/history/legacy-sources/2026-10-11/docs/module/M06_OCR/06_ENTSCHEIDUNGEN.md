<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Entscheidungen M06

| Register-ID / Fundstelle | Kurzform (1 Zeile) | Datum | gilt/überholt |
|---|---|---|---|
| D-GOV-001; origin/main:docs/project/DOCUMENT_AUTHORITY.md | origin/main ist Lieferwahrheit; Dirty-Worktree nicht autoritativ. | 2026-09-10 | gilt; aktuelle Git-Prüfung als externes PL-Gate Q-M06-005 offen |
| D-ARCH-012; Entscheidungsregister/Modulkarte | Externe Dokumentfähigkeit nur portbasiert; Microsoft/Azure ist Zielprovider, keine Fachwahrheit. | 2026-08-28 | gilt |
| D-AI-001; Entscheidungsregister | Cheap-first und kein stiller Wechsel zu einer stärkeren/anderen Stufe. | 2026-09-14 | gilt |
| D-AI-002; Entscheidungsregister | Quelle → Fakten → Mensch → Aktion → Receipt/Readback. | 2026-09-14 | gilt |
| D-RES-001; Entscheidungsregister/Rettungsleine | Kein Informationsverlust/Fake-Erfolg; klare Fehler, Korrelation und Resume. | 2026-09-14 | gilt |
| D-UI-V5-003; gültige Repo-Registerkopie | V5 bleibt UI-Linie; V6 ist verworfen. | 2026-09-14 | gilt; V6 überholt/verworfen |
| OE-2609-04 | Hinten angestellte Elemente sind grau und nicht klickbar. | 2026-09-25 | gilt |
| OE-2609-05/-06 | M01–M07 hinten anstellen; Bau/Anbindung nur nach Plan, Design und seriellem Gate. | 2026-09-25 | gilt |
| OE-2609-09 | Alle Personen haben normalen Appzugang; Admin nur für Administration/Sperren. | 2026-09-26 | gilt |
| OE-2609-10 | Fachliche Konflikte werden Rolf/Phillip zugeordnet. | 2026-09-26 | gilt |
| OE-2609-15 | Vollständige Dossiers für M01–M07. | 2026-09-26 | gilt |
| OE-2609-17 | Modulkerne parallel mit höchstens zwei Läufen; M06 vor M05; Kreile-Anbindung seriell nach Grundstamm. | 2026-09-26 | gilt |
| OE-2609-20 | Dokumentartbezogene Aufbewahrung; Löschung/Anonymisierung nur vorgeschlagen und durch Admin freigegeben. | 2026-09-26 | gilt; Q-M06-003 geklärt |
| OE-2609-25 | Produktion im Kreile-eigenen Azure-Abo; Dev F0 nur synthetisch, Produktion S0 am Gate. | 2026-09-26 | gilt; Q-M06-001/-002 geklärt, Realisierungsgate offen |
| OE-2609-26 | Dringende Konflikte, Warnungen und Entscheidungen stehen je Zuständigkeit oben auf der Startseite. | 2026-09-26 | gilt für K-M06-001…006 |
| OP-09; Plan/Provider-Matrix | Provider, Datenschutz/AVV/EU, Betrieb und Kosten brauchen Owner-Gate; bis dahin grau/manuell. | 2026-09-26 | gilt; Gate offen |
| Mapping-Vertrag § FactDisposition | Jeder Fakt genau ASSIGNED, REFERENCE_ONLY, CONFLICT oder UNASSIGNED; sonst Lauf ungültig. | 2026-09-14 | gilt |
| Mapping-Vertrag § Confirmation | Keine automatische Mutation; 85 % ist nur Vorauswahl/Anzeige. | 2026-09-14 | gilt; ältere Auto-Lesart überholt |
| Mapping-Vertrag § Actions | Action-Key nur Vorschlag; Serverkatalog, separate Bestätigung, ein Kommando, Receipt/Readback. | 2026-09-14 | gilt |
| Azure-Testbeleg § Rechnung | Hohe Konfidenz schützt nicht vor vertauschten Absender-/Empfängerrollen. | 2026-09-14 | gilt als Risiko-/Testbeleg, kein Produktpass |
| V5 intakeModal | Titel/Leitfolge/Original zuerst/Review/Zuordnung sind Interaktionsanker. | 2026-09-14 | gilt als Anker, nicht als Modulmock |
| 04_SCHNITTSTELLEN_DATEN.md § Persistenz | Keine neue M06-Tabelle; vorhandene scan_uploads-Basis zuerst abgleichen. | 2026-09-26 | gilt als technische Ableitung; Schemaänderung braucht neues Gate |
| 04_SCHNITTSTELLEN_DATEN.md § Downstream | Suche/KI-Chat erhalten nur bestätigte, berechtigungsgefilterte Projektionen. | 2026-09-26 | gilt als technische Ableitung |

Keine Zeile ist eine Freigabe für Provideraktion, Migration, neue Abhängigkeit, Route, Adoption, Deployment, Merge oder Production.
