-- F0-06 Storage + View Haertung (Kandidat-Migration; Anwendung koordiniert mit RLS-CONTRACT + Prod).
-- item-photos: 12 MiB, image/jpeg,png,webp (evidenzbasiert aus reserve_item_photo_job).
update storage.buckets set file_size_limit = 12582912, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'item-photos';
-- buchhaltung-belege: 5 MiB, pdf/png/jpeg (Entscheidung 2026-08-07).
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['application/pdf','image/png','image/jpeg'] where id = 'buchhaltung-belege';
-- v_auftrag_db: einzige View ohne security_invoker (16/17 bereits on) -> on.
alter view public.v_auftrag_db set (security_invoker = on);