import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("F0_F2_SCHEMA_DATABASE_URL_REQUIRED");

const tenant = "galvanik-kreile";
const actorId = "00000000-0000-4000-8000-000000000000";

const queries = [
  {
    id: "f0-login-list",
    text: `SELECT users.id, users.full_name, users.kuerzel, users.bezeichnung, users.role, users.pin_hash, users.email,
      (SELECT COALESCE(array_agg(rights.bereich ORDER BY rights.bereich), ARRAY[]::text[])
       FROM public.app_user_rights rights
       WHERE rights.tenant_id=users.tenant_id AND rights.user_id=users.id) AS areas
      FROM public.app_users users
      WHERE users.tenant_id='${tenant}' AND users.active=true
      ORDER BY users.full_name, users.id`,
  },
  {
    id: "f0-authorization",
    text: `SELECT users.id, users.tenant_id, users.full_name, users.role, users.active, users.updated_at,
      (SELECT COALESCE(array_agg(rights.bereich ORDER BY rights.bereich), ARRAY[]::text[])
       FROM public.app_user_rights rights
       WHERE rights.tenant_id=users.tenant_id AND rights.user_id=users.id) AS areas
      FROM public.app_users users
      WHERE users.id='${actorId}'::uuid AND users.tenant_id='${tenant}'`,
  },
  {
    id: "f0-rights-matrix",
    text: `SELECT users.id::text AS id, users.email, users.full_name, users.kuerzel, users.bezeichnung,
      users.role, users.active,
      COALESCE(array_agg(rights.bereich ORDER BY rights.bereich) FILTER (WHERE rights.bereich IS NOT NULL), ARRAY[]::text[]) AS areas
      FROM public.app_users users
      LEFT JOIN public.app_user_rights rights ON rights.tenant_id=users.tenant_id AND rights.user_id=users.id
      WHERE users.tenant_id='${tenant}'
      GROUP BY users.id, users.email, users.full_name, users.kuerzel, users.bezeichnung, users.role, users.active
      ORDER BY users.full_name, users.id`,
  },
  {
    id: "f2-preferences",
    text: `SELECT preference.visible_fields, to_jsonb(preference)->'layout' AS layout
      FROM private.today_preferences preference
      WHERE preference.tenant_id='${tenant}' AND preference.actor_id='${actorId}'::uuid LIMIT 1`,
  },
  {
    id: "f2-reminders",
    text: `SELECT item_key, reminder_until FROM private.today_reminders
      WHERE tenant_id='${tenant}' AND actor_id='${actorId}'::uuid`,
  },
  {
    id: "f2-invoices",
    text: `SELECT invoice.id, invoice.invoice_number, invoice.order_id, customer.name AS customer_name,
      customer.country AS customer_country, invoice.due_date,
      invoice.payment_open_amount_cents AS open_amount_cents,
      orders.payment_mode, invoice.payment_status, orders.station
      FROM public.invoices invoice
      JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id
      JOIN public.customers customer ON customer.tenant_id=invoice.tenant_id AND customer.id=invoice.customer_id
      WHERE invoice.tenant_id='${tenant}' AND invoice.status='issued'
        AND invoice.payment_status IN ('offen', 'teilbezahlt')
        AND invoice.due_date < (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date
      ORDER BY invoice.due_date, invoice.invoice_number LIMIT 20`,
  },
  {
    id: "f2-prepayments",
    text: `SELECT payment.order_id, payment.order_number, customer.name AS customer_name,
      customer.country AS customer_country, orders.due_date, payment.invoice_id,
      payment.payment_open_amount_cents AS open_amount_cents, payment.payment_status,
      payment.station, payment.goods_out_event_count
      FROM private.v_goods_out_ui_state_v1 payment
      JOIN public.orders orders ON orders.tenant_id=payment.tenant_id AND orders.id=payment.order_id
      JOIN public.customers customer ON customer.tenant_id=orders.tenant_id AND customer.id=orders.customer_id
      WHERE payment.tenant_id='${tenant}' AND payment.payment_mode='vorkasse'
        AND payment.station='fertig' AND payment.goods_out_event_count=0 AND payment.integrity_ok=true
        AND (payment.invoice_state='not_issued' OR payment.payment_status IN ('offen', 'teilbezahlt'))
      ORDER BY orders.due_date NULLS LAST, payment.order_number LIMIT 20`,
  },
  {
    id: "f2-delegation-targets",
    text: `SELECT users.id, users.full_name FROM public.app_users users
      WHERE users.tenant_id='${tenant}' AND users.active=true AND users.id<>'${actorId}'::uuid
        AND EXISTS (SELECT 1 FROM public.app_user_rights rights
          WHERE rights.tenant_id=users.tenant_id AND rights.user_id=users.id AND rights.bereich='auftraege')
      ORDER BY users.full_name, users.id`,
  },
  {
    id: "f2-graph-threads",
    text: `SELECT source FROM public.communication_threads
      WHERE tenant_id='${tenant}' AND source LIKE 'MS_GRAPH_IN:%'`,
  },
  {
    id: "f2-assignments",
    text: `SELECT order_id, assigned_to_name, current_order_version
      FROM private.v_order_task_assignment_v1
      WHERE tenant_id='${tenant}' AND assigned_by='${actorId}'::uuid AND active=true`,
  },
];

const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function explain(query) {
  try {
    await sql.unsafe(`EXPLAIN ${query.text}`);
  } catch (error) {
    throw new Error(`F0_F2_SCHEMA_EXPLAIN_FAILED:${query.id}:${error instanceof Error ? error.message : String(error)}`);
  }
}

try {
  for (const query of queries) await explain(query);

  if (process.argv.includes("--selftest")) {
    let rejected = false;
    try {
      await explain({ id: "selftest-invented-column", text: "SELECT definitely_missing_h12_column FROM public.app_users" });
    } catch (error) {
      rejected = String(error).includes("selftest-invented-column");
    }
    if (!rejected) throw new Error("F0_F2_SCHEMA_SELFTEST_DID_NOT_REJECT_INVENTED_COLUMN");
    console.log(`F0_F2_SCHEMA_SELFTEST=PASS queries=${queries.length}`);
  } else {
    console.log(`F0_F2_SCHEMA=PASS queries=${queries.length}`);
  }
} finally {
  await sql.end();
}
