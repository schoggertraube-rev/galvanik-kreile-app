begin;

do $$
declare
  affected_count integer;
begin
  select count(*)
    into affected_count
  from public.app_users
  where tenant_id = 'galvanik-kreile'
    and role = 'office';

  if affected_count > 1 then
    raise exception
      'Expected at most 1 office user for galvanik-kreile, found %',
      affected_count;
  end if;

  update public.app_users
  set role = 'buero',
      updated_at = now()
  where tenant_id = 'galvanik-kreile'
    and role = 'office';
end $$;

commit;

notify pgrst, 'reload schema';
