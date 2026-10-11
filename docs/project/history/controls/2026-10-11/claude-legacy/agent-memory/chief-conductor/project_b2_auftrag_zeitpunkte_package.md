---
name: project-b2-auftrag-zeitpunkte-package
description: Paket B2 Auftrag-Zeitpunkte (Branch claude/kr-b2-auftrag-zeitpunkte) — Analyse-vor-Bau stoppt Storno-Teil vollstaendig, Zeitpunkt-Teil stark verengt
metadata:
  type: project
---

Auftrag 2026-09-27: "Eindeutige Zeitpunkte 'fertig'/'abgeholt' sowie Storno-Behandlung des Auftrags
laut G04 (Voraussetzung Termintreue); vorhandene Commands (orderStationCommand.ts,
orderFreezeCommand.ts, recordGoodsOutCommand.ts) nutzen, keine Parallelwahrheit." Verbindliches
Dossier: `_MODULDOSSIERS/G04_AUFTRAEGE/` (Status im Dossier selbst: BAUBEREIT, aber §9-Review laut
eigenem Bericht NICHT erfolgt).

Wie bei B1 ("Du bist der einzige Writer" = Runner-Boilerplate) an drei Spezialisten zur
verpflichtenden Analyse-vor-Bau delegiert: requirements-archaeologist, data-contract-auditor,
platform-architect (parallel, KEIN Code). Siehe [[feedback_sole_writer_verifier_conflict]].

## Ergebnis: Alle drei Spezialisten stoppen das Paket unabhaengig, konvergent

**Storno-Teil — BLOCKED_PRODUCT_DECISION, einstimmig 3/3:**
- Das G04-Dossier selbst verbietet die Storno-Implementierung: `A-G04-023`/`T-G04-024` = nur ein
  ausgegrautes UI-Element "In Klaerung", `ORDER_CANCELLED_V1` explizit "FEHLT — nicht
  implementieren" bis `Q-G04-002` (Owner-Entscheidung) geklaert ist. Der PL-Auftragstext
  ("Storno-Behandlung laut G04") widerspricht damit dem eigenen Referenzdokument.
