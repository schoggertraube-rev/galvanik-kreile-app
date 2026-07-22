insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scans',
  'scans',
  false,
  14680064,
  array['image/jpeg', 'image/png', 'application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public) values ('item-photos', 'item-photos', false) on conflict (id) do nothing;
