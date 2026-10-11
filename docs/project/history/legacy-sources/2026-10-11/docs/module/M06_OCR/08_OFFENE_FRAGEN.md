<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Offene Fragen und sichere Zwischenzustände M06

## Regel

Frühere Antworten wurden zuerst in Owner-Entscheidungen, Vorwissenliste, Digest, Plan, Kanon und Arbeitsordner gesucht. Bereits beantwortete Punkte werden nicht erneut gefragt. Jede verbleibende Lücke hat eine Empfehlung, eine Zuständigkeit und einen verbindlichen sicheren Zustand „bis dahin in der App“. Nach Anleitung §8 verhindern so abgesicherte externe Gates den Dossierstatus `BAUBEREIT` nicht; gebaut oder angebunden wird der betroffene Teil erst nach Schließen seines Gates.

| Q-ID | Frage | Optionen | Empfehlung | wer klärt (Owner/PL/Designphase) | bis dahin in der App | Status | gesucht in |
|---|---|---|---|---|---|---|---|
| Q-M06-001 | Wem gehört die Produktionsumgebung für Azure Document Intelligence und welcher Tarif gilt? | A: Kreile-eigenes Azure-Abo, S0; B: vorhandene F0-Dev-Ressource als Produktion | A gemäß Owner-Entscheidung | Owner + PL | Dokumentendienst `In Klärung`; kein Produktionstraffic; manueller Pfad | GEKLÄRT – OE-2609-25 vom 2026-09-26; reale Anlage/Freigabe bleibt Q-M06-004 | OE-2609-25; `HINWEIS_OWNER_OE-2609-25.md`; OP-09 |
| Q-M06-002 | Darf die vorhandene F0-Dev-Ressource mit produktiven Kreile-Dokumenten genutzt werden? | A: nein, nur gekennzeichnete synthetische Tests; B: ja | A gemäß Owner-Entscheidung | Owner + PL | keine Echtdaten im Dev-Provider; Dokumentendienst `In Klärung`; manueller Pfad | GEKLÄRT – OE-2609-25 vom 2026-09-26; Dev-E2E wird im Kreile-Tenant wiederholt | OE-2609-25; `HINWEIS_OWNER_OE-2609-25.md`; Provider-Matrix |
| Q-M06-003 | Welche Aufbewahrungs-/Löschregel gilt für Produktoriginal, Arbeitskopien, bestätigte Fakten und Auditbelege? | A: dokumentartbezogene Fristen aus OE-2609-20, danach Personenbezug entfernen; Löschung/Anonymisierung nur als Vorschlag mit Admin-Freigabe; B: stille oder pauschale Löschung | A gemäß Owner-Entscheidung | Owner + Datenschutz/Fachverantwortung | keine stille Löschung; Hostfrist und Adminfreigabe sind Pflicht; bei fehlender Zuordnung `In Klärung` | GEKLÄRT – OE-2609-20 vom 2026-09-26; Steuerberater-/Datenschutzbestätigung bleibt externes Vor-Livegang-Gate | OE-2609-20; `HINWEIS_OWNER_OE-2609-20.md`; OP-13 |
| Q-M06-004 | Sind Kreile-Azure-Abo/S0, DPA/AVV, zulässige Dokumentklassen, Region, Netzwerk, Kostenbudget, RBAC und Löschbeleg für Produktion nachweislich eingerichtet und freigegeben? | A: vollständiger Gatebeleg liegt vor; B: Provider bleibt aus | A erst nach vollständigem G-M06-003/005-Beleg | Owner + Datenschutz/Vertrag + PL/technische Administration | Kachel und Analyse `In Klärung`; keine Datenübertragung; `Manuell fortsetzen` | OFFEN – externes Provider-/Owner-Gate; blockiert Providertraffic, nicht `BAUBEREIT` | OE-2609-25; OP-09; Provider-Matrix; Microsoft-Primärquellen |
| Q-M06-005 | Ist der für die Mission maßgebliche Stand von `origin/main` durch den PL aktuell verifiziert? | A: PL bestätigt Ref und irrelevanten/keinen Diff; B: relevante Änderung erfordert Dossier-Nachlauf | PL prüft mit git-fähigem Zugang; im Sandbox-Nutzer wegen `dubious ownership` nicht erneut versuchen | PL/Repository-Governance | Element `In Klärung`, grau, nicht klickbar, keine Route; keine Repo-Adoption | OFFEN – externes Governance-Gate; blockiert keine Dossier-Baubereitschaft | Nutzerauftrag 2026-09-26; AGENTS.md; dokumentierter früherer Ref in Datei 09 |
| Q-M06-006 | Wo liegt das vor einer Repo-Mission verbindlich zu lesende `missions/MISSION_TEMPLATE.yml` im aktuellen `origin/main`? | A: PL weist aktuellen Pfad nach; B: Governance wird korrigiert | PL klärt vor einer Repo-Mission; keine Datei oder Regel erfinden | PL/Repository-Governance | Element `In Klärung`, grau, nicht klickbar, keine Route; keine Repo-Mission/Adoption | OFFEN – externes Governance-Gate; blockiert keine Dossier-Baubereitschaft | AGENTS.md; früher dokumentierter Ref in Datei 09 |
| Q-M06-007 | Reicht `scan_uploads` nach Baseline-/Drizzle-Abgleich für Ledger und Resume? | A: Mapping auf Bestand reicht; B: echte Schemaänderung nötig | A zuerst; bei B vor der konkreten Änderung genau eine Strukturentscheidung einholen | PL/Writer + unabhängiger Reviewer; bei B Owner | Persistenzadapter `In Aufbau`; keine Blindmigration, keine neue Tabelle, kein Live-Schreibweg | OFFEN – technische Bauprüfung; abgesichert, blockiert `BAUBEREIT` nicht | Produktionsbaseline; `src/db/schema.ts`; Scan-/OCR-Code; Path-1-Regeln |
| Q-M06-008 | Ist das dedizierte M06-Design aus Phase 1b für alle Geräte und Zustände freigegeben? | A: Design/Owner-UX PASS; B: Nacharbeit | A erst nach vollständiger Abnahme aus Datei 03/07 | Designphase + Owner | Grundstamm-Element `In Klärung`, grau, nicht klickbar, keine Route; keine Modulscreens | OFFEN – externes Designgate; blockiert Designumsetzung/Anbindung, nicht `BAUBEREIT` | Anleitung §8; Datei 03; T-M06-043…048 |
| Q-M06-009 | Haben Modulkandidat, Manifest/Handshake, Tests und unabhängiger read-only Review den Modulpass erreicht? | A: alle Nachweise PASS; B: Kandidat bleibt off-repo/gesperrt | A vollständig nach Datei 07 und G-M06-002 | PL + unabhängiger Reviewer | Grundstamm-Element `In Aufbau` erst bei begonnenem Bau, sonst `In Klärung`; immer grau, nicht klickbar, keine Route | OFFEN – externes Modul-/Reviewgate; blockiert Adoption, nicht `BAUBEREIT` | OE-2609-17; Anleitung §8/§9; Dateien 00, 07 und 11 |
| Q-M06-010 | Sind die Aufbewahrungswerte und die Zuordnung der M06-Dokumentarten durch Steuerberater und Datenschutz vor Livegang bestätigt? | A: Bestätigung und dokumentierte Zuordnung liegen vor; B: Lösch-/Anonymisierungsfunktion bleibt gesperrt | A vor Livegang; ohne Bestätigung keine Löschung/Anonymisierung | Owner + Steuerberater + Datenschutz/Fachverantwortung | Lösch-/Anonymisierungsaktion `In Klärung`, nicht ausführbar; Original und Belege bleiben erhalten | OFFEN – externes Vor-Livegang-Gate; blockiert Löschung, nicht `BAUBEREIT` | OE-2609-20; OP-13; `HINWEIS_OWNER_OE-2609-20.md` |

