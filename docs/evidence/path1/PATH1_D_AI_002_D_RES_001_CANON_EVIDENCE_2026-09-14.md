# PATH1 D-AI-002 / D-RES-001 — Kanonisierungsbeleg 2026-09-14

Status: `REMOTE_CHECKPOINT_CANDIDATE_INDEPENDENT_REVIEW_PENDING_NO_PRODUCT_OR_PROVIDER_ACTIVATION`.

Dieser Beleg trennt den bindenden Ownervertrag strikt vom isolierten
Entwicklungsbeleg. Er steuert keinen Scope und behauptet weder Produkt-,
Provider-, UI- noch End-to-End-Lieferung.

## Bindende Ownerquellen

1. `C:\Users\Traube\Documents\Codex\2026-09-13\wie-sieht-es-derzeit-aus-mit\KREILE_OWNERENTSCHEID_APPWEITE_RETTUNGSLEINE_2026-09-14.md`
   - SHA-256: `A65EE598F06597AD74637C55D2634D8C13DD9B36E3DDB71A955E561FF1176108`
   - Vertrag: D-RES-001, appweite Fehlertransparenz und Rettungsleine.
2. `C:\Users\Traube\Documents\Codex\2026-09-13\wie-sieht-es-derzeit-aus-mit\KREILE_AI_MAPPING_TEST_CONTRACT_2026-09-14.md`
   - SHA-256: `160EF535570CD49692187E9A5F1551044B8FCD6E2FF91D3932D65F2D432EAF62`
   - Vertrag und isolierter Testbeleg für D-AI-002.

Beide Dateien wurden vor der Kanonisierung vollständig gelesen und gegen die
genannten Hashes geprüft. Sie bleiben Quellenbelege außerhalb des Repos und
sind nach der master-first-Aufnahme keine zweite Produktwahrheit.

## Master-first und Entscheidungsintegrität

Der bisherige Master war ein bytegenaues 252-Zeilen-Präfix der 360-zeiligen
Repo-Kopie. Die 108 bestätigten Zusatzzeilen mit D-UI-V5-001, D-ARCH-012 und
D-AI-001 wurden zuerst verlustfrei in den Master übernommen. Danach wurden
D-AI-002 und D-RES-001 im Master ergänzt und erst anschließend die Repo-Kopie
auf denselben vollständigen Inhalt gebracht.

- Master und Repo-Register: SHA-256
  `D1F37D64E34D6C209D03A198DE1439B8F37874530855472D5A8520D167692217`;
- byte-identisch: ja;
- D-UI-V5-001, D-ARCH-012, D-AI-001, D-AI-002 und D-RES-001 jeweils genau
  einmal;
- keine frühere Entscheidung wurde entfernt oder umgeschrieben.

## Kanonischer Querschnittsvertrag

D-AI-002 bindet getrennte Capture-/Provider-Ports für Dokument/Foto/PDF,
Freitext/Telefonnotiz, M365-Mail/Anhang und später Sprache an eine gemeinsame
providerneutrale Kette:

`SourceEnvelope -> FactLedger 1:1 -> EntityCandidates/ConflictSet -> actionKey-Vorschläge -> serverseitige Rechte/Preconditions -> menschliche Bestätigung -> bestehender sicherer Command -> Receipt/Readback`.

Original beziehungsweise unveränderlicher Snapshot werden vor Verarbeitung
privat, tenantgebunden, versioniert und mit Objekt-/Quellreferenz gesichert.
Jede `factId` besitzt genau eine Disposition
`ASSIGNED|REFERENCE_ONLY|CONFLICT|UNASSIGNED`; fehlende oder doppelte Fakten
invalidieren den gesamten Lauf. Modellvorschläge besitzen keine Autorität für
Labels, Rechte, Preconditions, Risiko oder Verfügbarkeit. Nur serverseitig
neu berechnete `AVAILABLE`-Aktionen dürfen nach menschlicher Bestätigung genau
einen bestehenden Command auslösen.

D-RES-001 bindet Quellenerhalt, verständliche Fehlerwirkung, sichere
Datenlage, kopierbare Correlation-ID, nächsten rollenrichtigen Weg und
Wiederaufnahme. Erfolg existiert nur nach Receipt und Fach-Readback. Ein
unklarer Ausgang bleibt `AUSGANG_UNGEKLÄRT` und verlangt zuerst Ist-Readback
statt blindem Retry. Es gibt keinen stillen Provider-/Modellwechsel, kein
Schattenmodul und keinen Error-Framework-Big-Bang.

Beide Entscheidungen aktivieren keine Tabelle, Route, kein Modul, Secret,
Runtime-Paket, Auth-/Rollenmodell, keinen neuen Schreibweg und keinen Provider.
Der Status bleibt `ISOLATED_DEV_CAPABILITY_PARTIAL`.

## Isolierter Entwicklungsbeleg — kein Produkt-E2E

