CREATE TABLE consumable_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  order_id text REFERENCES orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  inventory_item_id uuid,
  description text NOT NULL,
  quantity numeric(10,3) NOT NULL DEFAULT 1,
  unit text DEFAULT 'Stück',
  unit_cost_eur numeric(10,2),
  used_by uuid REFERENCES app_users(id),
  used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON consumable_uses(order_id);
CREATE INDEX ON consumable_uses(item_id);