## Bereits beantwortet – nicht erneut fragen

| Thema | Antwort |
|---|---|
| Produktionsumgebung | Kreile-eigenes Azure-Abo, S0; tatsächliche Anlage/Freigabe am Gate. |
| Dev-Umgebung | vorhandene F0-Ressource nur für gekennzeichnete synthetische Tests; Dev-E2E vor Livegang im Kreile-Tenant wiederholen. |
| Aufbewahrung | dokumentartbezogene Fristen nach OE-2609-20; nie still löschen/anonymisieren, sondern Vorschlag + Admin-Freigabe. |
| Providerstrategie | Microsoft/Azure hinter Portgrenze; keine automatische Nutzungserlaubnis. |
| Menschliche Bestätigung | immer; nur Vorschläge. |
| 85-%-Schwelle | Vorauswahl/Markierung, keine automatische Mutation. |
| Cockpitzustand | grau, nicht klickbar, keine Route; aktuell `In Klärung`. |
| Bau- und Anbindungsreihenfolge | Kern parallel nach OE-2609-17, höchstens zwei Läufe und M06 vor M05; Kreile-Anbindung seriell nach Grundstamm. |
| Nutzerrollen | alle Personen Appzugang; Admin nur Administration/Sperren; fachliche Konflikte Rolf/Phillip. |
| Konfliktanzeige | dringende Konflikte, Warnungen und Entscheidungen je Zuständigkeit oben auf der Startseite. |
| Original | vor OCR/Zuordnung sichern und unverändert erhalten. |
| Fallback | kein stiller Fallback; manueller Pfad sichtbar. |
| Gemini/Klippa/Mock | Quarantäne, keine Produktfunktion. |

## Schließkriterium für den Dossierstatus

Alle fachlichen Entscheidungen, die ein fremder Builder für den M06-Kern benötigt, sind getroffen. Q-M06-004 bis Q-M06-010 sind externe Provider-, Governance-, Design-, Mapping-, Review-, Adoptions- oder Vor-Livegang-Gates mit Zuständigkeit und fail-closed App-Zustand. Sie verhindern nach Anleitung §7 Punkt 13 und §8 den Dossierstatus `BAUBEREIT` nicht. Eine echte Schemaänderung aus Q-M06-007 wäre eine neue dauerhafte Strukturentscheidung; erst vor dieser konkreten Änderung ist anzuhalten.
