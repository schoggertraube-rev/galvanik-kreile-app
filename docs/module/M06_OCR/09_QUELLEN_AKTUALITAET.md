<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Quellen und Aktualität M06

## Prüfzeitpunkt und Hashregeln

- Prüfzeitpunkt: **2026-09-26**, Zeitzone Europe/Berlin.
- Lokale Dateien: SHA-256 über die gelesenen Bytes.
- `origin/main`-Dateien: historischer Git-Blob-SHA-1 des im Erstlauf dokumentierten Refs `21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`; Datum ist der dort dokumentierte letzte Commit dieser Datei. Die aktuelle Remote-Frische klärt Q-M06-005 durch den PL.
- Webquellen: Abruf über die Web-Suche am 2026-09-26. Die Shell hatte keinen Netzwerkzugriff und konnte deshalb keinen reproduzierbaren Byte-Snapshot hashen. Es wird bewusst **kein falscher SHA** angegeben; URL, Abrufdatum und Inhaltspunkt sind dokumentiert.
- Im Nachlauf wurde Git gemäß Nutzerauftrag nicht erneut aufgerufen: Der Sandbox-Nutzer kann das Repository wegen `dubious ownership` nicht verlässlich lesen. Q-M06-005 weist die aktuelle Verifikation ausschließlich dem PL zu; der Worktree bleibt unangetastet.

## Verbindliches Quellenregister

