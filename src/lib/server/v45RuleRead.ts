import 'server-only';
import {hasAuthorizationArea,isAccessArea,QUOTE_OPERATION_ACTION_IDS,type AccessArea} from '@/lib/auth/authorizationContract';
import {getAuthorizationActionGrants,type AuthorizationSnapshot} from './authorization';
import {V45_RULES,V45_SOURCE_HASHES,V45_PREVIEW_SHA,V45_ELEMENTS} from '@/ui/v45.generated';

// PL17.11 13:34, KORR-RECHTE C: one temporary rights seam for the frozen projection.
// Delete in S14b after the bound projection carries the new rights; never regenerate V45 here.
export const LEGACY_V45_GELD_RECHT:Readonly<Record<string,AccessArea>>=Object.freeze({
  "customer.invoice": "preise",
  "customer.quote_followup": "preise",
  "order.issue": "preise",
  "order.notify": "preise",
  "order.extra_request": "preise",
  "order.prices": "preise",
  "prices.save": "preise",
  "order.collect": "preise",
  "collection.add": "preise",
  "collection.close": "preise",
  "collection.issue": "preise",
  "invoice.issue": "preise",
  "invoice.document": "preise",
  "invoice.print": "preise",
  "invoice.send": "preise",
  "quote.send": "preise",
  "quote.followup": "preise",
  "quote.revise": "preise",
  "quote.accept": "preise",
  "quote.extend": "preise",
  "quote.reject": "preise",
  "quote.convert": "preise",
  "quote.prepare": "preise",
  "quote.save": "preise",
  "quote.accept_save": "preise",
  "quote.extend_save": "preise",
  "quote.reject_save": "preise",
  "quote.weeks": "preise",
  "quote.save_send": "preise",
  "extra.decide": "preise",
  "extra.decide_save": "preise",
  "extra.next": "preise",
  "extra.price": "preise",
  "extra.price_save": "preise",
  "shipping.cost": "preise",
  "shipping.cost_save": "preise",
  "shipping.refresh_price": "preise",
  "complaint.return_invoice": "preise",
  "kunde.feld.approval_profile": "preise",
  "out.followup": "zahlungen",
  "out.focus_payments": "zahlungen",
  "customer.remind": "zahlungen",
  "customer.money": "zahlungen",
  "customer.dunning": "zahlungen",
  "order.payment": "zahlungen",
  "order.customer_debt": "zahlungen",
  "order.remind": "zahlungen",
  "order.dunning": "zahlungen",
  "order.apply_credit": "zahlungen",
  "payment.open": "zahlungen",
  "payment.bank": "zahlungen",
  "payment.cash": "zahlungen",
  "payment.partial": "zahlungen",
  "payment.save_partial": "zahlungen",
  "payment.correct": "zahlungen",
  "payment.correct_save": "zahlungen",
  "payment.refresh": "zahlungen",
  "invoice.cancel": "zahlungen",
  "invoice.cancel_save": "zahlungen",
  "credit.refund": "zahlungen",
  "credit.refund_save": "zahlungen",
  "credit.refund_refresh": "zahlungen",
  "escalation.prepare": "zahlungen",
  "escalation.send": "zahlungen",
  "escalation.recall": "zahlungen",
  "escalation.call": "zahlungen",
  "escalation.call_save": "zahlungen",
  "escalation.storage": "zahlungen",
  "escalation.storage_save": "zahlungen",
  "balance.apply": "zahlungen",
  "balance.apply_save": "zahlungen",
  "balance.undo": "zahlungen",
  "balance.undo_save": "zahlungen",
  "balance.refresh": "zahlungen",
  "kunde.feld.payment_preference": "zahlungen",
  "document.save": "eingang",
  "document.review": "eingang",
  "document.related": "eingang",
  "document.attach_duplicate": "eingang",
  "complaint.rejected_return": "entscheiden",
  "complaint.rejected_return_save": "entscheiden",
  "ausgang.mahnwesen": "zahlungen",
  "kunde.kachel.debt": "zahlungen",
  "tag.money": "zahlungen",
  "kv.details": "preise",
  "order.duplicate": "preise",
  "document.inquiry": "buchhaltung",
  "shipping.sim_create": "auftraege",
  "shipping.sim_reconcile": "auftraege",
  "shipping.sim_unknown": "auftraege",
  "shipping.sim_fail": "auftraege"
});

/** Pure reading projection. Facts must come from the existing domain read ports.
 * Unknown is never false: stop at the first still-possible higher-priority rule.
 * The ordered rules themselves remain solely in the hash-bound V45 projection.
 */
