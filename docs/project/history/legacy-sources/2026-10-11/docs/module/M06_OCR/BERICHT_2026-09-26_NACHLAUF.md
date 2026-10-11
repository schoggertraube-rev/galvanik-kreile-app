<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Bericht M06_OCR – Nachlauf

**Auftrag:** Kreile-only-Trennung, Übernahme der für M06 einschlägigen Owner-Entscheidungen OE-2609-17…26, Neubewertung externer Gates nach Anleitung §7 Punkt 13/§8 und Aktualisierung der Checkliste.

**Prüfstand:** 2026-09-26, Europe/Berlin.

## Ergebnis

Das Dossier beschreibt ausschließlich M06 für das Galvanik-Kreile WerkstattCockpit. Angaben zu anderen Apps wurden aus den Dossierdateien und dem historischen Erstbericht entfernt. Die Übertragbarkeit steht nur noch im Pflichtfeld des Steckbriefs und in `04_SCHNITTSTELLEN_DATEN.md`: **Kern app-neutral: ja**, weil die abstrakten Aufnahme-, Fakten-, Bestätigungs- und Receipt/Readback-Verträge frei von Kreile-Fachbegriffen bleiben und alle Kreile-spezifischen Ports, Regeln, Ressourcen und Konfigurationen im Kreile-HostAdapter liegen.

Für M06 sind aus OE-2609-17…26 unmittelbar einschlägig:

- OE-2609-17: paralleler Kernbau mit höchstens zwei Läufen, Abhängigkeit M06 vor M05, Kreile-Anbindung weiterhin seriell nach Grundstamm;
- OE-2609-20: dokumentartbezogene Aufbewahrung, keine stille Löschung/Anonymisierung, sondern Vorschlag und Admin-Freigabe;
- OE-2609-25: Produktionsumgebung im Kreile-eigenen Azure-Abo/S0, vorhandene F0-Dev-Ressource ausschließlich für synthetische Tests, Dev-E2E vor Livegang im Kreile-Tenant;
- OE-2609-26: dringende Konflikte, Warnungen und Entscheidungen je Zuständigkeit oben auf der Startseite.

OE-2609-18/-19 und OE-2609-21…24 betreffen M06 nicht unmittelbar und wurden daher nicht als M06-Regeln dupliziert.

Q-M06-001 bis Q-M06-003 sind durch OE-2609-25/-20 auf `GEKLÄRT` gesetzt. Die weiterhin offenen Q-M06-004 bis Q-M06-010 sind externe Provider-, Git-/Governance-, Mapping-, Design-, Review-, Adoptions- oder Vor-Livegang-Gates. Jede Frage nennt Zuständigkeit und einen fail-closed `In Klärung`-/`In Aufbau`-Zustand. Damit verhindern sie nach Anleitung §7 Punkt 13 und §8 den Dossierstatus `BAUBEREIT` nicht; der jeweils betroffene Bau-, Provider-, Lösch-/Anonymisierungs- oder Adoptionsschritt bleibt bis zur Gate-Schließung gesperrt.

Die aktuelle `origin/main`-Prüfung wurde gemäß Nutzerauftrag wegen `dubious ownership` im Sandbox-Nutzer nicht erneut versucht. Q-M06-005 weist sie dem PL mit git-fähigem Zugang zu. `02_app`, der off-repo-Kandidat und alle anderen Ordner blieben unverändert; es wurden weder Code noch Git-Status, Provider, Infrastruktur, Daten, Migrationen oder Secrets verändert.

## Änderungsliste