| Pfad | Datum | SHA-256 (12) | Status | ersetzt durch |
|---|---|---|---|---|
| `../00_ANLEITUNG_MODULDOSSIER.md` | 2026-09-26 | `893D264A026A` | GÜLTIG | Version 1.1 einschließlich §7 Punkt 13 und §8 Abgrenzung |
| `../00_PROJEKT/QUELLEN/00_QUELLENREGISTER.md` | 2026-09-26 | `23640B17DC55` | GÜLTIG | — |
| `../00_PROJEKT/REDTEAM_BUILDER_2026-09-26.md` | 2026-09-26 | `4369457A4C5A` | GÜLTIG | — |
| `../00_PROJEKT/PLAN_JETZT_BIS_LIVEGANG_2026-09-25.md` | 2026-09-26 | `30AC8172CE0B` | GÜLTIG | — |
| `../00_PROJEKT/00_OFFENE_PUNKTE_KREILE.md` | 2026-09-26 | `02E14050B37C` | GÜLTIG | — |
| `../00_PROJEKT/OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` | 2026-09-26 | `F04B248EE23D` | GÜLTIG | OE-2609-01…27; für M06 insbesondere -17, -20, -25, -26 |
| `../00_PROJEKT/QUELLEN/PRIOR_QUELLEN_EINDEUTIG.md` | 2026-09-26 | `F46163CD3576` | GÜLTIG | — |
| `HINWEIS_TRENNUNG_2026-09-26.md` | 2026-09-26 | `29F15E29DD04` | GÜLTIG | Kreile-only; Übertragbarkeit nur als app-neutraler Kern + Grund |
| `HINWEIS_OWNER_OE-2609-20.md` | 2026-09-26 | `69BCAFAB1362` | GÜLTIG | klärt Q-M06-003 |
| `HINWEIS_OWNER_OE-2609-25.md` | 2026-09-26 | `2D744871DCA8` | GÜLTIG | klärt Q-M06-001/-002; Realisierung bleibt externes Gate |
| `../00_PROJEKT/QUELLEN/KREILE_MODUL_MINDMAP_2026-08-15.pdf` | 2026-08-15 | `80051E940E72` | GÜLTIG | als Strukturbild; neuere Owner-/Kanonquellen präzisieren |
| `../00_PROJEKT/QUELLEN/KREILE_MODUL_MINDMAP_V2_2026-08-15.html` | 2026-08-15 | `B792DEF27F89` | GÜLTIG | lesbare Quelldatei zur PDF |
| `C:/Users/Traube/Downloads/kreile-modul-mindmap.pdf` | 2026-09-26 | `80051E940E72` | DUPLIKAT | Ablagekopie im Projekt-Quellenordner |
| `C:/Users/Traube/Desktop/kreile-modul-mindmap.pdf` | 2026-09-06 | `52DEC8D8B5EE` | ÜBERHOLT | Projekt-Ablagekopie SHA `80051E940E72` |
| `origin/main:AGENTS.md` | 2026-09-10 | `7A5FBDBEAF29` | GÜLTIG | historischer Ref `21a23567…`; aktuelle Remote-Frische Q-M06-005 |
| `origin/main:docs/project/CURRENT_STATE.md` | 2026-09-10 | `C9B97F3AE164` | GÜLTIG | Ref `21a23567…`; Remote-Frische Q-M06-005 |
| `origin/main:docs/project/MASTERPLAN.md` | 2026-09-10 | `2E021EAEA22B` | GÜLTIG | Ref `21a23567…`; Remote-Frische Q-M06-005 |
| `origin/main:docs/project/DOCUMENT_AUTHORITY.md` | 2026-09-10 | `E1A5D571CCB5` | GÜLTIG | Ref `21a23567…`; Remote-Frische Q-M06-005 |
| `origin/main:docs/project/linie/MODULKARTE_KANON.md` | 2026-09-21 | `68FCCB2AB17E` | GÜLTIG | neuere Owner-Entscheidungen präzisieren Modulreihenfolge |
| `origin/main:docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` | 2026-09-21 | `96C91AB9210` | GÜLTIG | maßgebliche Registerkopie plus D-UI-V5-003 |
| `../../00_BIBEL/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` | 2026-09-21 | `10122CDBB5F2` | ÜBERHOLT | Repo-Kopie SHA `96C91AB9210` plus D-UI-V5-003 |
| `origin/main:docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md` | 2026-09-15 | `7421775EA5E5` | GÜLTIG | — |
| `origin/main:docs/project/PROVIDER_CAPABILITY_MATRIX.md` | 2026-09-17 | `E11916D8E4D8` | GÜLTIG | — |
| `origin/main:docs/project/linie/ui/00_UI_REFERENZ_KANONISCH.md` | 2026-09-10 | `5AD0F70AB796` | GÜLTIG | — |
| `origin/main:docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` | 2026-09-14 | `75258FF3BD4C` | GÜLTIG | UI-Anker; kein M06-Modulmock |
| `02_app/Claude outputs/KREILE_GESAMTMOCK_V6_2026-09-14.html` | 2026-09-14 | `C35FB3DFCFAF` | VERWORFEN | V5 SHA `75258FF3BD4C` |
| `origin/main:src/app/actions/ocr.actions.ts` | 2026-08-10 | `3DE3C2ACFF6E` | GÜLTIG | Ist-Beleg: fail closed/NOT_AVAILABLE, keine Produktfunktion |
| `origin/main:src/app/api/erfassung/scan-upload/route.ts` | 2026-08-10 | `C2B1B792FD51` | GÜLTIG | Ist-Beleg: Quarantäne/503 |
| `origin/main:src/db/schema.ts` | 2026-08-11 | `5A581DFAEC15` | GÜLTIG | Ist-Beleg mit Drift-Risiko zur Baseline |
| `origin/main:supabase/migrations/20260805180624_production_schema_baseline.sql` | 2026-08-07 | `C472A4C8E436` | GÜLTIG | bestehende Schemawahrheit im Ref |
| `C:/Users/Traube/AppData/Local/Temp/kreile_digest/OCR_01a0b07f.md` | 2026-09-26 | `365D4F2BD74D` | GÜLTIG | unterstützend; Kanon/Owner gehen vor |
| `…/KREILE_AZURE_COST_AND_DOCUMENT_AI_RECEIPT_2026-09-14.md` | 2026-09-14 | `E0C6FB9D8651` | GÜLTIG | isolierter Testbeleg, kein Produktpass |
| `…/KREILE_AI_MAPPING_TEST_CONTRACT_2026-09-14.md` | 2026-09-14 | `160EF535570C` | GÜLTIG | Sicherheits-/Mappingvertrag |
| `…/KREILE_OWNERENTSCHEID_APPWEITE_RETTUNGSLEINE_2026-09-14.md` | 2026-09-14 | `A65EE598F065` | GÜLTIG | durch Kanon bestätigt |
| `02_app/Claude outputs/KREILE_ANFORDERUNGEN_OCR_SUCHE_KI_2026-09-14.md` | 2026-09-14 | `A6DEA24DC71E` | GÜLTIG | unterstützend; neuere Verträge verschärfen |

