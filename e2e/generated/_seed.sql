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
INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)
VALUES ('00000000-0000-4000-8000-000000000101', 'galvanik-kreile', 'K-FLOW-001', 'Prueffirma Alpha GmbH', 'business', 'Prueffirma Alpha GmbH', 'Testa Alphaprobe', '06100 111111', 'einkauf@alpha-pruef.test', 'Prüfweg', NULL, '99001', 'Prüfstadt', 'Deutschland', 'vorkasse', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')
ON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();
DO $flow$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN
  EXECUTE 'UPDATE public.customers SET salutation = ''frau'' WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE public.customers SET first_name = ''Testa'' WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
  EXECUTE 'UPDATE public.customers SET last_name = ''Alphaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN
  EXECUTE 'UPDATE public.customers SET contact_role = ''Einkauf'' WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN
  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN
  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN
  EXECUTE 'UPDATE public.customers SET house_number = ''1'' WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
END $flow$;
INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)
VALUES ('00000000-0000-4000-8000-000000000102', 'galvanik-kreile', 'K-FLOW-002', 'Pia Privatprobe', 'privat', NULL, 'Pia Privatprobe', '06100 222222', 'pia@privat-pruef.test', 'Prüfweg', NULL, '99002', 'Prüfstadt', 'Deutschland', 'vorkasse', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')
ON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();
DO $flow$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN
  EXECUTE 'UPDATE public.customers SET salutation = NULL WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE public.customers SET first_name = ''Pia'' WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
  EXECUTE 'UPDATE public.customers SET last_name = ''Privatprobe'' WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN
  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN
  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN
  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN
  EXECUTE 'UPDATE public.customers SET house_number = ''2'' WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
END $flow$;
INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)
VALUES ('00000000-0000-4000-8000-000000000103', 'galvanik-kreile', 'K-FLOW-003', 'Prueffirma Gamma KG', 'business', 'Prueffirma Gamma KG', NULL, '06100 333333', 'buero@gamma-pruef.test', 'Prüfweg', NULL, '99003', 'Prüfstadt', 'Deutschland', 'vorkasse', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')
ON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();
DO $flow$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN
  EXECUTE 'UPDATE public.customers SET salutation = NULL WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE public.customers SET first_name = NULL WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
  EXECUTE 'UPDATE public.customers SET last_name = NULL WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN
  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN
  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN
  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN
  EXECUTE 'UPDATE public.customers SET house_number = ''3'' WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
END $flow$;
INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)
VALUES ('00000000-0000-4000-8000-000000000104', 'galvanik-kreile', 'K-FLOW-004', 'Bea Barprobe', 'privat', NULL, 'Bea Barprobe', '06100 555555', 'bea@bar-pruef.test', 'Prüfweg', NULL, '99005', 'Prüfstadt', 'Deutschland', 'bar', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')
ON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();
DO $flow$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN
  EXECUTE 'UPDATE public.customers SET salutation = NULL WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE public.customers SET first_name = ''Bea'' WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
  EXECUTE 'UPDATE public.customers SET last_name = ''Barprobe'' WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN
  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN
  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN
  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN
  EXECUTE 'UPDATE public.customers SET house_number = ''5'' WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
END $flow$;
INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)
VALUES ('00000000-0000-4000-8000-000000000105', 'galvanik-kreile', 'K-FLOW-005', 'Prueffirma Epsilon GmbH', 'business', 'Prueffirma Epsilon GmbH', 'Eno Epsilonprobe', '06100 666666', 'buero@epsilon-pruef.test', 'Prüfweg', NULL, '99006', 'Prüfstadt', 'Deutschland', 'vorkasse', 'versand', NULL, false, NULL, NULL, NULL, 'flow-spec')
ON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();
DO $flow$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN
  EXECUTE 'UPDATE public.customers SET salutation = ''ohne'' WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE public.customers SET first_name = ''Eno'' WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
  EXECUTE 'UPDATE public.customers SET last_name = ''Epsilonprobe'' WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN
  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN
  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN
  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN
  EXECUTE 'UPDATE public.customers SET house_number = ''6'' WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
