-- RETIRED_FIXED_PERIOD_SEED
-- A period is an operational accounting decision. Fresh databases must not
-- manufacture "open" June/July 2026 periods without a reviewed source action.
/*
INSERT INTO periode (tenant_id, jahr, monat, status) VALUES
('galvanik-kreile', 2026, 6, 'offen'),
('galvanik-kreile', 2026, 7, 'offen')
ON CONFLICT (tenant_id, jahr, monat) DO NOTHING;
*/
