import {createHmac} from "node:crypto";
import {isIP} from "node:net";
import type {PrivilegedTenantTransaction} from "@/lib/server/privilegedDb";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { sql } from "drizzle-orm";

export type PinAttemptResult =
  | { status: "valid" }
  | { status: "invalid" }
  | { status: "blocked"; retryAtMs: number; retryAfterMinutes: number };

type PinRateLimitRow = {
  failed_attempts: number;
  last_failed_at: Date | string;
};

function blockedResult(row: PinRateLimitRow): PinAttemptResult | null {
  const lastFail = new Date(row.last_failed_at).getTime();
  if (!Number.isSafeInteger(row.failed_attempts) || row.failed_attempts < 0 || !Number.isFinite(lastFail)) {
    throw Error("PIN_RATE_LIMIT_SOURCE_INVALID");
  }
  // Only each completed group of ten starts a pause. The eleventh failure
  // after an expired pause must not restart the previous group's pause.
  if (row.failed_attempts < 10 || row.failed_attempts % 10 !== 0) return null;
  const minutes = Math.min(24 * 60, 15 * 2 ** Math.min(7, row.failed_attempts / 10 - 1));
  const retryAtMs = lastFail + minutes * 60_000;
  const remaining = retryAtMs - Date.now();
  return remaining > 0
    ? { status: "blocked", retryAtMs, retryAfterMinutes: Math.ceil(remaining / 60_000) }
    : null;
}

/** Serializes IP and operator checks in one transaction; no nested pool acquisition. */
export function trustedPinClientIp(headers:Pick<Headers,'get'>):string|null {
  if(process.env.VERCEL!=='1')return null;
  const value=headers.get('x-vercel-forwarded-for')||headers.get('x-real-ip');
  if(!value)return null;
  const ip=value.split(',')[0].trim();
  if(!isIP(ip))throw Error('PIN_IP_SOURCE_INVALID');
  return ip;
}
type IpLimitRow={failed_attempts:number;window_start:Date|string};
function ipBlocked(row:IpLimitRow):PinAttemptResult|null {
  if(!Number.isSafeInteger(row.failed_attempts)||row.failed_attempts<0||!Number.isFinite(new Date(row.window_start).getTime()))throw Error('PIN_IP_SOURCE_INVALID');
  if(row.failed_attempts<50)return null;
  const retryAtMs=new Date(row.window_start).getTime()+3600000;
  return {status:'blocked',retryAtMs,retryAfterMinutes:Math.max(1,Math.ceil((retryAtMs-Date.now())/60000))};
}
export async function runPinAttempt(
  operatorId: string|null,
  verifyPin: (tx:PrivilegedTenantTransaction) => Promise<boolean>,
  clientIp:string|null=null,
): Promise<PinAttemptResult> {
  const {db}=await import("@/db");
  return db.transaction(async (tx) => {
    const ipHash=clientIp===null?null:createHmac('sha256',(await import('@/lib/server/appSession')).getSecretKey()).update('pin-ip-v1:'+clientIp).digest('hex');
    if(ipHash){
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('pin-ip:'||${KREILE_TENANT_SLUG}||':'||${ipHash},0))`);
      await tx.execute(sql`DELETE FROM private.pin_ip_rate_limits WHERE tenant_id=${KREILE_TENANT_SLUG} AND window_start<statement_timestamp()-interval '24 hours'`);
      const rows=await tx.execute<IpLimitRow>(sql`SELECT failed_attempts,window_start FROM private.pin_ip_rate_limits WHERE tenant_id=${KREILE_TENANT_SLUG} AND ip_hash=${ipHash} AND window_start=to_timestamp(floor(extract(epoch FROM statement_timestamp())/3600)*3600)`);
      if(rows.length>1)throw Error('PIN_IP_SOURCE_AMBIGUOUS');
      if(rows[0]){const blocked=ipBlocked(rows[0]);if(blocked)return blocked;}
    }
    if(operatorId!==null){
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${operatorId}::text,0))`);
      const [row]=await tx.execute<PinRateLimitRow>(sql`SELECT failed_attempts,last_failed_at FROM pin_rate_limits WHERE operator_id=${operatorId} AND tenant_id=${KREILE_TENANT_SLUG}`);
      if(row){const blocked=blockedResult(row);if(blocked)return blocked;}
    }

    const pinValid = await verifyPin(tx);

    if (pinValid) {
      if(operatorId===null)throw Error("PIN_IDENTITY_REQUIRED");
      await tx.execute(sql`
        DELETE FROM pin_rate_limits
        WHERE operator_id = ${operatorId} AND tenant_id = ${KREILE_TENANT_SLUG}
      `);
      return { status: "valid" };
    }

    let ipBlock:PinAttemptResult|null=null;
    if(ipHash){
      const rows=await tx.execute<IpLimitRow>(sql`INSERT INTO private.pin_ip_rate_limits(tenant_id,ip_hash,window_start,failed_attempts) VALUES(${KREILE_TENANT_SLUG},${ipHash},to_timestamp(floor(extract(epoch FROM statement_timestamp())/3600)*3600),1) ON CONFLICT(tenant_id,ip_hash,window_start) DO UPDATE SET failed_attempts=private.pin_ip_rate_limits.failed_attempts+1 RETURNING failed_attempts,window_start`);
      if(rows.length!==1)throw Error('PIN_IP_RECEIPT_REQUIRED');
      ipBlock=ipBlocked(rows[0]);
    }
    if(operatorId===null)return ipBlock??{status:'invalid'};
    const recorded = await tx.execute<PinRateLimitRow>(sql`
      INSERT INTO pin_rate_limits (
        operator_id,
        failed_attempts,
        last_failed_at,
        tenant_id
      )
      VALUES (${operatorId}, 1, now(), ${KREILE_TENANT_SLUG})
      ON CONFLICT (operator_id)
      DO UPDATE SET
        failed_attempts = pin_rate_limits.failed_attempts + 1,
        last_failed_at = now()
      WHERE pin_rate_limits.tenant_id = EXCLUDED.tenant_id
      RETURNING failed_attempts, last_failed_at
    `);
    if (recorded.length !== 1) throw Error("PIN_RATE_LIMIT_RECEIPT_REQUIRED");
    return ipBlock ?? blockedResult(recorded[0]) ?? { status: "invalid" };
  });
}

/** Existing PIN counter boundary, composed inside the existing settings writer transaction. */
export async function applyPinChangeRateLimit(tx:PrivilegedTenantTransaction,tenantId:string,operatorId:string,phase:'lock'|'reset') {
  if(phase==='lock')await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${operatorId}::text,0))`);
  else await tx.execute(sql`DELETE FROM public.pin_rate_limits WHERE tenant_id=${tenantId} AND operator_id=${operatorId}::uuid`);
}
