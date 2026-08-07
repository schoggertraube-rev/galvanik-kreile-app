ALTER TABLE kostenstelle ADD COLUMN IF NOT EXISTS energie_anteil_prozent numeric(5,2);

UPDATE kostenstelle SET energie_anteil_prozent = 50.00, verfuegbare_stunden_monatlich = 160 WHERE kuerzel = 'GAL' AND tenant_id = 'galvanik-kreile';
UPDATE kostenstelle SET energie_anteil_prozent = 20.00, verfuegbare_stunden_monatlich = 160 WHERE kuerzel = 'POL' AND tenant_id = 'galvanik-kreile';
UPDATE kostenstelle SET energie_anteil_prozent = 15.00, verfuegbare_stunden_monatlich = 160 WHERE kuerzel = 'SCH' AND tenant_id = 'galvanik-kreile';
UPDATE kostenstelle SET energie_anteil_prozent = 5.00, verfuegbare_stunden_monatlich = 80 WHERE kuerzel = 'QS' AND tenant_id = 'galvanik-kreile';
UPDATE kostenstelle SET energie_anteil_prozent = 5.00, verfuegbare_stunden_monatlich = 80 WHERE kuerzel = 'VER' AND tenant_id = 'galvanik-kreile';
UPDATE kostenstelle SET energie_anteil_prozent = 5.00, verfuegbare_stunden_monatlich = 80 WHERE kuerzel = 'WE' AND tenant_id = 'galvanik-kreile';