- Azure Document Intelligence F0: realer isolierter
  3-Bildseiten-/Layout-Beleg. Layout, Text, Tabellen, Key-Value-Paare,
  Drehung und Handschrift wurden technisch erkannt; die generische Semantik
  verwechselte beim Versandbeleg Absender und möglichen Kunden. Deshalb darf
  generische Semantik nie direkt Fachfelder schreiben.
- Foundry/Azure OpenAI `gpt-5-mini`, Version `2025-08-07`, Deployment
  `GlobalStandard` Kapazität 1, Responses API und strikte Structured Outputs:
  Der erste Fact-Lauf verlor eine explizit vorhandene Tatsache und ist FAIL.
  Der verschärfte Lauf lieferte 24/24 `factId`s genau einmal,
  `requiresHumanConfirmation=true`, `writeAllowed=false` und verbrauchte
  3.232 Tokens.
- Der Aktionslauf verwendete ausschließlich Katalog-IDs. Er verbrauchte 647
  Input- plus 820 Output-Tokens, insgesamt 1.467 Tokens; nicht erfüllte
  Customer-/Order-/Payment-/Calendar-Preconditions blieben blockiert.
- Erfolgreiche Foundry-Läufe insgesamt: 7.247 Tokens. Zwei Aufrufe wurden
  während der Netzumschaltung mit HTTP 403 fail-closed abgewiesen und
  erzeugten keine Modellantwort.
- An Foundry gingen ausschließlich pseudonymisierte OCR-Fakten. Es wurden
  keine Originalbilder und keine echten Namen, Adressen, Beleg-, Konto-,
  Tracking- oder Zahlungsreferenzen übertragen.
- Nach dem Test war der Netzwerkzugriff deaktiviert. Dieser isolierte Beleg
  ist kein aktivierter Provider-, Secret-, Runtime- oder Produktpfad.

## Ehrlicher Repo-Iststand

- `src/components/telefonnotiz/TelefonnotizDesktop.tsx` rendert ausschließlich
  `FoundationUnavailable`; `src/app/actions/analyzePhoneNote.ts` gibt `null`
  zurück.
- `src/lib/localPhoneAnalysis.ts` verwendet leere lokale
  `MockCustomer`-/`MockOrder`-Listen und besitzt keinen realen Read-Port.
- Freitext-Kundenerkennung und Scan→Order bleiben fail-closed
  `NOT_AVAILABLE` beziehungsweise `CONFLICT`.
- Der Legacy-Adapter `src/lib/ocr/GeminiProvider.ts` überträgt Base64 direkt
  an das Provider-SDK und besitzt weder Originalreferenz noch lückenloses
  FactLedger. Er bleibt `LEGACY_QUARANTINE_SUPERSEDED`.
- Nichts davon wurde reaktiviert, umverdrahtet oder als geliefert markiert.

## Gebundene Querschnittsakzeptanz

Jede später berührte vertikale Einheit injiziert Fehler an ihren realen
Nähten und belegt:

- 0 Quellen-/Snapshotverlust;
- 0 Fehler ohne Correlation-ID und nachvollziehbaren Endstatus;
- 0 UI-Erfolg ohne Command-Receipt plus fachlichen Readback;
- 0 Doppelmutation bei Retry, Reload, Doppelklick oder Dublette;
- 0 unmarkierte Teilwahrheit und 0 stillen Provider-/Modellwechsel;
- 100 Prozent Wiederauffindbarkeit zuvor serverseitig gesicherter offener
  Fälle nach Login/Reload;
- für jeden blockierten Fall eine verständliche nächste Handlung oder
  zuständige Rolle.

Die vertikale Reihenfolge bleibt: Customer/KV/Order plus neue Shell, danach
Suche, Wareneingang/Capture und zuletzt reale M365-/OCR-/KI-Pfade. Der nächste
Produktbau bleibt `GLOBAL_PLUS_MANUAL_CUSTOMER_QUOTE_ORDER`.

## Lokale Kanonisierungsabnahme

- Authority-Selftest: 2 gültige Zustände und 27/27 Negativfälle PASS;
- Authority-Repo-Check: 7 Wahrheitsarten und 4 UI-Referenzen PASS;
- Modul-Gates: PASS, alle Nähte halten;
- No-Fake: PASS, Pages 76/76, APIs 19/19, Actions 51/51, KPI 7/7,
  produktiv erreichbare Mocks 0 und unregistrierte sichtbare Capabilities 0;
- Doc-Truth-Selftest: 5 negative und 5 positive Fixtures PASS;
- Doc-Truth-Repo-Check: PASS;
- YAML/JSON-Parse, Quell-/Link-/Pfadprüfung und `git diff --check`: PASS;
- Repo-Scope: exakt sechs freigegebene Pfade; zusätzlich ausschließlich der
  autorisierte externe Master.
