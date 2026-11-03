// Generated from BAUPLAN SHA-256 DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4. Do not edit.
export const generatedFlowRuntime = {
  "database": {
    "orders": {
      "table": "orders",
      "columns": {
        "kunde": "customer_id",
        "art": "is_quote",
        "liefertermin": "promised_due_date",
        "terminstatus": "intake_term_status",
        "uebergabe": "handover_mode",
        "zahlungsmodus": "payment_mode",
        "eingangsart": "intake_source"
      },
      "transforms": {
        "art": "order_kind",
        "uebergabe": "handover",
        "zahlungsmodus": "payment_mode"
      }
    },
    "items": {
      "table": "items",
      "columns": {
        "auftrag": "order_id",
        "bezeichnung": "name",
        "menge": "quantity",
        "einheit": "unit",
        "oberflaeche": "surface_requested",
        "ausfuehrung": "execution_requested"
      },
      "transforms": {}
    },
    "customers": {
      "table": "customers",
      "columns": {
        "customer_type": "type",
        "zahlungsbedingung": "payment_preference",
        "notiz": "notes"
      },
      "transforms": {}
    },
    "intake_item": {
      "table": "intake_item",
      "columns": {},
      "transforms": {}
    },
    "intake_file": {
      "table": "intake_file",
      "columns": {},
      "transforms": {}
    },
    "intake_suggestion": {
      "table": "intake_suggestion",
      "columns": {},
      "transforms": {}
    },
    "intake_drafts": {
      "schema": "private",
      "table": "intake_drafts",
      "columns": {
        "login": "actor_id"
      },
      "transforms": {}
    },
    "goods_receipt": {
      "table": "goods_receipt",
      "columns": {},
      "transforms": {}
    },
    "outbox_mails": {
      "table": "outbox_mails",
      "columns": {},
      "transforms": {}
    },
    "task": {
      "table": "tasks",
      "columns": {},
      "transforms": {}
    },
    "complaint": {
      "table": "complaints",
      "columns": {
        "auftrag_id": "order_id",
        "kunde_id": "customer_id",
        "mangel": "reason"
      },
      "transforms": {}
    },
    "supplier_invoice": {
      "table": "supplier_invoice",
      "columns": {},
      "transforms": {}
    }
  },
  "fixtureSql": {
    "kunde_vollstaendig_firma": "INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)\nVALUES ('00000000-0000-4000-8000-000000000101', 'galvanik-kreile', 'K-FLOW-001', 'Prueffirma Alpha GmbH', 'business', 'Prueffirma Alpha GmbH', 'Testa Alphaprobe', '06100 111111', 'einkauf@alpha-pruef.test', 'Prüfweg', NULL, '99001', 'Prüfstadt', 'Deutschland', 'vorkasse', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')\nON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();\nDO $flow$ BEGIN\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN\n  EXECUTE 'UPDATE public.customers SET salutation = ''frau'' WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN\n  EXECUTE 'UPDATE public.customers SET first_name = ''Testa'' WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN\n  EXECUTE 'UPDATE public.customers SET last_name = ''Alphaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN\n  EXECUTE 'UPDATE public.customers SET contact_role = ''Einkauf'' WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN\n  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN\n  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN\n  EXECUTE 'UPDATE public.customers SET house_number = ''1'' WHERE id = ''00000000-0000-4000-8000-000000000101''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nEND $flow$;",
    "kunde_privat_ohne_ansprechpartner": "INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)\nVALUES ('00000000-0000-4000-8000-000000000102', 'galvanik-kreile', 'K-FLOW-002', 'Pia Privatprobe', 'privat', NULL, 'Pia Privatprobe', '06100 222222', 'pia@privat-pruef.test', 'Prüfweg', NULL, '99002', 'Prüfstadt', 'Deutschland', 'vorkasse', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')\nON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();\nDO $flow$ BEGIN\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN\n  EXECUTE 'UPDATE public.customers SET salutation = NULL WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN\n  EXECUTE 'UPDATE public.customers SET first_name = ''Pia'' WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN\n  EXECUTE 'UPDATE public.customers SET last_name = ''Privatprobe'' WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN\n  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN\n  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN\n  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN\n  EXECUTE 'UPDATE public.customers SET house_number = ''2'' WHERE id = ''00000000-0000-4000-8000-000000000102''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nEND $flow$;",
    "kunde_firma_ohne_ansprechpartner": "INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)\nVALUES ('00000000-0000-4000-8000-000000000103', 'galvanik-kreile', 'K-FLOW-003', 'Prueffirma Gamma KG', 'business', 'Prueffirma Gamma KG', NULL, '06100 333333', 'buero@gamma-pruef.test', 'Prüfweg', NULL, '99003', 'Prüfstadt', 'Deutschland', 'vorkasse', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')\nON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();\nDO $flow$ BEGIN\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN\n  EXECUTE 'UPDATE public.customers SET salutation = NULL WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN\n  EXECUTE 'UPDATE public.customers SET first_name = NULL WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN\n  EXECUTE 'UPDATE public.customers SET last_name = NULL WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN\n  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN\n  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN\n  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN\n  EXECUTE 'UPDATE public.customers SET house_number = ''3'' WHERE id = ''00000000-0000-4000-8000-000000000103''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nEND $flow$;",
    "kunde_bedingung_bar": "INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)\nVALUES ('00000000-0000-4000-8000-000000000104', 'galvanik-kreile', 'K-FLOW-004', 'Bea Barprobe', 'privat', NULL, 'Bea Barprobe', '06100 555555', 'bea@bar-pruef.test', 'Prüfweg', NULL, '99005', 'Prüfstadt', 'Deutschland', 'bar', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')\nON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();\nDO $flow$ BEGIN\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN\n  EXECUTE 'UPDATE public.customers SET salutation = NULL WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN\n  EXECUTE 'UPDATE public.customers SET first_name = ''Bea'' WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN\n  EXECUTE 'UPDATE public.customers SET last_name = ''Barprobe'' WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN\n  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN\n  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN\n  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN\n  EXECUTE 'UPDATE public.customers SET house_number = ''5'' WHERE id = ''00000000-0000-4000-8000-000000000104''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nEND $flow$;",
    "kunde_bedingung_vorkasse": "INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)\nVALUES ('00000000-0000-4000-8000-000000000105', 'galvanik-kreile', 'K-FLOW-005', 'Prueffirma Epsilon GmbH', 'business', 'Prueffirma Epsilon GmbH', 'Eno Epsilonprobe', '06100 666666', 'buero@epsilon-pruef.test', 'Prüfweg', NULL, '99006', 'Prüfstadt', 'Deutschland', 'vorkasse', 'versand', NULL, false, NULL, NULL, NULL, 'flow-spec')\nON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();\nDO $flow$ BEGIN\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN\n  EXECUTE 'UPDATE public.customers SET salutation = ''ohne'' WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN\n  EXECUTE 'UPDATE public.customers SET first_name = ''Eno'' WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN\n  EXECUTE 'UPDATE public.customers SET last_name = ''Epsilonprobe'' WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN\n  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN\n  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN\n  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN\n  EXECUTE 'UPDATE public.customers SET house_number = ''6'' WHERE id = ''00000000-0000-4000-8000-000000000105''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nEND $flow$;",
    "kunde_ohne_bedingung": "INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)\nVALUES ('00000000-0000-4000-8000-000000000106', 'galvanik-kreile', 'K-FLOW-006', 'Prueffirma Zeta GmbH', 'business', 'Prueffirma Zeta GmbH', 'Zea Zetaprobe', '06100 777777', 'buero@zeta-pruef.test', 'Prüfweg', NULL, '99007', 'Prüfstadt', 'Deutschland', NULL, NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')\nON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();\nDO $flow$ BEGIN\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN\n  EXECUTE 'UPDATE public.customers SET salutation = ''frau'' WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN\n  EXECUTE 'UPDATE public.customers SET first_name = ''Zea'' WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN\n  EXECUTE 'UPDATE public.customers SET last_name = ''Zetaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN\n  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN\n  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN\n  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN\n  EXECUTE 'UPDATE public.customers SET house_number = ''7'' WHERE id = ''00000000-0000-4000-8000-000000000106''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nEND $flow$;",
    "kunde_rechnung_ohne_freischaltung": "INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)\nVALUES ('00000000-0000-4000-8000-000000000107', 'galvanik-kreile', 'K-FLOW-007', 'Prueffirma Eta GmbH', 'business', 'Prueffirma Eta GmbH', 'Eto Etaprobe', '06100 888888', 'buero@eta-pruef.test', 'Prüfweg', NULL, '99008', 'Prüfstadt', 'Deutschland', 'rechnung_14', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')\nON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();\nDO $flow$ BEGIN\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN\n  EXECUTE 'UPDATE public.customers SET salutation = ''herr'' WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN\n  EXECUTE 'UPDATE public.customers SET first_name = ''Eto'' WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN\n  EXECUTE 'UPDATE public.customers SET last_name = ''Etaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN\n  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN\n  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN\n  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN\n  EXECUTE 'UPDATE public.customers SET house_number = ''8'' WHERE id = ''00000000-0000-4000-8000-000000000107''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nEND $flow$;",
    "kunde_rechnung_freigeschaltet": "INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)\nVALUES ('00000000-0000-4000-8000-000000000108', 'galvanik-kreile', 'K-FLOW-008', 'Prueffirma Theta GmbH', 'business', 'Prueffirma Theta GmbH', 'Tea Thetaprobe', '06100 999999', 'buero@theta-pruef.test', 'Prüfweg', NULL, '99009', 'Prüfstadt', 'Deutschland', 'rechnung_30', NULL, NULL, true, 30, 0, 0, 'flow-spec')\nON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();\nDO $flow$ BEGIN\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN\n  EXECUTE 'UPDATE public.customers SET salutation = ''frau'' WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN\n  EXECUTE 'UPDATE public.customers SET first_name = ''Tea'' WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN\n  EXECUTE 'UPDATE public.customers SET last_name = ''Thetaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN\n  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN\n  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN\n  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN\n  EXECUTE 'UPDATE public.customers SET house_number = ''9'' WHERE id = ''00000000-0000-4000-8000-000000000108''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nEND $flow$;",
    "kunde_plz_land_widerspruch": "INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)\nVALUES ('00000000-0000-4000-8000-000000000109', 'galvanik-kreile', 'K-FLOW-009', 'Prueffirma Delta GmbH', 'business', 'Prueffirma Delta GmbH', 'Testo Deltaprobe', '06100 444444', 'buero@delta-pruef.test', 'Prüfweg', NULL, '3013', 'Prüfort', 'Deutschland', 'vorkasse', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')\nON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();\nDO $flow$ BEGIN\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN\n  EXECUTE 'UPDATE public.customers SET salutation = ''herr'' WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN\n  EXECUTE 'UPDATE public.customers SET first_name = ''Testo'' WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN\n  EXECUTE 'UPDATE public.customers SET last_name = ''Deltaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN\n  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN\n  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN\n  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN\n  EXECUTE 'UPDATE public.customers SET house_number = ''4'' WHERE id = ''00000000-0000-4000-8000-000000000109''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nEND $flow$;",
    "lieferant_bekannt": "INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)\nVALUES ('00000000-0000-4000-8000-000000000110', 'galvanik-kreile', 'K-FLOW-010', 'Prueflieferant Omega GmbH', 'lieferant', 'Prueflieferant Omega GmbH', NULL, '06100 121212', 'rechnung@omega-pruef.test', 'Prüfweg', NULL, '99012', 'Prüfstadt', 'Deutschland', NULL, NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')\nON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();\nDO $flow$ BEGIN\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN\n  EXECUTE 'UPDATE public.customers SET salutation = NULL WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN\n  EXECUTE 'UPDATE public.customers SET first_name = NULL WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN\n  EXECUTE 'UPDATE public.customers SET last_name = NULL WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN\n  EXECUTE 'UPDATE public.customers SET contact_role = NULL WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN\n  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN\n  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN\n  EXECUTE 'UPDATE public.customers SET house_number = ''12'' WHERE id = ''00000000-0000-4000-8000-000000000110''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nEND $flow$;",
    "kunde_vorrang": "INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)\nVALUES ('00000000-0000-4000-8000-000000000111', 'galvanik-kreile', 'K-FLOW-011', 'Prueffirma Iota GmbH', 'business', 'Prueffirma Iota GmbH', 'Ina Iotaprobe', '06100 101010', 'einkauf@iota-pruef.test', 'Prüfweg', NULL, '99001', 'Prüfstadt', 'Deutschland', 'vorkasse', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')\nON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();\nDO $flow$ BEGIN\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN\n  EXECUTE 'UPDATE public.customers SET salutation = ''frau'' WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN\n  EXECUTE 'UPDATE public.customers SET first_name = ''Ina'' WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN\n  EXECUTE 'UPDATE public.customers SET last_name = ''Iotaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN\n  EXECUTE 'UPDATE public.customers SET contact_role = ''Einkauf'' WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN\n  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN\n  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN\n  EXECUTE 'UPDATE public.customers SET house_number = ''10'' WHERE id = ''00000000-0000-4000-8000-000000000111''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nEND $flow$;",
    "kunde_ohne_auto_info": "INSERT INTO public.customers (id, tenant_id, customer_number, name, type, company_name, contact_person, phone, email, street, address, zip_code, city, country, payment_preference, shipping_preference, vat_id, ziel_freigeschaltet, ziel_tage, skonto_prozent, skonto_tage, source)\nVALUES ('00000000-0000-4000-8000-000000000112', 'galvanik-kreile', 'K-FLOW-012', 'Prueffirma Kappa GmbH', 'business', 'Prueffirma Kappa GmbH', 'Kai Kappaprobe', '06100 131313', 'einkauf@kappa-pruef.test', 'Prüfweg', NULL, '99001', 'Prüfstadt', 'Deutschland', 'vorkasse', NULL, NULL, false, NULL, NULL, NULL, 'flow-spec')\nON CONFLICT (id) DO UPDATE SET customer_number = EXCLUDED.customer_number, name = EXCLUDED.name, type = EXCLUDED.type, company_name = EXCLUDED.company_name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, street = EXCLUDED.street, address = EXCLUDED.address, zip_code = EXCLUDED.zip_code, city = EXCLUDED.city, country = EXCLUDED.country, payment_preference = EXCLUDED.payment_preference, shipping_preference = EXCLUDED.shipping_preference, vat_id = EXCLUDED.vat_id, ziel_freigeschaltet = EXCLUDED.ziel_freigeschaltet, ziel_tage = EXCLUDED.ziel_tage, skonto_prozent = EXCLUDED.skonto_prozent, skonto_tage = EXCLUDED.skonto_tage, source = 'flow-spec', updated_at = statement_timestamp();\nDO $flow$ BEGIN\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'salutation') THEN\n  EXECUTE 'UPDATE public.customers SET salutation = ''frau'' WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN\n  EXECUTE 'UPDATE public.customers SET first_name = ''Kai'' WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN\n  EXECUTE 'UPDATE public.customers SET last_name = ''Kappaprobe'' WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'contact_role') THEN\n  EXECUTE 'UPDATE public.customers SET contact_role = ''Einkauf'' WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'billing_email') THEN\n  EXECUTE 'UPDATE public.customers SET billing_email = NULL WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'website') THEN\n  EXECUTE 'UPDATE public.customers SET website = NULL WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_number') THEN\n  EXECUTE 'UPDATE public.customers SET house_number = ''13'' WHERE id = ''00000000-0000-4000-8000-000000000112''::uuid AND tenant_id = ''galvanik-kreile''';\nEND IF;\nEND $flow$;",
    "verzeichnis_pruefadressen": "DO $flow$ BEGIN IF to_regclass('public.address_directory') IS NOT NULL THEN\nINSERT INTO public.address_directory (country, zip_code, city, district, street)\nVALUES ('DE', '99107', 'Neustadt am Prüfbach', NULL, 'Neuweg')\nON CONFLICT DO NOTHING;\nINSERT INTO public.address_directory (country, zip_code, city, district, street)\nVALUES ('DE', '99109', 'Neustadt am Prüfbach', NULL, 'Neuweg')\nON CONFLICT DO NOTHING;\nINSERT INTO public.address_directory (country, zip_code, city, district, street)\nVALUES ('DE', '99001', 'Prüfstadt', NULL, 'Prüfweg')\nON CONFLICT DO NOTHING;\nINSERT INTO public.address_directory (country, zip_code, city, district, street)\nVALUES ('DE', '99002', 'Prüfstadt', NULL, 'Prüfweg')\nON CONFLICT DO NOTHING;\nINSERT INTO public.address_directory (country, zip_code, city, district, street)\nVALUES ('DE', '99003', 'Prüfstadt', NULL, 'Prüfweg')\nON CONFLICT DO NOTHING;\nINSERT INTO public.address_directory (country, zip_code, city, district, street)\nVALUES ('DE', '99005', 'Prüfstadt', NULL, 'Prüfweg')\nON CONFLICT DO NOTHING;\nINSERT INTO public.address_directory (country, zip_code, city, district, street)\nVALUES ('DE', '99006', 'Prüfstadt', NULL, 'Prüfweg')\nON CONFLICT DO NOTHING;\nINSERT INTO public.address_directory (country, zip_code, city, district, street)\nVALUES ('DE', '99007', 'Prüfstadt', NULL, 'Prüfweg')\nON CONFLICT DO NOTHING;\nINSERT INTO public.address_directory (country, zip_code, city, district, street)\nVALUES ('DE', '99008', 'Prüfstadt', NULL, 'Prüfweg')\nON CONFLICT DO NOTHING;\nINSERT INTO public.address_directory (country, zip_code, city, district, street)\nVALUES ('DE', '99009', 'Prüfstadt', NULL, 'Prüfweg')\nON CONFLICT DO NOTHING;\nINSERT INTO public.address_directory (country, zip_code, city, district, street)\nVALUES ('CH', '3013', 'Prüfort', NULL, 'Prüfweg')\nON CONFLICT DO NOTHING;\nEND IF; END $flow$;"
  },
  "logins": {
    "login_meister": {
      "id": "10000000-0000-4000-8000-000000000001",
      "pin": "1111"
    },
    "login_werkstatt": {
      "id": "10000000-0000-4000-8000-000000000002",
      "pin": "2222"
    },
    "login_ohne_eingang": {
      "id": "10000000-0000-4000-8000-000000000003",
      "pin": "3333"
    },
    "login_ohne_kunden": {
      "id": "10000000-0000-4000-8000-000000000004",
      "pin": "4444"
    },
    "login_nur_eingang": {
      "id": "10000000-0000-4000-8000-000000000005",
      "pin": "5555"
    },
    "login_buero_ohne_geld": {
      "id": "10000000-0000-4000-8000-000000000006",
      "pin": "6666"
    },
    "login_einstellungen": {
      "id": "10000000-0000-4000-8000-000000000007",
      "pin": "7777"
    }
  },
  "datenlagen": {
    "kunde_vollstaendig_firma": {
      "id": "00000000-0000-4000-8000-000000000101",
      "tabelle": "customers",
      "customer_number": "K-FLOW-001",
      "customer_type": "business",
      "phone": "06100 111111",
      "country": "DE",
      "street": "Prüfweg",
      "house_number": "1",
      "zip_code": "99001",
      "city": "Prüfstadt",
      "ziel_freigeschaltet": false,
      "handover_preference": null,
      "company_name": "Prueffirma Alpha GmbH",
      "name": "Prueffirma Alpha GmbH",
      "salutation": "frau",
      "first_name": "Testa",
      "last_name": "Alphaprobe",
      "contact_role": "Einkauf",
      "email": "einkauf@alpha-pruef.test",
      "zahlungsbedingung": "vorkasse"
    },
    "kunde_privat_ohne_ansprechpartner": {
      "id": "00000000-0000-4000-8000-000000000102",
      "tabelle": "customers",
      "customer_number": "K-FLOW-002",
      "customer_type": "privat",
      "phone": "06100 222222",
      "country": "DE",
      "street": "Prüfweg",
      "house_number": "2",
      "zip_code": "99002",
      "city": "Prüfstadt",
      "ziel_freigeschaltet": false,
      "handover_preference": null,
      "name": "Pia Privatprobe",
      "first_name": "Pia",
      "last_name": "Privatprobe",
      "email": "pia@privat-pruef.test",
      "zahlungsbedingung": "vorkasse"
    },
    "kunde_firma_ohne_ansprechpartner": {
      "id": "00000000-0000-4000-8000-000000000103",
      "tabelle": "customers",
      "customer_number": "K-FLOW-003",
      "customer_type": "business",
      "phone": "06100 333333",
      "country": "DE",
      "street": "Prüfweg",
      "house_number": "3",
      "zip_code": "99003",
      "city": "Prüfstadt",
      "ziel_freigeschaltet": false,
      "handover_preference": null,
      "company_name": "Prueffirma Gamma KG",
      "name": "Prueffirma Gamma KG",
      "email": "buero@gamma-pruef.test",
      "zahlungsbedingung": "vorkasse"
    },
    "kunde_bedingung_bar": {
      "id": "00000000-0000-4000-8000-000000000104",
      "tabelle": "customers",
      "customer_number": "K-FLOW-004",
      "customer_type": "privat",
      "phone": "06100 555555",
      "country": "DE",
      "street": "Prüfweg",
      "house_number": "5",
      "zip_code": "99005",
      "city": "Prüfstadt",
      "ziel_freigeschaltet": false,
      "handover_preference": null,
      "name": "Bea Barprobe",
      "first_name": "Bea",
      "last_name": "Barprobe",
      "email": "bea@bar-pruef.test",
      "zahlungsbedingung": "bar"
    },
    "kunde_bedingung_vorkasse": {
      "id": "00000000-0000-4000-8000-000000000105",
      "tabelle": "customers",
      "customer_number": "K-FLOW-005",
      "customer_type": "business",
      "phone": "06100 666666",
      "country": "DE",
      "street": "Prüfweg",
      "house_number": "6",
      "zip_code": "99006",
      "city": "Prüfstadt",
      "ziel_freigeschaltet": false,
      "handover_preference": "versand",
      "company_name": "Prueffirma Epsilon GmbH",
      "name": "Prueffirma Epsilon GmbH",
      "salutation": "ohne",
      "first_name": "Eno",
      "last_name": "Epsilonprobe",
      "email": "buero@epsilon-pruef.test",
      "zahlungsbedingung": "vorkasse"
    },
    "kunde_ohne_bedingung": {
      "id": "00000000-0000-4000-8000-000000000106",
      "tabelle": "customers",
      "customer_number": "K-FLOW-006",
      "customer_type": "business",
      "phone": "06100 777777",
      "country": "DE",
      "street": "Prüfweg",
      "house_number": "7",
      "zip_code": "99007",
      "city": "Prüfstadt",
      "ziel_freigeschaltet": false,
      "handover_preference": null,
      "company_name": "Prueffirma Zeta GmbH",
      "name": "Prueffirma Zeta GmbH",
      "salutation": "frau",
      "first_name": "Zea",
      "last_name": "Zetaprobe",
      "email": "buero@zeta-pruef.test",
      "zahlungsbedingung": null
    },
    "kunde_rechnung_ohne_freischaltung": {
      "id": "00000000-0000-4000-8000-000000000107",
      "tabelle": "customers",
      "customer_number": "K-FLOW-007",
      "customer_type": "business",
      "phone": "06100 888888",
      "country": "DE",
      "street": "Prüfweg",
      "house_number": "8",
      "zip_code": "99008",
      "city": "Prüfstadt",
      "ziel_freigeschaltet": false,
      "handover_preference": null,
      "company_name": "Prueffirma Eta GmbH",
      "name": "Prueffirma Eta GmbH",
      "salutation": "herr",
      "first_name": "Eto",
      "last_name": "Etaprobe",
      "email": "buero@eta-pruef.test",
      "zahlungsbedingung": "rechnung"
    },
    "kunde_rechnung_freigeschaltet": {
      "id": "00000000-0000-4000-8000-000000000108",
      "tabelle": "customers",
      "customer_number": "K-FLOW-008",
      "customer_type": "business",
      "phone": "06100 999999",
      "country": "DE",
      "street": "Prüfweg",
      "house_number": "9",
      "zip_code": "99009",
      "city": "Prüfstadt",
      "ziel_freigeschaltet": true,
      "handover_preference": null,
      "company_name": "Prueffirma Theta GmbH",
      "name": "Prueffirma Theta GmbH",
      "salutation": "frau",
      "first_name": "Tea",
      "last_name": "Thetaprobe",
      "email": "buero@theta-pruef.test",
      "zahlungsbedingung": "rechnung",
      "ziel_tage": 30,
      "skonto_prozent": 0,
      "skonto_tage": null
    },
    "verzeichnis_pruefadressen": {
      "id": "20000000-0000-4000-8000-000000000009",
      "tabelle": "address_directory",
      "zeilen": [
        {
          "country": "DE",
          "zip_code": "99107",
          "city": "Neustadt am Prüfbach",
          "street": "Neuweg"
        },
        {
          "country": "DE",
          "zip_code": "99109",
          "city": "Neustadt am Prüfbach",
          "street": "Neuweg"
        },
        {
          "country": "DE",
          "zip_code": "99001",
          "city": "Prüfstadt",
          "street": "Prüfweg"
        },
        {
          "country": "DE",
          "zip_code": "99002",
          "city": "Prüfstadt",
          "street": "Prüfweg"
        },
        {
          "country": "DE",
          "zip_code": "99003",
          "city": "Prüfstadt",
          "street": "Prüfweg"
        },
        {
          "country": "DE",
          "zip_code": "99005",
          "city": "Prüfstadt",
          "street": "Prüfweg"
        },
        {
          "country": "DE",
          "zip_code": "99006",
          "city": "Prüfstadt",
          "street": "Prüfweg"
        },
        {
          "country": "DE",
          "zip_code": "99007",
          "city": "Prüfstadt",
          "street": "Prüfweg"
        },
        {
          "country": "DE",
          "zip_code": "99008",
          "city": "Prüfstadt",
          "street": "Prüfweg"
        },
        {
          "country": "DE",
          "zip_code": "99009",
          "city": "Prüfstadt",
          "street": "Prüfweg"
        },
        {
          "country": "CH",
          "zip_code": "3013",
          "city": "Prüfort",
          "street": "Prüfweg"
        }
      ]
    },
    "kunde_plz_land_widerspruch": {
      "id": "00000000-0000-4000-8000-000000000109",
      "tabelle": "customers",
      "customer_number": "K-FLOW-009",
      "customer_type": "business",
      "phone": "06100 444444",
      "country": "DE",
      "street": "Prüfweg",
      "house_number": "4",
      "zip_code": "3013",
      "city": "Prüfort",
      "ziel_freigeschaltet": false,
      "handover_preference": null,
      "company_name": "Prueffirma Delta GmbH",
      "name": "Prueffirma Delta GmbH",
      "salutation": "herr",
      "first_name": "Testo",
      "last_name": "Deltaprobe",
      "email": "buero@delta-pruef.test",
      "zahlungsbedingung": "vorkasse"
    },
    "auftrag_quelle": {
      "id": null,
      "tabelle": "orders",
      "order_number": "A-2099-9001",
      "kunde": "{kunde_vollstaendig_firma}",
      "art": "auftrag",
      "uebergabe": "versand",
      "zahlungsmodus": "vorkasse",
      "eingangsart": "versand",
      "liefertermin": "{arbeitstag:-10}",
      "terminstatus": "bestaetigt",
      "geprueft": true,
      "station": "abgeschlossen",
      "ware": "da",
      "positionen": [
        {
          "bezeichnung": "Prüfteil Kopie A",
          "menge": 3,
          "einheit": "stueck",
          "oberflaeche": "verchromen",
          "ausfuehrung": "hochglanz",
          "material": "Messing",
          "einzelpreis": 12.5
        },
        {
          "bezeichnung": "Prüfteil Kopie B",
          "menge": 2,
          "einheit": "kg",
          "oberflaeche": "verzinken",
          "ausfuehrung": "gelb_passiviert",
          "material": "Stahl",
          "einzelpreis": null
        }
      ],
      "fotos": 1
    },
    "auftrag_erwartet": {
      "id": null,
      "tabelle": "orders",
      "order_number": "A-2099-9002",
      "kunde": "{kunde_vollstaendig_firma}",
      "art": "auftrag",
      "station": "wareneingang",
      "ware": "erwartet",
      "uebergabe": "abholung",
      "zahlungsmodus": "vorkasse",
      "liefertermin": "{arbeitstag:+20}",
      "terminstatus": "bestaetigt",
      "positionen": [
        {
          "bezeichnung": "Prüfteil W1",
          "menge": 4,
          "einheit": "stueck",
          "oberflaeche": "verchromen"
        },
        {
          "bezeichnung": "Prüfteil W2",
          "menge": 1,
          "einheit": "satz",
          "oberflaeche": "vernickeln"
        }
      ]
    },
    "auftrag_teilweise": {
      "id": "20000000-0000-4000-8000-000000000013",
      "tabelle": "orders",
      "order_number": "A-2099-9003",
      "kunde": "{kunde_vollstaendig_firma}",
      "art": "auftrag",
      "station": "in_arbeit",
      "ware": "teilweise",
      "uebergabe": "abholung",
      "zahlungsmodus": "vorkasse",
      "liefertermin": "{arbeitstag:+20}",
      "terminstatus": "bestaetigt",
      "positionen": [
        {
          "bezeichnung": "Prüfteil R1",
          "menge": 4,
          "einheit": "stueck",
          "oberflaeche": "verchromen"
        }
      ],
      "goods_receipt": {
        "status": "galvanik",
        "zustand": "teillieferung",
        "packstuecke_da": 2,
        "packstuecke_gesamt": 3,
        "mengen": [
          {
            "erwartet": 4,
            "bestaetigt": 2
          }
        ]
      }
    },
    "auftrag_erwartet_2": {
      "id": "20000000-0000-4000-8000-000000000014",
      "tabelle": "orders",
      "order_number": "A-2099-9004",
      "kunde": "{kunde_bedingung_vorkasse}",
      "art": "auftrag",
      "station": "wareneingang",
      "ware": "erwartet",
      "uebergabe": "versand",
      "zahlungsmodus": "vorkasse",
      "liefertermin": "{arbeitstag:+20}",
      "terminstatus": "bestaetigt",
      "positionen": [
        {
          "bezeichnung": "Prüfteil W3",
          "menge": 2,
          "einheit": "stueck",
          "oberflaeche": "verzinken"
        }
      ]
    },
    "lieferant_bekannt": {
      "id": "00000000-0000-4000-8000-000000000110",
      "tabelle": "customers",
      "customer_number": "K-FLOW-010",
      "customer_type": "lieferant",
      "name": "Prueflieferant Omega GmbH",
      "company_name": "Prueflieferant Omega GmbH",
      "email": "rechnung@omega-pruef.test",
      "phone": "06100 121212",
      "country": "DE",
      "street": "Prüfweg",
      "house_number": "12",
      "zip_code": "99012",
      "city": "Prüfstadt",
      "zahlungsziel_tage": 14,
      "iban": null
    },
    "eingang_mail_bekannt": {
      "id": "20000000-0000-4000-8000-000000000016",
      "tabelle": "intake_item",
      "kanal": "mail",
      "richtung": "rein",
      "quelle": "mailabruf",
      "absender_name": "Pruefabsender Alpha",
      "absender_adresse": "anfrage@alpha-pruef.test",
      "betreff": "Prüfanfrage Verzinken",
      "text": "Bitte um Angebot für zwei Prüfteile.",
      "zuordnung": "offen",
      "kunde_id": null,
      "anliegen": [
        "kv_anfrage"
      ],
      "anliegen_haupt": "kv_anfrage",
      "anliegen_offen": [
        "kv_anfrage"
      ],
      "einsatz": "offen",
      "dateien": [
        {
          "dateiname": "pruef_foto.jpg",
          "art": "anhang",
          "lesbar": true
        }
      ],
      "vorschlaege": [
        {
          "feld": "kunde",
          "wert": "{kunde_vollstaendig_firma}",
          "sicherheit": "vorschlag",
          "regel": "R6",
          "grund": "gleiche Firmenadresse @alpha-pruef.test",
          "status": "offen"
        }
      ]
    },
    "eingang_mail_unbekannt": {
      "id": "20000000-0000-4000-8000-000000000017",
      "tabelle": "intake_item",
      "kanal": "mail",
      "richtung": "rein",
      "quelle": "mailabruf",
      "absender_name": "Pruefabsender Unbekannt",
      "absender_adresse": "anfrage@unbekannt-pruef.test",
      "betreff": "Prüfanfrage Vernickeln",
      "text": "Bitte um Angebot.",
      "zuordnung": "offen",
      "kunde_id": null,
      "anliegen": [
        "kv_anfrage"
      ],
      "anliegen_haupt": "kv_anfrage",
      "anliegen_offen": [
        "kv_anfrage"
      ],
      "einsatz": "offen",
      "dateien": [],
      "vorschlaege": []
    },
    "eingang_mail_lesen": {
      "id": "20000000-0000-4000-8000-000000000018",
      "tabelle": "intake_item",
      "kanal": "mail",
      "richtung": "rein",
      "quelle": "mailabruf",
      "absender_name": "Testa Alphaprobe",
      "absender_adresse": "einkauf@alpha-pruef.test",
      "betreff": "Prüfnachricht",
      "text": "Prüftext ohne Anliegen.",
      "zuordnung": "automatisch",
      "zuordnung_regel": "R4",
      "kunde_id": "{kunde_vollstaendig_firma}",
      "anliegen": [
        "lesen"
      ],
      "anliegen_haupt": "lesen",
      "anliegen_offen": [
        "lesen"
      ],
      "einsatz": "offen",
      "dateien": []
    },
    "eingang_mail_erledigt": {
      "id": "20000000-0000-4000-8000-000000000019",
      "tabelle": "intake_item",
      "kanal": "mail",
      "richtung": "rein",
      "quelle": "mailabruf",
      "absender_name": "Testa Alphaprobe",
      "absender_adresse": "einkauf@alpha-pruef.test",
      "betreff": "Prüfnachricht erledigt",
      "text": "Prüftext erledigt.",
      "zuordnung": "automatisch",
      "zuordnung_regel": "R4",
      "kunde_id": "{kunde_vollstaendig_firma}",
      "anliegen": [
        "nachfrage"
      ],
      "anliegen_haupt": "nachfrage",
      "anliegen_offen": [],
      "einsatz": "erledigt",
      "dateien": []
    },
    "eingang_foto_offen": {
      "id": null,
      "tabelle": "intake_item",
      "kanal": "foto",
      "richtung": "rein",
      "quelle": "geraet",
      "zuordnung": "offen",
      "kunde_id": null,
      "anliegen": [],
      "anliegen_offen": [],
      "einsatz": "offen",
      "dateien": [
        {
          "dateiname": "pruef_foto.jpg",
          "art": "foto",
          "foto_art": "sonst",
          "lesbar": true
        }
      ],
      "vorschlaege": [],
      "fixture_firma": "Firmenname aus der synthetischen Fixture visitenkarte.jpg"
    },
    "eingang_foto_kunde": {
      "id": "20000000-0000-4000-8000-000000000021",
      "tabelle": "intake_item",
      "kanal": "foto",
      "richtung": "rein",
      "quelle": "geraet",
      "zuordnung": "hand",
      "kunde_id": "{kunde_vollstaendig_firma}",
      "anliegen": [],
      "anliegen_offen": [],
      "einsatz": "info",
      "dateien": [
        {
          "dateiname": "pruef_foto.jpg",
          "art": "foto",
          "foto_art": "teile",
          "lesbar": true,
          "geoeffnet": true
        }
      ],
      "vorschlaege": [
        {
          "feld": "position",
          "wert": {
            "bezeichnung": "Prüfteil V1",
            "menge": 2
          },
          "sicherheit": "unsicher",
          "fundstelle": "Seite 1, oben",
          "status": "offen"
        },
        {
          "feld": "termin",
          "wert": "{arbeitstag:+10}",
          "sicherheit": "unsicher",
          "fundstelle": "Seite 1, unten",
          "status": "offen"
        }
      ]
    },
    "eingang_exe_kunde": {
      "id": "20000000-0000-4000-8000-000000000022",
      "tabelle": "intake_item",
      "kanal": "datei",
      "richtung": "rein",
      "quelle": "geraet",
      "zuordnung": "hand",
      "kunde_id": "{kunde_vollstaendig_firma}",
      "anliegen": [],
      "anliegen_offen": [],
      "einsatz": "info",
      "dateien": [
        {
          "dateiname": "pruef_datei.exe",
          "art": "mime",
          "lesbar": false,
          "geoeffnet": false
        }
      ]
    },
    "eingang_rechnung": {
      "id": "20000000-0000-4000-8000-000000000023",
      "tabelle": "intake_item",
      "kanal": "mail",
      "richtung": "rein",
      "quelle": "mailabruf",
      "absender_name": "Prueflieferant Omega GmbH",
      "absender_adresse": "rechnung@omega-pruef.test",
      "betreff": "Prüfrechnung",
      "text": "Rechnung anbei.",
      "zuordnung": "automatisch",
      "zuordnung_regel": "R3",
      "kunde_id": "{lieferant_bekannt}",
      "anliegen": [
        "rechnung"
      ],
      "anliegen_haupt": "rechnung",
      "anliegen_offen": [
        "rechnung"
      ],
      "einsatz": "offen",
      "dateien": [
        {
          "dateiname": "pruef_foto.jpg",
          "art": "anhang",
          "foto_art": "beleg",
          "lesbar": true
        }
      ]
    },
    "rechnung_offen": {
      "id": "20000000-0000-4000-8000-000000000024",
      "tabelle": "supplier_invoice",
      "lieferant_id": "{lieferant_bekannt}",
      "nummer": "PR-2001",
      "datum": "{heute:-10}",
      "netto": 50,
      "ust": 9.5,
      "brutto": 59.5,
      "faellig_am": "{heute:+4}",
      "zahlstatus": "offen",
      "eingang": {
        "kanal": "mail",
        "einsatz": "erledigt",
        "dateien": [
          {
            "dateiname": "pruef_foto.jpg"
          }
        ]
      }
    },
    "rechnung_unklar": {
      "id": "20000000-0000-4000-8000-000000000025",
      "tabelle": "supplier_invoice",
      "lieferant_id": "{lieferant_bekannt}",
      "nummer": "PR-3001",
      "datum": "{heute:-3}",
      "netto": 80,
      "ust": 15.2,
      "brutto": 95.2,
      "faellig_am": "{heute:+11}",
      "zahlstatus": "unklar",
      "unklar_grund": "Prüfgrund unklar",
      "eingang": {
        "kanal": "mail",
        "einsatz": "erledigt",
        "dateien": [
          {
            "dateiname": "pruef_foto.jpg"
          }
        ]
      }
    },
    "aufgabe_rechnung_klaeren": {
      "id": "20000000-0000-4000-8000-000000000026",
      "tabelle": "task",
      "art": "rechnung",
      "titel": "Rechnung klären · Prueflieferant Omega GmbH",
      "faellig_am": "{heute:+0}",
      "vorlauf_tage": 0,
      "fuer_bereich": "geld",
      "bezug_typ": "eingangsrechnung",
      "bezug_id": "{rechnung_unklar}",
      "status": "offen"
    },
    "aufgabe_offen": {
      "id": "20000000-0000-4000-8000-000000000027",
      "tabelle": "task",
      "art": "aufgabe",
      "titel": "Prüfaufgabe offen",
      "faellig_am": "{heute:+0}",
      "vorlauf_tage": 0,
      "fuer_bereich": "auftraege",
      "bezug_typ": "kunde",
      "bezug_id": "{kunde_vollstaendig_firma}",
      "status": "offen"
    },
    "reklamation_aufgenommen": {
      "id": "20000000-0000-4000-8000-000000000028",
      "tabelle": "complaint",
      "nummer": "RK-2099-9001",
      "auftrag_id": "{auftrag_quelle}",
      "kunde_id": "{kunde_vollstaendig_firma}",
      "teile": [
        {
          "position": "Prüfteil Kopie A",
          "menge": 1
        }
      ],
      "mangel": "blasen",
      "beschreibung": "Prüfbeschreibung Blasen",
      "ware_zurueck": "ja",
      "stand": "aufgenommen"
    },
    "reklamation_ohne_ware": {
      "id": "20000000-0000-4000-8000-000000000029",
      "tabelle": "complaint",
      "nummer": "RK-2099-9002",
      "auftrag_id": "{auftrag_quelle}",
      "kunde_id": "{kunde_vollstaendig_firma}",
      "teile": [
        {
          "position": "Prüfteil Kopie A",
          "menge": 1
        }
      ],
      "mangel": "blasen",
      "beschreibung": "Prüfbeschreibung Blasen",
      "ware_zurueck": "nein",
      "stand": "aufgenommen"
    },
    "reklamation_gutschrift": {
      "id": "20000000-0000-4000-8000-000000000030",
      "tabelle": "complaint",
      "nummer": "RK-2099-9003",
      "auftrag_id": "{auftrag_quelle}",
      "kunde_id": "{kunde_vollstaendig_firma}",
      "teile": [
        {
          "position": "Prüfteil Kopie A",
          "menge": 1
        }
      ],
      "mangel": "blasen",
      "ware_zurueck": "nein",
      "stand": "massnahme_gutschrift",
      "bewertung": "kulanz",
      "massnahme": "gutschrift",
      "gutschrift_betrag": null
    },
    "termine_einstellungen": {
      "id": "20000000-0000-4000-8000-000000000031",
      "tabelle": "company_settings",
      "tagesleistung_eur": 1000,
      "uebergabepuffer_tage": 1,
      "auslastung_passt_pct": 80,
      "auslastung_knapp_pct": 100,
      "auslastung_wenig_pct": 50,
      "auslastung_vorrang_pct": 110
    },
    "eingang_mail_zwei_anliegen": {
      "id": "20000000-0000-4000-8000-000000000032",
      "tabelle": "intake_item",
      "kanal": "mail",
      "richtung": "rein",
      "quelle": "mailabruf",
      "absender_name": "Pruefabsender Zwei",
      "absender_adresse": "zwei@unbekannt-pruef.test",
      "betreff": "Prüfanfrage mit Rückruf",
      "text": "Bitte Angebot und Rückruf.",
      "zuordnung": "offen",
      "kunde_id": null,
      "anliegen": [
        "kv_anfrage",
        "rueckruf"
      ],
      "anliegen_haupt": "kv_anfrage",
      "anliegen_offen": [
        "kv_anfrage",
        "rueckruf"
      ],
      "einsatz": "offen",
      "dateien": [],
      "vorschlaege": []
    },
    "eingang_rechnung_erkannt": {
      "id": "20000000-0000-4000-8000-000000000033",
      "tabelle": "intake_item",
      "kanal": "mail",
      "richtung": "rein",
      "quelle": "mailabruf",
      "absender_name": "Prueflieferant Omega GmbH",
      "absender_adresse": "rechnung@omega-pruef.test",
      "betreff": "Prüfrechnung erkannt",
      "text": "Rechnung anbei.",
      "zuordnung": "automatisch",
      "zuordnung_regel": "R3",
      "kunde_id": "{lieferant_bekannt}",
      "anliegen": [
        "rechnung"
      ],
      "anliegen_haupt": "rechnung",
      "anliegen_offen": [
        "rechnung"
      ],
      "einsatz": "offen",
      "dateien": [
        {
          "dateiname": "pruef_foto.jpg",
          "art": "anhang",
          "foto_art": "beleg",
          "lesbar": true
        }
      ],
      "vorschlaege": [
        {
          "feld": "rechnung.nummer",
          "wert": "PR-4001",
          "sicherheit": "unsicher",
          "fundstelle": "Seite 1, oben",
          "status": "offen"
        },
        {
          "feld": "rechnung.datum",
          "wert": "{heute:-2}",
          "sicherheit": "sicher",
          "fundstelle": "Seite 1, oben",
          "status": "offen"
        },
        {
          "feld": "rechnung.betrag",
          "wert": {
            "netto": 40,
            "ust": 7.6,
            "brutto": 47.6
          },
          "sicherheit": "sicher",
          "fundstelle": "Seite 1, unten",
          "status": "offen"
        }
      ]
    },
    "rechnung_vorhanden": {
      "id": "20000000-0000-4000-8000-000000000034",
      "tabelle": "supplier_invoice",
      "lieferant_id": "{lieferant_bekannt}",
      "nummer": "PR-1001",
      "datum": "{heute:-5}",
      "netto": 100,
      "ust": 19,
      "brutto": 119,
      "faellig_am": "{heute:+9}",
      "zahlstatus": "offen",
      "eingang": {
        "kanal": "mail",
        "einsatz": "erledigt",
        "dateien": [
          {
            "dateiname": "pruef_foto.jpg"
          }
        ]
      }
    },
    "rechnung_vorhanden_4001": {
      "id": "20000000-0000-4000-8000-000000000035",
      "tabelle": "supplier_invoice",
      "lieferant_id": "{lieferant_bekannt}",
      "nummer": "PR-4001",
      "datum": "{heute:-2}",
      "netto": 40,
      "ust": 7.6,
      "brutto": 47.6,
      "faellig_am": "{heute:+12}",
      "zahlstatus": "offen",
      "eingang": {
        "kanal": "mail",
        "einsatz": "erledigt",
        "dateien": [
          {
            "dateiname": "pruef_foto.jpg"
          }
        ]
      }
    },
    "eingang_mail_original": {
      "id": "20000000-0000-4000-8000-000000000036",
      "tabelle": "intake_item",
      "kanal": "mail",
      "richtung": "rein",
      "quelle": "mailabruf",
      "absender_name": "Testa Alphaprobe",
      "absender_adresse": "einkauf@alpha-pruef.test",
      "betreff": "Prüfmail Original",
      "text": "Prüftext Mail-Original",
      "zuordnung": "automatisch",
      "zuordnung_regel": "R4",
      "kunde_id": "{kunde_vollstaendig_firma}",
      "anliegen": [],
      "anliegen_offen": [],
      "einsatz": "info",
      "dateien": []
    },
    "datei_mail_eml": {
      "id": "20000000-0000-4000-8000-000000000037",
      "tabelle": "intake_file",
      "item_id": "{eingang_mail_original}",
      "art": "mime",
      "dateiname": "pruef_mail.eml",
      "lesbar": true,
      "geoeffnet": true
    },
    "eingang_offen_ohne_anhang": {
      "id": "20000000-0000-4000-8000-000000000038",
      "tabelle": "intake_item",
      "kanal": "foto",
      "richtung": "rein",
      "quelle": "geraet",
      "zuordnung": "offen",
      "kunde_id": null,
      "anliegen": [],
      "anliegen_offen": [],
      "einsatz": "offen",
      "dateien": [],
      "vorschlaege": []
    },
    "datei_offen": {
      "id": "20000000-0000-4000-8000-000000000039",
      "tabelle": "intake_file",
      "item_id": "{eingang_offen_ohne_anhang}",
      "art": "foto",
      "foto_art": "sonst",
      "dateiname": "pruef_foto.jpg",
      "lesbar": true,
      "geoeffnet": true
    },
    "kunde_vorrang": {
      "id": "00000000-0000-4000-8000-000000000111",
      "tabelle": "customers",
      "customer_number": "K-FLOW-011",
      "customer_type": "business",
      "country": "DE",
      "street": "Prüfweg",
      "zip_code": "99001",
      "city": "Prüfstadt",
      "ziel_freigeschaltet": false,
      "handover_preference": null,
      "salutation": "frau",
      "contact_role": "Einkauf",
      "zahlungsbedingung": "vorkasse",
      "phone": "06100 101010",
      "house_number": "10",
      "company_name": "Prueffirma Iota GmbH",
      "name": "Prueffirma Iota GmbH",
      "first_name": "Ina",
      "last_name": "Iotaprobe",
      "email": "einkauf@iota-pruef.test",
      "vorrang": true,
      "auto_info": true
    },
    "kunde_ohne_auto_info": {
      "id": "00000000-0000-4000-8000-000000000112",
      "tabelle": "customers",
      "customer_number": "K-FLOW-012",
      "customer_type": "business",
      "country": "DE",
      "street": "Prüfweg",
      "zip_code": "99001",
      "city": "Prüfstadt",
      "ziel_freigeschaltet": false,
      "handover_preference": null,
      "salutation": "frau",
      "contact_role": "Einkauf",
      "zahlungsbedingung": "vorkasse",
      "phone": "06100 131313",
      "house_number": "13",
      "company_name": "Prueffirma Kappa GmbH",
      "name": "Prueffirma Kappa GmbH",
      "first_name": "Kai",
      "last_name": "Kappaprobe",
      "email": "einkauf@kappa-pruef.test",
      "vorrang": false,
      "auto_info": false
    },
    "auftrag_auslastung_90": {
      "id": "20000000-0000-4000-8000-000000000042",
      "tabelle": "orders",
      "order_number": "A-2099-9005",
      "kunde": "{kunde_vollstaendig_firma}",
      "art": "auftrag",
      "station": "in_arbeit",
      "ware": "da",
      "uebergabe": "abholung",
      "zahlungsmodus": "vorkasse",
      "angenommen_am": "{heute:-5}",
      "liefertermin": "{arbeitstag:+60}",
      "terminstatus": "bestaetigt",
      "positionen": [
        {
          "bezeichnung": "Prüfteil Last",
          "menge": 1,
          "einheit": "stueck",
          "oberflaeche": "verzinken",
          "einzelpreis": 54000
        }
      ]
    },
    "auftrag_auslastung_105": {
      "id": "20000000-0000-4000-8000-000000000043",
      "tabelle": "orders",
      "order_number": "A-2099-9006",
      "kunde": "{kunde_vollstaendig_firma}",
      "art": "auftrag",
      "station": "in_arbeit",
      "ware": "da",
      "uebergabe": "abholung",
      "zahlungsmodus": "vorkasse",
      "angenommen_am": "{heute:-5}",
      "liefertermin": "{arbeitstag:+60}",
      "terminstatus": "bestaetigt",
      "positionen": [
        {
          "bezeichnung": "Prüfteil Last",
          "menge": 1,
          "einheit": "stueck",
          "oberflaeche": "verzinken",
          "einzelpreis": 63000
        }
      ]
    },
    "auftrag_auslastung_voll": {
      "id": "20000000-0000-4000-8000-000000000044",
      "tabelle": "orders",
      "order_number": "A-2099-9007",
      "kunde": "{kunde_vollstaendig_firma}",
      "art": "auftrag",
      "station": "in_arbeit",
      "ware": "da",
      "uebergabe": "abholung",
      "zahlungsmodus": "vorkasse",
      "angenommen_am": "{heute:-5}",
      "liefertermin": "{kw_ende:+40}",
      "terminstatus": "bestaetigt",
      "positionen": [
        {
          "bezeichnung": "Prüfteil Voll",
          "menge": 1,
          "einheit": "stueck",
          "oberflaeche": "verzinken",
          "einzelpreis": 60000
        }
      ]
    },
    "entwurf_eigen": {
      "id": null,
      "tabelle": "intake_drafts",
      "login": "{login}",
      "art": "eingang",
      "text": "Entwurf Prüftext",
      "kunde": "{kunde_vollstaendig_firma}",
      "zuletzt_feld": "eingang.erfassen-text"
    },
    "entwurf_fremd": {
      "id": "20000000-0000-4000-8000-000000000046",
      "tabelle": "intake_drafts",
      "login": "login_meister",
      "art": "eingang",
      "text": "Fremder Entwurf"
    },
    "auftrag_quelle_abholer": {
      "id": null,
      "tabelle": "orders",
      "order_number": "A-2099-9008",
      "kunde": "{kunde_vollstaendig_firma}",
      "station": "fertig",
      "pickup_by_name": "Jens",
      "pickup_by_source": "notiz"
    },
    "eingang_foto_fehlgeschlagen": {
      "id": null,
      "tabelle": "intake_item",
      "kanal": "foto",
      "richtung": "rein",
      "erkennung_status": "fehlgeschlagen",
      "erkennung_grund": "provider_503"
    },
    "eingang_foto_verwaist": {
      "id": null,
      "tabelle": "intake_item",
      "kanal": "foto",
      "richtung": "rein",
      "erkennung_status": "laeuft",
      "erkennung_seit": "{jetzt:-3min}"
    }
  }
} as const;
