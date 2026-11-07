/** Integer decimal arithmetic for the configured KV calculation; no monetary defaults. */
export type QuoteCalculation = {hours:string;hourlyRateCents:number|null;setupCents:number|null;materialCents:number|null};
export type QuoteCalculationResult = {code:'OK';totalNetCents:number}|{code:'VALIDATION_ERROR';field:keyof QuoteCalculation|'total';message:string};

export function calculateQuote(input:QuoteCalculation):QuoteCalculationResult {
 if(typeof input.hours!=='string'||!/^\d{1,10}(?:[.,]\d{1,4})?$/u.test(input.hours.trim()))return {code:'VALIDATION_ERROR',field:'hours',message:'Stunden fehlen oder sind ungültig (bis vier Nachkommastellen).'};
 for(const field of ['hourlyRateCents','setupCents','materialCents'] as const){
  const value=input[field];
  if(value===null)return {code:'VALIDATION_ERROR',field,message:{hourlyRateCents:'Stundensatz fehlt',setupCents:'Rüstansatz fehlt',materialCents:'Materialansatz fehlt'}[field]};
  if(!Number.isSafeInteger(value)||value<0||field==='hourlyRateCents'&&value===0)return {code:'VALIDATION_ERROR',field,message:'Geldansatz ist ungültig.'};
 }
 const [whole,fraction='']=input.hours.trim().replace(',','.').split('.');
 const hours=BigInt(whole)*10000n+BigInt(fraction.padEnd(4,'0'));
 // Round once, in integer cents. No binary floating point or intermediate rounding.
 const total=(hours*BigInt(input.hourlyRateCents!)+5000n)/10000n+BigInt(input.setupCents!)+BigInt(input.materialCents!);
 if(total>BigInt(Number.MAX_SAFE_INTEGER))return {code:'VALIDATION_ERROR',field:'total',message:'Der KV-Betrag ist zu groß.'};
 return {code:'OK',totalNetCents:Number(total)};
}

/** A sent acceptance belongs to its content edition, independently of optimistic locking. */
export function quoteAcceptanceIsCurrent(facts:{edition:number;acceptedEdition:number|null;acceptedAt:string|null;acceptanceEvidence:string|null}){
 return Number.isSafeInteger(facts.edition)&&facts.edition>0&&facts.acceptedEdition===facts.edition
  &&typeof facts.acceptedAt==='string'&&Number.isFinite(Date.parse(facts.acceptedAt))&&Boolean(facts.acceptanceEvidence?.trim());
}

export function nextQuoteEdition(facts:{edition:number;sentEdition:number|null},contentChanged:boolean){
 if(!Number.isSafeInteger(facts.edition)||facts.edition<1||facts.sentEdition!==null&&(!Number.isSafeInteger(facts.sentEdition)||facts.sentEdition<1||facts.sentEdition>facts.edition))throw Error('QUOTE_EDITION_INVALID');
 if(!contentChanged||facts.sentEdition===null)return facts.edition;
 if(facts.edition===Number.MAX_SAFE_INTEGER)throw Error('QUOTE_EDITION_OVERFLOW');
 return facts.edition+1;
}
