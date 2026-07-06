# M6-Übergabe: Operator-Prompts für Codex / ChatGPT

Stand: 2026-07-06 · Erstellt vom Chefdirigenten nach Abschluss des M6-Gates (`CONTRACT_VERDICT_V24: PASS`).
Zweck: (A) Übergabeprompt, damit ChatGPT/Codex den Projektstand kennt und nichts sabotiert. (B) Template-Prompt für jede weitere Fundament-/Baumission über die Agentur.

---

## A. ÜBERGABEPROMPT (einmalig an ChatGPT/Codex geben, bevor es irgendetwas anfasst)

```
PROJEKT-ÜBERGABE — Galvanik-Kreile WerkstattCockpit. Lies das vollständig, bevor du irgendeine Datei änderst oder committest.

REPO: C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app (Branch: feature/capture-auth-tenant)
LAB:  C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_agentur_lab\kreile-agentur-twin-20260703-233807 (Agentur-Twin, Branch master)

WAS PASSIERT IST (2026-07-05/06):
1. Im Agentur-Twin wurde eine Multi-Agent-"Agentur" gebaut und geprüft (Berichte 00_–33_ in _agentur_reports/): Schreiber-Agent + unabhängiger Prüfer-Agent + Gates. Ein SSG-14-Sicherheits-Guard (Commit-/MCP-Sperren) ist AKTIV und ABSICHT.
2. Mission M6: Der Slice-1-Implementierungsvertrag wurde in einer Schreiber/Prüfer-Schleife erstellt: V2.2 → Fremdprüfung FAIL (36_) → Korrekturdirektive (37_) → V2.3 → finale Fremdprüfung FAIL mit 1 Kategorie-1-Fund (38_) → Korrektur V2.4 → Nachprüfung CONTRACT_VERDICT_V24: PASS (38_, Abschnitt "Nachprüfung V2.4").
3. Der akzeptierte Vertrag V2.4 wurde in den autoritativen Baum von 02_app übernommen. Er ist die verbindliche Bauvorschrift für Slice 1 (Foto/Beleg → Original sichern → Offline → OCR → Zuordnung → Wareneingang → Produktionskarte), aufgeteilt in 7 Baumissionen B1–B7. Er inventarisiert 6 existierende Altpfade (I-1…I-6) mit Code-Zeilenbelegen, die je "ersetzt" oder "gehärtet" werden.

NEUE/GEÄNDERTE DATEIEN IN 02_app (das ist der zu committende Stand):
- M  KREILE_PROJEKT_DOKUMENTATION/00_AUTORITATIV/00_PROJECT_TRUTH.md            (Projektwahrheit auf Stand 06.07.2026)
- M  KREILE_PROJEKT_DOKUMENTATION/00_AUTORITATIV/04_CURRENT_GATE_AND_DESIGN_SEQUENCE.md (Gate: PROPOSAL_ACCEPTED, Designfolge, B1–B7)
- NEU KREILE_PROJEKT_DOKUMENTATION/00_AUTORITATIV/05_SLICE1_IMPLEMENTATION_CONTRACT_V2_4.md (der akzeptierte Vertrag, byte-identisch zur Prüf-Fassung — NICHT editieren)
- NEU KREILE_PROJEKT_DOKUMENTATION/M6_EVIDENZ/ (36_, 37_, 38_ — Prüf-Evidenzkette, NICHT editieren)
- NEU KREILE_PROJEKT_DOKUMENTATION/M6_UEBERGABE_PROMPTS.md (diese Datei)

COMMIT-AUFTRAG (genau so, nicht mehr):
git add KREILE_PROJEKT_DOKUMENTATION/00_AUTORITATIV/00_PROJECT_TRUTH.md KREILE_PROJEKT_DOKUMENTATION/00_AUTORITATIV/04_CURRENT_GATE_AND_DESIGN_SEQUENCE.md KREILE_PROJEKT_DOKUMENTATION/00_AUTORITATIV/05_SLICE1_IMPLEMENTATION_CONTRACT_V2_4.md KREILE_PROJEKT_DOKUMENTATION/M6_EVIDENZ KREILE_PROJEKT_DOKUMENTATION/M6_UEBERGABE_PROMPTS.md
git commit -m "M6: Slice-1-Implementierungsvertrag V2.4 akzeptiert (CONTRACT_VERDICT_V24: PASS) — Uebernahme in 00_AUTORITATIV inkl. Evidenzkette 36-38"
Die übrigen untracked Ordner (.agents/, .claude/agent-memory/, KREILE_CLAUDE_COWORK_MASCHINERIE/control_plane/, KREILE_PROJEKT_DOKUMENTATION/99_AUDIT_INPUT/) gehören NICHT in diesen Commit — unangetastet lassen, separate Entscheidung des Auftraggebers.

HARTE VERBOTE (Sabotage-Schutz):
1. 00_AUTORITATIV-Dateien nie inhaltlich ändern außer über den Gate-Prozess (unabhängige Prüfung + Auftraggeber-Freigabe). Auch nicht "verbessern", umformatieren oder kürzen.
2. 05_SLICE1_IMPLEMENTATION_CONTRACT_V2_4.md und M6_EVIDENZ/ sind eingefroren (Beweismittel). Änderungswünsche = neue Vertragsversion über die Prüfschleife, nie In-Place-Edit.
3. Den SSG-14-Guard (Hooks/Sperren im Twin und in KREILE_CLAUDE_COWORK_MASCHINERIE) NIEMALS lockern, löschen oder umgehen. Freigaben laufen ausschließlich über die vorgesehene Flag-Datei durch den Auftraggeber.
4. Kein git push --force, kein Rebase/History-Rewrite, kein Löschen von Branches, kein "Aufräumen" von scheinbar ungenutzten Dateien.
5. Im Agentur-Twin ist _agentur_reports/ gitignoriert — diese Dateien sind dort die EINZIGE Quelle. Nichts davon löschen; versionierte Kopien liegen in 02_app/KREILE_PROJEKT_DOKUMENTATION/M6_EVIDENZ/.
6. Keine Slice-1-Implementierung (Migration, RLS, Server-Actions, UI) starten. Aktives Gate: erst Claude-Design-Gate (UI-/Interaktionsvertrag), dann einzeln freigegebene Baumissionen B1–B7 gemäß Vertrag V2.4 §9.
7. Kernregeln beachten (01_PRODUCT_AND_SLICE_CONTRACT.md): u.a. kein Mock/Math.random/stiller Fallback im Prod-Pfad, keine Navigation/Sidebar-Änderung ohne Freigabe.

Bestätige kurz, dass du Stand + Verbote verstanden hast, führe dann NUR den Commit-Auftrag aus.
```

