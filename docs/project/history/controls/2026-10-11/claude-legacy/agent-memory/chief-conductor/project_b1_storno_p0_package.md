---
name: project-b1-storno-p0-package
description: Paket B1 P0-Storno (Branch claude/kr-b1-storno-p0) schließt DB-Guard-Lücke K-G07-004 aus G07-Dossier
metadata:
  type: project
---

Auftrag 2026-09-26: `guard_f1_4_invoice_update` (DB-Trigger, `supabase/migrations/20260821152949_f1_4_immutable_invoice_contract.sql`)
prüft beim Storno-Übergang (`issued -> cancelled`) keinen Zahlungsstatus — App-Ebene
(`hasClearlyUnpaidPaymentState` in `src/lib/server/commands/immutableInvoiceCommand.ts`) hat den
Check bereits, DB-Ebene fehlt (zweite Schicht gegen Umgehung des App-Checks per Direkt-DB-Session).

Verbindliches Dossier: `_MODULDOSSIERS/G07_GELD_RECHNUNGEN/` (bereits vollständig, Status
`BAUBEREIT`, Bericht vom 2026-09-26). Gap ist dort exakt benannt: `05_REGELN_SPERREN_KONFLIKTE.md`
K-G07-004 "Storno-Payment-Gate als zweite Schicht ... FEHLT — P0 vor Live"; Test-Pflicht
`07_ABNAHME_TESTS.md` T-G07-016. Harte Schranke: "`LIVE = NO_GO`, solange K-G07-004 nicht auch auf
DB-Ebene geschlossen und real negativ getestet ist."

Der Handoff-Prompt für dieses Paket instruierte (wie üblich bei diesen Runner-Handoffs) "Du bist
der einzige Writer" — das ist Runner-Boilerplate für den build-engineer-Subagenten, NICHT eine
Anweisung an mich (chief-conductor), selbst zu bauen. Ich habe an `build-engineer` delegiert
(Writer, DB-Migration + Tests, hart scope-begrenzt auf `supabase/migrations/**` + `src/test/**`)
und werde danach `qa-test-verifier` unabhängig prüfen lassen. Siehe [[feedback_sole_writer_verifier_conflict]].

**Why:** G07-Dossier ist die einzige verbindliche Quelle für diese Anforderung; kein Owner-Konflikt
offen für diesen spezifischen P0-Punkt (andere G07-Punkte wie ZUGFeRD, ausgangs-Export,
Aufbewahrungsfrist sind separat offen/SPEZ und NICHT Teil dieses Pakets).

**How to apply:** Bei Fortsetzung/Nachfrage zu B1: Status über die beiden Subagenten-Reports
(build-engineer MAIN_REPORT, dann qa-test-verifier-Befund) zusammenführen, nie selbst PASS
behaupten. Endstatus max. `PROPOSED_PASS` bis unabhängige Prüfung vorliegt (lt. Auftrag).

## Ergebnis Retry-Runde 2026-09-26 (lokaler Vorab-Test ROT)

Runner meldete `F1_4_LOCAL_DATABASE_REQUIRED` beim lokalen Vorab-Testlauf. Beide Subagenten
unabhängig bestätigt: **kein Codedefekt** — der Env-Guard in der neuen Testdatei ist byte-
identisch (SHA-256 gleich) mit dem etablierten Fail-closed-Muster im Sibling-Test. Ursache ist
rein Docker/lokale-DB-Abwesenheit in der Ausführungsumgebung (RC-1).

Bei der Tiefenprüfung deckte qa-test-verifier aber zwei echte, vom Auftraggeber nicht genannte
Blocker in `.github/workflows/quality.yml` auf:
- F-001: neue Testdatei fehlt im CI-Run (`F1.4 immutable invoice regression`-Step, ~Z. 548).
- F-002 (schwerwiegender, von build-engineer wegen Scope-Sperre nicht gesehen): der Schema-Reset
  vor diesem Step ist auf `--version 20260909180000` gepinnt — **vor** der neuen Migration
  `20260926120000`. Das blosse Nachtragen der Testdatei würde den Test gegen die ALTE
  Guard-Definition laufen lassen und faelschlich rot werden lassen. Erst ein Reset OHNE
  `--version`-Pin (wie Z. 588) faehrt die neue Migration ein.

