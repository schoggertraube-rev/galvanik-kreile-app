-- Generated from BAUPLAN.testmodell. Local replay database only.
BEGIN;
INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, kuerzel, bezeichnung)
VALUES ('10000000-0000-4000-8000-000000000001'::uuid, 'galvanik-kreile', 'login_meister@flow.local', 'Flow meister', 'meister', '$2b$12$u4o.djf1c9OZbJWiD7XtCOFahRnoeyJe2OiyG7QyzsIEb4vv/UHaq', true, 'F01', 'Generierter Wege-Test')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, pin_hash = EXCLUDED.pin_hash, active = true, updated_at = statement_timestamp();
DELETE FROM public.app_user_rights WHERE tenant_id = 'galvanik-kreile' AND user_id = '10000000-0000-4000-8000-000000000001'::uuid;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000001'::uuid, 'auftraege') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000001'::uuid, 'eingang') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000001'::uuid, 'kunden') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000001'::uuid, 'geld') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000001'::uuid, 'mails') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000001'::uuid, 'einstellungen') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000001'::uuid, 'kassieren') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000001'::uuid, 'logins') ON CONFLICT DO NOTHING;
DO $flow$ BEGIN BEGIN INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000001'::uuid, 'entscheiden') ON CONFLICT DO NOTHING; EXCEPTION WHEN check_violation THEN RAISE NOTICE 'FLOW_SEED_AREA_PENDING:entscheiden'; END; END $flow$;
INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, kuerzel, bezeichnung)
VALUES ('10000000-0000-4000-8000-000000000002'::uuid, 'galvanik-kreile', 'login_werkstatt@flow.local', 'Flow werkstatt', 'werkstatt', '$2b$12$a9ZEwrinIz0zIJ7jrTabAuF6ACwd.oUHJv1iOZ61xkkn.1minJHBy', true, 'F02', 'Generierter Wege-Test')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, pin_hash = EXCLUDED.pin_hash, active = true, updated_at = statement_timestamp();
DELETE FROM public.app_user_rights WHERE tenant_id = 'galvanik-kreile' AND user_id = '10000000-0000-4000-8000-000000000002'::uuid;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000002'::uuid, 'auftraege') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000002'::uuid, 'eingang') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000002'::uuid, 'kunden') ON CONFLICT DO NOTHING;
INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, kuerzel, bezeichnung)
VALUES ('10000000-0000-4000-8000-000000000003'::uuid, 'galvanik-kreile', 'login_ohne_eingang@flow.local', 'Flow ohne_eingang', 'meister', '$2b$12$/C2xIVQ7tBxoZKRL6Ba7UOtHwE.fBynIDbe0fejXDxjQyWaFkzQnq', true, 'F03', 'Generierter Wege-Test')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, pin_hash = EXCLUDED.pin_hash, active = true, updated_at = statement_timestamp();
DELETE FROM public.app_user_rights WHERE tenant_id = 'galvanik-kreile' AND user_id = '10000000-0000-4000-8000-000000000003'::uuid;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000003'::uuid, 'auftraege') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000003'::uuid, 'kunden') ON CONFLICT DO NOTHING;
INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, kuerzel, bezeichnung)
VALUES ('10000000-0000-4000-8000-000000000004'::uuid, 'galvanik-kreile', 'login_ohne_kunden@flow.local', 'Flow ohne_kunden', 'meister', '$2b$12$lgvHXCJ7iDaE3gRb28yQsunVSdvEAPBaesRNAY3XWYUO3/znrjk3i', true, 'F04', 'Generierter Wege-Test')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, pin_hash = EXCLUDED.pin_hash, active = true, updated_at = statement_timestamp();
DELETE FROM public.app_user_rights WHERE tenant_id = 'galvanik-kreile' AND user_id = '10000000-0000-4000-8000-000000000004'::uuid;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000004'::uuid, 'auftraege') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000004'::uuid, 'eingang') ON CONFLICT DO NOTHING;
INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, kuerzel, bezeichnung)
VALUES ('10000000-0000-4000-8000-000000000005'::uuid, 'galvanik-kreile', 'login_nur_eingang@flow.local', 'Flow nur_eingang', 'meister', '$2b$12$iX9SQ7tzMSuCSdN9P1ZokeuIjv53solEfRP2g0ve.ObqxdXFTV9eu', true, 'F05', 'Generierter Wege-Test')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, pin_hash = EXCLUDED.pin_hash, active = true, updated_at = statement_timestamp();
DELETE FROM public.app_user_rights WHERE tenant_id = 'galvanik-kreile' AND user_id = '10000000-0000-4000-8000-000000000005'::uuid;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000005'::uuid, 'eingang') ON CONFLICT DO NOTHING;
INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, kuerzel, bezeichnung)
VALUES ('10000000-0000-4000-8000-000000000006'::uuid, 'galvanik-kreile', 'login_buero_ohne_geld@flow.local', 'Flow buero_ohne_geld', 'meister', '$2b$12$REJw.ffLob7XTc35.mq5BuGF5QfanyzWTey1N0rMh3hy8DUuQtay2', true, 'F06', 'Generierter Wege-Test')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, pin_hash = EXCLUDED.pin_hash, active = true, updated_at = statement_timestamp();
DELETE FROM public.app_user_rights WHERE tenant_id = 'galvanik-kreile' AND user_id = '10000000-0000-4000-8000-000000000006'::uuid;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000006'::uuid, 'auftraege') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000006'::uuid, 'eingang') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000006'::uuid, 'kunden') ON CONFLICT DO NOTHING;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000006'::uuid, 'mails') ON CONFLICT DO NOTHING;
INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, kuerzel, bezeichnung)
VALUES ('10000000-0000-4000-8000-000000000007'::uuid, 'galvanik-kreile', 'login_einstellungen@flow.local', 'Flow einstellungen', 'meister', '$2b$12$cgAV2CpgQkfW9zMsrQSFUOIobbZIEwVppDcRJA2G378JOw9jpSlyy', true, 'F07', 'Generierter Wege-Test')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, pin_hash = EXCLUDED.pin_hash, active = true, updated_at = statement_timestamp();
DELETE FROM public.app_user_rights WHERE tenant_id = 'galvanik-kreile' AND user_id = '10000000-0000-4000-8000-000000000007'::uuid;
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', '10000000-0000-4000-8000-000000000007'::uuid, 'einstellungen') ON CONFLICT DO NOTHING;
COMMIT;