`…` steht für `C:/Users/Traube/Documents/Codex/2026-09-13/wie-sieht-es-derzeit-aus-mit/`. Webquellen stehen wegen des transparenten Hash-Limits separat weiter unten; sie werden nicht mit einem erfundenen SHA in diese Tabelle aufgenommen.

## Quellenhierarchie

1. Verbindliches `origin/main`: Projektsteuerung, Authority, Kanon, Architektur, Provider-Matrix, UI; aktuelle Lesbarkeit/Remote-Frische als PL-Gate Q-M06-005.
2. Neuere Owner-Entscheidungen, gültige M06-Hinweise, Plan, offene Punkte und Dossieranleitung im Projektordner.
3. Bestätigte Test-/Vertragsbelege im Arbeitsordner.
4. Digest und Anforderungskompilation nur unterstützend; nie allein gegen Kanon/Owner.
5. Microsoft-Primärquellen nur für zeitabhängige Produktfähigkeit, Limits, Sicherheit und Preis; keine interne Produktentscheidung.

Die Nutzerangabe „Anleitung Version 1.0“ weicht von der tatsächlich gelesenen Datei ab. Die Datei ist **Version 1.1, Stand 2026-09-26** und enthält die engere Regel „erst Vorwissen suchen, dann fragen“; deshalb wurde Version 1.1 angewendet.

## Projekt- und Ownerquellen

| Quelle | Datum | SHA / Typ | Aktualitätsurteil | Verwendung / Konfliktbehandlung |
|---|---|---|---|---|
| `../00_ANLEITUNG_MODULDOSSIER.md` | 2026-09-26 | SHA-256 `893D264A026A23D5095D2FA02840B40F413CA525A83FFD91B1B1B24C7295E0B5` | **aktuell**, Version 1.1 | Dateisatz, IDs, Zustände, Checkliste, Fragenregel sowie §7 Punkt 13/§8 Abgrenzung. |
| `../00_PROJEKT/REDTEAM_BUILDER_2026-09-26.md` | 2026-09-26 | SHA-256 `4369457A4C5AA354598732BCF786883B7C4C1BEB6FB966F0470C1E22B25F63BC` | **aktuell** | RT-22/23/24/31. |
| `../00_PROJEKT/PLAN_JETZT_BIS_LIVEGANG_2026-09-25.md` | 2026-09-26 | SHA-256 `30AC8172CE0B4858BBE3B5319012B9803A6316EACEB0648AADD44BA00B2BFD5A` | **aktuell** | Modulreihenfolge, Phase 1b, Gates, Providerstatus. |
| `../00_PROJEKT/00_OFFENE_PUNKTE_KREILE.md` | 2026-09-26 | SHA-256 `02E14050B37C183D9C08B50B8FD520FC5B5436A4571BFC41B2231EC8E72850E7` | **aktuell** | OP-01, OP-09, OP-26. |
| `../00_PROJEKT/OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` | 2026-09-26 | SHA-256 `F04B248EE23DF6782A0AE3D6C47C14804EE94DCC662DD8C66622904A620E5DF6` | **aktuell und bindend** | OE-2609-01…27; für M06 insbesondere -17, -20, -25 und -26. |
| `../00_PROJEKT/QUELLEN/PRIOR_QUELLEN_EINDEUTIG.md` | 2026-09-26 | SHA-256 `F46163CD3576D83446F50FB1541635AB007F1F8DB5B696094454178B4E8F643B` | **aktuell als Quellenwegweiser** | Vorwissen zuerst; belegt Quelle/HTML zum Mindmap-PDF. |
| `HINWEIS_TRENNUNG_2026-09-26.md` | 2026-09-26 | SHA-256 `29F15E29DD04397F6956948CD51392070AE39E5B7CADC13F060D44F338FC6E60` | **aktuell und bindend** | Dossier nur Kreile; Übertragbarkeit auf app-neutralen Kern + Grund begrenzen. |
| `HINWEIS_OWNER_OE-2609-20.md` | 2026-09-26 | SHA-256 `69BCAFAB13620520B6A4E73FC4C9E3F380E972AEDA2A90DF726C72B8EFFD91F1` | **aktuell und bindend** | Aufbewahrung/Löschung; Q-M06-003 geklärt. |
| `HINWEIS_OWNER_OE-2609-25.md` | 2026-09-26 | SHA-256 `2D744871DCA89A63EE34A6499685956DB52251F3D7E633C54DFB2F8C6BC8E91E` | **aktuell und bindend** | Produktions-/Dev-Umgebung; Q-M06-001/-002 geklärt. |
| `../00_PROJEKT/QUELLEN/KREILE_MODUL_MINDMAP_2026-08-15.pdf` | Inhalt 2026-08-15; Datei 2026-09-26 | SHA-256 `80051E940E7216E49C519E28EBDAB25AF3E1572D8576A2E281D2F3ECF788487A` | **historische Fachquelle** | Original vor OCR, Mensch bestätigt, manuell möglich. PDF-Binärcode/Hash geprüft; mangels PDF-Renderer nicht visuell inspiziert. Inhalt über benannte HTML-Quelle geprüft. |
| `../00_PROJEKT/QUELLEN/KREILE_MODUL_MINDMAP_V2_2026-08-15.html` | Inhalt 2026-08-15; Datei 2026-09-05 | SHA-256 `B792DEF27F8922825BC7270FECA44E80AD295D1EC79E00B0C15414BB294BB988` | **historische, lesbare Quellfassung** | Inhaltliche Prüfung der Mindmap; bei Konflikt gewinnen neuere Owner-/Kanonquellen. |

