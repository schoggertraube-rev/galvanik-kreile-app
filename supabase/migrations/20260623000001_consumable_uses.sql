-- Migration: consumable_uses
-- Tabelle für Materialverbrauch pro Auftrag/Station
-- Referenziert von v_auftrag_db (Kundenkarte-Migration), aber nie angelegt

DROP TABLE IF EXISTS consumable_uses CASCADE

CREATE TABLE IF NOT EXISTS consumable_uses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text NOT NULL DEFAULT 'galvanik-kreile',
  order_id            text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  station_kuerzel     text NOT NULL,
  inventory_item_id   text REFERENCES inventory_items(id),
  item_name           text NOT NULL,
  quantity            numeric(10,4) NOT NULL,
  unit                text NOT NULL DEFAULT 'stk',
  unit_cost_eur       numeric(10,4) NOT NULL,
  vorlage_id          uuid REFERENCES vorlage_verbrauch(id),
  erfasst_von         uuid REFERENCES app_users(id),
  created_at          timestamptz DEFAULT now()
)

CREATE INDEX idx_consumable_uses_order ON consumable_uses(order_id)

CREATE INDEX idx_consumable_uses_station ON consumable_uses(station_kuerzel)

ALTER TABLE consumable_uses ENABLE ROW LEVEL SECURITY

CREATE POLICY "service_role_all_consumable_uses" ON consumable_uses
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true)
