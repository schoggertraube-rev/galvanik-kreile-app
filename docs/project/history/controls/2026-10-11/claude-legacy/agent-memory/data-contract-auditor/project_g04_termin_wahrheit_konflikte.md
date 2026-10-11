---
name: project-g04-termin-wahrheit-konflikte
description: Two unresolved governance conflicts about the G04 Termin-Wahrheit (due_date vs promised_due_date semantics, and V1 vs V2 as pickup-time source)
metadata:
  type: project
---

Zwei Vertragsfragen rund um die G04-Terminwahrheit sind NICHT vom Writer entscheidbar. Beide sind
2026-09-28 bei PR #115 (Paket B2 Auftrag-Zeitpunkte) aufgeschlagen.

**1. `due_date` = Zusage (G04) vs. `due_date` = Wunsch (G03).**
`_MODULDOSSIERS/G04_AUFTRAEGE/04_SCHNITTSTELLEN_DATEN.md` Z.69 + §Soll-Ist Punkt 1: `orders.due_date`
ist der bestaetigte Auftragstermin, `promised_due_date` ist Legacy read-only.
`_MODULDOSSIERS/G03_ANLEGEN_INTAKE/04_SCHNITTSTELLEN_DATEN.md` Z.75 sagt das Gegenteil als Ziel:
"`due_date` ist im Ziel der Terminwunsch; `promised_due_date` ist die Zusage" — inklusive
Vorwaertsmigration (Z.76) und Pflichtanforderung G03-A16/G03-T15, beide Felder getrennt zu
schreiben. Gleiche Wahrheitsart (zwei Moduldossiers), widersprechende Aussage →
`BLOCKED_GOVERNANCE_CONFLICT`-Kandidat. Offen bleibt zusaetzlich **Q-G04-001** (Owner PL/Kanon,
"OFFEN – abgesichert").

**2. Belegt ein valides `ORDER_PICKED_UP_V1` den Abholzeitpunkt?**
`04_SCHNITTSTELLEN_DATEN.md` §Soll-Ist Punkt 3 und `07_ABNAHME_TESTS.md` T-G04-021 nennen
ausschliesslich `ORDER_PICKED_UP_V2`; die Eventtabelle in §3 fuehrt V1 gar nicht. Der gebaute
Command `src/lib/server/commands/recordGoodsOutCommand.ts` schreibt aber V1 fuer den Zweig
"Rechnung bereits gestellt" — also fuer den Normalfall vorkasse/abholung — und V2 nur, wenn keine
Rechnung existiert. `11_IST_CODE_UMBAU.md` kennt beide Typen als GEBAUT. Wer V1 nicht wertet, hat
fuer die Mehrheit der Auftraege dauerhaft keinen Abholzeitpunkt und damit keine Kennzahl
"fristgerecht abgeholt" (`05_REGELN_SPERREN_KONFLIKTE.md` §3). → `BLOCKED_PRODUCT_DECISION`.

Zwei Belege, die 2026-09-28 bei PR #115 Runde 1 dazukamen und das Gewicht klar zugunsten
"V1 belegt einen Wert" verschieben:
- `KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` Z.188 (D-F15-003, ECHTE D-GOV-001-Quelle)
  fuehrt V2 als rein additiven Sonderfall "Rechnung noch nicht gestellt" ein und sagt:
  "`ORDER_PICKED_UP_V1` und `INVOICE_CREATED_V1` bleiben vollstaendig unveraendert". V1 ist damit
  der unveraendert vollwertige Normalbeleg, nicht der schwaechere.
- Die V1-Nullung erzeugt einen FALSCHEN Konsistenzhinweis: `pickedUpAt.value === null` bei
  `status = abgeholt` pusht `picked_up_status_without_pickup_event` — also "kein Abholereignis"
  fuer Auftraege, bei denen eines nachweislich existiert.

**Why:** Beides sieht wie ein Writer-Bug aus, ist aber eine Besitz-/Produktentscheidung. Ein
stiller Fix wuerde eine zweite Terminwahrheit beziehungsweise eine zweite Abholwahrheit einbauen.

**How to apply:** Reviewer-Forderungen zu `promised_due_date` oder zu V1-Abholzeitpunkten nicht als
Writer-Fix umsetzen. Was DOCH ohne neue Autoritaet zulaessig ist: das **Benennen** eines
Legacy-Widerspruchs als read-only Diagnose — dafuer gibt es Deckung in
`02_FUNKTIONEN_ABLAEUFE.md` F-G04-007 ("Fehlerfaelle: Legacy-Terminfelder widersprechen sich"),
K-G04-008 und A-G04-008. Siehe [[reference-g04-dossier]], [[open-q-g04-008-manifest-ownership]].
