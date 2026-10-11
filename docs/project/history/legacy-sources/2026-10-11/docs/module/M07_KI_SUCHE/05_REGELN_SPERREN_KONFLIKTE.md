<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M07 KI-Suche — Regeln, Sperren und Konflikte

## 1. Sperren

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| S-M07-001 Modulschalter AUS oder Adoption nicht freigegeben | M07-Route, Evidenz- und Providerzugriff; G08 bleibt nutzbar | UI/Server | Anleitung §6; OE-2609-04/05 | SPEZ |
| S-M07-002 fehlende Session, Tenant- oder Personenberechtigung | Cross-Tenant-/Cross-Person-Datenzugriff und Client-Bypass | Server | D-AI-001; D-ARCH-012; OE-2609-09 | SPEZ |
| S-M07-003 deterministische Antwort ausreichend | unnötigen Modellaufruf und Kosten | Server | D-AI-001; Owner-Automation #85/#222 | SPEZ |
| S-M07-004 unvollständige, veraltete oder nicht autorisierte Evidenz | Faktbehauptung ohne tragfähige Quelle | Server | D-AI-001; `SearchCoverage`; D-RES-001 | SPEZ |
| S-M07-005 fehlende menschliche Bestätigung oder veraltete Vorbedingung | jede fachliche Mutation durch Modell/Vorschlag | UI/Server | D-AI-002; G01 Command/Receipt/Readback | SPEZ |
| S-M07-006 Budget, Rate-Limit oder Usage-Reservierung blockiert | kostenpflichtigen Provideraufruf ohne freies Kontingent | Server/DB | D-AI-001; vorhandene Usage-RPCs | SPEZ |
| S-M07-007 Timeout, offener Circuit oder Provider-Gate nicht vollständig | stilles Weiterlaufen, Wiederholungssturm oder Fallback | Server | D-ARCH-012; D-RES-001; OP-09 | SPEZ |
| S-M07-008 ungültiges Ausgabeschema, fehlende Citation oder unbekannte `actionKey` | Halluzination als Fakt oder frei formulierten Befehl | Server | D-AI-001/002 | SPEZ |
| S-M07-009 unbestätigter OCR-/Modellkandidat oder Prompt-Injection-Inhalt | Übernahme nichtkanonischer Fakten und Toolsteuerung aus Nutzinhalt | Server | D-AI-002; `KREILE_AI_MAPPING_TEST_CONTRACT_2026-09-14.md` | SPEZ |
| S-M07-010 Provider-/Secret-/Region-/AVV-Gate offen | Übertragung von Kreile-Daten an einen nicht freigegebenen Dienst | Server | D-ARCH-012; OP-09; Q-M07-008–010 | SPEZ |
| S-M07-011 ungültiger Kreile-Kontext | Daten-, Session-, Secret-, Konto- oder Ressourcenbezug außerhalb des serverseitig aufgelösten Tenants `galvanik-kreile` | Server | `HINWEIS_TRENNUNG_2026-09-26.md`; Anleitung §5 | SPEZ |

## 2. Konflikte

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-M07-001 | Zwei aktuelle Fachquellen widersprechen sich bei einem laufenden Auftrag. | unterschiedliche Werte/Versionen für dieselbe fachliche Aussage oder Readback ≠ Quelle | Phillip | Phillip-Startseite › oben: dringende Konflikte | Originalkarten öffnen, verantwortliche Fachquelle korrigieren, danach Frage neu ausführen; M07 legt keine Wahrheit fest. | SPEZ; G09-Anzeige noch zu bauen |
| K-M07-002 | G08 oder ein Evidenzport meldet truncated, veraltet, unvollständig oder nicht verfügbar. | `coverage.truncated`, fehlender Datenstand oder Portfehler | Phillip | Phillip-Startseite › oben: dringende Konflikte | Suchraum eingrenzen oder fehlende Fachquelle im Besitzer-Modul vervollständigen; bis dahin keine Vollständigkeitsbehauptung. | SPEZ; G09-Anzeige noch zu bauen |
| K-M07-003 | Person will eine vorgeschlagene Aktion ausführen, aber Berechtigung oder Vorbedingung fehlt. | Command-Describe/Precondition liefert Denial oder Versionskonflikt | Rolf | Rolf-Startseite › oben: dringende Konflikte | Rechte beziehungsweise fachliche Vorbedingung im Besitzer-Modul klären; keine Mutation, Vorschau verwerfen. | SPEZ; G09-Anzeige noch zu bauen |
| K-M07-004 | Command-Receipt und anschließender Readback widersprechen Vorschau oder Quelle. | erwarteter Zustand ≠ fachlicher Readback | Phillip | Phillip-Startseite › oben: dringende Konflikte | Besitzer-Modul und Originaldatensatz prüfen; M07 kennzeichnet Ergebnis als Konflikt und wiederholt nicht automatisch. | SPEZ; G09-Anzeige noch zu bauen |
| K-M07-005 | Providerstatus, Usage-Settlement, Budget oder Konfiguration bleibt nach Lauf unklar. | Timeout/uncertain, fehlendes Settlement, unbekannte Deployment-/Modellversion oder Circuit offen | Rolf | Rolf-Startseite › oben: dringende Konflikte | Providerlauf nicht als Erfolg werten, Budget/Usage und Audit per Korrelations-ID klären, Provider bis zur Klärung geschlossen halten. | SPEZ; G09-Anzeige noch zu bauen |

## 3. Verbindliche Auflösungsregeln

- Ein Konflikt wird nie durch Mehrheitswahl, Providertext oder stillen Fallback „gelöst“.
- Fachliche Korrektur erfolgt nur im Besitzer-Modul; M07 liest danach neu.
- Rolf verantwortet Organisations-, Rechte-, Budget- und Providerklärung; Phillip verantwortet operative Auftrags-/Werkstattdaten. Gregor unterstützt technisch, ist aber nach OE-2609-10 nicht primärer Empfänger fachlicher Konflikte.
- OE-2609-26 legt den Anzeigeort oben auf der zuständigen Startseite fest. G09 darf nur die konkrete Darstellung und den Erledigt-/Rückweg-Readback präzisieren. Bis dahin bleibt der Konflikt lokal sichtbar und die betroffene Antwort/Aktion gesperrt; es entsteht keine neue Route oder zweite Konfliktliste.
