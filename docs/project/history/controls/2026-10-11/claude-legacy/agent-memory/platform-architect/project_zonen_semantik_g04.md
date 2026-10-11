---
name: zonen-semantik-g04
description: Europe/Berlin ist fuer G04-Terminfakten dossier-mandatiert; offen bleibt nur der Frist-Cutoff (Tag vs. Instant), nicht die Zonenwahl
metadata:
  type: project
---

Fuer G04-Termin-/Termintreue-Semantik ist `Europe/Berlin` die einzige kanonische Zone und bereits
entschieden (Dossier G04: F-G04-005, K-G04-007, `getOrderSchedule`-SPEZ, T-G04-015 "kanonischer
Kreile-Tag"). Eine "Zonenwahl offen"-Formulierung in Code/Migrationen ist daher kein offener Punkt,
sondern eine nicht umgesetzte Vorgabe.

Was wirklich offen ist (Owner PL/Produkt, Stand 2026-09-28, aufgetaucht bei PR #115 / Paket B2):
der **Frist-Cutoff** beim Vergleich von Fertig-Zeitpunkt (Instant) gegen bestaetigten Termin
(Kalendertag) — endet die Frist am Tagesende 23:59:59.999 Europe/Berlin oder an einer fachlich
zugesagten Uhrzeit/Abholzeit? Ohne diese Entscheidung ist keine Puenktlichkeitsquote (M02)
berechenbar. Distinkt von Q-G04-008 (Tabellen-Eigentum, siehe [[naht4-private-vs-public-views]]).

**Why:** Ein Review hat die Zonenfrage und die Cutoff-Frage vermischt und als eine offene
Owner-Entscheidung behandelt; das blockiert unnoetig, weil nur die zweite offen ist.

**How to apply:** Bei Terminfeldern Zonenwahl nicht mehr als offen behandeln — Berlin setzen.
Wenn ein Paket eine Quote/Vergleich Instant-gegen-Tag braucht, den Cutoff als
`BLOCKED_PRODUCT_DECISION` benennen statt eine Default-Uhrzeit zu waehlen.