Weitere Findings (nicht blockierend fuer Governance, aber Substanz-relevant): fehlende
Testabdeckung fuer Guard-Bedingung 5 (`gross_amount_cents > 0`), irrefuehrender Kommentar in der
Testdatei (Z. 583-585 behauptet falsche Abdeckungsbegruendung), unbelegte Zeilenzahl fuer
Legacy-Rechnungen vor Remote-Migration, und ein Governance-Fund: K-G07-004/T-G07-016 existieren
in KEINER nach D-GOV-001 autoritativen Quelle (nur im `_MODULDOSSIERS`-Ordner, 0 Treffer in
`00_BIBEL`/`docs/project/linie`/`missions`) — Live-Blocker haengt an nicht zugeordneter Quelle.
Zusaetzlich: `missions/F1_ORDER_TO_CASH_PILOT_001.yml` bildet ein anderes aktives Paket ab
(A2 Phillip Recovery) und nicht diesen Branch/B1 — Missionsdatei ist stale.

**Why:** Die CI-Fix (E1+E2) erfordert eine Aenderung an `.github/workflows/quality.yml`, die
ausserhalb der im Auftrag genannten Datei-Allowlist (nur Server/Module/DB-Migration/Tests) liegt.
Das ist eine Scope-Erweiterung, die ich als chief-conductor nicht selbst genehmigen darf.

**How to apply:** Bei Fortsetzung: Owner/PL muss entscheiden, ob (a) quality.yml-Fix in dieses
Paket aufgenommen wird (Scope-Erweiterung) oder (b) als eigenes CI-Wiring-Folgepaket lauft. Erst
danach kann ein echter Fresh-DB-Nachweis fuer T-G07-016 erbracht werden. Endstatus ist NICHT
PASS/PROPOSED_PASS — Kandidat: `FAIL_INTERNAL` (interne, behebbare CI-Defekte) mit einem
`BLOCKED_PRODUCT_DECISION`-Anteil (Scope- und Governance-Zuordnungsfragen). Siehe auch
[[feedback_ci_schema_pin_pattern]] fuer das wiederkehrende Muster versionsgepinnter Resets.

## Runde 3 (2026-09-26 spaet): Scope-Frage vom Stop-Gate entschieden, CI-Wiring geliefert

Der Stop-Gate des Runners hat die offene Scope-Frage von Projektseite entschieden und die beiden
CI-Blocker namentlich zur Behebung verlangt. Damit ist E1 nicht mehr offen. Umgesetzt (Writer:
build-engineer, nicht ich):

- Neuer blockierender Schritt in `quality.yml` (Job `fresh-supabase-replay`, Step 37/44) fuer
  `src/test/f1_4_invoice_cancel_payment_guard.integration.test.ts`, platziert direkt hinter dem
  bereits existierenden UNGEPINNTEN `supabase db reset --local --no-seed`.
- Bewusst NICHT umgesetzt: den Test an den F1.4-Block (Z. 548) anhaengen oder den Pin in Z. 534
  von 20260909180000 auf 20260926120000 umschreiben. Beides waere falsch — Z. 534/578 definieren
  die Schemabasis fuer fuenf fremde Teststufen (Werkstatt-KPI, F1.4-Regression, drei F1.5-Bloecke,
  F1.3 live-card). Die Platzierung hinter dem ungepinnten Reset loest F-002 ohne Fremdeingriff.

**Neu gelernt (wichtig, kostet sonst eine Runde):** jede Byte-Aenderung an `.github/workflows/quality.yml`
bricht `npm run lint:ratchet` mit "The ratchet implementation or invocation drifted; a protected
judge-contract migration is required" — `judgeContractHash` in `scripts/quality/check-eslint-ratchet.ts`
hasht quality.yml, eslint-ratchet.yml und die beiden Ratchet-Skripte. Von mir empirisch bestaetigt
(Exit 1 vorher, Exit 0 nachher). Details in [[feedback_ratchet_judge_contract_refresh]].

