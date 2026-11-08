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
 const hours=BigInt(whole)*BigInt(10000)+BigInt(fraction.padEnd(4,'0'));
 // Round once, in integer cents. No binary floating point or intermediate rounding.
 const total=(hours*BigInt(input.hourlyRateCents!)+BigInt(5000))/BigInt(10000)+BigInt(input.setupCents!)+BigInt(input.materialCents!);
 if(total>BigInt(Number.MAX_SAFE_INTEGER))return {code:'VALIDATION_ERROR',field:'total',message:'Der KV-Betrag ist zu groß.'};
 return {code:'OK',totalNetCents:Number(total)};
}

/** U-246/247: setup is fixed; only work and material follow the quantity. */
export function scaleQuoteCalculation(input:QuoteCalculation,previousQuantity:number,nextQuantity:number):
 {code:'OK';calculation:QuoteCalculation;totalNetCents:number}|Exclude<QuoteCalculationResult,{code:'OK'}>{
 const original=calculateQuote(input);
 if(original.code!=='OK')return original;
 if(!Number.isSafeInteger(previousQuantity)||previousQuantity<1||!Number.isSafeInteger(nextQuantity)||nextQuantity<1)
  return {code:'VALIDATION_ERROR',field:'total',message:'Mengenfaktor ist ungueltig.'};
 const numerator=BigInt(nextQuantity),denominator=BigInt(previousQuantity);
 const rounded=(value:bigint)=>(value*numerator+denominator/BigInt(2))/denominator;
 const [whole,fraction='']=input.hours.trim().replace(',','.').split('.');
 const hours=rounded(BigInt(whole)*BigInt(10000)+BigInt(fraction.padEnd(4,'0')));
 const material=rounded(BigInt(input.materialCents!));
 if(material>BigInt(Number.MAX_SAFE_INTEGER))return {code:'VALIDATION_ERROR',field:'materialCents',message:'Materialansatz ist zu gross.'};
 const calculation={...input,hours:(hours/BigInt(10000)).toString()+'.'+(hours%BigInt(10000)).toString().padStart(4,'0'),materialCents:Number(material)};
 const result=calculateQuote(calculation);
 return result.code==='OK'?{...result,calculation}:result;
}

export type QuoteQuantityLine={position:number;quantity:number;lineTotalCents:number};

/** Fixed setup is apportioned once against original lines; only the remainder scales. */
export function scaleQuotePositions(calculation:QuoteCalculation|null,source:QuoteQuantityLine[],quantities:Array<{position:number;quantity:number}>):
 {code:'OK';positions:QuoteQuantityLine[];totalNetCents:number;calculation:QuoteCalculation|null}|Exclude<QuoteCalculationResult,{code:'OK'}>{
 const invalid=():Exclude<QuoteCalculationResult,{code:'OK'}>=>({code:'VALIDATION_ERROR',field:'total',message:'KV-Positionen und Mengen sind nicht eindeutig oder passen nicht zur Kalkulation.'});
 if(calculation===null){
  if(!source.length||source.length!==quantities.length||new Set(source.map(row=>row.position)).size!==source.length||new Set(quantities.map(row=>row.position)).size!==quantities.length||source.some(row=>!Number.isSafeInteger(row.position)||row.position<1||!Number.isSafeInteger(row.quantity)||row.quantity<1||!Number.isSafeInteger(row.lineTotalCents)||row.lineTotalCents<0)||quantities.some(row=>!source.some(original=>original.position===row.position)||!Number.isSafeInteger(row.quantity)||row.quantity<0))return invalid();
  const positions=source.map(row=>{const quantity=quantities.find(next=>next.position===row.position)!.quantity;return {...row,quantity,lineTotalCents:Number((BigInt(row.lineTotalCents)*BigInt(quantity)+BigInt(row.quantity)/BigInt(2))/BigInt(row.quantity))};}).filter(row=>row.quantity>0);
  const totalNetCents=positions.reduce((sum,row)=>sum+row.lineTotalCents,0);
  return !positions.length||!Number.isSafeInteger(totalNetCents)||positions.some(row=>!Number.isSafeInteger(row.lineTotalCents))?invalid():{code:'OK',positions,totalNetCents,calculation:null};
 }
 const valid=calculateQuote(calculation);
 if(valid.code!=='OK')return valid;
 if(!source.length||source.length!==quantities.length||new Set(source.map(row=>row.position)).size!==source.length||new Set(quantities.map(row=>row.position)).size!==quantities.length||source.some(row=>!Number.isSafeInteger(row.position)||row.position<1||!Number.isSafeInteger(row.quantity)||row.quantity<1||!Number.isSafeInteger(row.lineTotalCents)||row.lineTotalCents<0)||quantities.some(row=>!source.some(original=>original.position===row.position)||!Number.isSafeInteger(row.quantity)||row.quantity<0)||source.reduce((sum,row)=>sum+row.lineTotalCents,0)!==valid.totalNetCents)return invalid();
 const setup=BigInt(calculation.setupCents!);
 const weights=source.map(row=>BigInt(row.lineTotalCents)),total=BigInt(valid.totalNetCents);
 const largest=source.reduce((best,row,index)=>row.lineTotalCents>source[best].lineTotalCents?index:best,0);
 const setupShares=weights.map(weight=>total===BigInt(0)?BigInt(0):setup*weight/total);
 setupShares[largest]+=setup-setupShares.reduce((sum,value)=>sum+value,BigInt(0));
 const next=source.map(row=>quantities.find(quantity=>quantity.position===row.position)!.quantity);
 const active=source.map((_,index)=>index).filter(index=>next[index]>0);
 if(!active.length)return invalid();
 const largestActive=active.reduce((best,index)=>weights[index]>weights[best]?index:best,active[0]);
 const values=source.map((row,index)=>{const denominator=BigInt(row.quantity);return (BigInt(row.lineTotalCents)-setupShares[index])*BigInt(next[index])+denominator/BigInt(2);}).map((value,index)=>value/BigInt(source[index].quantity)+setupShares[index]);
 // The fixed setup survives omitted zero-quantity lines, without creating fake parts.
 const omittedSetup=source.reduce((sum,_,index)=>next[index]===0?sum+setupShares[index]:sum,BigInt(0));
 values[largestActive]+=omittedSetup;
 const uniform=source.every((row,index)=>BigInt(next[index])*BigInt(source[0].quantity)===BigInt(next[0])*BigInt(row.quantity));
 let scaledCalculation:QuoteCalculation|null=null;
 if(uniform){const scaled=scaleQuoteCalculation(calculation,source[0].quantity,next[0]);if(scaled.code!=='OK')return scaled;scaledCalculation=scaled.calculation;values[largestActive]+=BigInt(scaled.totalNetCents)-active.reduce((sum,index)=>sum+values[index],BigInt(0));}
 const sum=active.reduce((amount,index)=>amount+values[index],BigInt(0));
 if(sum>BigInt(Number.MAX_SAFE_INTEGER)||active.some(index=>values[index]<BigInt(0)||values[index]>BigInt(Number.MAX_SAFE_INTEGER)))return invalid();
 return {code:'OK',totalNetCents:Number(sum),calculation:scaledCalculation,positions:active.map(index=>({position:source[index].position,quantity:next[index],lineTotalCents:Number(values[index])}))};
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
