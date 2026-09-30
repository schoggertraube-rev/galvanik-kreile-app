<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 11 – Ist-Code und Umbauentscheidung

Stand: 2026-09-26  
Vergleichsref: letzter belegter Read-only-Stand `origin/main` bei `21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`; im Nachlauf wegen `dubious ownership` nicht erneut lesbar, Bestätigung durch PL in Q-M02-007

Es wurden keine Dateien im Repo geändert. Die Entscheidungen hier sind Planungsentscheidungen; insbesondere „Entfernen“ ist keine Löschfreigabe.

## Inventar und Entscheidung

| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |
|---|---|---|---|---|---|
| Off-Repo `outputs/analysis-core-v1.1` | Zustandsloser Decision-Support-Core | GEBAUT als Kandidat; Receipt vom 2026-09-17: 66/66 im Glob-Lauf am Audit-Freeze, 67/67 in der Post-Closure-Funktionssuite ohne `artifact-integrity.test.mjs`; enger Reaudit PASS | **bleibt** als Übernahmekandidat | `TEST_RECEIPT.json` SHA `A1C22EB0C6E0…`; Manifest `7A2BA82A7230…`; Closure `FFEE68E892F2…` | Bytegenau prüfen; vollständigen Post-Closure-Gesamtlauf nachweisen (Q-M02-011); kanonische Serialisierung und Repo-Gate vor Adoption; keine Bestandsdaten enthalten |
| Off-Repo `outputs/analysis-core-v1.1-closure` | Unabhängiger enger P1-/Disclosure-Nachweis | GEBAUT | **bleibt** als Auditnachweis | `OPUS_DISC_SCOPE_CLOSURE_CHECK.json` | Zusammen mit Manifest/Testreceipt übernehmen; keine Bestandsdaten |
| `src/modules` (kein M02-Modul) | Künftiger kanonischer Kreile-Host | FEHLT im letzten belegten Stand | **ersetzen durch Modul** nach Q-M02-004/Q-M02-007 | Repo-Inventar; Architektur | Neues Modul ist dauerhafte, freigabepflichtige Strukturentscheidung; keine Migration jetzt |
| `src/modules/orders` und Produktionsfakten | Quelle der ersten Kennzahl Termintreue | GEBAUT fachmodulseitig; M02-Port im letzten belegten Stand FEHLT | **bleibt**; read-only Adapter nach PL-Gate ergänzen | OE-2609-21; Core-Quellenvertrag | Fakten bleiben im Besitzer-Modul; Zusage/Fertig-/Abholereignis, Population, Snapshot, Pagination, Eligibility und Disclosure nachweisen |
| `src/modules/accounting` | Quelle der zweiten Kennzahl Liquidität 30 Tage nach M01 | Capability im letzten belegten Stand unvollständig | **bleibt**; vollständigen read-only Fact-Vertrag ergänzen | OE-2609-23/24; KPI-Admission | Manueller Kontostand, laufende Kosten, offene Posten und freigegebene Personalkosten-Summen; keine Datenmigration durch M02 |
| `src/features/analyse` (25 Dateien) | Legacy-Fach-/UI-Code | VERWORFEN; Digest `04A2042EB3DA…` | **ersetzen durch Modul** | Architektur/Modulkarte | Imports, Links und einzigartige Anforderungen salvagen; Entfernung nur separat freigeben |
| `src/app/cockpit` (14 Dateien) | Legacy-Routen/-UI | VERWORFEN; Digest `3C1332DC5075…` | **entfällt** nach Linkprüfung | Architektur/Modulkarte | Navigation, Deep Links und Tests migrieren; Entfernung nur separat freigeben |
| `src/app/performance` (9 Dateien) | Legacy-Performance-Routen | VERWORFEN; Digest `0D407709381C…` | **entfällt** nach Linkprüfung | Architektur/Modulkarte | Imports/Links prüfen; keine Legacy-Bestandswerte übernehmen |
| `src/lib/analyse` (3 Dateien) | Legacy-Berechnung/Utility | VERWORFEN; Digest `1FD7711D87CB…` | **ersetzen durch Modul** | Core Integer-/Zeit-/Coverage-Vertrag | Nur fachliche Hinweise gegen Metric-Pack prüfen; später separat entfernen |
| `src/lib/analytics` (5 Dateien) | Parallele Analytics-Logik | VERWORFEN; Digest `E5AC72B3D394…` | **ersetzen durch Modul** | Schattenmodell-/Fallback-Risiko | Importprüfung; keine Bestandsdatenmigration; später separat entfernen |
| `src/lib/performance` (1 Datei) | Legacy-Performance-Logik | VERWORFEN; Digest `61CADD2AAA24…` | **ersetzen durch Modul** | Architektur/Modulkarte | Importprüfung; später separat entfernen |
| `src/components/analytics` (12 Dateien) | Legacy-Analysekomponenten | VERWORFEN; Digest `0E397C6F2CA7…` | **umbauen auf Designsystem** nach Designphase 1b | V5; RT-22/24 | Nur geprüfte generische Accessibility-Muster salvagen; keine Beispielwerte |
| `supabase/functions/kpi-insight` | Legacy Edge Function | VERWORFEN; Digest `CEED0BA79F83…` | **entfällt** als M02-Port | Portvertrag `decision-support.read/v1` | Vor Entkopplung andere Verbraucher prüfen; Entfernung nur separat freigeben |
| `supabase/migrations/20260908101500_werkstatt_kpi_view.sql` | Bestehender View für WIP/fällig diese Woche | GEBAUT; SHA `29D448E720FA…` | **bleibt** für bestehenden Zweck | Migration in `origin/main` | Nicht direkt in M02 verwenden; kein Snapshot-/Population-/Provenienzvertrag; keine Migration jetzt |
| Kundenkarte V2 / Auftragskarte V8 Analyse-Slots | Eingebettete UI-Platzhalter mit alten Beispielwerten | SPEZ/Legacy-Referenz | **umbauen auf Designsystem** | OE-2609-04/22; Q-M02-002 | Bis Design-/Integrationsgate grau, nicht klickbar, exakt `In Klärung`; keine Bestandswerte übernehmen |