**How to apply:** Noch offen und NICHT von mir entscheidbar: RT-002 (K-G07-004/T-G07-016 in keiner
nach D-GOV-001 autoritativen Quelle — im Liefer-Repo sogar selbstreferenziell: jeder In-Repo-Treffer
ist Produkt dieses Pakets oder Agent-Notiz) und U-1 (Fresh-DB-Verhaltensnachweis, lokal unmoeglich
weil Docker aus). Endstatus bleibt `BLOCKED`. Zusaetzlich zwei additive Test-Haertungen empfohlen,
aber wegen "sonst nichts" NICHT gebaut: Slice-Semantik in Test 1 gegen Verschiebung haerten und
ein Verhaltens-Fixture `gross_amount_cents = 0`.

## Runde 4 (2026-09-27): Owner/PL descoped CI-Wiring wieder heraus — engste Korrektur B1

Neuer Auftrag "Betriebs-Eingriff B1" kehrt die Runde-3-Entscheidung um: quality.yml-Step
wieder vollstaendig entfernen (Revert auf committeten Stand), `judgeContractHash` zurueck auf
`312eb5b13e75ee045510666f1799858b9318e717ed0e623cac106f8348d17b13`. Paket damit auf Migration +
Test + Fixture verengt; CI-Wiring explizit in ein separates Folgepaket verschoben. Ich habe wieder
an build-engineer (Writer) delegiert, dann an qa-test-verifier (unabhaengig). Beide Reverts von
mir selbst per `git diff` gegengeprueft: leer, exakt. Build-engineer meldete selbst nur
`PROPOSED_PASS` fuer die zwei Reverts, NICHT PASS fuer das Paket — korrektes Verhalten, kein
Selbst-Freispruch.

Drei unaufgeforderte Substanz-Funde des Writers, die eine unabhaengige Einordnung brauchen (an
qa-test-verifier delegiert, noch nicht final bewertet):
- **F-07**: nach dem Revert ist der neue DB-Guard-Test in KEINEM CI-Job verdrahtet (Owner-Absicht
  laut Auftrag, aber faktisch bleibt der P0-Guard bis zum Folgepaket ungeprueft in CI).
- **R3**: Rechnungen mit `payment_contract_version IS NULL` (Altbestand) werden durch die neue
  Guard-Bedingung moeglicherweise dauerhaft auf DB-Ebene nicht mehr stornierbar — ungeklaerte
  Produktfrage, nicht im Dossier verifiziert.
- **F-08**: Korrektheitsargument fuer Guard-Bedingung 1 stuetzt sich nur auf einen Kommentar in der
  neuen Migration, nicht auf gelesenen Quellcode von `invoices_f15_amounts_chk` (`20260905100000`).

**Why:** Wiederholt sich das RC2-Muster aus [[feedback_ci_schema_pin_pattern]]: die Platzierung des
entfernten CI-Steps HINTER dem ungepinnten Reset war kein Zufall, sondern zwingend (fruehere
F1.4/F1.5-Bloecke laufen auf gepinntem Schema vor der neuen Migration). Ein Folgepaket, das den
Step falsch platziert (z.B. an den alten F1.4-Block angehaengt), wuerde einen falschen Gruen-Status
erzeugen.

**How to apply:** Bei Fortsetzung/Folgepaket zwingend beachten: CI-Wiring-Folgepaket MUSS den Step
hinter dem ungepinnten `supabase db reset --local --no-seed` einfuegen (nicht an den alten
F1.4-Block), UND den `judgeContractHash`-Refresh im selben PR mitliefern (siehe
[[feedback_ratchet_judge_contract_refresh]]). R3 ist eine echte offene Produktfrage fuer den
Owner, keine Coding-Aufgabe. Endstatus dieses B1-Pakets: warte auf qa-test-verifier-Befund, dann
zusammenfuehren — voraussichtlich `PROPOSED_PASS` fuer die engen Reverts, mit F-07/R3/F-08 als
gesondert auszuweisenden offenen Punkten (nicht stillschweigend als erledigt melden).

## Ergebnis Runde 4 (2026-09-27, final fuer dieses B1-Paket): qa-test-verifier empfiehlt "PASS mit Auflagen"