export function readV45Rule(area:string,facts:Readonly<Record<string,unknown>>,unrecordedFacts:readonly string[]=[]){
 const datenluecken=[...new Set(unrecordedFacts)].filter(key=>!Object.hasOwn(facts,key));
 const gaps=datenluecken.length?{datenluecken}:{};
 const rules=V45_RULES.filter(rule=>rule.bereich===area);
 if(!rules.length)return {code:'VALIDATION_ERROR' as const};
 for(const rule of rules){
  const conditions=Object.entries(rule.wenn);
  // R15: only facts explicitly audited as having no capture path are absent.
  // Present-but-unreadable values never enter this exception.
  if(conditions.some(([key])=>datenluecken.includes(key)))continue;
  const known=(key:string,value:string|boolean|number)=>Object.hasOwn(facts,key)&&typeof facts[key]===typeof value&&(typeof facts[key]!=='number'||Number.isFinite(facts[key]));
  if(conditions.some(([key,value])=>known(key,value)&&facts[key]!==value))continue;
  const missing=conditions.filter(([key,value])=>!known(key,value)).map(([key])=>key);
  if(missing.length)return {code:'SOURCE_INCOMPLETE' as const,ruleId:rule.id,missing,...gaps};
  return {code:'OK' as const,ruleId:rule.id,...rule.dann,...gaps,quelle:{rule:rule.id,source:rule.quelle,sha256:V45_SOURCE_HASHES['regeln.json'],previewSha256:V45_PREVIEW_SHA}};
 }
 return {code:'SOURCE_INCOMPLETE' as const,missing:['MATCHING_V45_RULE'],...gaps};
}

/** One rights-filtered rule seam for the later U2 domain composition.
 * It never returns caller facts or example amounts, and grants no command right.
 */
export function readAuthorizedV45Rule(auth:AuthorizationSnapshot,area:string,facts:Readonly<Record<string,unknown>>,commandRights?:Readonly<Record<string,boolean>>,unrecordedFacts:readonly string[]=[]){
 if(!auth.active)return {code:'FORBIDDEN' as const};
 const selected=readV45Rule(area,facts,unrecordedFacts);
 if(selected.code!=='OK')return selected;
 if(selected.hauptaktion===null)return {...selected,gesperrt:[]};
 const action=readAuthorizedV45Action(auth,selected.hauptaktion,commandRights);
 if(action.code!=='OK')return action;
 return {...selected,...action};
}

/** Shared metadata/right seam for V45 actions, including the approved message
 * fallback. It describes permissions, never executes a command. */
export function readAuthorizedV45Action(auth:AuthorizationSnapshot,elementId:string,commandRights?:Readonly<Record<string,boolean>>){
 if(!auth.active)return {code:'FORBIDDEN' as const};
 const metadata=V45_ELEMENTS.filter(row=>row.id===elementId);
 if(metadata.length!==1||!Object.hasOwn(metadata[0],'recht')||typeof metadata[0].text!=='string')return {code:'SOURCE_INCOMPLETE' as const,missing:['ACTION_METADATA']};
 const action=metadata[0];
 const right=action.recht==='geld'?(Object.hasOwn(LEGACY_V45_GELD_RECHT,elementId)?LEGACY_V45_GELD_RECHT[elementId]:undefined):action.recht;
 if(action.recht==='geld'&&right===undefined)return {code:'OK' as const,hauptaktion:null,gesperrt:[{elementId:action.id,grundKey:'error.permission'}],diagnosticCode:'V45_LEGACY_RIGHT_UNMAPPED' as const};
 // V45 status names the existing perm_op_status capability; no role inference.
 if(right!==null&&right!=='status'&&!isAccessArea(right))return {code:'SOURCE_INCOMPLETE' as const,missing:['ACTION_RIGHT']};
 // PL15.11.11:58 / U-249: these operational quote decisions use the
 // writer's canonical commandRights. V45's status tag adds no second gate.
 const canonicalQuoteDecision=commandRights!==undefined&&QUOTE_OPERATION_ACTION_IDS.includes(elementId);
 const canonicalCashDecision=elementId==='payment.cash'&&getAuthorizationActionGrants(auth).confirmPayment;
 const permitted=elementId==='payment.cash'?canonicalCashDecision:canonicalQuoteDecision||(right===null||right==='status'?right===null||auth.permissions.includes('perm_op_status'):hasAuthorizationArea(auth,right!));
 const commandPermitted=commandRights===undefined||Object.hasOwn(commandRights,action.id)&&commandRights[action.id]===true;
 if(!permitted||!commandPermitted)return {code:'OK' as const,hauptaktion:null,gesperrt:[{elementId:action.id,grundKey:'error.permission'}]};
 return {code:'OK' as const,hauptaktion:elementId,textKey:action.text,recht:right,gesperrt:[]};
}
