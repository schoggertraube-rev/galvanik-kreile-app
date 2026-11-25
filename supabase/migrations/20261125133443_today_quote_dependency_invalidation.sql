-- E-G2: receipt and sequence changes invalidate the affected tenant epoch.
-- The existing trigger function reads tenant_id from the transition tables
-- and reduces both sides of an update to a sorted set of affected tenants.
ALTER FUNCTION private.today_mark_evidence_extraction_metadata_v1()
  RENAME TO today_mark_dependency_epoch_v1;

CREATE TRIGGER today_mark_insert_v1 AFTER INSERT ON private.quote_create_receipts
  REFERENCING NEW TABLE AS today_new FOR EACH STATEMENT
  EXECUTE FUNCTION private.today_mark_dependency_epoch_v1();
CREATE TRIGGER today_mark_update_v1 AFTER UPDATE ON private.quote_create_receipts
  REFERENCING OLD TABLE AS today_old NEW TABLE AS today_new FOR EACH STATEMENT
  EXECUTE FUNCTION private.today_mark_dependency_epoch_v1();
CREATE TRIGGER today_mark_delete_v1 AFTER DELETE ON private.quote_create_receipts
  REFERENCING OLD TABLE AS today_old FOR EACH STATEMENT
  EXECUTE FUNCTION private.today_mark_dependency_epoch_v1();

CREATE TRIGGER today_mark_insert_v1 AFTER INSERT ON private.quote_number_counters
  REFERENCING NEW TABLE AS today_new FOR EACH STATEMENT
  EXECUTE FUNCTION private.today_mark_dependency_epoch_v1();
CREATE TRIGGER today_mark_update_v1 AFTER UPDATE ON private.quote_number_counters
  REFERENCING OLD TABLE AS today_old NEW TABLE AS today_new FOR EACH STATEMENT
  EXECUTE FUNCTION private.today_mark_dependency_epoch_v1();
CREATE TRIGGER today_mark_delete_v1 AFTER DELETE ON private.quote_number_counters
  REFERENCING OLD TABLE AS today_old FOR EACH STATEMENT
  EXECUTE FUNCTION private.today_mark_dependency_epoch_v1();
