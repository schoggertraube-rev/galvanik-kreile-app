<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->

# Kreile — Dokumentenautoritaet

Stand: 2026-10-11, D-GOV-001 und D-GOV-004.

Jede Wahrheitsart hat genau eine Quelle:

| Wahrheitsart | Einzige Quelle |
|---|---|
| Projekt- und Rollenregeln | `AGENTS.md` |
| Vollstaendige Reihenfolge bis Live | `docs/delivery/KREILE_LIVE_PLAN_V1.json` |
| Aktives Paket und Laufphase | `missions/F1_ORDER_TO_CASH_PILOT_001.yml` |
| Produktentscheidungen | `docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` |
| Scope und Module | `docs/project/linie/MODULKARTE_KANON.md` |
| Architektur und Modulnaehte | `docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md` |
| Auf `main` belegter Lieferstand | `docs/project/CURRENT_STATE.md` |
| UI-Schichten und gebundene Quellen | `docs/project/linie/00_UI_REFERENZEN_PFADE.md` |

## Ausfuehrungsregel

Nur Plan und Mission steuern Arbeit. Der Plan legt alle 20 Pakete und ihre feste
Reihenfolge fest. Die Mission zeigt genau ein Paket daraus. Evidence beweist einen
konkreten Stand, steuert aber niemals Scope oder Nachfolger.

Alte Bauplaene, Paketmanifeste, Queue-Dateien, PR-Bundles, Tagesberichte und Dateien
unter `docs/project/history/**` sind Quellenmaterial oder Historie. Sie besitzen keine
Ausfuehrungsautoritaet. `quality/authoritative-sources.json` und die lokalen
Qualitaetspruefer erzwingen diese Zuordnung.

## Konfliktregel

Eine Quelle darf nur ihre eigene Wahrheitsart bestimmen. Bei UI gilt die geschichtete
Regel aus D-UI-DS-001: V1.1 fuer System/Komponenten, vier HTML-Seiten fuer Komposition,
V5 nur fuer Ablauf. Dadurch gibt es innerhalb des aktiven Kontextes keine freie Auswahl.

Eine neue dauerhafte Produkt- oder Strukturentscheidung erfordert eine konkrete
Owner-Entscheidung. Gewoehnliche Implementierungsdetails innerhalb eines Pakets nicht.
