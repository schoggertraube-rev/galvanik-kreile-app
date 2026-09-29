<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M05 — M365 Kommunikation

**Zweck:** M05 nimmt manuelle Telefonnotizen und überwachte eingehende E-Mails providerneutral als nachvollziehbare Kommunikationsfälle auf. Das Modul ordnet Quellen nach menschlicher Bestätigung einem Kunden zu, bereitet fachliche Aktionen und Antworten vor und übergibt bestätigte Änderungen ausschließlich über Ports an die besitzenden Module; es ist kein Outlook-Postfach und keine zweite Kunden-, Auftrags-, KV- oder Buchhaltungswahrheit.
**Stufe:** hinten angestellt
**Dossier-Status:** BAUBEREIT
**Modul-Status:** HINTEN_ANGESTELLT; off-repo `communication-intake-core-v1-candidate.2` ist nicht adoptiert, die Anbindungs- und externen Freigabegates sind offen
**Zuständige Session:** Modulchat M365, Session `01a0aa99`
**Arbeitsordner:** `C:\Users\Traube\Documents\Codex\2026-09-16\kreile-microsoft-365-integration`
**Code-Pfad:** off-repo `work/communication-intake-core-v1-candidate.2` · Artefaktset SHA-256 `DC26CD060439`; laut letzter read-only Inventur existierte kein adoptiertes M05-Modul, aktuelle Git-Frische siehe Q-M05-015
**Braucht:** G01 Auth/Rechte/Tenant/Commands/Receipts/Readback; G02 Startseite/Handlungsbedarf; G03 Intake; G04 Aufträge; G05 Kunden; G06 KV/Angebot; G08 Suche; G09 Konflikte; G10 Einstellungen; M01 Accounting-Lesekontext; M06 UDI/Dokument-Original/OCR; dauerhafte, sichere Host-Persistenz; Microsoft-Graph-Adapter; Search/Today/Analysis-Projektionsabnehmer
**Wird gebraucht von:** G02 Rolf-/Phillip-Startseite, G04 Auftragskontext, G05 Kundenkarte/Telefonnotiz, G06 Anfrage-zu-KV, G08 Suche, M01 Accounting-Kontext, M02 Analyse
**Anbindungszeitpunkt + Gate:** Der Kern darf nach BAUBEREIT off-repo in der priorisierten Modulfolge weitergebaut werden; wegen der Abhängigkeit muss M06 vor M05 stehen. Die Kreile-Anbindung erfolgt erst nach fertiggestelltem Grundstamm und den vorgelagerten Modulen seriell. Adoption nur atomar nach Opus-Schlussprüfung, P2-Entscheidung, freigegebenem Persistenz-/Portvertrag, Phase-1b-Design, realem Host-E2E und realem Microsoft-Graph-E2E; danach Owner-Transfergate. `LIVE = NO_GO` bis Owner-Freigabe.
**Bis dahin im Grundstamm:** Kein M05-Navigationsziel und keine Route. In bestehenden G05/G06-Screens nur ein gedämpftes, nicht klickbares Element mit Titel „Kommunikation zuordnen“ und Status „In Klärung“; der Telefonnotiz-Einstieg bleibt bis zur geklärten G05/M05-Anbindung ebenfalls „In Klärung“. Direkt-URL `/kommunikation` bleibt fail-closed/404.
**Übertragbarkeit:** Kern app-neutral: ja. Grund: Der Kern kennt nur Kommunikationsfälle, Evidenz, Bestätigung, Receipts und Readback; Kreile-Fachbegriffe, Microsoft-Graph-Anbindung und Kreile-Ressourcen liegen im Kreile-HostAdapter.
**Rate-Stellen aus Red-Team:** RT-05, RT-06, RT-07, RT-16, RT-22, RT-23, RT-24, RT-31
**Stand:** 2026-09-26
**Bearbeiter:** Codex, ein Writer; unabhängiger Read-only-Dossierreview nach Abschnitt 9 der Anleitung noch ausstehend → Q-M05-019

## Verifizierter Ist-Stand

- Das Candidate-Artefaktset umfasst 86 Dateien; der Set-Hash wurde am 2026-09-26 bytegenau bestätigt.
- `node --test --test-concurrency=1 ./tests/*.test.mjs` lief am 2026-09-26 read-only mit 76/76 bestandenen Tests.
- Der einzige Opus-Schlussversuch vom 2026-09-17 endete vor Inferenz mit HTTP 429; das Gate ist deshalb offen. Der bekannte P2-Hinweis betrifft den Cast in `src/reducer.ts:168`.
- Microsoft Graph Mail, Entra-App/Consent und die reale Laufzeit sind laut Runtime-Inventar E0/REPORTED_UNVERIFIED. Es gibt keinen real belegten M365-End-to-End-Pfad.
- Git ist für den Sandbox-Nutzer wegen „dubious ownership“ nicht lesbar. Im Nachlauf wurde auftragsgemäß kein erneuter Zugriff auf `origin/main` versucht; die Frischeprüfung liegt bei PL und ist als Q-M05-015 mit „In Klärung“ abgesichert.