## Repositoryquellen aus `origin/main`

| Quelle | letzter Commit | Git-Blob-SHA-1 | Aktualitätsurteil | Verwendung |
|---|---|---|---|---|
| `AGENTS.md` | 2026-09-10 | `51431999fde1d1a0cad33b7c8106b180440cf3f0` | verbindlich im historisch geprüften Ref; aktuelle Remote-Frische Q-M06-005 | Liefer-, Gate-, Original-, Modul- und Sicherheitsregeln. |
| `docs/project/CURRENT_STATE.md` | 2026-09-10 | `dbdc661865adf38eeb1992dd278f3b1493972ee8` | verbindlich im geprüften Ref | M06 nicht gebaut; Ground-Stem-/Originalprinzip. |
| `docs/project/MASTERPLAN.md` | 2026-09-10 | `56fc85dae6fef954c4e87e4a892ee9085806da37` | verbindlich im geprüften Ref | Capture/OCR-Review und Confidenceprinzip. |
| `docs/project/DOCUMENT_AUTHORITY.md` | 2026-09-10 | `9cb1081404e2f2ebe1250c3b54dbae02b7e1a76c` | verbindlich im geprüften Ref | Quellenhierarchie. |
| `docs/project/linie/MODULKARTE_KANON.md` | 2026-09-21 | `1b9702787877eb634a9a65e146eaef0829004546` | neueste kanonische Modulkarte im Ref | D-ARCH-012/D-AI/D-RES, Providerport, Quarantäne. Ältere „entfällt“-Planung wird durch Owner vom 2026-09-25 und 2026-09-26 ersetzt. |
| `docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` | 2026-09-21 | `b7493111452eeb170cb3d5576db29a3c286c0104` | laut Auftrag geltende Kopie | D-ARCH-012, D-AI-001/002, D-RES-001; zusammen mit D-UI-V5-003. Abweichende Masterkopie nicht als Wahrheit genutzt. |
| `docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md` | 2026-09-15 | `68da5bab89a31900369ea9eb2e51ae146282a5a9` | aktuell im Ref | Modulgrenzen, öffentliche Ports, Manifest/Handshake, keine Schattenwahrheit. |
| `docs/project/PROVIDER_CAPABILITY_MATRIX.md` | 2026-09-17 | `7a511076d2396f15ec0c34c1f8e0f88373a6bb07` | aktuell im Ref | Azure `PLANNED_BLOCKED...`, Testbefund, Gemini/Klippa/Mock-Quarantäne. |
| `docs/project/linie/ui/00_UI_REFERENZ_KANONISCH.md` | 2026-09-10 | `113a60e54a978fe7c4797fcc5610e4a7c9f08d96` | aktuell im Ref | benennt V5 als UI-Referenz. Lokale Datei SHA-256 `5AD0F70AB7968EB1CA8E87F8B1898A136472725A39B48523CD83B3A4DC295DB9`. |
| `docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` | 2026-09-14 | `11f20f88f8a4add2a2bedf95f1d0e59b20643ef0` | aktueller UI-Anker im Ref | Aufnahmefolge und Wortlaut; kein dediziertes M06-Mock. Lokale SHA-256 `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`. |
| `src/app/actions/ocr.actions.ts` | 2026-08-10 | `a24080d91a8880c004c59f6e2748fe70d669920f` | Ist-Code, absichtlich gesperrt | `NOT_AVAILABLE`, keine Funktion. |
| `src/app/api/erfassung/scan-upload/route.ts` | 2026-08-10 | `65ef1acc9d8a132bd4fd0d10c205e77e042846f9` | Ist-Code, absichtlich gesperrt | 503/fail closed. |
| `src/db/schema.ts` | 2026-08-11 | `f9ce97a6562d986bc914be0e2f51a30eec03d8ea` | Ist-Code mit Drift-Risiko | Teilabbildung `scan_uploads`. |
| `supabase/migrations/20260805180624_production_schema_baseline.sql` | 2026-08-07 | `2814482abe198700160800e0f8b504a38de2f079` | autoritative bestehende Baseline im Ref | vollständigerer `scan_uploads`-Bestand; lokale SHA-256 `C472A4C8E436817BE44673EC393D6A1308644BD67BABB8AA7B227C4FF7E999E2`. |
| `missions/MISSION_TEMPLATE.yml` | — | **FEHLT im historisch geprüften Ref** | externes Governance-Gate | Q-M06-006; vor Repo-Mission durch PL nachzuweisen, kein Dossierblocker. |

