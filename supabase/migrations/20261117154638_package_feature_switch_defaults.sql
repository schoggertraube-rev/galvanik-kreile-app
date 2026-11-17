-- S21: only default rows in the existing flag source.
-- Existing logging and offline pilot state/filter must survive unchanged.
INSERT INTO public.feature_flags (id,name,enabled,roles_allowed) VALUES
 ('ui_v45','ui_v45',false,ARRAY[]::text[]),
 ('logging','logging',false,ARRAY[]::text[]),
 ('p2_eingang','p2_eingang',false,ARRAY[]::text[]),
 ('p2_nachrichten','p2_nachrichten',false,ARRAY[]::text[]),
 ('p2_kv','p2_kv',false,ARRAY[]::text[]),
 ('p3_karten','p3_karten',false,ARRAY[]::text[]),
 ('p3_werkstatt','p3_werkstatt',false,ARRAY[]::text[]),
 ('p4_ausgang','p4_ausgang',false,ARRAY[]::text[]),
 ('p4_geld','p4_geld',false,ARRAY[]::text[]),
 ('p4_reklamation','p4_reklamation',false,ARRAY[]::text[]),
 ('p5_tag','p5_tag',false,ARRAY[]::text[]),
 ('p5_suche','p5_suche',false,ARRAY[]::text[]),
 ('p5_einstellungen','p5_einstellungen',false,ARRAY[]::text[]),
 ('p5_uebersetzen','p5_uebersetzen',false,ARRAY[]::text[]),
 ('offline_24h','offline_24h',false,ARRAY[]::text[]),
 ('tag_anordnen','tag_anordnen',false,ARRAY[]::text[]),
 ('tag_notizen','tag_notizen',false,ARRAY[]::text[])
ON CONFLICT (id) DO NOTHING;
