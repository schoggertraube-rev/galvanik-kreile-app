---
name: q-g04-008-not-ratified
description: Q-G04-008 (Tabellenbesitz orders) wird in Abnahmeauftraegen als "vom PL ratifizierte Entscheidung Option B" praesentiert, ist im autoritativen Dossier aber OFFEN mit fachlicher Neigung zu Option A — Praemisse nicht ungeprueft uebernehmen
metadata:
  type: project
---

Am 2026-09-28 kam ein Abnahmeauftrag (B2 / PR #115) mit der Praemisse: `ownsTables: []`
und `events.emits: []` im `orders`-Manifest seien "die vom PL/Owner **ratifizierte**
Entscheidung Q-G04-008 (gemeinsame Tabellen bleiben Hostbesitz)" — also Option B,
nur noch zu bestaetigen. Die Nachpruefung an der autoritativen Quelle widerlegt das
"ratifiziert":

`galvanik_kreile/_MODULDOSSIERS/G04_AUFTRAEGE/08_OFFENE_FRAGEN.md` Zeile 12 fuehrt
Q-G04-008 mit Status **"OFFEN – abgesichert"**, Owner **PL/Architektur**, drei Optionen
(A = G04 besitzt `orders/items/events` vollstaendig, B = gemeinsame Persistenz bleibt
Hostbesitz, C = gemischter Besitz je Feld). Die Empfehlungsspalte sagt ausdruecklich
**"A fachlich, aber erst nach PL-Architekturpruefung"** — die Neigung geht also zu A,
nicht zu B. Zusatz aus derselben Zeile: Bedingung fuer A war "Commands/Reads hinter
`src/modules/orders/server-public.ts` (FEHLT)". Genau diese Datei hat B2 nun angelegt,
womit die Vorbedingung teilweise erfuellt und die Frage *lebendiger* statt geschlossener
ist. Im Dossier steht ferner: "Manifest nicht als Beweis fuer leere Abhaengigkeiten
verwenden."

Im Repo `02_app` existiert kein Treffer fuer Q-G04-008 ausser in `.claude/agent-memory/*`
(nicht D-GOV-001-autoritativ); alle Peer-Memories nennen die Frage konsistent "offen".

**Why:** Wenn ein Pruefer die Praemisse "ratifiziert" uebernimmt, quittiert er eine
offene PL/Architektur-Entscheidung stillschweigend als erledigt. AGENTS.md verbietet
genau das (keine stille Prioritaetsentscheidung; `BLOCKED_GOVERNANCE_CONFLICT`). Der
Ist-Zustand `ownsTables: []` ist deckungsgleich mit Option B, aber Deckungsgleichheit
ist keine Ratifikation.

**How to apply:** `ownsTables: []` im orders-Manifest als *unveraendert gegenueber main*
und *konsistent mit Option B* bestaetigen — aber nie als "ratifizierte Entscheidung"
abnicken. Solange Q-G04-008 offen ist, gilt `public.v_*` fuer G04-Lesevertraege. Eine
behauptete Ratifikation ist nur gueltig, wenn sie im Dossier oder im
Entscheidungsregister nachweisbar ist; das Dossier ist vom 2026-09-26, eine spaetere
Owner-Freigabe muesste extern belegt werden. Verwandt:
[[reference-moduldossiers]], [[package-deliverables-arrive-uncommitted]].