## Arbeits-, Digest- und Anforderungsquellen

| Quelle | Datum | SHA-256 | Urteil | Verwendung |
|---|---|---|---|---|
| `C:/Users/Traube/AppData/Local/Temp/kreile_digest/OCR_01a0b07f.md` | 2026-09-26 | `365D4F2BD74D259B89A32AD309971F5963F63548FF234EE0DE6F06AE442FF077` | aktuell zur benannten Session, aber nicht kanonisch | universelle Erfassung, Cheap-first, FactLedger, Isolation; nur bei Bestätigung durch höhere Quellen. |
| `…/wie-sieht-es-derzeit-aus-mit/KREILE_AZURE_COST_AND_DOCUMENT_AI_RECEIPT_2026-09-14.md` | 2026-09-14 | `E0C6FB9D8651326F8D6F472F146D140456D403AAAB1795FFF1AF238176BC6917` | belastbarer isolierter Testbeleg, kein Produktpass | Ressource/Region/Tarif/Auth, Layoutwerte, Rechnungsrollenfehler. |
| `…/KREILE_AI_MAPPING_TEST_CONTRACT_2026-09-14.md` | 2026-09-14 | `160EF535570CD49692187E9A5F1551044B8FCD6E2FF91D3932D65F2D432EAF62` | aktueller Sicherheits-/Mappingbeleg | Faktendisposition, keine Autoaktion, Command/Receipt/Readback, 85-%-Konfliktauflösung. |
| `…/KREILE_OWNERENTSCHEID_APPWEITE_RETTUNGSLEINE_2026-09-14.md` | 2026-09-14 | `A65EE598F06597AD74637C55D2634D8C13DD9B36E3DDB71A955E561FF1176108` | bestätigte, inzwischen kanonisierte Rettungsleine | kein Informationsverlust/Fake-Erfolg; Wiederaufnahme. |
| `02_app/Claude outputs/KREILE_ANFORDERUNGEN_OCR_SUCHE_KI_2026-09-14.md` | 2026-09-14 | `A6DEA24DC71E7FCD289F0E3651BC9DD6B87D032F2A7D8FCC2E2EBD730B4B4BAC` | unterstützende Kompilation, nicht `origin/main`-Kanon | Felder, Kamera/Datei, Kandidatenlogik, Schwellen; durch neuere Verträge verschärft. |