| Datei | ID | alt → neu | Grund |
|---|---|---|---|
| `00_STECKBRIEF.md` | Dossier-Status | `NICHT_BAUBEREIT` wegen Git/Mission-Template → `BAUBEREIT` | Anleitung §7 Punkt 13 und §8 trennen Dossierstatus von externen Gates. |
| `00_STECKBRIEF.md` | Anbindungszeitpunkt + Gate | sechstes Modul nach M01–M05 → Kern parallel, M06 vor M05; Kreile-Anbindung seriell | OE-2609-17. |
| `00_STECKBRIEF.md` | Übertragbarkeit | app-fremdes Status-/Ressourcenfeld → `Kern app-neutral: ja` + Grund | Trennungshinweis und neues Pflichtfeld der Anleitung. |
| `00_STECKBRIEF.md` | Builder-Einstieg | Git-/Mission-Template als formaler Dossierblocker → PL-Governance-Gate vor Repo-Mission | Externe Gate-Abgrenzung; kein erneuter Git-Versuch. |
| `01_ANFORDERUNGSKATALOG.md` | A-M06-038 | Anforderung für eine andere App → tenantgebundene, serverseitige Kreile-Providerkonfiguration | Dossier beschreibt nur Kreile; die fachliche ID bleibt als Kreile-Sicherheitsanforderung erhalten. |
| `01_ANFORDERUNGSKATALOG.md` | A-M06-043 | fehlte → dokumentartbezogene Aufbewahrung, keine stille Löschung | OE-2609-20. |
| `01_ANFORDERUNGSKATALOG.md` | A-M06-044 | fehlte → Kreile-eigenes Azure/S0, F0-Dev nur synthetisch, E2E im Kreile-Tenant | OE-2609-25. |
| `04_SCHNITTSTELLEN_DATEN.md` | Aufbewahrung und Löschung | Frist nur als offene Frage → Hostfristen 8/6 Jahre bzw. steuerliche Prüfbarkeit, Vorschlag + Admin-Freigabe | OE-2609-20 klärt Q-M06-003. |
| `04_SCHNITTSTELLEN_DATEN.md` | APIs/Provider | Produktionstarif/-eigentum offen → Kreile-eigenes Azure-Abo/S0 festgelegt; reale Anlage bleibt Gate | OE-2609-25. |
| `04_SCHNITTSTELLEN_DATEN.md` | Übertragbarkeit | konkreter zweiter Host mit Zielapp-Details → nur `Kern app-neutral: ja` + Grund | Trennungshinweis; keine Inhalte anderer Apps. |
| `05_REGELN_SPERREN_KONFLIKTE.md` | R-M06-019/-021/-023, S-M06-003 | allgemeines Providergate und app-fremde Isolation → Kreile-Produktionsgate, serverseitige Kreile-Konfiguration, keine stille Löschung | OE-2609-20/-25 und Kreile-only-Trennung. |
| `05_REGELN_SPERREN_KONFLIKTE.md` | K-M06-001…006 | Anzeige `Handlungsbedarf` → `Dringende Konflikte, Warnungen und Entscheidungen` je Zuständigkeit | OE-2609-26. |
| `05_REGELN_SPERREN_KONFLIKTE.md` | SK-M06-003/-008/-009 | sechste serielle Position/app-fremde Frage/F0 nur unbestimmt → paralleler Kern M06 vor M05, app-fremde Zeile entfernt, S0-Produktion/F0-Dev geklärt | OE-2609-17/-25 und Trennungshinweis. |
| `06_ENTSCHEIDUNGEN.md` | OE-Verweise | nur OE bis -15 und veraltete ID-Schreibweise → OE-2609-17/-20/-25/-26 mit Datum, IDs normalisiert | Owner-Entscheidungen nur als datierte Verweise übernehmen. |
| `06_ENTSCHEIDUNGEN.md` | app-fremder Q-Verweis | Verweis auf frühere Zielapp-Frage → entfernt | Dossier beschreibt nur Kreile. |
| `07_ABNAHME_TESTS.md` | T-M06-033/-055/-056 | offene Produktretention, keine Owner-Umgebungstests → Hostfrist/Adminfreigabe sowie F0-/S0-/Tenant-Gates testbar | A-M06-043/-044; OE-2609-20/-25. |
| `08_OFFENE_FRAGEN.md` | Q-M06-001/-002 | Produktionsumgebung und Tarif offen → `GEKLÄRT`: Kreile-Azure/S0, F0-Dev nur synthetisch | OE-2609-25 und gültiger Hinweis. |
| `08_OFFENE_FRAGEN.md` | Q-M06-003 | Aufbewahrung offen → `GEKLÄRT` mit dokumentartbezogenen Fristen und Adminfreigabe | OE-2609-20 und gültiger Hinweis. |
| `08_OFFENE_FRAGEN.md` | Q-M06-004 | app-fremde Ausbaufrage → externes Kreile-Provider-/Owner-Gate | Kreile-only-Trennung und §8-Gate-Abgrenzung. |
| `08_OFFENE_FRAGEN.md` | Q-M06-005/-006 | Git-Frische/Mission-Template blockierten `BAUBEREIT` → PL-Governance-Gates mit `In Klärung`, ohne Route | Nutzerauftrag sowie Anleitung §7 Punkt 13/§8. |
| `08_OFFENE_FRAGEN.md` | Q-M06-007…010 | nur Mappingfrage, kein vollständiges Gatebild → Mapping-, Design-, Modul-/Review- und Aufbewahrungs-Bestätigungsgate separat abgesichert | Alle externen Gates brauchen Zuständigkeit und sicheren App-Zustand. |
| `09_QUELLEN_AKTUALITAET.md` | Quellenregister | veraltete Anleitung-/Owner-Hashes und app-fremde Quellen → aktuelle Hashes für Anleitung, OE-Register und gültige Hinweise; app-fremde Quellen entfernt | Tatsächlich gelesene aktuelle Quellen; nichts erfinden. |
| `09_QUELLEN_AKTUALITAET.md` | Aktualitätsurteil | Git/Mission-Template → `NICHT_BAUBEREIT` → externe PL-Gates, Dossier `BAUBEREIT` | Anleitung §8; Git wegen `dubious ownership` nicht erneut versucht. |
| `10_CHECKLISTE.md` | Punkte 1–13 | 11/13, Punkte 9/13 negativ → 13/13 erfüllt | Quellen-/Gate-Abgrenzung korrigiert; alle offenen Fragen fail-closed abgesichert. |
| `11_IST_CODE_UMBAU.md` | Prüfstand/Umbausequenz | aktueller Git-Prüfstand und formale Freigabe vorausgesetzt → historischer Ref transparent, aktuelle Prüfung PL; Umsetzung je Gate | Nutzerauftrag und §8-Abgrenzung; kein Codezugriff im Nachlauf. |
| `BERICHT_2026-09-26.md` | historischer Erstbericht | app-fremde Inhalte ohne Ablösehinweis → app-fremde Inhalte entfernt, durch Nachlaufbericht als abgelöst markiert | Kreile-only-Dossier; Historie bleibt als Erstbewertung erkennbar. |
| `BERICHT_2026-09-26_NACHLAUF.md` | neu | fehlte → Nachlauf, Gate-Neubewertung und vollständige Änderungsliste | Ergebnisvorgabe des Auftrags. |

## Selbstprüfung

- `00` bis `11` und beide Berichte sind vorhanden; `02_FUNKTIONEN_ABLAEUFE.md` und `03_OPTIKVORLAGE.md` benötigten keine inhaltliche Änderung.
- Keine app-fremden Anforderungen oder Zielapp-Details verbleiben in `00` bis `11` oder im historischen Bericht.
- `06_ENTSCHEIDUNGEN.md` enthält nur Verweise mit Datum.
- `08_OFFENE_FRAGEN.md` enthält für jedes offene externe Gate Zuständigkeit und sicheren App-Zustand.
- `10_CHECKLISTE.md` bewertet alle 13 Punkte mit `✓`.
- M06 bleibt `HINTEN_ANGESTELLT`; `BAUBEREIT` beschreibt nur die Qualität des Dossiers, nicht Implementierung, Providerfreigabe, Adoption oder Livebetrieb.

DOSSIER-STATUS: BAUBEREIT
