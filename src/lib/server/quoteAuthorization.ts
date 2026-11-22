import {getAuthorizationActionGrants,hasAuthorizationArea} from "@/lib/auth/authorizationContract";
import type {AuthorizationSnapshot} from './authorization';
import {authorizationReadContext,type AuthorizedReadContext} from './authorizationReadContext';

/** Same commercial read predicate for a real-session wrapper and a normalized
 * projector callback; write capabilities still require the original full actor. */
export function quoteReadContext(authorization:Pick<AuthorizedReadContext,'tenantId'|'canReadArea'>){
  return {tenantId:authorization.tenantId,capabilities:{canReadQuote:authorization.canReadArea('preise')&&authorization.canReadArea('auftraege')}};
}

export function quoteCommandContext(authorization: AuthorizationSnapshot) {
  const actionGrants = getAuthorizationActionGrants(authorization);
  const {capabilities:{canReadQuote}}=quoteReadContext(authorizationReadContext(authorization));
  return {
    tenantId: authorization.tenantId,
    userId: authorization.userId,
    capabilities: {
      canCreateQuote: actionGrants.createQuote,
      canReadQuote,
      canUpdateQuote: actionGrants.createQuote,
      canConvertQuote: actionGrants.createQuote,
    },
  };
}

export function canReadQuoteForGoods(auth:AuthorizationSnapshot){return auth.active&&hasAuthorizationArea(auth,'auftraege')&&auth.permissions.includes('perm_view_leitstand');}

/** U-249 operational actions; shared by the writer capability context and U2 rights projection. */
export {QUOTE_OPERATION_ACTION_IDS} from '@/lib/auth/authorizationContract';

/** Existing operational quote purpose; exposes no financial edit grant. */
export function quoteOperationContext(auth:AuthorizationSnapshot){
 const context=quoteCommandContext(auth);return {...context,capabilities:{...context.capabilities,canReadQuote:auth.active,canDecideQuote:true,canConvertQuote:true}};
}
