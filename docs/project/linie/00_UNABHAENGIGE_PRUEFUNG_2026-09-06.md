# Unabhängige §5-Prüfung (Prüfer ≠ Autor) — Stand 2026-09-06

*Diese Datei erfüllt `PROBLEMLOESUNGEN.md` P6: der „aufgeräumt/fertig"-Claim wird NICHT vom Autor selbst benotet. Rotstand von einem unabhängigen Prüf-Chat. Der Autor (Orchestrator) hat danach reagiert; die Reaktions-Spalte ist wieder autor-seitig und muss beim nächsten Durchlauf erneut unabhängig geprüft werden.*

## Verdikt des Prüfers
Der Ordner ist von „chaotisch" auf „sehr guter Bauplan" gesprungen. **Aber** die Behauptung „jeder dumme Chat baut in 3 Tagen exakt dieselbe Live-App" ist **falsch** — aus strukturellen Gründen, nicht aus Nachlässigkeit:
- Der Ordner enthält absichtlich Entscheidungen, die nur der Owner treffen kann.
- Zwei Pflicht-Inputs lagen außerhalb `02_app`.
- Verschiedene LLMs erzeugen nie byteidentischen Code. Erreichbar ist nur: **„jeder Chat besteht dieselben Gates"** — und die Gates fehlen noch im Code.

## Die vier benannten Lücken + Status nach PR #76
1. **Suchleiste-Modul fehlte physisch** (lag in `00_BIBEL\_parallel`). → **GESCHLOSSEN:** Lieferung ist im Repo (`_lieferungen/suche/`); Modulkarte-Zeile korrigiert. Rest = forken nach `src/modules/suche/` (Bau).
2. **Owner-Entscheidungen auf dem kritischen Pfad** (B1/B3/Skonto, AMBIG-Routen, Rolf-Route/`baeder`). → **GESCHLOSSEN:** alle im Register §7 #2–#9 eingefroren; „PL entscheidet selbst" aufgehoben; AMBIG (`items`/`telefonnotiz`/`lager`/`lieferanten`) entschieden.
3. **CI-Gates nur Prosa, nicht im Code** (S0/S1, `src/modules/`). → **TEILWEISE:** S0 (Tenant-Bann) gebaut (PR #75). **S1 (fünf Gates) offen — das ist Code, der nächste Bau-Schritt, kein Aufräumen.** Bis dahin erzwingt der Ordner die Regeln durch Text, nicht durch die CI. Ehrlich als SOLL-nach-S1 markiert.
4. **§5-Prüfung nicht im Repo** (Interessenkonflikt). → **GESCHLOSSEN durch diese Datei.**

## Ehrliche Rest-Wahrheit
- **Entscheidungsfrei:** ja (Stand 2026-09-06). Keine offene Owner-Frage auf dem kritischen Pfad.
- **Bau-frei / hand-to-any-chat bis „live":** NEIN. Es fehlt der einzige echte Determinismus-Hebel — **S1: die fünf CI-Gates** (Manifest-Pflicht, positive Fassade/Deep-Import-Verbot, Tenant-Injektion, Cross-Modul nur über `v_*`, UI-Contract). Erst rote Gates machen abweichende Ergebnisse unmöglich.
- **Live schaltet der Owner**, nicht ein Chat (Secrets, Remote-Migration, Deploy, RLS) — per Design.

## Nächster Schritt (Bau, nicht Aufräumen)
S1 als Writer-Pakete spezifizieren und bauen. Danach: erneute unabhängige §5-Prüfung gegen den Abnahmetest in `00_ABC_INDEX.md`.

## NACHTRAG (Autor-Seite, 2026-09-06 abends — erneut unabhängig zu prüfen)
- Lücke 3 ist als **Code** geschlossen: PR #75 = S0 (Tenant zentral, ESLint-Verbot, alle Fundstellen mechanisch verifiziert) **+ S1** (`scripts/quality/check-module-gates.mjs`, Nähte 1/2/4/5/6 in quality.yml und geschützt in eslint-ratchet.yml; Beweis-Tests `src/test/s1_module_gates.test.ts`). Unabhängiges Red-Team des Gates: 2×P0 + 7×P1 gefunden und geschlossen (`9f9332c`).
- Dabei aufgedeckt und behoben: die ESLint-Ratsche hatte keinen Migrationspfad (jede Regeländerung war unmergebar) → D-QA-001 / PROBLEMLOESUNGEN P8, ebenfalls unabhängig red-teamt (`97f3161`).
- Der Runner-PL (Codex) kam **unabhängig** zum gleichen Ratschen-Befund (Commit 8b0d1e1, Nullmutation) — zwei Prüfer, ein Befund.
- Zwei Punkte kann nur der Owner: **Merge #75** und **Required Checks** (`ratchet`, `Fresh Supabase replay`) in der Branch-Protection.
- Die Aussage „Heute erzwungen: nur der Tenant-Literal-Bann" oben gilt bis zum Merge von #75; danach gilt der SOLL-Zustand des Abnahmetests.
