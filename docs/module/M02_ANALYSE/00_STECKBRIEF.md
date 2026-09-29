<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M02 Analyse - Steckbrief

**Zweck:** M02 liefert quellengebundene Entscheidungsunterstützung. Es verbindet bestätigte Fakten der Fachmodule mit versionierten Berechnungen, Claims, Empfehlungen, Entscheidungsbriefs, Szenarien und Wirkungskontrolle, besitzt aber selbst keine Fachfakten, Ziele, Entscheidungen oder Commands. Unbekannte, partielle, veraltete, verweigerte, unterdrückte oder widersprüchliche Evidenz darf niemals als Null oder Erfolg erscheinen.
**Stufe:** hinten angestellt
**Dossier-Status:** BAUBEREIT
**Modul-Status:** OFF_REPO_KANDIDAT
**Zustaendige Session:** Analyse `01a0abaa-9cfb-70f2-ae73-05c699b55070`
**Arbeitsordner:** `C:\Users\Traube\Documents\Codex\2026-09-16\kreile-analyse-runtime-kern`
**Code-Pfad:** Off-repo-Kandidat `outputs\analysis-core-v1.1\`; finales `ARTIFACT_MANIFEST.json` SHA-256 `7A2BA82A7230AD6C2C52A1715E77C4FBAA7E08886A5F71F1C5A048ABFD30B360` (erste 12: `7A2BA82A7230`); enger unabhaengiger Closure-Beleg `outputs\analysis-core-v1.1-closure\OPUS_DISC_SCOPE_CLOSURE_CHECK.json`, SHA-256 erste 12 `FFEE68E892F2`.
**Braucht (Module/Ports):** Fertigen Grundstamm mit OWNER_UX_PASS; kanonisches serielles Adoptionsgate; Host-Autorisierung und opaken Scope; `domain-fact-adapter/v1.1`; ownerfreigegebene kanonische Metric-Packs; fuer den ersten Slice einen vollstaendigen Orders-/Production-Termintreue-Read mit gemeinsamer Snapshot-, Perioden-, Coverage-, Disclosure- und Entity-Ref-Semantik; spaeter Accounting-, Leadership- und Domain-Receipt-/Readback-Ports.
**Wird gebraucht von:** Rolf-Entscheidungsansicht, Home/Today, Suche und Leadership konsumieren dieselbe unveraenderte Projektion ueber `decision-support.read/v1`; kein Consumer darf neu berechnen oder eine zweite Wahrheit erzeugen.
**Anbindungszeitpunkt + Gate:** Der Modulcore darf nach BAUBEREIT gemäß OE-2609-17 in Kreile-Reihenfolge M01 -> M02 off-repo parallel gebaut werden; die Kreile-Anbindung bleibt seriell nach fertigem Grundstamm und M01. Reihenfolge: PL-Kanon-/Pfadgate -> exakten Artefakthash importieren -> Termintreue-Adapter und kanonisches Metric-Pack -> nach M01 Liquidität 30 Tage -> Shadow-Vergleich -> Browser/RLS/Denied/Stale/Failure-Beleg -> ein Consumer -> atomarer Cutover -> unabhängige Abnahme -> Owner-Transfergate.
**Bis dahin im Grundstamm:** Keine M02-Route und kein klickbares Analyse-Navigationsziel. Die Steckplätze `Analyse & Kundenwert` (Kundenkarte V2) und `Kalkulation & Kennzahlen` (Auftragskarte V8) bleiben gedämpft, nicht klickbar und zeigen wörtlich `In Klärung`; keine Werte und keine Fake-Daten. Die Startseite zeigt keine Analyse-Kennzahl-Kachel. Erst nach Anbindung erscheinen dort ausschließlich dringende Konflikte, Warnungen oder Entscheidungen; der eigene Menüpunkt erscheint ebenfalls erst nach Anbindung (OE-2609-22/26).
**Übertragbarkeit:** Kern app-neutral: ja – der Core enthält keine Kreile-Fachbegriffe; Kreile-spezifische Fakten, Kennzahlen, Rechte und Projektionen liefert ausschließlich der Kreile-HostAdapter.
**Rate-Stellen aus Red-Team:** RT-21, RT-22, RT-23, RT-24, RT-31.
**Stand:** 2026-09-26
**Bearbeiter:** Codex (Dossier-Writer); unabhaengiger Dossier-Reviewer ausstehend
