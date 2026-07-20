import { sql } from "drizzle-orm";
import { db } from "@/db";
import { emailProviderConfigured } from "@/lib/server/emailDelivery";

const LEDGER_ROLLOUT_REQUIRED = "Der serverseitige Status-Mail-Beleg ist in dieser Datenbank noch nicht vollständig ausgerollt.";
const PROVIDER_CONFIGURATION_REQUIRED = "Der E-Mail-Provider ist serverseitig noch nicht vollständig konfiguriert.";

export type StatusEmailCapability = {
  available: boolean;
  reason: string | null;
};

const ledgerCapabilityQuery = sql<{ available: boolean }>`
  select (
    not exists (
      select 1
      from (values
        ('communications', 'id'),
        ('communications', 'tenant_id'),
        ('communications', 'customer_id'),
        ('communications', 'order_id'),
        ('communications', 'invoice_id'),
        ('communications', 'created_by'),
        ('communications', 'subject'),
        ('communications', 'body'),
        ('communications', 'type'),
        ('communications', 'channel_type'),
        ('communications', 'resend_message_id'),
        ('communications', 'recipient'),
        ('communications', 'template_key'),
        ('communications', 'idempotency_key'),
        ('communications', 'status'),
        ('communications', 'attempt_count'),
        ('communications', 'claimed_at'),
        ('communications', 'completed_at'),
        ('communications', 'error_code'),
        ('communications', 'created_at'),
        ('email_templates', 'tenant_id'),
        ('email_templates', 'template_key'),
        ('email_templates', 'subject_template'),
        ('email_templates', 'body_html_template'),
        ('email_templates', 'body_text_template')
      ) as required(table_name, column_name)
      where not exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = required.table_name
          and c.column_name = required.column_name
      )
    )
    and not exists (
      select 1
      from (values ('communications'), ('email_templates')) as required(table_name)
      where not exists (
        select 1
        from pg_class rel
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = required.table_name
          and rel.relrowsecurity
          and rel.relforcerowsecurity
      )
    )
    and not exists (
      select 1 from information_schema.role_table_grants grants
      where grants.table_schema = 'public'
        and grants.table_name in ('communications', 'email_templates')
        and grants.grantee in ('anon', 'authenticated')
    )
    and exists (
      select 1
      from pg_index pi
      join pg_class idx on idx.oid = pi.indexrelid
      join pg_class rel on rel.oid = pi.indrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where ns.nspname = 'public'
        and rel.relname = 'communications'
        and idx.relname = 'communications_tenant_idempotency_uidx'
        and pi.indisunique
        and pi.indisvalid
        and pi.indisready
        and pi.indpred is null
        and pg_get_indexdef(pi.indexrelid) like '%(tenant_id, idempotency_key)%'
    )
    and exists (
      select 1
      from pg_constraint pc
      join pg_class rel on rel.oid = pc.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where ns.nspname = 'public'
        and rel.relname = 'communications'
        and pc.conname = 'communications_delivery_status_chk'
        and pc.convalidated
        and pg_get_constraintdef(pc.oid) like '%uncertain%'
        and pg_get_constraintdef(pc.oid) like '%draft%'
    )
  ) as available
`;

function readBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("STATUS_EMAIL_CAPABILITY_INVALID");
  return value;
}

export async function readStatusEmailLedgerCapability(): Promise<StatusEmailCapability> {
  try {
    const rows = await db.execute(ledgerCapabilityQuery);
    const available = readBoolean(rows[0]?.available);
    return { available, reason: available ? null : LEDGER_ROLLOUT_REQUIRED };
  } catch (error) {
    console.error("Status email ledger capability check failed", error);
    return { available: false, reason: LEDGER_ROLLOUT_REQUIRED };
  }
}

export async function readStatusEmailSendCapability(): Promise<StatusEmailCapability> {
  const ledger = await readStatusEmailLedgerCapability();
  if (!ledger.available) return ledger;
  if (!emailProviderConfigured()) return { available: false, reason: PROVIDER_CONFIGURATION_REQUIRED };
  return { available: true, reason: null };
}
