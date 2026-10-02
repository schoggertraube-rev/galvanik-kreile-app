<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G08_SUCHE — Offene Fragen

Alle Fragen wurden zuerst in Owner-Entscheidungen, Prior-Quellen, eigenem PL-Digest, beiden KOORD-Digests, Kanon, Projektplan, offenen Punkten und dem Ist-Code gesucht. Keine Frage blockiert einen stillen Ersatzweg; bis zur Klärung gilt die angegebene sichere Anzeige.

| Q-ID | Frage | Optionen | Empfehlung | wer klärt (Owner/PL/Designphase) | bis dahin in der App | Status | gesucht in: |
|---|---|---|---|---|---|---|---|
| Q-G08-001 | Welcher öffentliche Besitzer-Port darf Dokumente in G08 bereitstellen und welche Dokumentfelder sind suchbar? | A: keine Dokumentquelle in T-04; B: späterer enger L4-Port des besitzenden Fachmoduls; C: neue G08-Dokumentwahrheit | **B**, aber erst nach separater Portentscheidung; T-04 baut nur die Registry-Anschlussstelle und keine Dokumentdaten. | Owner/PL nach G03/G04/G05-Datenbesitz | `Dokumente — In Klärung`, gedämpft, nicht klickbar, keine Route, nicht in `checkedSources` | OFFEN (OP-10) | `OWNER_ENTSCHEIDUNGEN`; `PRIOR_QUELLEN_EINDEUTIG`; `PL_01a0ce4b`; `KOORD_late`; `KOORD_01a07c58`; MODULKARTE; ARCHITEKTUR 4c; `00_OFFENE_PUNKTE_KREILE.md` OP-10; Ist-Code |
| Q-G08-002 | Wann werden `CURRENT_STATE.md` und die aktive Mission an den bereits auf `origin/main` liegenden Suchkern angepasst? | A: Doku-Sync vor T-04; B: Doku-Sync im T-04-PR; C: alten Kandidatentext als Wahrheit behandeln | **A** oder spätestens **B**; Code darf als Salvage inventarisiert werden, aber sichtbarer Lieferstatus bleibt bis Full-Route-Abnahme offen. | PL | keine Lieferbehauptung; im aktuellen Zielrahmen kein aktiver Trigger, während des freigegebenen Baus höchstens `Suche — In Aufbau` | OFFEN (Doku-Drift, kein Produktentscheid) | `DOCUMENT_AUTHORITY`; `CURRENT_STATE`; `MASTERPLAN`; `F1_ORDER_TO_CASH_PILOT_001.yml`; `origin/main`-Codehistorie; P3-Evidence; beide KOORD-Digests |
| Q-G08-003 | Welche finalen `kr-`-Bausteine und bestätigten Wortlaute gelten für Karten-Laden, Nicht-mehr-verfügbar, Navigatorfehler, gesperrte Zielkarte und die grauen Zustände? | A: Designphase 1 ergänzt Varianten/Textset; B: heutiges CSS/Text ad hoc übernehmen; C: V5-CSS kopieren | **A**; Verhalten und empfohlene sichere Texte stehen in `02`, visuelle/produktsprachliche Freigabe erfolgt im Designsystem. | Designphase 1 / PL | Suchplatz `Suche — In Aufbau`; fehlende Resultattypen `{Quellenname} — In Klärung`; keine ausführbare Karte ohne belegten Zustand | OFFEN, fail-contained | V5 + vier Seitenreferenzen; OE-2609-03; `PRIOR_QUELLEN_EINDEUTIG`; PL-Digest; `SearchDialog.tsx`; Red-Team RT-19/22/25 |

## Nicht mehr offene Punkte

- Andere Zielapps liefern keine Anforderungen für dieses Dossier; geklärt durch Owner-Nachtrag (2) und `LERNINSEL_INPUT_2026-09-26.md`.
- Suchkern app-neutral, Kreile-spezifische Ports im Kreile-HostAdapter; verbindlich entschieden.
- V5 statt V6 und kein kopiertes Mock-CSS; verbindlich entschieden.
- Orders und Customers sind die aktiven Kreile-V1-Quellen; weitere Quellen werden ohne Besitzer-Port nicht erfunden.

