-- F0-06 Härtung: Size-/MIME-Limits fuer bisher unbeschraenkte private Buckets.
-- Status: buildable Kandidat; Remote-Anwendung braucht Freigabe.

-- item-photos: Werte EVIDENZBASIERT aus RPC reserve_item_photo_job
--   (file_bytes 1..12582912 = 12 MiB; mime image/jpeg,image/png,image/webp).
update storage.buckets
   set file_size_limit = 12582912,
       allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id = 'item-photos';

-- buchhaltung-belege: Entscheidung 2026-08-07 = 5 MiB, pdf/png/jpeg (analog 'belege').
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['application/pdf','image/png','image/jpeg']
 where id = 'buchhaltung-belege';