`…` steht in dieser Tabelle für `C:/Users/Traube/Documents/Codex/2026-09-13/wie-sieht-es-derzeit-aus-mit/`.

## Externe Microsoft-Primärquellen, aktuell geprüft

| URL | Abruf / Seitenstand | Inhaltsprüfung | SHA |
|---|---|---|---|
| https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits?preserve-view=true&view=doc-intel-4.0.0 | abgerufen 2026-09-26; v4.0 GA | Formate; F0 1 Analyze/s, 4 MB, 2 Seiten; Office-Unterstützung modellabhängig | nicht verfügbar – dynamische Webquelle, Shell-Netz blockiert |
| https://azure.microsoft.com/en-us/pricing/details/document-intelligence/ | abgerufen 2026-09-26 | F0: 0–500 Seiten/Monat kostenlos; Preis ist dynamisch und wird nicht als Festbetrag spezifiziert | nicht verfügbar – dynamische Webquelle |
| https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/document-intelligence/data-privacy-security | abgerufen 2026-09-26 | gleiche Region, HTTPS, temporär verschlüsselte Speicherung, automatische Löschung nach 24 h, frühere Delete-Operation | nicht verfügbar – dynamische Webquelle |
| https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/authentication/encrypt-data-at-rest?view=doc-intel-4.0.0 | abgerufen 2026-09-26 | Verschlüsselung at rest standardmäßig, CMK optional, 24-h-Analyseantwort | nicht verfügbar – dynamische Webquelle |
| https://learn.microsoft.com/en-us/azure/ai-services/disable-local-auth | abgerufen 2026-09-26 | Entra-Authentifizierung und Abschalten lokaler Authentifizierung | nicht verfügbar – dynamische Webquelle |
| https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/authentication/managed-identities?view=doc-intel-4.0.0 | Seite aktualisiert 2026-04-21; abgerufen 2026-09-26 | system-assigned Managed Identity/RBAC, Storage Blob Data Reader; keine Credentialverwaltung im Code | nicht verfügbar – dynamische Webquelle |
| https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/document-intelligence/transparency-note | abgerufen 2026-09-26 | Konfidenz 0…1, eigene Evaluation, Datenschutz-/Rechtsprüfung und Human-in-the-loop empfohlen | nicht verfügbar – dynamische Webquelle |
| https://learn.microsoft.com/en-us/azure/reliability/regions-list | veröffentlicht ca. 2026-05; abgerufen 2026-09-26 | Germany West Central ist Azure-Region; beweist nicht allein die konkrete DI-Ressourcenkonfiguration | nicht verfügbar – dynamische Webquelle |

## Aktualitätsurteil

- **Fachliche Vollständigkeit:** gegeben; Anforderungen, Abläufe, UI-Soll, Ports, Regeln, Entscheidungen, Tests, offene Gates und Ist-Umbau sind spezifiziert.
- **Providerfakten:** am 2026-09-26 gegen Microsoft-Primärquellen aktualisiert; dynamische Angaben sind nicht hart als dauerhafte Produktwerte codiert.
- **Repo-Aktualität:** nur für den im Erstlauf dokumentierten Ref exakt; im Nachlauf wegen `dubious ownership` nicht erneut geprüft. Q-M06-005 weist die Verifikation dem PL zu.
- **Governance-Vollständigkeit:** `missions/MISSION_TEMPLATE.yml` fehlte im historisch geprüften Ref; Q-M06-006 weist Pfad-/Governanceklärung dem PL vor einer Repo-Mission zu.
- **Statusfolge nach Anleitung §8:** Beide Punkte sind externe Governance-Gates mit sicherem `In Klärung`-/Keine-Route-Zustand und verhindern `BAUBEREIT` nicht.
- **Folge:** Dossierstatus `BAUBEREIT`; Modul-, Provider-, Design- und Adoptionsstatus bleiben von ihren jeweiligen Gates abhängig.
