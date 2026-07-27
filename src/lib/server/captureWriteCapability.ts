import { sql } from "drizzle-orm";
import { db } from "@/db";
import { databaseRuntimeIdentityPredicate } from "@/lib/server/databaseRuntimeIdentity";

type CapabilityRow = { available: boolean };

const CAPTURE_TABLES = [
  "arbeitszeit_buchung",
  "audit_log",
  "vorlage_zeit",
  "vorlage_verbrauch",
  "kostensatz_default",
  "teile_klassifikator",
  "capture_request_receipts",
] as const;

/**
 * Proves the server-only capture boundary after the separate inventory
 * capability has passed. A partial migration must leave writes unavailable.
 */
export const captureWriteCapabilityQuery = sql<CapabilityRow>`
  with protected_relations as (
    select rel.oid, rel.relname, rel.relowner, rel.relacl,
      rel.relrowsecurity, rel.relforcerowsecurity
    from pg_class rel
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relkind in ('r', 'p')
      and rel.relname in (${sql.join(CAPTURE_TABLES.map((name) => sql`${name}`), sql`, `)})
  ),
  template_projection_relations as (
    select rel.oid, rel.relname, rel.relowner
    from pg_class rel
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relkind in ('r', 'p')
      and rel.relname in (
        'orders', 'items', 'arbeitszeit_buchung', 'teile_klassifikator',
        'stock_movements', 'inventory_items', 'vorlage_zeit', 'vorlage_verbrauch',
        'customers', 'ausgangsrechnung', 'kostenstelle', 'kostenstellen_energie_monat'
      )
  ),
  required_columns(table_name, column_name, data_type, nullable, precision, scale) as (
    values
      ('arbeitszeit_buchung', 'id', 'uuid', false, null::integer, null::integer),
      ('arbeitszeit_buchung', 'tenant_id', 'text', false, null::integer, null::integer),
      ('arbeitszeit_buchung', 'auftrag_id', 'text', false, null::integer, null::integer),
      ('arbeitszeit_buchung', 'employee_id', 'uuid', false, null::integer, null::integer),
      ('arbeitszeit_buchung', 'kostenstelle_kuerzel', 'text', false, null::integer, null::integer),
      ('arbeitszeit_buchung', 'station_kuerzel', 'text', false, null::integer, null::integer),
      ('arbeitszeit_buchung', 'start_zeit', 'timestamp with time zone', false, null::integer, null::integer),
      ('arbeitszeit_buchung', 'end_zeit', 'timestamp with time zone', true, null::integer, null::integer),
      ('arbeitszeit_buchung', 'dauer_minuten', 'integer', false, null::integer, null::integer),
      ('arbeitszeit_buchung', 'kostensatz_eur_pro_stunde', 'numeric', false, 8, 2),
      ('arbeitszeit_buchung', 'erfasst_modus', 'text', false, null::integer, null::integer),
      ('arbeitszeit_buchung', 'war_aus_vorlage', 'boolean', true, null::integer, null::integer),
      ('arbeitszeit_buchung', 'vorlage_id', 'uuid', true, null::integer, null::integer),
      ('arbeitszeit_buchung', 'bemerkung', 'text', true, null::integer, null::integer),
      ('arbeitszeit_buchung', 'erstellt_am', 'timestamp with time zone', true, null::integer, null::integer),
      ('arbeitszeit_buchung', 'aktualisiert_am', 'timestamp with time zone', true, null::integer, null::integer),
      ('arbeitszeit_buchung', 'client_request_id', 'uuid', true, null::integer, null::integer),
      ('audit_log', 'id', 'text', false, null::integer, null::integer),
      ('audit_log', 'tenant_id', 'text', false, null::integer, null::integer),
      ('audit_log', 'client_request_id', 'uuid', true, null::integer, null::integer),
      ('audit_log', 'action', 'text', false, null::integer, null::integer),
      ('audit_log', 'actor_id', 'uuid', true, null::integer, null::integer),
      ('audit_log', 'table_name', 'text', true, null::integer, null::integer),
      ('audit_log', 'record_id', 'text', true, null::integer, null::integer),
      ('audit_log', 'payload', 'jsonb', true, null::integer, null::integer),
      ('audit_log', 'created_at', 'timestamp with time zone', false, null::integer, null::integer),
      ('vorlage_zeit', 'id', 'uuid', false, null::integer, null::integer),
      ('vorlage_zeit', 'tenant_id', 'text', false, null::integer, null::integer),
      ('vorlage_zeit', 'schluessel', 'text', false, null::integer, null::integer),
      ('vorlage_zeit', 'teilekategorie', 'text', true, null::integer, null::integer),
      ('vorlage_zeit', 'oberflaeche', 'text', true, null::integer, null::integer),
      ('vorlage_zeit', 'station_kuerzel', 'text', false, null::integer, null::integer),
      ('vorlage_zeit', 'median_minuten', 'numeric', false, 8, 2),
      ('vorlage_zeit', 'p25_minuten', 'numeric', true, 8, 2),
      ('vorlage_zeit', 'p75_minuten', 'numeric', true, 8, 2),
      ('vorlage_zeit', 'n_referenzauftraege', 'integer', false, null::integer, null::integer),
      ('vorlage_zeit', 'letzte_aktualisierung', 'timestamp with time zone', true, null::integer, null::integer),
      ('vorlage_zeit', 'is_active', 'boolean', false, null::integer, null::integer),
      ('vorlage_verbrauch', 'id', 'uuid', false, null::integer, null::integer),
      ('vorlage_verbrauch', 'tenant_id', 'text', false, null::integer, null::integer),
      ('vorlage_verbrauch', 'schluessel', 'text', false, null::integer, null::integer),
      ('vorlage_verbrauch', 'teilekategorie', 'text', true, null::integer, null::integer),
      ('vorlage_verbrauch', 'oberflaeche', 'text', true, null::integer, null::integer),
      ('vorlage_verbrauch', 'station_kuerzel', 'text', false, null::integer, null::integer),
      ('vorlage_verbrauch', 'inventory_item_id', 'text', false, null::integer, null::integer),
      ('vorlage_verbrauch', 'einheit_normiert', 'text', false, null::integer, null::integer),
      ('vorlage_verbrauch', 'median_menge', 'numeric', false, 10, 4),
      ('vorlage_verbrauch', 'p25_menge', 'numeric', true, 10, 4),
      ('vorlage_verbrauch', 'p75_menge', 'numeric', true, 10, 4),
      ('vorlage_verbrauch', 'n_referenzauftraege', 'integer', false, null::integer, null::integer),
      ('vorlage_verbrauch', 'haeufigkeit_prozent', 'numeric', true, 5, 2),
      ('vorlage_verbrauch', 'letzte_aktualisierung', 'timestamp with time zone', true, null::integer, null::integer),
      ('vorlage_verbrauch', 'is_active', 'boolean', false, null::integer, null::integer),
      ('kostensatz_default', 'tenant_id', 'text', false, null::integer, null::integer),
      ('kostensatz_default', 'station_kuerzel', 'text', false, null::integer, null::integer),
      ('kostensatz_default', 'eur_pro_stunde', 'numeric', false, 8, 2),
      ('kostensatz_default', 'gilt_ab', 'date', false, null::integer, null::integer),
      ('kostensatz_default', 'bemerkung', 'text', true, null::integer, null::integer),
      ('teile_klassifikator', 'id', 'uuid', false, null::integer, null::integer),
      ('teile_klassifikator', 'tenant_id', 'text', false, null::integer, null::integer),
      ('teile_klassifikator', 'klasse', 'text', false, null::integer, null::integer),
      ('teile_klassifikator', 'keywords', 'ARRAY', false, null::integer, null::integer),
      ('teile_klassifikator', 'beispiel_oberflaechen', 'ARRAY', true, null::integer, null::integer),
      ('capture_request_receipts', 'id', 'uuid', false, null::integer, null::integer),
      ('capture_request_receipts', 'tenant_id', 'text', false, null::integer, null::integer),
      ('capture_request_receipts', 'client_request_id', 'uuid', false, null::integer, null::integer),
      ('capture_request_receipts', 'kind', 'text', false, null::integer, null::integer),
      ('capture_request_receipts', 'actor_id', 'uuid', false, null::integer, null::integer),
      ('capture_request_receipts', 'order_id', 'text', false, null::integer, null::integer),
      ('capture_request_receipts', 'station_kuerzel', 'text', true, null::integer, null::integer),
      ('capture_request_receipts', 'request_hash', 'text', false, null::integer, null::integer),
      ('capture_request_receipts', 'result', 'jsonb', true, null::integer, null::integer),
      ('capture_request_receipts', 'created_at', 'timestamp with time zone', false, null::integer, null::integer),
      ('capture_request_receipts', 'completed_at', 'timestamp with time zone', true, null::integer, null::integer)
  ),
  required_checks(table_name, constraint_name, expression_md5) as (
    values
      ('arbeitszeit_buchung', 'arbeitszeit_buchung_duration_nonnegative', '40ef758bc7533d8e38afdf87e7315628'),
      ('arbeitszeit_buchung', 'arbeitszeit_buchung_rate_nonnegative', 'af4623a76bb8df45752378658a9e1030'),
      ('arbeitszeit_buchung', 'arbeitszeit_buchung_template_provenance_chk', '148196aa98066313711f2b0f3cbb223d'),
      ('arbeitszeit_buchung', 'arbeitszeit_buchung_tenant_nonblank_chk', '33fc5488e7b5d67e44ddb3a9d273f639'),
      ('audit_log', 'audit_log_tenant_nonblank_chk', '33fc5488e7b5d67e44ddb3a9d273f639'),
      ('vorlage_zeit', 'vorlage_zeit_tenant_nonblank_chk', '33fc5488e7b5d67e44ddb3a9d273f639'),
      ('vorlage_zeit', 'vorlage_zeit_projection_values_chk', '2dafb1c34dcb1e1f071b0adb425c6972'),
      ('vorlage_verbrauch', 'vorlage_verbrauch_tenant_nonblank_chk', '33fc5488e7b5d67e44ddb3a9d273f639'),
      ('vorlage_verbrauch', 'vorlage_verbrauch_projection_values_chk', 'b4c1bfc16010d3005ab0fcb3695631b8'),
      ('kostensatz_default', 'kostensatz_default_tenant_nonblank_chk', '33fc5488e7b5d67e44ddb3a9d273f639'),
      ('kostensatz_default', 'kostensatz_default_rate_valid_chk', '9367f9851c5771f5ecf943e41eddc5a2'),
      ('teile_klassifikator', 'teile_klassifikator_tenant_nonblank_chk', '33fc5488e7b5d67e44ddb3a9d273f639'),
      ('capture_request_receipts', 'capture_request_receipts_kind_check', '5521b4088377fe1ed56c30e010c7b8f9'),
      ('capture_request_receipts', 'capture_request_receipts_hash_check', '60495c1d366774dc52477cab1e821e81'),
      ('capture_request_receipts', 'capture_request_receipts_completion_chk', '05f5c630cdc8fdc563c051f8130c3beb'),
      ('capture_request_receipts', 'capture_request_receipts_tenant_nonblank_chk', '33fc5488e7b5d67e44ddb3a9d273f639')
  ),
  required_exact_checks(table_name, constraint_name, expression_definition) as (
    values
      ('items', 'items_template_surface_key_chk', '((surface_requested IS NULL) OR (POSITION((''|''::text) IN (surface_requested)) = 0))'),
      ('teile_klassifikator', 'teile_klassifikator_template_key_chk', '((btrim(klasse) <> ''''::text) AND (POSITION((''|''::text) IN (klasse)) = 0) AND fn_kreile_template_keywords_valid(keywords))')
  ),
  required_primary_keys(table_name, columns) as (
    values
      ('arbeitszeit_buchung', ARRAY['id']),
      ('audit_log', ARRAY['id']),
      ('capture_request_receipts', ARRAY['id'])
  ),
  required_defaults(table_name, column_name, fragment) as (
    values
      ('arbeitszeit_buchung', 'id', 'gen_random_uuid()'),
      ('arbeitszeit_buchung', 'erstellt_am', 'now()'),
      ('arbeitszeit_buchung', 'aktualisiert_am', 'now()'),
      ('audit_log', 'id', 'gen_random_uuid()'),
      ('audit_log', 'created_at', 'now()'),
      ('vorlage_zeit', 'is_active', 'false'),
      ('vorlage_verbrauch', 'is_active', 'false'),
      ('capture_request_receipts', 'id', 'gen_random_uuid()'),
      ('capture_request_receipts', 'created_at', 'now()')
  ),
  required_foreign_keys(
    constraint_name, source_table, target_table, source_columns, target_columns,
    delete_type, target_index_name, target_opclasses, equality_operators,
    expected_collations
  ) as (
    values
      ('arbeitszeit_buchung_tenant_order_fk', 'arbeitszeit_buchung', 'orders', ARRAY['tenant_id', 'auftrag_id'], ARRAY['tenant_id', 'id'], 'r', 'orders_tenant_id_uidx', ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops']::text[], ARRAY['pg_catalog.=(text,text)'::regoperator::oid, 'pg_catalog.=(text,text)'::regoperator::oid]::oid[], ARRAY['pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid]::oid[]),
      ('arbeitszeit_buchung_tenant_employee_fk', 'arbeitszeit_buchung', 'app_users', ARRAY['tenant_id', 'employee_id'], ARRAY['tenant_id', 'id'], 'r', 'app_users_tenant_id_uidx', ARRAY['pg_catalog.text_ops', 'pg_catalog.uuid_ops']::text[], ARRAY['pg_catalog.=(text,text)'::regoperator::oid, 'pg_catalog.=(uuid,uuid)'::regoperator::oid]::oid[], ARRAY['pg_catalog.default'::regcollation::oid, 0::oid]::oid[]),
      ('arbeitszeit_buchung_tenant_template_fk', 'arbeitszeit_buchung', 'vorlage_zeit', ARRAY['tenant_id', 'vorlage_id'], ARRAY['tenant_id', 'id'], 'r', 'vorlage_zeit_tenant_id_uidx', ARRAY['pg_catalog.text_ops', 'pg_catalog.uuid_ops']::text[], ARRAY['pg_catalog.=(text,text)'::regoperator::oid, 'pg_catalog.=(uuid,uuid)'::regoperator::oid]::oid[], ARRAY['pg_catalog.default'::regcollation::oid, 0::oid]::oid[]),
      ('vorlage_verbrauch_tenant_inventory_fk', 'vorlage_verbrauch', 'inventory_items', ARRAY['tenant_id', 'inventory_item_id'], ARRAY['tenant_id', 'id'], 'r', 'inventory_items_tenant_id_uidx', ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops']::text[], ARRAY['pg_catalog.=(text,text)'::regoperator::oid, 'pg_catalog.=(text,text)'::regoperator::oid]::oid[], ARRAY['pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid]::oid[]),
      ('stock_movements_tenant_template_fk', 'stock_movements', 'vorlage_verbrauch', ARRAY['tenant_id', 'vorlage_id'], ARRAY['tenant_id', 'id'], 'r', 'vorlage_verbrauch_tenant_id_uidx', ARRAY['pg_catalog.text_ops', 'pg_catalog.uuid_ops']::text[], ARRAY['pg_catalog.=(text,text)'::regoperator::oid, 'pg_catalog.=(uuid,uuid)'::regoperator::oid]::oid[], ARRAY['pg_catalog.default'::regcollation::oid, 0::oid]::oid[]),
      ('capture_request_receipts_tenant_actor_fk', 'capture_request_receipts', 'app_users', ARRAY['tenant_id', 'actor_id'], ARRAY['tenant_id', 'id'], 'r', 'app_users_tenant_id_uidx', ARRAY['pg_catalog.text_ops', 'pg_catalog.uuid_ops']::text[], ARRAY['pg_catalog.=(text,text)'::regoperator::oid, 'pg_catalog.=(uuid,uuid)'::regoperator::oid]::oid[], ARRAY['pg_catalog.default'::regcollation::oid, 0::oid]::oid[]),
      ('capture_request_receipts_tenant_order_fk', 'capture_request_receipts', 'orders', ARRAY['tenant_id', 'order_id'], ARRAY['tenant_id', 'id'], 'r', 'orders_tenant_id_uidx', ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops']::text[], ARRAY['pg_catalog.=(text,text)'::regoperator::oid, 'pg_catalog.=(text,text)'::regoperator::oid]::oid[], ARRAY['pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid]::oid[]),
      ('audit_log_tenant_actor_fk', 'audit_log', 'app_users', ARRAY['tenant_id', 'actor_id'], ARRAY['tenant_id', 'id'], 'r', 'app_users_tenant_id_uidx', ARRAY['pg_catalog.text_ops', 'pg_catalog.uuid_ops']::text[], ARRAY['pg_catalog.=(text,text)'::regoperator::oid, 'pg_catalog.=(uuid,uuid)'::regoperator::oid]::oid[], ARRAY['pg_catalog.default'::regcollation::oid, 0::oid]::oid[]),
      ('items_tenant_order_fk', 'items', 'orders', ARRAY['tenant_id', 'order_id'], ARRAY['tenant_id', 'id'], 'c', 'orders_tenant_id_uidx', ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops']::text[], ARRAY['pg_catalog.=(text,text)'::regoperator::oid, 'pg_catalog.=(text,text)'::regoperator::oid]::oid[], ARRAY['pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid]::oid[])
  ),
  required_indexes(
    table_name, index_name, columns, unique_index,
    predicate_definition, opclasses, sort_options, expected_collations
  ) as (
    values
      ('capture_request_receipts', 'capture_request_receipts_tenant_request_kind_uidx', ARRAY['tenant_id', 'client_request_id', 'kind'], true, null::text, ARRAY['pg_catalog.text_ops', 'pg_catalog.uuid_ops', 'pg_catalog.text_ops'], ARRAY[0, 0, 0]::smallint[], ARRAY['pg_catalog.default'::regcollation::oid, 0::oid, 'pg_catalog.default'::regcollation::oid]::oid[]),
      ('capture_request_receipts', 'capture_request_receipts_tenant_order_created_idx', ARRAY['tenant_id', 'order_id', 'created_at'], false, null::text, ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops', 'pg_catalog.timestamptz_ops'], ARRAY[0, 0, 3]::smallint[], ARRAY['pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid, 0::oid]::oid[]),
      ('arbeitszeit_buchung', 'arbeitszeit_buchung_tenant_order_idx', ARRAY['tenant_id', 'auftrag_id', 'erstellt_am'], false, null::text, ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops', 'pg_catalog.timestamptz_ops'], ARRAY[0, 0, 3]::smallint[], ARRAY['pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid, 0::oid]::oid[]),
      ('arbeitszeit_buchung', 'arbeitszeit_buchung_tenant_request_idx', ARRAY['tenant_id', 'client_request_id'], false, '(client_request_id IS NOT NULL)', ARRAY['pg_catalog.text_ops', 'pg_catalog.uuid_ops'], ARRAY[0, 0]::smallint[], ARRAY['pg_catalog.default'::regcollation::oid, 0::oid]::oid[]),
      ('audit_log', 'audit_log_tenant_request_action_uidx', ARRAY['tenant_id', 'client_request_id', 'action'], true, '(client_request_id IS NOT NULL)', ARRAY['pg_catalog.text_ops', 'pg_catalog.uuid_ops', 'pg_catalog.text_ops'], ARRAY[0, 0, 0]::smallint[], ARRAY['pg_catalog.default'::regcollation::oid, 0::oid, 'pg_catalog.default'::regcollation::oid]::oid[]),
      ('audit_log', 'audit_log_tenant_created_idx', ARRAY['tenant_id', 'created_at'], false, null::text, ARRAY['pg_catalog.text_ops', 'pg_catalog.timestamptz_ops'], ARRAY[0, 3]::smallint[], ARRAY['pg_catalog.default'::regcollation::oid, 0::oid]::oid[]),
      ('vorlage_zeit', 'vorlage_zeit_tenant_id_uidx', ARRAY['tenant_id', 'id'], true, null::text, ARRAY['pg_catalog.text_ops', 'pg_catalog.uuid_ops'], ARRAY[0, 0]::smallint[], ARRAY['pg_catalog.default'::regcollation::oid, 0::oid]::oid[]),
      ('vorlage_verbrauch', 'vorlage_verbrauch_tenant_id_uidx', ARRAY['tenant_id', 'id'], true, null::text, ARRAY['pg_catalog.text_ops', 'pg_catalog.uuid_ops'], ARRAY[0, 0]::smallint[], ARRAY['pg_catalog.default'::regcollation::oid, 0::oid]::oid[]),
      ('vorlage_zeit', 'vorlage_zeit_tenant_key_station_uidx', ARRAY['tenant_id', 'schluessel', 'station_kuerzel'], true, null::text, ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops', 'pg_catalog.text_ops'], ARRAY[0, 0, 0]::smallint[], ARRAY['pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid]::oid[]),
      ('vorlage_verbrauch', 'vorlage_verbrauch_tenant_key_station_item_uidx', ARRAY['tenant_id', 'schluessel', 'station_kuerzel', 'inventory_item_id'], true, null::text, ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops', 'pg_catalog.text_ops', 'pg_catalog.text_ops'], ARRAY[0, 0, 0, 0]::smallint[], ARRAY['pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid]::oid[])
  ),
  expected_projection_functions(
    function_oid, language_name, return_type, volatility,
    is_strict, security_definer, argument_count, argument_names,
    definition_md5, required_fragments
  ) as (
    values
      (
        to_regprocedure('public.fn_kreile_template_normalize(text)')::oid,
        'sql', 'text'::regtype::oid, 'i', true, false, 1, ARRAY['p_value']::text[],
        '11156fe67484f3a382eea5202c6e80a4',
        ARRAY['normalize(p_value, NFC)', 'lower(btrim', '''ä'', ''ae''', '''ö'', ''oe''', '''ü'', ''ue''', '''ß'', ''ss''']
      ),
      (
        to_regprocedure('public.fn_kreile_template_keywords_valid(text[])')::oid,
        'sql', 'boolean'::regtype::oid, 'i', false, false, 1, ARRAY['p_keywords']::text[],
        'd6c4024c3d3a869f0795c96a6ebe9c8e',
        ARRAY['p_keywords IS NOT NULL', 'cardinality(p_keywords) > 0', 'keyword IS NULL', 'btrim(keyword) = ''''']
      ),
      (
        to_regprocedure('public.fn_kreile_template_classify(text,text)')::oid,
        'sql', 'text'::regtype::oid, 's', true, false, 2, ARRAY['p_tenant_id', 'p_item_name']::text[],
        'aa3283092a231dd9134774ce3de5aecb',
        ARRAY['classifier.tenant_id = p_tenant_id', 'strpos(', '> 0', 'length(public.fn_kreile_template_normalize(keyword.value)) DESC', '''sonstiges''']
      ),
      (
        to_regprocedure('public.fn_update_vorlagen()')::oid,
        'plpgsql', 'trigger'::regtype::oid, 'v', false, true, 0, null::text[],
        'c0a810fd594dd7012e097d2d00be7f50',
        ARRAY[
          'TG_TABLE_SCHEMA', 'TG_TABLE_NAME', 'TG_OP',
          'OLD.id IS DISTINCT FROM NEW.id', 'OLD.tenant_id IS DISTINCT FROM NEW.tenant_id',
          'old_is_terminal', 'new_is_terminal', '''shipped''', '''versendet''',
          'movement_type IN (''consumption'', ''verbrauch'')',
          'movement.tenant_id = NEW.tenant_id', 'inventory.tenant_id = movement.tenant_id',
          'booking.end_zeit IS NOT NULL', 'WHEN ''beschichtung'' THEN ''galvanik''',
          'pg_advisory_xact_lock', 'is_active = false',
          'ON CONFLICT (tenant_id, schluessel, station_kuerzel)',
          'ON CONFLICT (tenant_id, schluessel, station_kuerzel, inventory_item_id)',
          'TEMPLATE_PROJECTION_UNIT_DRIFT',
          'TEMPLATE_PROJECTION_TERMINAL_INSERT_REQUIRES_STATUS_TRANSITION'
        ]
      ),
      (
        to_regprocedure('public.fn_guard_template_projection_source_insert()')::oid,
        'plpgsql', 'trigger'::regtype::oid, 'v', false, true, 0, null::text[],
        '758bf8c0fc6506ad85862f5547a660f2',
        ARRAY[
          'TG_TABLE_SCHEMA', 'TG_TABLE_NAME', 'TG_OP <> ''INSERT''',
          '''items''', '''arbeitszeit_buchung''', '''stock_movements''',
          'NEW.order_id', 'NEW.auftrag_id', 'NEW.movement_type',
          'FOR SHARE', 'source_order_status IS DISTINCT FROM ''in_progress''',
          'TEMPLATE_PROJECTION_SOURCE_ORDER_MISSING', 'TEMPLATE_PROJECTION_SOURCE_FROZEN'
        ]
      )
  ),
  expected_source_triggers(trigger_name, relation_name, definition_hashes) as (
    values
      ('template_projection_items_source_guard_trg', 'items', ARRAY['1518b003c2b9daa78a4c9fb95495ab25', '4ea1d298c5b87ee735867e25b9542f33']::text[]),
      ('template_projection_time_source_guard_trg', 'arbeitszeit_buchung', ARRAY['d549dd2d444805a2199fb4714a65a584', '5bcc98cc276601c794cc86b94543f52a']::text[]),
      ('template_projection_movement_source_guard_trg', 'stock_movements', ARRAY['4043dfe12eaf485e867ffce88def38fa', '768f4f1e8a396a1f14d510372e1e0c97']::text[])
  ),
  expected_check_dependencies(
    source_table, constraint_name, refclassid, refobjid, refobjsubid, deptype
  ) as (
    values
      ('items', 'items_template_surface_key_chk', 'pg_class'::regclass::oid, 'public.items'::regclass::oid, (select attnum from pg_attribute where attrelid = 'public.items'::regclass and attname = 'surface_requested' and not attisdropped), 'a'),
      ('items', 'items_template_surface_key_chk', 'pg_class'::regclass::oid, 'public.items'::regclass::oid, (select attnum from pg_attribute where attrelid = 'public.items'::regclass and attname = 'surface_requested' and not attisdropped), 'n'),
      ('teile_klassifikator', 'teile_klassifikator_template_key_chk', 'pg_proc'::regclass::oid, to_regprocedure('public.fn_kreile_template_keywords_valid(text[])')::oid, 0, 'n'),
      ('teile_klassifikator', 'teile_klassifikator_template_key_chk', 'pg_class'::regclass::oid, 'public.teile_klassifikator'::regclass::oid, (select attnum from pg_attribute where attrelid = 'public.teile_klassifikator'::regclass and attname = 'klasse' and not attisdropped), 'a'),
      ('teile_klassifikator', 'teile_klassifikator_template_key_chk', 'pg_class'::regclass::oid, 'public.teile_klassifikator'::regclass::oid, (select attnum from pg_attribute where attrelid = 'public.teile_klassifikator'::regclass and attname = 'klasse' and not attisdropped), 'n'),
      ('teile_klassifikator', 'teile_klassifikator_template_key_chk', 'pg_class'::regclass::oid, 'public.teile_klassifikator'::regclass::oid, (select attnum from pg_attribute where attrelid = 'public.teile_klassifikator'::regclass and attname = 'keywords' and not attisdropped), 'a'),
      ('teile_klassifikator', 'teile_klassifikator_template_key_chk', 'pg_class'::regclass::oid, 'public.teile_klassifikator'::regclass::oid, (select attnum from pg_attribute where attrelid = 'public.teile_klassifikator'::regclass and attname = 'keywords' and not attisdropped), 'n')
  ),
  expected_classifier_index_dependencies(refclassid, refobjid, refobjsubid, deptype) as (
    values
      ('pg_proc'::regclass::oid, to_regprocedure('public.fn_kreile_template_normalize(text)')::oid, 0, 'n'),
      ('pg_class'::regclass::oid, 'public.teile_klassifikator'::regclass::oid, (select attnum from pg_attribute where attrelid = 'public.teile_klassifikator'::regclass and attname = 'tenant_id' and not attisdropped), 'a'),
      ('pg_class'::regclass::oid, 'public.teile_klassifikator'::regclass::oid, (select attnum from pg_attribute where attrelid = 'public.teile_klassifikator'::regclass and attname = 'klasse' and not attisdropped), 'a')
  ),
  expected_view_bases(relation_oid) as (
    values
      ('public.orders'::regclass::oid),
      ('public.customers'::regclass::oid),
      ('public.ausgangsrechnung'::regclass::oid),
      ('public.stock_movements'::regclass::oid),
      ('public.arbeitszeit_buchung'::regclass::oid),
      ('public.kostenstelle'::regclass::oid),
      ('public.kostenstellen_energie_monat'::regclass::oid)
  ),
  expected_view_dependencies(relation_oid, column_name) as (
    values
      ('public.orders'::regclass::oid, 'id'),
      ('public.orders'::regclass::oid, 'order_number'),
      ('public.orders'::regclass::oid, 'customer_id'),
      ('public.orders'::regclass::oid, 'intake_date'),
      ('public.orders'::regclass::oid, 'status'),
      ('public.orders'::regclass::oid, 'current_station_id'),
      ('public.orders'::regclass::oid, 'current_station'),
      ('public.orders'::regclass::oid, 'station'),
      ('public.orders'::regclass::oid, 'due_date'),
      ('public.orders'::regclass::oid, 'tenant_id'),
      ('public.stock_movements'::regclass::oid, 'tenant_id'),
      ('public.stock_movements'::regclass::oid, 'order_id'),
      ('public.stock_movements'::regclass::oid, 'movement_type'),
      ('public.stock_movements'::regclass::oid, 'quantity'),
      ('public.stock_movements'::regclass::oid, 'snapshot_einkaufspreis_eur'),
      ('public.arbeitszeit_buchung'::regclass::oid, 'tenant_id'),
      ('public.arbeitszeit_buchung'::regclass::oid, 'auftrag_id'),
      ('public.arbeitszeit_buchung'::regclass::oid, 'start_zeit'),
      ('public.arbeitszeit_buchung'::regclass::oid, 'end_zeit'),
      ('public.arbeitszeit_buchung'::regclass::oid, 'dauer_minuten'),
      ('public.arbeitszeit_buchung'::regclass::oid, 'kostensatz_eur_pro_stunde'),
      ('public.arbeitszeit_buchung'::regclass::oid, 'kostenstelle_kuerzel'),
      ('public.customers'::regclass::oid, 'id'),
      ('public.customers'::regclass::oid, 'tenant_id'),
      ('public.customers'::regclass::oid, 'name'),
      ('public.customers'::regclass::oid, 'company_name'),
      ('public.ausgangsrechnung'::regclass::oid, 'order_id'),
      ('public.ausgangsrechnung'::regclass::oid, 'tenant_id'),
      ('public.ausgangsrechnung'::regclass::oid, 'netto'),
      ('public.ausgangsrechnung'::regclass::oid, 'status'),
      ('public.ausgangsrechnung'::regclass::oid, 'is_demo'),
      ('public.kostenstelle'::regclass::oid, 'id'),
      ('public.kostenstelle'::regclass::oid, 'tenant_id'),
      ('public.kostenstelle'::regclass::oid, 'kuerzel'),
      ('public.kostenstellen_energie_monat'::regclass::oid, 'kostenstelle_id'),
      ('public.kostenstellen_energie_monat'::regclass::oid, 'tenant_id'),
      ('public.kostenstellen_energie_monat'::regclass::oid, 'monat'),
      ('public.kostenstellen_energie_monat'::regclass::oid, 'energie_eur_pro_stunde')
  )
  select (
    (select count(*) from protected_relations) = ${CAPTURE_TABLES.length}
    and ${databaseRuntimeIdentityPredicate}
    and not exists (
      select 1 from required_columns required
      where not exists (
        select 1 from information_schema.columns col
        where col.table_schema = 'public'
          and col.table_name = required.table_name
          and col.column_name = required.column_name
          and col.data_type = required.data_type
          and (col.is_nullable = 'YES') = required.nullable
          and (required.precision is null or col.numeric_precision = required.precision)
          and (required.scale is null or col.numeric_scale = required.scale)
      )
    )
    and not exists (
      select 1 from required_checks required
      where not exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public' and rel.relname = required.table_name
          and con.conname = required.constraint_name
          and con.contype = 'c' and con.convalidated
          and con.conislocal and con.coninhcount = 0 and not con.connoinherit
          and not con.condeferrable and not con.condeferred and con.conparentid = 0
          and md5(pg_get_expr(con.conbin, con.conrelid, false)) = required.expression_md5
      )
    )
    and not exists (
      select 1 from required_exact_checks required
      where not exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = required.table_name
          and con.conname = required.constraint_name
          and con.contype = 'c'
          and con.convalidated
          and con.conislocal and con.coninhcount = 0 and not con.connoinherit
          and not con.condeferrable and not con.condeferred and con.conparentid = 0
          and pg_get_expr(con.conbin, con.conrelid, false) = required.expression_definition
      )
    )
    and not exists (
      select 1
      from expected_check_dependencies expected
      where not exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        join pg_depend dependency
          on dependency.classid = 'pg_constraint'::regclass
         and dependency.objid = con.oid
         and dependency.objsubid = 0
        where ns.nspname = 'public'
          and rel.relname = expected.source_table
          and con.conname = expected.constraint_name
          and dependency.refclassid = expected.refclassid
          and dependency.refobjid = expected.refobjid
          and dependency.refobjsubid = expected.refobjsubid
          and dependency.deptype::text = expected.deptype
      )
    )
    and 7 = (
      select count(*)
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      join pg_depend dependency
        on dependency.classid = 'pg_constraint'::regclass
       and dependency.objid = con.oid
      where ns.nspname = 'public'
        and (rel.relname, con.conname) in (
          ('items', 'items_template_surface_key_chk'),
          ('teile_klassifikator', 'teile_klassifikator_template_key_chk')
        )
    )
    and not exists (
      select 1 from required_primary_keys required
      where not exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public' and rel.relname = required.table_name
          and con.contype = 'p' and con.convalidated
          and con.conislocal and con.coninhcount = 0 and con.conparentid = 0
          and not con.condeferrable and not con.condeferred
          and (
            select array_agg(att.attname::text order by key.ordinality)
            from unnest(con.conkey) with ordinality as key(attnum, ordinality)
            join pg_attribute att on att.attrelid = con.conrelid and att.attnum = key.attnum
          ) = required.columns
      )
    )
    and not exists (
      select 1 from required_defaults required
      where not exists (
        select 1
        from information_schema.columns col
        where col.table_schema = 'public'
          and col.table_name = required.table_name
          and col.column_name = required.column_name
          and col.column_default ilike ('%' || required.fragment || '%')
      )
    )
    and not exists (
      select 1 from required_foreign_keys required
      where not exists (
        select 1
        from pg_constraint con
        join pg_class source_rel on source_rel.oid = con.conrelid
        join pg_namespace source_ns on source_ns.oid = source_rel.relnamespace
        join pg_class target_rel on target_rel.oid = con.confrelid
        join pg_namespace target_ns on target_ns.oid = target_rel.relnamespace
        join pg_index target_idx on target_idx.indexrelid = con.conindid
        join pg_class target_index_rel on target_index_rel.oid = target_idx.indexrelid
        join pg_namespace target_index_ns on target_index_ns.oid = target_index_rel.relnamespace
        join pg_am target_index_am on target_index_am.oid = target_index_rel.relam
        where source_ns.nspname = 'public' and target_ns.nspname = 'public'
          and source_rel.relname = required.source_table
          and target_rel.relname = required.target_table
          and con.conname = required.constraint_name
          and con.contype = 'f' and con.convalidated
          and con.conislocal and con.coninhcount = 0 and con.conparentid = 0
          and not con.condeferrable and not con.condeferred
          and con.connoinherit and con.confmatchtype = 's' and con.confupdtype = 'a'
          and con.confdeltype::text = required.delete_type
          and con.conindid = to_regclass('public.' || required.target_index_name)
          and con.conpfeqop::oid[] = required.equality_operators
          and con.conppeqop::oid[] = required.equality_operators
          and con.conffeqop::oid[] = required.equality_operators
          and target_index_ns.nspname = 'public'
          and target_index_rel.relname = required.target_index_name
          and target_idx.indrelid = con.confrelid
          and target_index_am.amname = 'btree'
          and target_idx.indisunique and target_idx.indimmediate
          and target_idx.indisvalid and target_idx.indisready
          and not target_idx.indisexclusion and not target_idx.indisprimary
          and not target_idx.indisclustered and not target_idx.indisreplident
          and not target_idx.indnullsnotdistinct
          and target_idx.indpred is null and target_idx.indexprs is null
          and target_idx.indnkeyatts = cardinality(required.target_columns)
          and target_idx.indnatts = cardinality(required.target_columns)
          and (
            select array_agg(key.attnum::smallint order by key.ordinality)
            from unnest(target_idx.indkey::smallint[]) with ordinality as key(attnum, ordinality)
          ) = con.confkey
          and (
            select array_agg(
              (opclass_namespace.nspname || '.' || opclass.opcname)::text
              order by key.ordinality
            )
            from unnest(target_idx.indclass::oid[]) with ordinality as key(opclass_oid, ordinality)
            join pg_opclass opclass on opclass.oid = key.opclass_oid
            join pg_namespace opclass_namespace on opclass_namespace.oid = opclass.opcnamespace
          ) = required.target_opclasses
          and not exists (
            select 1
            from unnest(target_idx.indoption::smallint[]) as option_value(value)
            where option_value.value <> 0
          )
          and (
            select array_agg(index_collation.collation_oid::oid order by index_collation.ordinality)
            from unnest(target_idx.indcollation::oid[]) with ordinality
              as index_collation(collation_oid, ordinality)
          ) = required.expected_collations
          and (
            select array_agg(target_attribute.attcollation order by key.ordinality)
            from unnest(con.confkey) with ordinality as key(attnum, ordinality)
            join pg_attribute target_attribute
              on target_attribute.attrelid = con.confrelid
             and target_attribute.attnum = key.attnum
             and not target_attribute.attisdropped
          ) = required.expected_collations
          and (
            select array_agg(source_attribute.attcollation order by source_key.ordinality)
            from unnest(con.conkey) with ordinality as source_key(attnum, ordinality)
            join pg_attribute source_attribute
              on source_attribute.attrelid = con.conrelid
             and source_attribute.attnum = source_key.attnum
             and not source_attribute.attisdropped
          ) = required.expected_collations
          and (
            select array_agg(att.attname::text order by key.ordinality)
            from unnest(con.conkey) with ordinality as key(attnum, ordinality)
            join pg_attribute att on att.attrelid = con.conrelid and att.attnum = key.attnum
          ) = required.source_columns
          and (
            select array_agg(att.attname::text order by key.ordinality)
            from unnest(con.confkey) with ordinality as key(attnum, ordinality)
            join pg_attribute att on att.attrelid = con.confrelid and att.attnum = key.attnum
          ) = required.target_columns
      )
    )
    and not exists (
      select 1 from required_indexes required
      where not exists (
        select 1
        from pg_index idx
        join pg_class rel on rel.oid = idx.indrelid
        join pg_class index_rel on index_rel.oid = idx.indexrelid
        join pg_am access_method on access_method.oid = index_rel.relam
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public' and rel.relname = required.table_name
          and index_rel.relname = required.index_name
          and index_rel.relnamespace = rel.relnamespace
          and access_method.amname = 'btree'
          and idx.indisunique = required.unique_index
          and idx.indimmediate and idx.indisvalid and idx.indisready
          and not idx.indisexclusion and not idx.indisprimary
          and not idx.indisclustered and not idx.indisreplident
          and not idx.indnullsnotdistinct and idx.indexprs is null
          and pg_get_expr(idx.indpred, idx.indrelid, false) is not distinct from required.predicate_definition
          and idx.indnkeyatts = cardinality(required.columns)
          and idx.indnatts = cardinality(required.columns)
          and (
            select array_agg(att.attname::text order by key.ordinality)
            from unnest(idx.indkey) with ordinality as key(attnum, ordinality)
            join pg_attribute att on att.attrelid = idx.indrelid and att.attnum = key.attnum
          ) = required.columns
          and (
            select array_agg(
              (opclass_namespace.nspname || '.' || opclass.opcname)::text
              order by key.ordinality
            )
            from unnest(idx.indclass::oid[]) with ordinality as key(opclass_oid, ordinality)
            join pg_opclass opclass on opclass.oid = key.opclass_oid
            join pg_namespace opclass_namespace on opclass_namespace.oid = opclass.opcnamespace
          ) = required.opclasses
          and (
            select array_agg(index_collation.collation_oid::oid order by index_collation.ordinality)
            from unnest(idx.indcollation::oid[]) with ordinality
              as index_collation(collation_oid, ordinality)
          ) = required.expected_collations
          and (
            select array_agg(att.attcollation order by key.ordinality)
            from unnest(idx.indkey::smallint[]) with ordinality as key(attnum, ordinality)
            join pg_attribute att
              on att.attrelid = idx.indrelid
             and att.attnum = key.attnum
             and not att.attisdropped
          ) = required.expected_collations
          and (
            select array_agg(option_value::smallint order by option_key.ordinality)
            from unnest(idx.indoption::smallint[]) with ordinality as option_key(option_value, ordinality)
          ) = required.sort_options
      )
    )
    and exists (
      select 1
      from pg_index idx
      join pg_class index_rel on index_rel.oid = idx.indexrelid
      join pg_namespace ns on ns.oid = index_rel.relnamespace
      where ns.nspname = 'public'
        and index_rel.relname = 'teile_klassifikator_tenant_normalized_class_uidx'
        and idx.indrelid = 'public.teile_klassifikator'::regclass
        and idx.indisunique and idx.indimmediate and idx.indisvalid and idx.indisready
        and not idx.indisexclusion and not idx.indisprimary
        and not idx.indisclustered and not idx.indisreplident and not idx.indnullsnotdistinct
        and idx.indpred is null and idx.indexprs is not null
        and idx.indnkeyatts = 2 and idx.indnatts = 2
        and (select amname from pg_am where oid = index_rel.relam) = 'btree'
        and (
          select array_agg(
            (opclass_namespace.nspname || '.' || opclass.opcname)::text
            order by key.ordinality
          )
          from unnest(idx.indclass::oid[]) with ordinality as key(opclass_oid, ordinality)
          join pg_opclass opclass on opclass.oid = key.opclass_oid
          join pg_namespace opclass_namespace on opclass_namespace.oid = opclass.opcnamespace
        ) = ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops']::text[]
        and (
          select array_agg(index_collation.collation_oid::oid order by index_collation.ordinality)
          from unnest(idx.indcollation::oid[]) with ordinality
            as index_collation(collation_oid, ordinality)
        ) = ARRAY['pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid]::oid[]
        and ARRAY[
          (select attcollation from pg_attribute where attrelid = idx.indrelid and attname = 'tenant_id' and not attisdropped),
          (select attcollation from pg_attribute where attrelid = idx.indrelid and attname = 'klasse' and not attisdropped)
        ]::oid[] = ARRAY['pg_catalog.default'::regcollation::oid, 'pg_catalog.default'::regcollation::oid]::oid[]
        and idx.indoption::text = '0 0'
        and pg_get_indexdef(idx.indexrelid, 1, false) = 'tenant_id'
        and pg_get_indexdef(idx.indexrelid, 2, false) in (
          'fn_kreile_template_normalize(klasse)',
          'public.fn_kreile_template_normalize(klasse)'
        )
        and not exists (
          select 1
          from expected_classifier_index_dependencies expected
          where not exists (
            select 1
            from pg_depend dependency
            where dependency.classid = 'pg_class'::regclass
              and dependency.objid = idx.indexrelid
              and dependency.objsubid = 0
              and dependency.refclassid = expected.refclassid
              and dependency.refobjid = expected.refobjid
              and dependency.refobjsubid = expected.refobjsubid
              and dependency.deptype::text = expected.deptype
          )
        )
        and 3 = (
          select count(*)
          from pg_depend dependency
          where dependency.classid = 'pg_class'::regclass
            and dependency.objid = idx.indexrelid
        )
    )
    and exists (
      select 1
      from pg_trigger trigger_value
      join pg_class relation on relation.oid = trigger_value.tgrelid
      join pg_namespace relation_namespace on relation_namespace.oid = relation.relnamespace
      join pg_proc function_value on function_value.oid = trigger_value.tgfoid
      join pg_namespace function_namespace on function_namespace.oid = function_value.pronamespace
      where relation_namespace.nspname = 'public'
        and relation.relname = 'capture_request_receipts'
        and trigger_value.tgname = 'capture_request_receipts_write_once_trg'
        and not trigger_value.tgisinternal
        and trigger_value.tgenabled = 'O'
        and pg_get_triggerdef(trigger_value.oid) ilike '%BEFORE INSERT OR UPDATE ON public.capture_request_receipts%'
        and function_namespace.nspname = 'public'
        and function_value.proname = 'enforce_capture_request_receipt_write_once'
        and not function_value.prosecdef
        and array_to_string(function_value.proconfig, ',') ilike '%search_path%pg_catalog%public%'
        and not exists (
          select 1
          from unnest(ARRAY[
            'TG_OP = ''INSERT''',
            'OLD.result IS NOT NULL', 'OLD.completed_at IS NOT NULL',
            'NEW.result IS NULL', 'NEW.completed_at IS NULL',
            'NEW.tenant_id IS DISTINCT FROM OLD.tenant_id',
            'NEW.request_hash IS DISTINCT FROM OLD.request_hash',
            'NEW.result->>''requestId''', 'NEW.client_request_id::text',
            'NEW.result->>''kind''', 'NEW.result->>''orderId''',
            'jsonb_typeof', 'timeCostEur', 'materialCostEur',
            'timeBookingIds', 'movementIds', 'createdAt', 'isfinite'
          ]) fragment
          where regexp_replace(pg_get_functiondef(function_value.oid), '[[:space:]]+', '', 'g')
            not ilike ('%' || replace(fragment, ' ', '') || '%')
        )
        and not exists (
          select 1
          from aclexplode(coalesce(function_value.proacl, acldefault('f', function_value.proowner))) acl
          where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
        )
        and not exists (
          select 1 from pg_roles role
          where role.rolname in ('anon', 'authenticated', 'service_role')
            and has_function_privilege(role.oid, function_value.oid, 'EXECUTE')
        )
    )
    and 5 = (
      select count(*) from expected_projection_functions where function_oid is not null
    )
    and exists (
      select 1
      from pg_roles owner_role
      join pg_database database_record
        on database_record.datname = current_database()
       and database_record.datdba = owner_role.oid
      where (owner_role.rolbypassrls or owner_role.rolsuper)
        and owner_role.rolname not in ('anon', 'authenticated', 'service_role', 'authenticator')
        and 12 = (select count(*) from template_projection_relations)
        and not exists (
          select 1 from template_projection_relations projection_relation
          where projection_relation.relowner <> owner_role.oid
        )
        and not exists (
          select 1
          from expected_projection_functions expected
          join pg_proc function_value on function_value.oid = expected.function_oid
          where function_value.proowner <> owner_role.oid
        )
    )
    and not exists (
      select 1
      from expected_projection_functions expected
      left join pg_proc function_value on function_value.oid = expected.function_oid
      left join pg_namespace function_namespace on function_namespace.oid = function_value.pronamespace
      left join pg_language function_language on function_language.oid = function_value.prolang
      where function_value.oid is null
        or function_namespace.nspname <> 'public'
        or function_language.lanname <> expected.language_name
        or function_value.prokind <> 'f'
        or function_value.prorettype <> expected.return_type
        or function_value.provolatile::text <> expected.volatility
        or function_value.proisstrict <> expected.is_strict
        or function_value.prosecdef <> expected.security_definer
        or function_value.pronargs <> expected.argument_count
        or function_value.proargnames is distinct from expected.argument_names
        or function_value.proleakproof
        or function_value.proparallel <> 'u'
        or function_value.proretset
        or function_value.prosupport <> 0
        or function_value.pronargdefaults <> 0
        or function_value.provariadic <> 0
        or function_value.protrftypes is not null
        or function_value.proallargtypes is not null
        or function_value.proargmodes is not null
        or function_value.proargdefaults is not null
        or function_value.probin is not null
        or function_value.prosqlbody is not null
        or function_value.procost <> 100
        or function_value.prorows <> 0
        or function_value.proconfig is distinct from ARRAY['search_path=pg_catalog, pg_temp']::text[]
        or md5(convert_to(
          btrim(regexp_replace(function_value.prosrc, '[[:space:]]+', ' ', 'g')),
          'UTF8'
        )) <> expected.definition_md5
    )
    and not exists (
      select 1
      from expected_projection_functions expected
      join pg_proc function_value on function_value.oid = expected.function_oid
      cross join lateral unnest(expected.required_fragments) fragment
      where regexp_replace(pg_get_functiondef(function_value.oid), '[[:space:]]+', ' ', 'g')
        not ilike ('%' || regexp_replace(fragment, '[[:space:]]+', ' ', 'g') || '%')
    )
    and not exists (
      select 1
      from expected_projection_functions expected
      join pg_proc function_value on function_value.oid = expected.function_oid
      cross join lateral aclexplode(coalesce(function_value.proacl, acldefault('f', function_value.proowner))) acl
      where acl.grantee <> function_value.proowner
        or acl.grantor <> function_value.proowner
    )
    and not exists (
      select 1
      from expected_projection_functions expected
      join pg_proc function_value on function_value.oid = expected.function_oid
      cross join pg_roles executable_role
      where executable_role.oid <> function_value.proowner
        and not executable_role.rolsuper
        and has_function_privilege(executable_role.oid, function_value.oid, 'EXECUTE')
    )
    and not exists (
      select 1
      from expected_projection_functions expected
      join pg_proc function_value on function_value.oid = expected.function_oid
      where not has_function_privilege(function_value.proowner, function_value.oid, 'EXECUTE')
    )
    and not exists (
      select 1
      from expected_projection_functions expected
      join pg_proc function_value on function_value.oid = expected.function_oid
      where expected.function_oid = to_regprocedure('public.fn_update_vorlagen()')::oid
        and (
          pg_get_functiondef(function_value.oid) ilike '%COALESCE(NEW.tenant_id%'
          or pg_get_functiondef(function_value.oid) ilike '%''st''%'
        )
    )
    and exists (
      select 1
      from pg_trigger trigger_value
      where trigger_value.tgrelid = 'public.orders'::regclass
        and trigger_value.tgname = 'trg_update_vorlagen'
        and trigger_value.tgfoid = to_regprocedure('public.fn_update_vorlagen()')::oid
        and not trigger_value.tgisinternal
        and trigger_value.tgparentid = 0
        and trigger_value.tgconstrrelid = 0
        and trigger_value.tgconstrindid = 0
        and trigger_value.tgconstraint = 0
        and not trigger_value.tgdeferrable
        and not trigger_value.tginitdeferred
        and trigger_value.tgenabled = 'O'
        and trigger_value.tgtype = 17
        and trigger_value.tgnargs = 0
        and octet_length(trigger_value.tgargs) = 0
        and trigger_value.tgoldtable is null
        and trigger_value.tgnewtable is null
        and trigger_value.tgattr::text = (
          select attribute.attnum::text
          from pg_attribute attribute
          where attribute.attrelid = 'public.orders'::regclass
            and attribute.attname = 'status'
            and not attribute.attisdropped
        )
        and trigger_value.tgqual is not null
        and md5(convert_to(
          btrim(regexp_replace(pg_get_triggerdef(trigger_value.oid), '[[:space:]]+', ' ', 'g')),
          'UTF8'
        )) in ('22cecf094c118fa1dc2a444493928b34', 'e514cdaf1cca2df32f7807c3f3201523')
    )
    and exists (
      select 1
      from pg_trigger trigger_value
      where trigger_value.tgrelid = 'public.orders'::regclass
        and trigger_value.tgname = 'trg_insert_vorlagen'
        and trigger_value.tgfoid = to_regprocedure('public.fn_update_vorlagen()')::oid
        and not trigger_value.tgisinternal
        and trigger_value.tgparentid = 0
        and trigger_value.tgconstrrelid = 0
        and trigger_value.tgconstrindid = 0
        and trigger_value.tgconstraint = 0
        and not trigger_value.tgdeferrable
        and not trigger_value.tginitdeferred
        and trigger_value.tgenabled = 'O'
        and trigger_value.tgtype = 5
        and trigger_value.tgnargs = 0
        and octet_length(trigger_value.tgargs) = 0
        and trigger_value.tgoldtable is null
        and trigger_value.tgnewtable is null
        and trigger_value.tgattr::text = ''
        and trigger_value.tgqual is not null
        and md5(convert_to(
          btrim(regexp_replace(pg_get_triggerdef(trigger_value.oid), '[[:space:]]+', ' ', 'g')),
          'UTF8'
        )) in ('5539b157c4df2c3e9a487f15c3b9ee03', '8236f23a0ed55e431dc91ae322613169')
    )
    and 2 = (
      select count(*)
      from pg_trigger trigger_value
      where trigger_value.tgfoid = to_regprocedure('public.fn_update_vorlagen()')::oid
        and not trigger_value.tgisinternal
    )
    and 3 = (
      select count(*)
      from expected_source_triggers required_trigger
      join pg_trigger trigger_value
        on trigger_value.tgrelid = to_regclass('public.' || required_trigger.relation_name)
       and trigger_value.tgname = required_trigger.trigger_name
       and trigger_value.tgfoid = to_regprocedure('public.fn_guard_template_projection_source_insert()')::oid
       and not trigger_value.tgisinternal
       and trigger_value.tgparentid = 0
       and trigger_value.tgconstrrelid = 0
       and trigger_value.tgconstrindid = 0
       and trigger_value.tgconstraint = 0
       and not trigger_value.tgdeferrable
       and not trigger_value.tginitdeferred
       and trigger_value.tgenabled = 'O'
       and trigger_value.tgtype = 7
       and trigger_value.tgnargs = 0
       and octet_length(trigger_value.tgargs) = 0
       and trigger_value.tgoldtable is null
       and trigger_value.tgnewtable is null
       and trigger_value.tgattr::text = ''
       and trigger_value.tgqual is null
       and md5(convert_to(
         btrim(regexp_replace(pg_get_triggerdef(trigger_value.oid), '[[:space:]]+', ' ', 'g')),
         'UTF8'
       )) = any(required_trigger.definition_hashes)
    )
    and 3 = (
      select count(*)
      from pg_trigger trigger_value
      where trigger_value.tgfoid = to_regprocedure('public.fn_guard_template_projection_source_insert()')::oid
        and not trigger_value.tgisinternal
    )
    and not exists (
      select 1 from protected_relations
      where not relrowsecurity or not relforcerowsecurity
    )
    and not exists (
      select 1 from pg_policy policy
      join protected_relations protected on protected.oid = policy.polrelid
    )
    and not exists (
      select 1 from protected_relations protected
      cross join lateral aclexplode(coalesce(protected.relacl, acldefault('r', protected.relowner))) acl
      where acl.grantee = 0
    )
    and not exists (
      select 1 from protected_relations protected
      join pg_attribute att on att.attrelid = protected.oid and att.attnum > 0 and not att.attisdropped
      cross join lateral aclexplode(att.attacl) acl
      where acl.grantee = 0
    )
    and not exists (
      select 1 from pg_roles role
      cross join protected_relations protected
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) privilege(name)
      where role.rolname in ('anon', 'authenticated')
        and has_table_privilege(role.oid, protected.oid, privilege.name)
    )
    and not exists (
      select 1 from pg_roles role
      cross join protected_relations protected
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) privilege(name)
      where role.rolname in ('anon', 'authenticated')
        and has_any_column_privilege(role.oid, protected.oid, privilege.name)
    )
    and exists (
      select 1 from protected_relations protected join pg_roles role on role.rolname = 'service_role'
      where protected.relname = 'arbeitszeit_buchung'
        and has_table_privilege(role.oid, protected.oid, 'SELECT')
        and has_table_privilege(role.oid, protected.oid, 'INSERT')
        and not has_table_privilege(role.oid, protected.oid, 'UPDATE')
    )
    and exists (
      select 1 from protected_relations protected join pg_roles role on role.rolname = 'service_role'
      where protected.relname = 'audit_log'
        and not has_table_privilege(role.oid, protected.oid, 'INSERT')
        and not has_table_privilege(role.oid, protected.oid, 'SELECT')
        and not has_table_privilege(role.oid, protected.oid, 'UPDATE')
    )
    and not exists (
      select 1 from protected_relations protected join pg_roles role on role.rolname = 'service_role'
      cross join (values ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) privilege(name)
      where has_table_privilege(role.oid, protected.oid, privilege.name)
    )
    and not exists (
      select 1 from protected_relations protected
      join pg_roles role on role.rolname = 'service_role'
      join pg_attribute att on att.attrelid = protected.oid and att.attnum > 0 and not att.attisdropped
      where has_column_privilege(role.oid, protected.oid, att.attnum, 'REFERENCES')
    )
    and not exists (
      select 1 from protected_relations protected
      join pg_roles role on role.rolname = 'service_role'
      join pg_attribute att on att.attrelid = protected.oid and att.attnum > 0 and not att.attisdropped
      where protected.relname <> 'capture_request_receipts'
        and has_column_privilege(role.oid, protected.oid, att.attnum, 'UPDATE')
    )
    and not exists (
      select 1 from protected_relations protected
      join pg_roles role on role.rolname = 'service_role'
      join pg_attribute att on att.attrelid = protected.oid and att.attnum > 0 and not att.attisdropped
      where protected.relname = 'capture_request_receipts'
        and att.attname not in ('result', 'completed_at')
        and has_column_privilege(role.oid, protected.oid, att.attnum, 'UPDATE')
    )
    and not exists (
      select 1 from protected_relations protected
      join pg_roles role on role.rolname = 'service_role'
      join pg_attribute att on att.attrelid = protected.oid and att.attnum > 0 and not att.attisdropped
      where protected.relname = 'capture_request_receipts'
        and att.attname not in (
          'tenant_id', 'client_request_id', 'kind', 'actor_id',
          'order_id', 'station_kuerzel', 'request_hash'
        )
        and has_column_privilege(role.oid, protected.oid, att.attnum, 'INSERT')
    )
    and not exists (
      select 1 from protected_relations protected
      join pg_roles role on role.rolname = 'service_role'
      join pg_attribute att on att.attrelid = protected.oid and att.attnum > 0 and not att.attisdropped
      where protected.relname = 'audit_log'
        and (
          has_column_privilege(role.oid, protected.oid, att.attnum, 'SELECT')
          or (
            att.attname not in (
              'tenant_id', 'client_request_id', 'action', 'table_name',
              'record_id', 'actor_id', 'payload'
            )
            and has_column_privilege(role.oid, protected.oid, att.attnum, 'INSERT')
          )
        )
    )
    and not exists (
      select 1
      from (values
        ('tenant_id'), ('client_request_id'), ('action'), ('table_name'),
        ('record_id'), ('actor_id'), ('payload')
      ) required(column_name)
      where not has_column_privilege(
        'service_role', 'public.audit_log', required.column_name, 'INSERT'
      )
    )
    and not exists (
      select 1 from protected_relations protected
      join pg_roles role on role.rolname = 'service_role'
      join pg_attribute att on att.attrelid = protected.oid and att.attnum > 0 and not att.attisdropped
      where protected.relname in ('vorlage_zeit', 'vorlage_verbrauch', 'kostensatz_default', 'teile_klassifikator')
        and (
          has_column_privilege(role.oid, protected.oid, att.attnum, 'INSERT')
          or has_column_privilege(role.oid, protected.oid, att.attnum, 'UPDATE')
        )
    )
    and not exists (
      select 1
      from (values
        ('tenant_id'), ('client_request_id'), ('kind'), ('actor_id'),
        ('order_id'), ('station_kuerzel'), ('request_hash')
      ) required(column_name)
      where not has_column_privilege(
        'service_role', 'public.capture_request_receipts', required.column_name, 'INSERT'
      )
    )
    and exists (
      select 1 from protected_relations protected join pg_roles role on role.rolname = 'service_role'
      where protected.relname = 'capture_request_receipts'
        and has_table_privilege(role.oid, protected.oid, 'SELECT')
        and not has_table_privilege(role.oid, protected.oid, 'INSERT')
        and has_column_privilege(role.oid, protected.oid, 'result', 'UPDATE')
        and has_column_privilege(role.oid, protected.oid, 'completed_at', 'UPDATE')
        and not has_table_privilege(role.oid, protected.oid, 'UPDATE')
    )
    and not exists (
      select 1 from protected_relations protected join pg_roles role on role.rolname = 'service_role'
      where protected.relname in ('vorlage_zeit', 'vorlage_verbrauch', 'kostensatz_default', 'teile_klassifikator')
        and (
          not has_table_privilege(role.oid, protected.oid, 'SELECT')
          or has_table_privilege(role.oid, protected.oid, 'INSERT')
          or has_table_privilege(role.oid, protected.oid, 'UPDATE')
        )
    )
    and exists (
      select 1
      from pg_class view_record
      join pg_namespace view_namespace on view_namespace.oid = view_record.relnamespace
      join pg_database database_record
        on database_record.datname = current_database()
       and database_record.datdba = view_record.relowner
      where view_namespace.nspname = 'public'
        and view_record.relname = 'v_auftrag_db'
        and view_record.relkind = 'v'
        and view_record.reloptions @> ARRAY['security_invoker=true', 'security_barrier=true']::text[]
        and view_record.reloptions <@ ARRAY['security_invoker=true', 'security_barrier=true']::text[]
        and md5(convert_to(
          btrim(regexp_replace(pg_get_viewdef(view_record.oid, false), '[[:space:]]+', ' ', 'g')),
          'UTF8'
        )) in (
          '8d59ab4d53f735d657349f089f300a1f',
          '88e7ea8c5610a89487080ba27262697c',
          '6cca82a4d6d6dacf2e9d3cf9f70c7879'
        )
        and (
          select array_agg(
            (attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod))::text
            order by attribute.attnum
          )
          from pg_attribute attribute
          where attribute.attrelid = view_record.oid
            and attribute.attnum > 0
            and not attribute.attisdropped
        ) = ARRAY[
          'order_id:text', 'order_number:text', 'customer_id:text',
          'kunde_name:text', 'company_name:text', 'intake_date:timestamp with time zone',
          'status:text', 'current_station:text', 'due_date:timestamp with time zone',
          'erloes_netto:numeric', 'material_kosten:numeric', 'arbeitszeit_kosten:numeric',
          'energie_anteil_kosten:numeric', 'deckungsbeitrag:numeric', 'db_marge:numeric',
          'anz_rechnungen:bigint', 'anz_verbrauch:bigint', 'anz_zeitbuchungen:bigint',
          'tenant_id:text', 'anz_rechnungen_ohne_netto:bigint',
          'anz_verbrauch_ohne_preis:bigint', 'anz_offene_zeitbuchungen:bigint',
          'anz_zeitbuchungen_ohne_energiepreis:bigint', 'db_berechenbar:boolean'
        ]::text[]
        and 1 = (
          select count(*)
          from pg_rewrite rewrite_record
          where rewrite_record.ev_class = view_record.oid
            and rewrite_record.rulename = '_RETURN'
            and rewrite_record.ev_type = '1'
            and rewrite_record.ev_enabled = 'O'
            and rewrite_record.is_instead
        )
        and not exists (
          select 1
          from expected_view_bases expected_base
          where not exists (
            select 1
            from pg_rewrite rewrite_record
            join pg_depend dependency
              on dependency.classid = 'pg_rewrite'::regclass
             and dependency.objid = rewrite_record.oid
             and dependency.objsubid = 0
            where rewrite_record.ev_class = view_record.oid
              and rewrite_record.rulename = '_RETURN'
              and dependency.refclassid = 'pg_class'::regclass
              and dependency.refobjid = expected_base.relation_oid
              and dependency.deptype = 'n'
          )
        )
        and not exists (
          select 1
          from expected_view_dependencies expected_dependency
          join pg_attribute expected_attribute
            on expected_attribute.attrelid = expected_dependency.relation_oid
           and expected_attribute.attname = expected_dependency.column_name
           and not expected_attribute.attisdropped
          where not exists (
            select 1
            from pg_rewrite rewrite_record
            join pg_depend dependency
              on dependency.classid = 'pg_rewrite'::regclass
             and dependency.objid = rewrite_record.oid
             and dependency.objsubid = 0
            where rewrite_record.ev_class = view_record.oid
              and rewrite_record.rulename = '_RETURN'
              and dependency.refclassid = 'pg_class'::regclass
              and dependency.refobjid = expected_dependency.relation_oid
              and dependency.refobjsubid = expected_attribute.attnum
              and dependency.deptype = 'n'
          )
        )
        and exists (
          select 1
          from pg_rewrite rewrite_record
          join pg_depend dependency
            on dependency.classid = 'pg_rewrite'::regclass
           and dependency.objid = rewrite_record.oid
           and dependency.objsubid = 0
          where rewrite_record.ev_class = view_record.oid
            and rewrite_record.rulename = '_RETURN'
            and dependency.refclassid = 'pg_class'::regclass
            and dependency.refobjid = view_record.oid
            and dependency.refobjsubid = 0
            and dependency.deptype = 'i'
        )
        and 39 = (
          select count(*)
          from pg_rewrite rewrite_record
          join pg_depend dependency
            on dependency.classid = 'pg_rewrite'::regclass
           and dependency.objid = rewrite_record.oid
          where rewrite_record.ev_class = view_record.oid
            and rewrite_record.rulename = '_RETURN'
        )
        and has_table_privilege('service_role', view_record.oid, 'SELECT')
        and not has_table_privilege('service_role', view_record.oid, 'INSERT')
        and not has_table_privilege('service_role', view_record.oid, 'UPDATE')
        and not has_table_privilege('service_role', view_record.oid, 'DELETE')
        and not has_table_privilege('service_role', view_record.oid, 'TRUNCATE')
        and not has_table_privilege('service_role', view_record.oid, 'REFERENCES')
        and not has_table_privilege('service_role', view_record.oid, 'TRIGGER')
        and not has_any_column_privilege('service_role', view_record.oid, 'INSERT')
        and not has_any_column_privilege('service_role', view_record.oid, 'UPDATE')
        and not has_any_column_privilege('service_role', view_record.oid, 'REFERENCES')
        and not exists (
          select 1
          from aclexplode(view_record.relacl) acl
          where acl.grantor <> view_record.relowner
            or acl.grantee not in (
              view_record.relowner,
              (select oid from pg_roles where rolname = 'service_role')
            )
            or (
              acl.grantee = (select oid from pg_roles where rolname = 'service_role')
              and (acl.privilege_type <> 'SELECT' or acl.is_grantable)
            )
        )
        and exists (
          select 1
          from aclexplode(view_record.relacl) acl
          where acl.grantee = (select oid from pg_roles where rolname = 'service_role')
            and acl.grantor = view_record.relowner
            and acl.privilege_type = 'SELECT'
            and not acl.is_grantable
        )
        and not exists (
          select 1
          from pg_attribute attribute
          cross join lateral aclexplode(attribute.attacl) acl
          where attribute.attrelid = view_record.oid
            and attribute.attnum > 0
            and not attribute.attisdropped
        )
        and not exists (
          select 1
          from pg_roles role_record
          where not role_record.rolsuper
            and role_record.rolname !~ '^pg_'
            and role_record.oid not in (
              view_record.relowner,
              (select oid from pg_roles where rolname = 'service_role')
            )
            and has_table_privilege(role_record.oid, view_record.oid, 'SELECT')
        )
    )
    and not exists (
      select 1
      from (values
        ('orders'), ('customers'), ('ausgangsrechnung'), ('stock_movements'),
        ('arbeitszeit_buchung'), ('kostenstelle'), ('kostenstellen_energie_monat')
      ) required_base(relation_name)
      where not has_table_privilege(
        'service_role', format('public.%I', required_base.relation_name), 'SELECT'
      )
    )
  ) as available
`;

export function captureWriteCapabilityAvailable(row: Record<string, unknown> | undefined): boolean {
  if (!row || typeof row.available !== "boolean") {
    throw new Error("CAPTURE_WRITE_CAPABILITY_UNAVAILABLE");
  }
  return row.available;
}

export async function readCaptureSchemaCapability(): Promise<boolean> {
  try {
    const rows = await db.execute(captureWriteCapabilityQuery);
    return captureWriteCapabilityAvailable(rows[0]);
  } catch (error) {
    console.error("Capture write capability preflight failed", error);
    return false;
  }
}
