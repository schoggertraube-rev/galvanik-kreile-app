import 'server-only';
import type {QuoteReadback} from '@/modules/quotes/public';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import type {AuthorizationSnapshot} from './authorization';
import {readAuthorizedV45Rule} from './v45RuleRead';

/** V45 quoteFacts, projected from the existing validated quote read port.
 * Historical editions never stand in for the current promise. Missing lifecycle
 * evidence stays missing; the ordered rule reader decides whether it is needed.
 */
export function v45QuoteFacts(quote:Pick<QuoteReadback,'linkedOrderId'|'validUntil'|'lifecycle'>,now=new Date()):Readonly<Record<string,unknown>>{
 const life=quote.lifecycle,converted=Boolean(quote.linkedOrderId);
 const past=quote.validUntil!==null&&quote.validUntil<berlinCalendarDay(now);
 const facts:Record<string,unknown>={converted,...(!past||converted?{expired:false}:{})};
 if(!life)return facts;
 const conditional=life.conditional?.edition===life.edition;
 const accepted=life.acceptedEdition===life.edition&&!conditional;
 // PL 11.11.09:00: validity only limits acceptance, not an existing promise.
 // Keep frozen V45 files untouched; the PL records this in NACHTRAG_PL.
 return {...facts,expired:past&&!converted&&!accepted,rejected:life.declinedAt!==null,conditional,sent:life.sentEdition===life.edition,accepted,
  ...(Array.isArray(life.goods)?{goods:life.goods.length>0}:{})};
}

/** Server-only U2 composition seam, receiving the validated operational readback
 * from the existing quote action. Neither prices nor the quote escape this reader.
 * This is the rule/fact portion, not a complete U2 response or a new command.
 */
export function readV45QuoteRule(auth:AuthorizationSnapshot,quote:Pick<QuoteReadback,'quoteId'|'version'|'linkedOrderId'|'validUntil'|'lifecycle'>){
 return {...readAuthorizedV45Rule(auth,'kv',v45QuoteFacts(quote)),source:{kind:'quote' as const,id:quote.quoteId,version:quote.version,edition:quote.lifecycle?.edition??null}};
}