- Technisch mit den drei genannten Commands nicht abbildbar: kein Storno-Status im
  `orderLifecycleContract` (4 fixierte Werte), ein 5. Status wuerde mehrere KPI-/Overlay-Views
  fail-closed rausfallen lassen bzw. still aus `wip_count` verschwinden lassen
  (`v_goods_out_ui_state_v1.integrity_ok`, `v_werkstatt_kpis_v1`, `f1_3_customer_summary`). Ein
  additiver zweiter Achsen-Ansatz (`cancelled_at`/`cancel_reason` analog D-ARCH-002 "Ort ≠
  Abrechnung") waere die einzig additiv-vertraegliche Variante, ist aber selbst ein NEUER
  Schreibweg (neues Command + Event + DB-Guard + Reversal-Pfad) — verstoesst gegen die
  Auftragsvorgabe "keine neue Tabelle/Schreibweg ausser Dossier verlangt es" (Dossier verlangt es
  ausdruecklich NICHT).
- `_MODULDOSSIERS/G04_AUFTRAEGE/` ist wie `G07` bei B1 in KEINER D-GOV-001-Quelle verankert
  (`quality/authoritative-sources.json` kennt es nicht) — systemischer Governance-Fund, dritte
  Wiederholung des Musters.

**Zeitpunkt-Teil — stark verengt, mehrere offene Fachfragen:**
- "fertig" (`orders.completed_date`) existiert bereits, ist aber (a) MUTABEL bei Korrektur/Refreeze
  (`orderFreezeCorrectionCommand.ts:339-340` setzt NULL, `orderFreezeCommand.ts:435` schreibt neu —
  ein korrigierter+neu gefreezter Auftrag zeigt die ZWEITE Freeze-Zeit, nicht die urspruengliche)
  und (b) redundant zu `private.order_freezes.frozen_at` (unveraenderlich, per Trigger), zwei
  Konsumentenkreise ohne erklaerte Vorrangregel. Echter, vom Dossier nicht behandelter Fachpunkt:
  ist die erste oder letzte Fertigmeldung die KPI-relevante Wahrheit? (Vorschlag `Q-G04-009`).
- "abgeholt" hat KEINE Spalte, ist aber bereits ohne Migration ueber `events.created_at` des
  `ORDER_PICKED_UP_V2`-Events lesbar (Praezedenz: `private.v_goods_out_ui_state_v1` exponiert das
  schon als `goods_out_occurred_at`).
- Minimal-invasive Bauempfehlung (platform-architect): EIN additiver Read-Contract
  `private.v_order_lifecycle_timestamps_v1` (min(occurred_at) je Eventtyp/Order), KEINE neue
  Spalte auf `public.orders`, KEIN neuer Schreibweg. Aber: zwei technische Vorfragen ungeklaert —
  gibt es eine DB-Constraint die genau EIN erfolgreiches `ORDER_FROZEN_V1`/`ORDER_PICKED_UP_V2` pro
  Auftrag garantiert (sonst braucht der View explizite `min()`-Semantik statt impliziten 1:1-Join)?
  Und was passiert mit `fertig_at` nach einer Freeze-Korrektur (bleibt/verschwindet/zweiter Wert)?
- **Kein legitimer Abnehmer**: der einzige im Dossier genannte Konsument (`getOrderTimelinessFacts`
  fuer M02/Termintreue-Analyse) ist ein Modul, das `MODULKARTE_KANON.md` EXPLIZIT geloescht hat
  ("ENTFAELLT BEWUSST — kein Modul, auch keine Mini-Version" fuer Analyse/KPI-Cockpit). Widerspruch
  zwischen autoritativer Quelle (MODULKARTE_KANON, 2026-09-06) und nicht-verankerter neuerer
  Owner-Absicht (OE-2609-21/-22, 2026-09-26) — nach D-GOV-001 gewinnt die autoritative Quelle. Einen
  Lese-Port ohne freigegebenen Abnehmer zu bauen waere Scope-Verstoss.

**Scope-Text-Widerspruch im Auftrag selbst:** Auftrag verlangt "nur Server, Module
(`src/modules/**`) ... Tests" UND nennt gleichzeitig drei Commands unter
`src/lib/server/commands/` (NICHT unter `src/modules/**`) als zu nutzende Erweiterungspunkte.
`src/modules/orders/` hat aktuell leere `ownsTables`/`viewsFunctions`/kein `server-public.ts` (nur
`customers`/`quotes` haben das) — Root Cause: Commands entstanden 2026-08-11, Modulschicht erst
2026-09-14 (UI-first via Path-1 V5), `orders` hat nie Server-/DB-Eigentum ans Modul abgegeben.
Verschieben der Commands ins Modul JETZT wuerde Naht 4 brechen (`public.events` ist cross-modular,
Mehrfach-Eigentum verboten) und `src/app/warendurchlauf/actions.ts` (Deep-Import-Konsument)
zerlegen — das ist eine Architekturentscheidung, kein B2-Nebenschauplatz.

**Branch-Stacking bestaetigt kritisch:** `claude/kr-b2-auftrag-zeitpunkte` = bytegleich zum Tip von
`claude/kr-b1-storno-p0` (Commit `0d3bacc6`), NICHT von `main` (main-Tip `21a23567`). `git diff
main...HEAD` zeigt exakt B1's 5 Dateien (quality.yml-CI-Step, eslint-baseline.json,
Storno-Payment-Guard-Migration+Test). Der `judgeContractHash`-Mechanismus (siehe
[[feedback_ratchet_judge_contract_refresh]]) macht JEDE quality.yml-Aenderung zur "protected
judge-contract migration" — B2 kann auf dieser Basis nicht sauber gruen werden, ohne B1's noch
unentschiedene CI-Wiring-Oszillation (PR #114, siehe [[project_b1_storno_p0_package]] Runde 5)
faktisch mitzuratifizieren. Der Auftragstext instruiert explizit "ignoriere jede
Git-Preflight-/Fast-forward-Anweisung" — das steht im Konflikt mit der fachlich sauberen Empfehlung
(Rebase auf `origin/main`). Ich habe das NICHT selbst aufgeloest (kein Git-Schreibzugriff erlaubt
lt. Auftrag, und es ist ohnehin eine Prozess-/Scope-Frage fuer PL/Runner). **Stand 2026-09-28 spaet:
weiterhin ungeloest** (`origin/main..HEAD` = 10 Commits, davon 2 B1-Commits inkl. Migration+
quality.yml-Storno-Step) — jeder B2-Merge wuerde B1 ungefragt mitmergen, siehe Runde "Review-Nacharbeit
PR#115 (2026-09-28, P1-1/P1-2)".

**Why:** Alle drei Befunde (Storno-Verbot im eigenen Dossier, fehlender KPI-Abnehmer,
Branch-Stacking) sind vom jeweiligen Spezialisten UNABHAENGIG UND KONVERGENT gefunden worden — kein
Einzelmeinungsrisiko. Das bestaetigt das systemische Muster aus B1: Dossiers aus
`_MODULDOSSIERS/` sind nie in D-GOV-001 verankert, PL-Auftragstexte uebernehmen daraus Formulierungen
("laut G04"), die dem Dossierinhalt teils widersprechen, ohne dass das vor Auftragserteilung
gegengeprueft wurde.

**Zusatzfunde data-contract-auditor (Detailrunde):** Event-Payload fuer `ORDER_PICKED_UP_V1/V2` ist
per DB-CHECK exakt fixiert — kein Feld nachruestbar ohne neue `V3`-Version (Payload+Parser+View+
Constraint-Test). Nach Rechnungsstorno kann ein Auftrag heute trotzdem noch nach `abgeholt` laufen
(`recordGoodsOutCommand.ts:439-444`, Zweig `invoiceNotIssued` durchlaesst es) — Sicherheitsluecke,
unabhaengig von B2 relevant. `payment_mode`-Guard vergleicht Whole-Row-Diff
(`20260905201850:62-66`) — jede neue Spalte darf NIE im selben UPDATE wie `payment_mode` gesetzt
werden, sonst bricht der Guard mit falschem Fehler. Kein Unit-Test fuer `orderFreezeCommand`
existiert (`__tests__/orderFreezeCommand.test.ts` fehlt) — vor jeder Aenderung an
`completed_date`-Semantik nachziehen.

**How to apply:** Bei Fortsetzung/Owner-Antwort: (1) Storno bleibt bis `Q-G04-002` vollstaendig
ausserhalb des Scopes — niemals als "erledigt" oder "vorerst so gebaut" melden. (2) Falls PL trotz
Governance-Konflikt (MODULKARTE_KANON vs. OE-2609-21/-22) einen Zeitpunkt-Read-Port bauen laesst:
erst Rebase auf sauberes `origin/main` verlangen (nicht meine Entscheidung, PL/Runner muss das
anordnen), dann die zwei technischen Restfragen (Event-Eindeutigkeits-Constraint,
Freeze-Korrektur-Semantik) VOR Bau klaeren, dann engste Allowlist nach platform-architect §8(c)
verwenden (nur additive Migration + View, `orders.manifest.json` nur 2 Felder, KEINE
`.github/workflows/**`/`quality/*.json`-Beruehrung). (3) Scope-Text-Widerspruch "nur Module" vs.
Commands unter `src/lib/server/commands/` braucht explizite PL-Klarstellung, nicht stille
Interpretation durch build-engineer. Nie an build-engineer delegieren, solange diese drei
PL/Owner-Entscheidungen offen sind.

[... Runden 2-9 und Review-Nacharbeit-Runden 1-4 (2026-09-27/28): siehe Git-Historie dieser Datei /
vorherige Fassung fuer Details zu Provenienz-Fix, private->public.v_*-Korrektur, W4-Inventar-Nachzug,
Zeitzonen-/promised_due_date-Fix, .gitignore-Scope-Revert. Kurzfassung: Zeitpunkt-Teil ist inhaltlich
weitgehend fertig und mehrfach unabhaengig bestaetigt (V2-Ableitung, Tenant-Isolation, Zeitzonen-
Stabilitaet), aber PROPOSED_PASS bleibt durch drei wiederkehrende Governance-Fragen gedeckelt:
kein legitimer Konsument (MODULKARTE_KANON loeschte M02), Missionsdatei deckt das Paket nicht ab,
Branch-Stacking auf unentschiedenem B1. ]

## Review-Nacharbeit PR #115 (2026-09-28, neue Runde): P1-1 Abholzeitpunkt-V1 vs. P1-2 F0-Evidence

Neuer Reviewbefund (FAIL, 2 P1): (P1-1) `orderTimelinessFacts.ts:527` verwirft den Zeitpunkt eines
eindeutigen, aktiv erzeugten `ORDER_PICKED_UP_V1`; Testzeile 699 zementiere faelschlich `null`.
(P1-2) `docs/evidence/f0/W4_CROSS_MODULE_READ_PORT_INVENTORY.json:114` sei ausserhalb der
B2-Allowlist veraendert (Runde-3-Nachzug der zwei additiven Eintraege fuer die neuen Views) und
muesse entfernt werden.

**P1-1 — kein Mechanik-Fix, echter Datenvertrags-Konflikt.** Vor Delegation an build-engineer selbst
gegengeprueft + `data-contract-auditor` unabhaengig beauftragt (read-only). Ergebnis, mit Belegen:
- G04-Dossier `04_SCHNITTSTELLEN_DATEN.md` §Soll-Ist Punkt 3 (Zeile 98): "Abholzeitpunkt kommt aus
  genau einem validen `ORDER_PICKED_UP_V2`-Ereignis" — schliesst V1 explizit aus. Geschriebenes
  Abnahmekriterium `07_ABNAHME_TESTS.md` T-G04-021 ist V2-only formuliert.
- ABER `docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` D-F15-003 (Owner
  2026-09-09, Zeile 188, ECHTE D-GOV-001-Quelle): "`ORDER_PICKED_UP_V1` und `INVOICE_CREATED_V1`
  bleiben vollstaendig unveraendert" — V1 ist der unveraenderte NORMALPFAD (Rechnung bereits
  gestellt), V2 wurde nur additiv fuer den Sonderfall "Rechnung noch nicht gestellt" eingefuehrt.
  Bestaetigt durch `recordGoodsOutCommand.ts:517`: `eventType = invoiceNotIssued ? V2 : V1` — V1
  ist heute ein aktiv laufender Schreibpfad, kein Altschema. Die SQL-View selbst
  (`20260927120000_b2_order_timeliness_read_contract.sql:105`) liest bereits BEIDE Eventtypen —
  der Ausschluss passiert erst in TypeScript (`orderTimelinessFacts.ts:509`, `single = validV2[0]`).