## Geplanter sichere Umbaufolge

1. PL bestätigt in Q-M02-007 den aktuellen Kanon; Q-M02-004 legt den dauerhaften Kreile-Modulpfad fest. Die Produktplatzierung selbst ist durch OE-2609-22 geklärt.
2. Core bytegenau übernehmen, Manifest/Serialisierung und einen vollständigen Post-Closure-Gesamtlauf einschließlich `artifact-integrity.test.mjs` im Repo nachweisen; bis dahin Q-M02-011 `In Klärung`.
3. Genau einen realen Fact-Adapter und ein Metric-Pack für Termintreue zulassen.
4. Nach M01 den vollständigen Liquiditäts-Fact-Vertrag und das zweite Metric-Pack anbinden; Q-M02-008 vorher schließen.
5. Host-Auth/Disclosure/Retention und V5-Renderer anbinden.
6. Freigegebene Screens und alle sieben Zustände bauen; Menüpunkt/Route erst mit Anbindung aktivieren.
7. Projektionen an Auftrag/Kunde und nur Dringendes auf die Startseite einbetten, ohne lokale Berechnung.
8. Legacy-Importe, Links und einzigartige Anforderungen vollständig salvagen.
9. Erst in einem eigenen freigegebenen Auftrag Legacy-Code entfernen.
10. Unabhängigen read-only Review durchführen.

## Nicht tun

- Den Off-Repo-Core als bereits implementiert bezeichnen.
- Legacy-Zahlen oder -Schwellen als Seed-, Demo- oder Fallbackdaten weiterverwenden.
- Direkt aus M02 auf Supabase, Microsoft 365 oder andere Provider zugreifen.
- Neue Tabellen, Events, Commands, Authmodelle oder Laufzeitabhängigkeiten ohne konkrete Strukturfreigabe anlegen.
- In diesem Dossierauftrag Code löschen, verschieben, committen oder im Repo ändern.
