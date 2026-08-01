insert into storage.buckets (id, name, public) values ('scans', 'scans', false) on conflict (id) do nothing

insert into storage.buckets (id, name, public) values ('item-photos', 'item-photos', false) on conflict (id) do nothing