---

## B. TEMPLATE-PROMPT für Fundament-/Baumissionen über die Agentur (je Mission anpassen)

Platzhalter in `{…}` ausfüllen. Eine Mission = ein Prompt. Nicht mehrere Baumissionen bündeln.

```
MISSION {M7|M8|…}: Baumission {B1|B2|…} — {Kurzname, z.B. "Daten-/Storage-/Sicherheitsfundament"} über die Kreile-Agentur ausführen.

ARBEITSVERZEICHNIS (Agentur-Lab): C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_agentur_lab\kreile-agentur-twin-20260703-233807
VERSIONIERTE WAHRHEIT (Referenz, read-only für diese Mission): C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app

PFLICHTLEKTÜRE VOR DEM ERSTEN EDIT (in dieser Reihenfolge):
1. KREILE_PROJEKT_DOKUMENTATION/00_AUTORITATIV/00_PROJECT_TRUTH.md
2. KREILE_PROJEKT_DOKUMENTATION/00_AUTORITATIV/01_PRODUCT_AND_SLICE_CONTRACT.md (18 Kernregeln)
3. KREILE_PROJEKT_DOKUMENTATION/00_AUTORITATIV/02_AUTONOMOUS_MISSION_PROTOCOL.md (Rollen, TRUTH-Marker, REDTEAM, Code-Gates)
4. KREILE_PROJEKT_DOKUMENTATION/00_AUTORITATIV/04_CURRENT_GATE_AND_DESIGN_SEQUENCE.md (aktives Gate!)
5. KREILE_PROJEKT_DOKUMENTATION/00_AUTORITATIV/05_SLICE1_IMPLEMENTATION_CONTRACT_V2_4.md — davon verbindlich: §2a (Ist-Inventar I-1…I-6), der Abschnitt deiner Baumission in §9 (Scope + ALLE Akzeptanzkriterien), §7 (Tenant/RLS/Rollen), §4 (Sagas/Transaktionen).

AGENTUR-BETRIEBSMODUS (nicht verhandelbar):
- Genau EIN Orchestrator, genau EIN schreibender Agent, genau EIN unabhängiger Prüfer (frische Session, prüft gegen Originalkriterien und Rohbelege, nie gegen die Selbsteinschätzung des Schreibers).
- Schreiber korrigiert selbstständig bis PASS, FAIL oder echtem externen Blocker. Keine Zwischenberichte, keine normalen Rückfragen.
- Vor Änderungen: Projektpfad, Branch, HEAD, git status --short, betroffene Dateien, Snapshot dokumentieren.
- TRUTH-Disziplin: K nur mit Datei-/Zeilen-/Rohlog-Beweis; Remote-Zustand ohne Rohlog bleibt SSG-00; Schema-Aussagen immer gegen src/db/schema.ts mit Zeilennummer.
- SSG-14-Guard bleibt scharf: KEIN Commit, keine Migration auf Remote, kein Deploy, kein Push aus der Maschinerie ohne ausdrückliche Missionsfreigabe des Auftraggebers (Flag-Datei-Mechanismus). Verboten ist auch jedes Lockern des Guards.
- Kernregel 17: kein Mock, Math.random, Demo- oder stiller Fallback im Produktionspfad. Kernregel 18: Navigation/Sidebar unangetastet.

SCOPE DIESER MISSION:
{Exakt den Scope-Block der Baumission aus V2.4 §9 einfügen + ggf. benannte Restpunkte: B1 trägt F-38-04, B4 trägt F-38-03-Rest.}

ABNAHME:
- Jedes Akzeptanzkriterium {Bx-AK1…AKn} einzeln mit Evidenz (Rohlog, SQL-Output, Diff, Screenshot-Pfad) belegen.
- Code-Gates: npx tsc --noEmit, npm run lint, alle Tests, npm run build, git diff --stat, git status --short — Exit-Codes als Rohlog.
- Der unabhängige Prüfer schreibt seinen Bericht als _agentur_reports/{NN}_M{X}_B{Y}_FREMDPRUEFUNG.md und schließt mit genau einer Zeile: MISSION_VERDICT: PASS oder MISSION_VERDICT: FAIL oder STATUS: BLOCKIERT_EXTERN. PASS ist unzulässig bei offenem Sicherheits-, Datenintegritäts- oder Vertragsblocker.
- Nach PASS: Ergebnisbericht + Prüfbericht nach 02_app/KREILE_PROJEKT_DOKUMENTATION/M{X}_EVIDENZ/ kopieren (im Twin ist _agentur_reports/ gitignoriert!). Committen tut ausschließlich der Auftraggeber.

Beginne mit der Pflichtlektüre und dem Zustands-Snapshot. Am Ende erwarte ich: Verdict-Zeile, nummerierte Kriterien mit Evidenz, Liste aller geänderten Dateien.
```

---

## C. Merkzettel Auftraggeber

- Reihenfolge laut Gate: **Claude Design (UI-/Interaktionsvertrag) → B1 → … → B7.** Wer B1 (reines Daten-/Storage-Fundament, kein UI) vor dem Design-Gate vorziehen will, tut das als dokumentierte Auftraggeber-Entscheidung — Design entscheidet ohnehin keine Tabellen/RLS/Storage (04_, Punkt 3).
- Die Agentur ist einsatzbereit für Missionen nach diesem Template; ihr Guard bleibt immer scharf.
- Jede Baumission endet mit unabhängigem Verdict + Evidenz-Export nach 02_app. Ohne das: nicht committen.
