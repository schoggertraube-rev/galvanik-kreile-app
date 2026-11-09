import {getAuthorizationActionGrants,hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';

export function quoteCommandContext(authorization: AuthorizationSnapshot) {
  const actionGrants = getAuthorizationActionGrants(authorization);
  const canReadQuote = hasAuthorizationArea(authorization, "geld")
    && hasAuthorizationArea(authorization, "auftraege");
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

/** Existing operational quote purpose; exposes no financial edit grant. */
export function quoteOperationContext(auth:AuthorizationSnapshot){
 const context=quoteCommandContext(auth);return {...context,capabilities:{...context.capabilities,canReadQuote:true,canDecideQuote:true,canConvertQuote:true}};
}