END $flow$;
INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)
VALUES ('00000000-0000-4000-8000-000000000106', 'galvanik-kreile', 'K-FLOW-006', 'Prueffirma Zeta GmbH', 'business', 'Prueffirma Zeta GmbH', 'Zea Zetaprobe', '06100 777777', 'buero@zeta-pruef.test', 'Prüfweg', NULL, '99007', 'Prüfstadt', 'Deutschland', NULL, NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')
ON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();
DO $flow$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN
  EXECUTE 'UPDATE public.customers SET salutation = ''frau'' WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE public.customers SET first_name = ''Zea'' WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
  EXECUTE 'UPDATE public.customers SET last_name = ''Zetaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN
  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN
  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN
  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN
  EXECUTE 'UPDATE public.customers SET house_number = ''7'' WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
END $flow$;
INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)
VALUES ('00000000-0000-4000-8000-000000000107', 'galvanik-kreile', 'K-FLOW-007', 'Prueffirma Eta GmbH', 'business', 'Prueffirma Eta GmbH', 'Eto Etaprobe', '06100 888888', 'buero@eta-pruef.test', 'Prüfweg', NULL, '99008', 'Prüfstadt', 'Deutschland', 'rechnung_14', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')
ON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();
DO $flow$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN
  EXECUTE 'UPDATE public.customers SET salutation = ''herr'' WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE public.customers SET first_name = ''Eto'' WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
  EXECUTE 'UPDATE public.customers SET last_name = ''Etaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN
  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN
  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN
  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN
  EXECUTE 'UPDATE public.customers SET house_number = ''8'' WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
END $flow$;
INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)
VALUES ('00000000-0000-4000-8000-000000000108', 'galvanik-kreile', 'K-FLOW-008', 'Prueffirma Theta GmbH', 'business', 'Prueffirma Theta GmbH', 'Tea Thetaprobe', '06100 999999', 'buero@theta-pruef.test', 'Prüfweg', NULL, '99009', 'Prüfstadt', 'Deutschland', 'rechnung_30', NULL, NULL, true, 30, 0, 0, 'flow-spec')
ON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();
DO $flow$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN
  EXECUTE 'UPDATE public.customers SET salutation = ''frau'' WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE public.customers SET first_name = ''Tea'' WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
  EXECUTE 'UPDATE public.customers SET last_name = ''Thetaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN
  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN
  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN
  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN
  EXECUTE 'UPDATE public.customers SET house_number = ''9'' WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
