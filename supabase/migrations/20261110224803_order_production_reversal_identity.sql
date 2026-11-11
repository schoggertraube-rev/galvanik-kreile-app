-- One real reopening event reverses every original pricing delta exactly.
-- Its existing reverses_event_id is part of the receipt identity, not a new truth.
-- The immutable-source trigger still validates each original tuple and value;
-- append-only guards prevent deleting/updating the referenced original.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='private.order_production_snapshots'::regclass AND contype='f' AND confrelid=conrelid LOOP
  EXECUTE format('ALTER TABLE private.order_production_snapshots DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE private.order_production_snapshots DROP CONSTRAINT order_production_snapshots_pkey;
ALTER TABLE private.order_production_snapshots ADD CONSTRAINT order_production_snapshot_receipt_identity
 UNIQUE NULLS NOT DISTINCT(event_id,item_id,component,reverses_event_id);
-- Approved by PL 11.11.00:09; original-value and append-only guards remain.
