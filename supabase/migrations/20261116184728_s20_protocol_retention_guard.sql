-- PL16.11.19:41 K2: immutable diagnostics, with only the authorized read-time
-- retention transaction allowed to remove technical rows. No business events.
CREATE FUNCTION private.guard_technical_protocol_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' AND current_setting('app.protocol_retention',true)='on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'TECHNICAL_PROTOCOL_IMMUTABLE' USING ERRCODE='23514';
END;
$$;
REVOKE ALL ON FUNCTION private.guard_technical_protocol_immutable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER technical_protocol_immutable_guard BEFORE UPDATE OR DELETE
ON public.technical_protocol FOR EACH ROW
EXECUTE FUNCTION private.guard_technical_protocol_immutable();