END $flow$;
INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)
VALUES ('00000000-0000-4000-8000-000000000109', 'galvanik-kreile', 'K-FLOW-009', 'Prueffirma Delta GmbH', 'business', 'Prueffirma Delta GmbH', 'Testo Deltaprobe', '06100 444444', 'buero@delta-pruef.test', 'Prüfweg', NULL, '3013', 'Prüfort', 'Deutschland', 'vorkasse', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')
ON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();
DO $flow$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN
  EXECUTE 'UPDATE public.customers SET salutation = ''herr'' WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE public.customers SET first_name = ''Testo'' WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
  EXECUTE 'UPDATE public.customers SET last_name = ''Deltaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN
  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN
  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN
  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN
  EXECUTE 'UPDATE public.customers SET house_number = ''4'' WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
END $flow$;
INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)
VALUES ('00000000-0000-4000-8000-000000000110', 'galvanik-kreile', 'K-FLOW-010', 'Prueflieferant Omega GmbH', 'lieferant', 'Prueflieferant Omega GmbH', NULL, '06100 121212', 'rechnung@omega-pruef.test', 'Prüfweg', NULL, '99012', 'Prüfstadt', 'Deutschland', NULL, NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')
ON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();
DO $flow$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN
  EXECUTE 'UPDATE public.customers SET salutation = NULL WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE public.customers SET first_name = NULL WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
  EXECUTE 'UPDATE public.customers SET last_name = NULL WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN
  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN
  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN
  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN
  EXECUTE 'UPDATE public.customers SET house_number = ''12'' WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
END $flow$;
INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)
VALUES ('00000000-0000-4000-8000-000000000111', 'galvanik-kreile', 'K-FLOW-011', 'Prueffirma Iota GmbH', 'business', 'Prueffirma Iota GmbH', 'Ina Iotaprobe', '06100 101010', 'einkauf@iota-pruef.test', 'Prüfweg', NULL, '99001', 'Prüfstadt', 'Deutschland', 'vorkasse', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')
ON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();
DO $flow$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN
  EXECUTE 'UPDATE public.customers SET salutation = ''frau'' WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE public.customers SET first_name = ''Ina'' WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
  EXECUTE 'UPDATE public.customers SET last_name = ''Iotaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN
  EXECUTE 'UPDATE public.customers SET contact_role = ''Einkauf'' WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN
  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN
  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN
  EXECUTE 'UPDATE public.customers SET house_number = ''10'' WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
END $flow$;
INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)
VALUES ('00000000-0000-4000-8000-000000000112', 'galvanik-kreile', 'K-FLOW-012', 'Prueffirma Kappa GmbH', 'business', 'Prueffirma Kappa GmbH', 'Kai Kappaprobe', '06100 131313', 'einkauf@kappa-pruef.test', 'Prüfweg', NULL, '99001', 'Prüfstadt', 'Deutschland', 'vorkasse', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')
ON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();
DO $flow$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN
  EXECUTE 'UPDATE public.customers SET salutation = ''frau'' WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
  EXECUTE 'UPDATE public.customers SET first_name = ''Kai'' WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
  EXECUTE 'UPDATE public.customers SET last_name = ''Kappaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN
  EXECUTE 'UPDATE public.customers SET contact_role = ''Einkauf'' WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN
  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN
  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN
  EXECUTE 'UPDATE public.customers SET house_number = ''13'' WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';
END IF;
END $flow$;
DO $flow$ BEGIN IF to_regclass('public.address_directory') IS NOT NULL THEN
INSERT INTO public.address_directory (country, zip_code, city, district, street)
VALUES ('DE', '99107', 'Neustadt am Prüfbach', NULL, 'Neuweg')
ON CONFLICT DO NOTHING;
INSERT INTO public.address_directory (country, zip_code, city, district, street)
VALUES ('DE', '99109', 'Neustadt am Prüfbach', NULL, 'Neuweg')
ON CONFLICT DO NOTHING;
INSERT INTO public.address_directory (country, zip_code, city, district, street)
VALUES ('DE', '99001', 'Prüfstadt', NULL, 'Prüfweg')
ON CONFLICT DO NOTHING;
INSERT INTO public.address_directory (country, zip_code, city, district, street)
VALUES ('DE', '99002', 'Prüfstadt', NULL, 'Prüfweg')
ON CONFLICT DO NOTHING;
INSERT INTO public.address_directory (country, zip_code, city, district, street)
VALUES ('DE', '99003', 'Prüfstadt', NULL, 'Prüfweg')
ON CONFLICT DO NOTHING;
INSERT INTO public.address_directory (country, zip_code, city, district, street)
VALUES ('DE', '99005', 'Prüfstadt', NULL, 'Prüfweg')
ON CONFLICT DO NOTHING;
INSERT INTO public.address_directory (country, zip_code, city, district, street)
VALUES ('DE', '99006', 'Prüfstadt', NULL, 'Prüfweg')
ON CONFLICT DO NOTHING;
INSERT INTO public.address_directory (country, zip_code, city, district, street)
VALUES ('DE', '99007', 'Prüfstadt', NULL, 'Prüfweg')
ON CONFLICT DO NOTHING;
INSERT INTO public.address_directory (country, zip_code, city, district, street)
VALUES ('DE', '99008', 'Prüfstadt', NULL, 'Prüfweg')
ON CONFLICT DO NOTHING;
INSERT INTO public.address_directory (country, zip_code, city, district, street)
VALUES ('DE', '99009', 'Prüfstadt', NULL, 'Prüfweg')
ON CONFLICT DO NOTHING;
INSERT INTO public.address_directory (country, zip_code, city, district, street)
VALUES ('CH', '3013', 'Prüfort', NULL, 'Prüfweg')
ON CONFLICT DO NOTHING;
END IF; END $flow$;
COMMIT;