qa-test-verifier hat alle Writer-Behauptungen gegen Quelle (nicht gegen Bericht) nachgelesen und
kam zu einem staerkeren Ergebnis als der Writer selbst: Reverts bytegenau bestaetigt (zusaetzlich
`grep`-Beleg dass der CI-Step auch inhaltlich weg ist, nicht nur diff-leer), alle Gates gruen
reproduziert (inkl. `quality:module-gates`, `quality:authority-gate`, Migrations-Ledger — vom
Writer nicht gepruefte, aber plausibelste stille Bruchstellen), Migration fachlich korrekt gegen
K-G07-004 (inkl. `invoices_f15_amounts_chk`-Semantik aus Quellcode `20260905100000` verifiziert,
nicht nur aus Migrations-Kommentar geglaubt), kein Regress in Fixtures/anderen Tests.

Die drei Substanzfunde des Writers wurden eingeordnet:
- **(a) F-07 CI-Wiring fehlt**: akzeptabler Zwischenzustand fuer dieses PR, ABER: Migration+Test
  wurden noch NIE ausgefuehrt (nicht nur "nicht in CI verdrahtet") — harte Auflage, dass dieses
  Paket NICHT als Schliessung von K-G07-004/T-G07-016 berichtet werden darf. `LIVE = NO_GO` bleibt.
- **(b) R3 Altbestand**: unbedenklich — Dossier nennt den Altzustand-Fall explizit als
  abzuwehrenden Fall, App-Schicht blockt ihn bereits. Kein Backfill vorhanden und jetzt auch keine
  DB-seitige Aufloesung mehr — als Folgepunkt (nicht Blocker) vermerkt.
- **(c) F-08 CHECK-Annahme**: verifiziert und bestaetigt (Quellcode gelesen), Sorge ausgeraeumt.

**Neuer eigener Fund F-1 (verifier, MITTEL):** Guard-Bedingung 5 (`gross_amount_cents > 0`) ist nur
textuell (per `pg_get_functiondef`-Stringsuche), NICHT verhaltensmaessig getestet — eine
Nullbetrag-Rechnung mit `payment_contract_version=1` ist real konstruierbar und wuerde permanent
unstornierbar, ohne dass ein Test das zeigt. Muss verbindlich ins Folgepaket (T-G07-016).

**Neuer eigener Fund F-2 (verifier, MITTEL):** Der DB-Guard ist keine selbsttragende zweite Schicht
— er prueft die sieben `payment_*`-Felder nicht selbst, sondern leitet sie aus
`invoices_f15_amounts_chk` ab. Wird dieser CHECK je gelockert, wird der Storno-Guard still
schwaecher. Benannter Architekturkompromiss, kein Blocker.

**Neuer eigener Fund F-3 (verifier, HOCH, Owner-Ebene):** K-G07-004/T-G07-016/`_MODULDOSSIERS`
kommen in KEINER nach D-GOV-001 autoritativen Quelle vor (nicht in `AGENTS.md` — anders als der
Auftragstext annimmt, referenziert `AGENTS.md` `_MODULDOSSIERS` NICHT separat; nicht in
`quality/authoritative-sources.json`; nicht in `MODULKARTE_KANON.md`/`00_ABC_INDEX.md`/
`CURRENT_STATE.md`). Einzige Repo-Treffer sind Agent-Memory-Dateien selbst. Zusaetzlich bestaetigt:
`missions/F1_ORDER_TO_CASH_PILOT_001.yml` bildet weiterhin ein ANDERES aktives Paket ab
(`branch: path1/a2-phillip-recovery-20260919`, `active_package: PATH1_UI_CONVERGENCE`) — die
autoritative Aktiv-Ausfuehrungswahrheit kennt dieses B1-Paket nicht.

**Why:** F-3 ist die einzige Sache, die dieses PASS kippen koennte — dann als
`BLOCKED_PRODUCT_DECISION` (Ursache liegt in Governance/Dokumentenzuordnung, nicht im gelieferten
Code), nie als `FAIL_INTERNAL`.

