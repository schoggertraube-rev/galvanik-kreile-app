INSERT INTO periode (tenant_id, jahr, monat, status) VALUES
('galvanik-kreile', 2026, 6, 'offen'),
('galvanik-kreile', 2026, 7, 'offen')
ON CONFLICT (tenant_id, jahr, monat) DO NOTHING
