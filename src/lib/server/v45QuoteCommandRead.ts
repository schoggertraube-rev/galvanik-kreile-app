import 'server-only';

// U4/HAUPTWEGE E2-E5/W2-W3: references to existing public action boundaries.
// These are descriptions, never a sender, command dispatcher or permission grant.
const quote=<Name extends keyof typeof import('@/app/actions/quotes.actions')>(funktion:Name,argumente:Readonly<Record<string,string>>={})=>({datei:'src/app/actions/quotes.actions.ts' as const,funktion,argumente});
const intake=<Name extends keyof typeof import('@/app/actions/eingang.actions')>(funktion:Name)=>({datei:'src/app/actions/eingang.actions.ts' as const,funktion,argumente:{}});
const communication=<Name extends keyof typeof import('@/app/actions/communications.actions')>(funktion:Name)=>({datei:'src/app/actions/communications.actions.ts' as const,funktion,argumente:{}});
const commands={
 'quote.return_goods':intake('recordQuoteGoodsReturnAction'),
 'quote.extend':quote('changeQuoteLifecycleAction',{action:'extend'}),
 'quote.revise':quote('updateQuoteAction'),
 'quote.followup':communication('sendCustomerMailAction'),
 'quote.send':communication('sendCustomerMailAction'),
 'quote.convert':quote('convertQuoteToOrderAction'),
 'quote.receive':intake('saveGoodsReceiptAction'),
 'quote.accept':quote('changeQuoteLifecycleAction',{action:'accept'})
} as const;

/** Missing bindings are unknown, not an invented new command. */
export function readV45QuoteCommand(elementId:string){
 return Object.hasOwn(commands,elementId)?commands[elementId as keyof typeof commands]:null;
}
