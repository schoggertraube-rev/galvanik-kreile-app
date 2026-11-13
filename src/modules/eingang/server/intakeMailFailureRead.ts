import 'server-only';
import {sql} from 'drizzle-orm';
import {MAIL_IMPORT_COPY} from '@/ui/situationCatalog';
/** One projection of the existing failure events and intake flag for every reader. */
export function mailImportFailureProjection(){
 return sql`CASE WHEN ${MAIL_IMPORT_COPY.failed}=ANY(source.kennzeichen) THEN (
  SELECT jsonb_build_object('label',${MAIL_IMPORT_COPY.failed}::text,'graphMessageId',source.graph_message_id,
   'reason',(array_agg(failed.nachher->>'reason' ORDER BY failed.zeit DESC,failed.id DESC))[1],
   'mailbox',(array_agg(failed.nachher->>'mailbox' ORDER BY failed.zeit DESC,failed.id DESC))[1],
   'attempts',CASE WHEN count(*)>0 THEN count(*)::integer ELSE NULL END,
   'state',CASE WHEN count(*)>0 AND source.graph_message_id IS NOT NULL AND (array_agg(failed.nachher->>'reason' ORDER BY failed.zeit DESC,failed.id DESC))[1] IS NOT NULL AND (array_agg(failed.nachher->>'mailbox' ORDER BY failed.zeit DESC,failed.id DESC))[1] IS NOT NULL AND (array_agg(failed.nachher->>'graphMessageId' ORDER BY failed.zeit DESC,failed.id DESC))[1]=source.graph_message_id THEN 'FAILED' ELSE 'SOURCE_INCOMPLETE' END,
   'taskId',(SELECT bound.nachher->>'taskId' FROM public.intake_event bound WHERE bound.tenant_id=source.tenant_id AND bound.item_id=source.id AND bound.art='einsatz' AND bound.nachher->>'action'='mail_import_failure_task' ORDER BY bound.zeit,bound.id LIMIT 1))
  FROM public.intake_event failed WHERE failed.tenant_id=source.tenant_id AND failed.item_id=source.id AND failed.art='einsatz' AND failed.nachher->>'action'='mail_import_failed') ELSE NULL END`;
}
