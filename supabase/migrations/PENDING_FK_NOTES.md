# Offene Foreign-Key-Constraints

Diese FKs wurden in Migrationen 20260609_001..004 bewusst NICHT gesetzt,
weil die Zieltabellen aktuell aus anderen Sessions stammen und Namens-
stand noch nicht final ist.

| Tabelle             | Spalte              | Zieltabelle (geplant) |
|---------------------|---------------------|-----------------------|
| kostenstelle        | capacity_center_id  | capacity_center oder Alternative |
| periode             | geschlossen_von     | employee oder Alternative |
| forecast_version    | erstellt_von        | employee oder Alternative |

Verantwortung: Siglinder ergänzt FK-Constraints in eigener Migration,
wenn Zieltabellen final stehen.
