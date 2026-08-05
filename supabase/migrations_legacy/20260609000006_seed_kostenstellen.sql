INSERT INTO kostenstelle (tenant_id, kuerzel, name, typ) VALUES
('galvanik-kreile', 'WE', 'Wareneingang', 'produktion'),
('galvanik-kreile', 'SCH', 'Schleiferei', 'produktion'),
('galvanik-kreile', 'POL', 'Politur', 'produktion'),
('galvanik-kreile', 'GAL', 'Galvanik', 'produktion'),
('galvanik-kreile', 'QS', 'Qualitätskontrolle', 'produktion'),
('galvanik-kreile', 'VER', 'Versand', 'produktion'),
('galvanik-kreile', 'BUERO', 'Büro / Administration', 'verwaltung'),
('galvanik-kreile', 'VERTRIEB', 'Akquise / Angebote', 'vertrieb'),
('galvanik-kreile', 'ENERGIE', 'Strom / Wasser / Abwasser', 'energie'),
('galvanik-kreile', 'GEBAEUDE', 'Halle / Miete / Versicherung', 'gebaeude')
ON CONFLICT (tenant_id, kuerzel) DO NOTHING;