**How to apply:** Ich (chief-conductor) darf F-3 nicht selbst aufloesen (Owner muss entscheiden:
Dossier als D-GOV-001-Quelle nachtragen ODER Mission auf tatsaechlich aktives Paket fortschreiben
ODER Ausnahme dokumentieren). Gesamtstatus im Bericht an PL: `PROPOSED_PASS` fuer die zwei engen
Reverts + Migration/Test-Scope, mit F-1/F-3 als OPEN und R3/F-2 als benannte Restrisiken. Nie
"K-G07-004 geschlossen" oder "T-G07-016 erfuellt" behaupten — Test wurde nie ausgefuehrt.

## Runde 5 (2026-09-27): Review-Nacharbeit PR #114 kehrt Runde-4-Descope erneut um — CI-Step wieder da

Ein Review von PR #114 (Verdict FAIL) verlangte woertlich genau das, was Runde 4 auf
Owner/PL-Weisung entfernt hatte: den DB-Nachweis-Test in `quality.yml` hinter dem ungepinnten
Fresh-Schema-Reset verdrahten. Ich habe wieder an build-engineer delegiert (Allowlist: NUR
`.github/workflows/quality.yml` + `quality/eslint-baseline.json`), dann an qa-test-verifier zur
unabhaengigen Pruefung.

Ergebnis: Platzierung, Env-Vertrag, `judgeContractHash`-Refresh — alles technisch korrekt und vom
Verifier unabhaengig nachgerechnet (nicht nur dem Builder-Bericht geglaubt). ABER Verifier-Verdikt
ist `BLOCKED_PRODUCT_DECISION`, nicht PASS, aus zwei Gruenden:
1. Der Review-Wortlaut verlangt "am Exact-SHA erfolgreich ausgefuehrt" — das existiert nicht, weil
   Aenderung nur im Arbeitsbaum liegt (kein Commit/Push, wie vom Auftrag verlangt: "KEINE
   Git-Kommandos ueberhaupt"). Der reale Beweis kann erst NACH Commit/Push/CI-Lauf entstehen.
2. **Governance-Oszillation (QA-02/FND-05):** Derselbe CI-Step wurde in Runde 3 gebaut, in Runde 4
   auf Owner/PL-Weisung entfernt (Scope-Trennung), jetzt in Runde 5 vom Review erneut verlangt.
   Verifier fand zusaetzlich: die Runde-4-Weisung ist NICHT in git rekonstruierbar (`git log --all
   -S "F1.4 Storno payment-gate"` liefert leer) — einzige Quelle dafuer ist der Agent-Memory-Bericht
   selbst. Ohne schriftliche Verankerung oszilliert diese Entscheidung.

**Why:** [[feedback_ci_schema_pin_pattern]] bestaetigt sich ein drittes Mal identisch (Platzierung
zwingend hinter dem einzigen ungepinnten Reset, Pins bei 534/578 nicht anfassen). Das eigentliche
Problem ist nicht mehr technisch, sondern dass eine Scope-Entscheidung (CI-Wiring im Paket vs.
Folgepaket) dreimal in wechselnde Richtungen getroffen wurde, ohne dass eine autoritative Quelle
das je festhielt — das ist genau die Art "verlorene Entscheidung", die ich als chief-conductor
verhindern soll.

**How to apply:** Bei einer moeglichen Runde 6 (z.B. erneuter Revert-Wunsch): NICHT still der
neuesten Anweisung folgen. Immer explizit benennen, dass dies die vierte Kehrtwende zu genau
diesem CI-Step ist, und verlangen, dass die Entscheidung schriftlich in einer autoritativen Quelle
(z.B. Kommentar im PR, Eintrag in `NON_LOSS_REGISTER.md` oder der Missionsdatei) landet — nicht nur
in Agent-Memory. Gesamtstatus fuer PR #114 bleibt technisch PROPOSED_PASS fuer den Diff selbst,
aber der Merge-Freigabe-Status haengt am noch fehlenden echten CI-Gruen am Exact-SHA (kann ich als
Agent nicht herstellen, da keine Git-Schreiboperationen erlaubt sind) und an der ungeklaerten
Governance-Frage. Siehe auch qa-test-verifier's eigene Memory-Datei
`project_b1_storno_ci_wiring_oscillation.md` fuer Details.