- Konsequenz: Fuer den STANDARDPFAD (Rechnung bereits gestellt = V1) liefert der Port heute NIE
  einen Abholzeitpunkt — nur fuer den additiven Sonderfall V2. Der Review-Fund ist fachlich
  vermutlich berechtigt (Register D-GOV-001-Quelle > nicht verankertes `_MODULDOSSIERS`), ABER die
  Umsetzung wuerde ein GESCHRIEBENES Abnahmekriterium (T-G04-021) inhaltlich aendern — das ist eine
  Produktentscheidung, kein Writer-Fix. `data-contract-auditor` fand zusaetzlich einen echten
  Selbstwiderspruch im heutigen Code: derselbe Fakt behauptet gleichzeitig "gueltiges V1 vorhanden"
  (`PICKUP_CONTRACT_V1_ONLY`) UND "kein Abholereignis" (`picked_up_status_without_pickup_event`,
  Konsistenzpruefung Zeile 601-603) — zwei Wahrheiten ueber dasselbe Ereignis.
- **Nicht umgesetzt, absichtlich.** An PL/Owner zurueckgegeben: neuer Registereintrag noetig ("Abholzeitpunkt
  wird durch genau ein valides V1 ODER V2 belegt"), plus Korrektur von `04_SCHNITTSTELLEN_DATEN.md:98`
  und T-G04-021 im selben Zug. Erst danach Writer-Auftrag mit vollstaendiger, vom Auditor bereits
  gelieferter Liste zu aendernder Testzeilen (u.a. `orderTimelinessFacts.test.ts:271-343`,
  `b2_order_timeliness_read_contract.integration.test.ts:699-704`, `:1165`, `:1203-1215`).

**P1-2 — sauberer Mechanik-Fix.** An build-engineer delegiert, Allowlist NUR diese eine JSON-Datei:
Revert auf `origin/main`-Stand (Hash-Vergleich `git hash-object` == `git rev-parse origin/main:<datei>`
bestaetigt Byte-Identitaet). Unerwarteter Nebenbefund (Writer UND unabhaengiger qa-test-verifier
konvergent bestaetigt): das W4-Gate (`check-w4-cross-module-read-ports.mjs`) entdeckt `public.v_*`
NIEMALS automatisch (Regex nur `private\.v_[a-z0-9_]+`) — der entfernte Eintrag war freiwillige
Selbstverschaerfung, kein Automatismus. Nach dem Revert bleibt das Gate PASS (nicht wie im Reviewtext
implizit erwartet FAIL), weil es fuer `public.v_*`-Views strukturell nie greift. Sicherheitsneutral:
`security_invoker=true` wird weiterhin per Live-DB-Integrationstest geprueft
(`b2_order_timeliness_read_contract.integration.test.ts:613-632`), nicht nur per totem JSON-Pin.

**Konvergenz Writer + qa-test-verifier:** beide unabhaengig `git diff origin/main -- <json>` leer,
`tsc --noEmit` Exit 0, `check-w4-cross-module-read-ports.mjs --check` PASS, `quality:module-gates`
PASS, 26/26 Unit-Tests fuer `orderTimelinessFacts.test.ts` gruen, P1-1-Dateien (`orderTimelinessFacts.ts`,
beide Testdateien) nachweislich UNVERAENDERT (`git diff HEAD --stat` leer). Verifier bestaetigt
zusaetzlich eigenstaendig (nicht nur geglaubt), dass die Nichtumsetzung von P1-1 sachlich gerechtfertigt
ist (beide Quellen selbst gegengelesen).

**Why:** Ein Review-Verdict kann selbst fachlich falsch bzw. unvollstaendig sein (hier: verlangt
implizit, ein geschriebenes Abnahmekriterium stillschweigend per Testanpassung zu kippen) — genau wie
bei [[feedback_verify_reported_gate_failures]] gilt: Reviewbefunde vor Delegation gegenpruefen statt
blind weiterreichen, besonders wenn der Fix eine Fachentscheidung (Data Contract) veraendern wuerde.

**How to apply:** MAIN_REPORT dieser Runde: `STATUS: BLOCKED` (P1-1 nicht erfuellt, absichtlich).
P1-2 ist im Arbeitsbaum fertig und unabhaengig bestaetigt, aber erst nach Commit/Push durch den
Runner wirklich "aus PR #115 entfernt" (Verifier-Vorbehalt: `origin/main...HEAD` zeigt die Datei bis
dahin weiterhin als geaendert). Branch-Stacking auf B1 (10 Commits gegenueber `origin/main`,
davon 2 B1-Commits) bleibt zusaetzlich unveraendert offen und merge-relevant. Bei einer Folgerunde:
NICHT wieder bei Null anfangen — der Auditor hat bereits die vollstaendige Testzeilen-Liste fuer eine
kuenftige P1-1-Umsetzung geliefert, sobald PL/Owner den Registereintrag nachgezogen hat.

## Review-Nacharbeit "Runde 2" PR #115 (2026-09-28, spaeter): identischer P1-1-Befund erneut vorgelegt

Neuer Auftragstext (wieder "Du bist der einzige Writer", wieder kein Sub-Agenten-Verbot beachtet,
siehe [[feedback_sole_writer_verifier_conflict]]) verlangt woertlich denselben P1-Fund wie oben
("Runde 1"): `orderTimelinessFacts.ts:527` verwirft den Zeitpunkt eines aktiv erzeugten, eindeutigen
`ORDER_PICKED_UP_V1`; Testzeile 699 zementiere das. Diesmal wird nur noch P1-1 genannt (P1-2/F0-W4
wird im Auftragstext selbst als "behoben" bestaetigt).

**Vor Delegation frisch selbst gegengeprueft (keine Spezialisten erneut beauftragt, da Frage
bereits 2x konvergent beantwortet wurde) — Ergebnis: NICHTS hat sich veraendert:**
- `git log` auf `KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md`: letzter Commit 2026-09-21,
  VOR Runde 1 dieses Befunds. Kein neuer Registereintrag zur V1/V2-Frage seit meinem BLOCKED-Bericht.
- Dossier `04_SCHNITTSTELLEN_DATEN.md` Soll-Ist Punkt 3 unveraendert: "Abholzeitpunkt kommt aus
  genau einem validen `ORDER_PICKED_UP_V2`-Ereignis." `07_ABNAHME_TESTS.md` T-G04-021 weiterhin
  wortgleich V2-only formuliert.
- `D-F15-003` im Register (Owner 2026-09-09) weiterhin vorhanden und unveraendert: V1 bleibt
  aktiver Normalpfad (Rechnung bereits gestellt), nicht Altschema.
- `orderTimelinessFacts.ts` selbst ist seit Runde 1 weitergereift (Kommentare Zeile 408-429
  dokumentieren jetzt explizit, dass V1 kein Altschema ist und ein strukturell kaputtes V1 sonst
  faelschlich als "gueltiger, nur nicht verwendbarer Vertrag" durchgehen wuerde) — bestaetigt den
  Befund noch deutlicher, aendert aber nichts an der Kernaussage: Zeile 527 verwirft weiterhin
  jeden validen V1-Zeitpunkt. Der Selbstwiderspruch besteht ebenfalls unveraendert fort
  (`PICKED_UP_STATUS_WITHOUT_PICKUP_EVENT`-Konsistenzhinweis feuert bei ABGEHOLT+validem V1, obwohl
  ein echtes Abholereignis existiert — Zeile 601-603).
- Keine der drei zuvor identifizierten Blocker-Bedingungen ist aufgeloest: (1) kein neuer
  Registereintrag, (2) `04_SCHNITTSTELLEN_DATEN.md:98`/T-G04-021 nicht angepasst, (3) kein
  legitimer M02-Abnehmer neu freigegeben (MODULKARTE_KANON-Loeschung weiterhin unwidersprochen).

**Entscheidung: erneut NICHT an build-engineer delegiert, erneut `BLOCKED_PRODUCT_DECISION`.** Ein
Review-Verdict — egal wie oft wortgleich wiederholt — ist keine D-GOV-001-Quelle und kann eine
Produktentscheidung (welcher Eventvertrag ist die KPI-Wahrheit) nicht ersetzen. Wiederholtes
Vorlegen desselben Befunds ohne begleitenden Registereintrag aendert die Governance-Lage nicht;
es waere ein Autoritaetsfehler, beim zweiten Mal "nachzugeben" nur weil die Anfrage wiederkommt.

**Why:** Genau das Muster aus [[feedback_ci_schema_pin_pattern]]/B1-Runde-5-Governance-Oszillation:
ein wiederholt vorgelegter Befund ohne schriftliche autoritative Entscheidung dazwischen darf nicht
durch Wiederholung an Gewicht gewinnen. Sonst wird die Pruef-Kette (Review kann Autoren
uebersteuern, ohne dass ein Owner je entscheidet) faktisch ausgehebelt.

**How to apply:** Bei einer moeglichen "Runde 3" mit demselben Befund: sofort auf diesen Eintrag
verweisen, NICHT erneut volle Spezialisten-Analyse wiederholen (Frage ist bereits 2x unabhaengig
konvergent beantwortet), nur pruefen ob sich seitdem am Register/Dossier etwas geaendert hat (kurzer
git-log-Check reicht). Antwort bleibt BLOCKED_PRODUCT_DECISION, bis ein echter Registereintrag
vorliegt, der entweder (a) `D-F15-003` explizit um "V1 liefert ebenfalls den realen Abholzeitpunkt"
erweitert (dann muss `04_SCHNITTSTELLEN_DATEN.md:98` und T-G04-021 im selben PR mitgezogen werden)
oder (b) den Review-Befund selbst als ueberholt/falsch zurueckweist. Die vom Auditor bereits
gelieferte Testzeilen-Liste (`orderTimelinessFacts.test.ts:271-343`,
`b2_order_timeliness_read_contract.integration.test.ts:699-704`, `:1165`, `:1203-1215`) bleibt
gueltig fuer den Tag, an dem diese Entscheidung endlich getroffen wird.

## Runde 3 (2026-09-28, wieder als "Runde 2" bezeichnet): identischer P1-Befund, dritte Vorlage

Auftragstext wortgleich zu Runde 2 (derselbe Zeilenverweis `orderTimelinessFacts.ts:527`, dieselbe
Testzeile 699, P1-2/F0-W4 wieder als "behoben" bestaetigt). Nur Kurzcheck durchgefuehrt (wie in
"How to apply" oben vorgesehen), keine erneute Spezialisten-Runde:
- `git log -3` auf das Register: neuester Commit weiterhin `587282ac` 2026-09-21 — unveraendert seit
  Runde 1/2, kein neuer `D-F15-003`-Zusatz oder sonstiger Eintrag zur V1/V2-Frage.
- Dossier `04_SCHNITTSTELLEN_DATEN.md:98` weiterhin wortgleich V2-only; `07_ABNAHME_TESTS.md`
  T-G04-021 weiterhin V2-only formuliert; `01_ANFORDERUNGSKATALOG.md:22` (A-G04-018) verlangt
  ausdruecklich nur `ORDER_PICKED_UP_V2` als Quelle.
- Code selbst (`orderTimelinessFacts.ts:509-527`) unveraendert seit Runde 2: Zeile 527 verwirft
  weiterhin jeden validen alleinstehenden V1-Zeitpunkt.
- Erneut NICHT an build-engineer delegiert. Erneut `BLOCKED_PRODUCT_DECISION` gemeldet, mit
  explizitem Verweis auf Runde 1/2 statt neuer Analyse.

**Why:** Bestaetigt das Muster aus Runde 2 ein drittes Mal: Wiederholung eines Review-Befunds ohne
begleitende Registeraenderung darf die Governance-Lage nicht durch Beharrlichkeit kippen. Wenn
derselbe Text ein viertes Mal kommt, reicht wieder nur der Kurzcheck — es lohnt sich, in Zukunft
direkt im MAIN_REPORT selbst auf diese Wiederholungshistorie hinzuweisen, damit PL/Owner erkennt,
dass hier eine echte Entscheidung aussteht statt eines Umsetzungsproblems.

**How to apply:** Bei jeder weiteren Wiedervorlage: gleicher Kurzcheck (Register-git-log +
Dossier-Grep + Codezeile), keine neue Spezialistenrunde, Antwort bleibt BLOCKED_PRODUCT_DECISION.
Erwaege, dem PL nach der zweiten Wiederholung aktiv vorzuschlagen, die Owner-Entscheidung direkt
einzuholen statt das Paket erneut unveraendert zurueckzugeben.
