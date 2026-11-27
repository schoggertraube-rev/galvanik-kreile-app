-- The order reader uses queued print jobs. Invalidate that same order source.
CREATE FUNCTION private.today_mark_print_jobs_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $body$
DECLARE affected jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT jsonb_agg(to_jsonb(row)) INTO affected FROM (SELECT DISTINCT tenant_id, order_id FROM today_new) row;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT jsonb_agg(to_jsonb(row)) INTO affected FROM (SELECT DISTINCT tenant_id, order_id FROM today_old) row;
  ELSE
    SELECT jsonb_agg(to_jsonb(row)) INTO affected FROM (
      SELECT tenant_id, order_id FROM today_new
      UNION
      SELECT tenant_id, order_id FROM today_old
    ) row;
  END IF;
  PERFORM private.today_mark_rows_v1('public.print_jobs', coalesce(affected, '[]'::jsonb));
  RETURN NULL;
END $body$;
REVOKE ALL ON FUNCTION private.today_mark_print_jobs_v1() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER today_mark_insert_v1 AFTER INSERT ON public.print_jobs
REFERENCING NEW TABLE AS today_new FOR EACH STATEMENT EXECUTE FUNCTION private.today_mark_print_jobs_v1();

CREATE TRIGGER today_mark_update_v1 AFTER UPDATE ON public.print_jobs
REFERENCING OLD TABLE AS today_old NEW TABLE AS today_new FOR EACH STATEMENT EXECUTE FUNCTION private.today_mark_print_jobs_v1();

CREATE TRIGGER today_mark_delete_v1 AFTER DELETE ON public.print_jobs
REFERENCING OLD TABLE AS today_old FOR EACH STATEMENT EXECUTE FUNCTION private.today_mark_print_jobs_v1();
