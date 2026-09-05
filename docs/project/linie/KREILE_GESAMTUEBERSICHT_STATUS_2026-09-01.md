# KREILE — GESAMTÜBERSICHT: was/wie/wo/wann/warum · Stand & Richtung
*Orientierungs-/Status-Snapshot · 2026-09-01 · Orchestrator/Wächter · KEIN Beschluss (Beschlüsse leben nur in „DIE LINIE" 2026-08-28). Additiv, mit Datum/Grund.*

## 0 — WARUM das alles so läuft (Governance)
- **Grund für PL + Orchestrator + kanonischen Ordner:** Ein Agent wollte statt am Bestehenden weiterzumachen die **alte App neu bauen** / alte Baupläne „interpretieren". Deshalb: Verfassungsprinzip **„Ein Bauplan ist wörtliches Gesetz, wird NIE interpretiert"** — jede Unklarheit ist STOP (`BLOCKED_PRODUCT_DECISION`), Beschluss in DIE LINIE, dann erst bauen.
- **Rollen:** EIN Writer (Main, beauftragt Claude zum Coden) · PL = Reviewer/Gates · Orchestrator/Wächter (ich) = nur Überwachung + Prozess-Hygiene, **nie** Repo/Code.
- **Kanonischer Ordner = `Kreile app\`** (PL-Inventar). Alle anderen Ordner (`ui oberfläche app\`, `KREILE_App_Website_Specs\` mit alten BUILD_PLANs, Bibel-Zip) sind **ARCHIV, kein Bau-Input**, bis ausdrücklich promotet. → genau die Leitplanke gegen „alte App nochmal bauen".

## 1 — ARCHITEKTUR-GRUNDSÄTZE (ratifiziert)
- **D-USP-001** Entlastung = oberstes Prinzip (App = „smarter bester Mitarbeiter").
- **D-ARCH-010** Galvanik = **EIN Step**, keine Bäder/keine internen Stationen. (→ `baeder`-Route widerspricht dem.)
- **Rollen** buero|werkstatt|meister|admin. Zwei Achsen: Ort ≠ Abrechnung (D-ARCH-002).
- **Startseite = wichtigstes Kontrollinstrument** (Kontrolle, Termintreue, Bündelung, Terminplanung). Geld/Zahlen erst später an Buchhaltung/Analyse.

## 2 — WAS GEBAUT WURDE (Git-Evidenz, Zeitachse) → main = `f1c34b8`, deployed
- **F0 Foundation** (Anf. Aug): Konvergenz, Security-Reconciliation, Ports/RLS — abgeschlossen.
- **F1.1 Digitaler Wareneingang** — Evidenz vorhanden.
- **F1.2 Werkstattdurchlauf (M2)** — PR #63 (17.08), Integration + Deploy dokumentiert.
- **F1.3 Leistungsabschluss (M3)** — „deliver real Leistungsabschluss" + CI-Fixes, PR #65/#66/#67 (18.–21.08). → main-HEAD `f1c34b8`. Live: galvanik-kreile-werkstatt.vercel.app.

## 3 — WAS GERADE GEBAUT WIRD (zwei parallele Ströme)
**A) F1.4 Unveränderliche Rechnung** — Branch `f1/immutable-invoice-m4-20260821` (aktuell ausgecheckt in 02_app).
- Status: Test-Reparatur-Loop. Linie #1 FINAL: **eine letzte** vertraglich gebundene Testkorrektur + **Coverage-Lücke schliessen** (Integrationstest muss echte Extra-Work-/Katalogzeile fahren; Migration-Replay auf frischer DB; Pos.42-Klassifikation gegen echte Produktsemantik belegen). Danach harte Stopp-Regel: jeder weitere Fehler = echter Produktbefund, kein Testbiegen.

**B) Frontend-Umsetzung / Warendurchlauf (Phillip „Werkstatt")** — F1-Worktree `f1/digital-wareneingang-20260812`.
- Paket A/B/C lokal committet (HEAD `b3419d6` „truthful Wareneingang states"; Tests 12/12 + 16/16, tsc/lint grün). In-Scope `src/app/warendurchlauf/**`, kein Drift.
- **Draft-PR/CI hängt** — GitHub-Port 443 ist im kreile-f1-Kontext blockiert (Egress-Allowlist), Push/PR/CI nicht gestartet.

## 4 — WO WIR STEHEN (Blocker & Lücken, priorisiert)
1. **GitHub-Egress fehlt** im Profil `kreile-f1` (nur localhost + api.anthropic.com erlaubt) → Push/Draft-PR/CI der Warendurchlauf-Arbeit blockiert. *(technisch, per Config-Zeile lösbar — wie schon bei Anthropic).*
2. **Design liegt nicht im kanonischen Ordner:** die UI-Referenzen (Rolf V8, Phillip V4, Auftragskarte V8, Kundenkarte V2) und die „Schattenseiten-als-Startseiten"-Festlegung leben als **Claude-Chat/-Artefakte**, nicht als Datei auf Disk. Der PL (Codex) kann sie nicht sehen/prüfen. → materialisieren.
3. **Offene Produktentscheidungen (Owner):** B1 Event-ID vs Rechnungsnummer · B3 Nummernvergabe-Zeitpunkt/Lifecycle (B2/Pos.42 klärt sich mit der F1.4-Testkorrektur).
4. **Konsolidierung (§10 der Linie):** `Kreile app\` als einzigen kanonischen Ordner bestätigen; alte Bauplan-Ordner als `_ARCHIV\` markieren; UI-Referenzen als Dateien exportieren.

## 5 — WO WIR HIN MÜSSEN (nächste Schritte, geordnet)
1. **Sofort/technisch (Orchestrator):** GitHub-Egress in `kreile-f1` freischalten → Paket-C-Push + Draft-PR + CI laufen; Codex-Neustart aktiviert Egress- + Ordner-Lesezugriff für den PL.
2. **Design materialisieren:** „Schattenseiten/Startseiten"-Spec aus dem Claude-Design-Chat + die vier UI-Referenzen als Dateien in `Kreile app\` einfrieren (Owner-Entscheidung §6). Danach kann der PL Ist-gegen-Soll bauen.
3. **F1.4 Rechnung** abschliessen: letzte Testkorrektur + Coverage schliessen → Real-Gate PASS → Merge (Owner-Grenze).
4. **F1.5 Zahlungseingang/Warenausgang:** erst **nach** F1.4-Merge, Start = Owner-Freigabe.
5. **Frontend OTC-Pfad:** Phase 0 Inventar → Phillip Proof-Screen → Rolf-Startseite + Auftragskarte + Kundenkarte. Rolf-Route-Wahl & `baeder`-Disposition darf der PL **selbst evidenzbasiert** entscheiden (Linie §5, im Git reversibel).

## 6 — WER MACHT WAS
- **Du (Owner):** Produktentscheidungen (B1/B3), Design-Export freigeben, F1.4-Merge & F1.5-Start freigeben, Konsolidierung bestätigen.
- **PL:** Specs/Gates/Reviews, Rolf-Route & baeder evidenzbasiert, Abnahme-Gates.
- **Main + Claude:** genau ein Writer baut, PR statt Push, kein Mock, echte Ports.
- **Orchestrator/Wächter (ich):** Egress/Config, Prozess-Hygiene, Überwachung, diese Übersicht — nie Repo/Code.
