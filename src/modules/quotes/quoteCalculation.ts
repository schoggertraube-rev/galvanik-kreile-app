/** Integer decimal arithmetic for the configured KV calculation; no monetary defaults. */
export type QuoteCalculation = {hours:string;hourlyRateCents:number|null;setupCents:number|null;materialCents:number|null};
export type QuoteCalculationResult = {code:'OK';totalNetCents:number}|{code:'VALIDATION_ERROR';field:keyof QuoteCalculation|'total';message:string};

function calculationHours(input:QuoteCalculation):{code:'OK';hours:bigint}|Exclude<QuoteCalculationResult,{code:'OK'}>{
 if(typeof input.hours!=='string'||!/^\d{1,10}(?:[.,]\d{1,4})?$/u.test(input.hours.trim()))return {code:'VALIDATION_ERROR',field:'hours',message:'Stunden fehlen oder sind ungültig (bis vier Nachkommastellen).'};
 for(const field of ['hourlyRateCents','setupCents','materialCents'] as const){
  const value=input[field];
  if(value===null)return {code:'VALIDATION_ERROR',field,message:{hourlyRateCents:'Stundensatz fehlt',setupCents:'Rüstansatz fehlt',materialCents:'Materialansatz fehlt'}[field]};
  if(!Number.isSafeInteger(value)||value<0||field==='hourlyRateCents'&&value===0)return {code:'VALIDATION_ERROR',field,message:'Geldansatz ist ungültig.'};
 }
 const [whole,fraction='']=input.hours.trim().replace(',','.').split('.');
 const hours=BigInt(whole)*BigInt(10000)+BigInt(fraction.padEnd(4,'0'));
 return {code:'OK',hours};
}

export function calculateQuote(input:QuoteCalculation):QuoteCalculationResult {
 const checked=calculationHours(input);if(checked.code!=='OK')return checked;
 const hours=checked.hours;
 // Explicit price/hour proposals only; quantity changes scale agreed line totals below.
 const total=(hours*BigInt(input.hourlyRateCents!)+BigInt(5000))/BigInt(10000)+BigInt(input.setupCents!)+BigInt(input.materialCents!);
 if(total>BigInt(Number.MAX_SAFE_INTEGER))return {code:'VALIDATION_ERROR',field:'total',message:'Der KV-Betrag ist zu groß.'};
 return {code:'OK',totalNetCents:Number(total)};
}

/** PL13Nov21:45: quantity changes scale time, never display-only approaches or money. */
export function scaleQuoteCalculation(input:QuoteCalculation,previousQuantity:number,nextQuantity:number):
 {code:'OK';calculation:QuoteCalculation}|Exclude<QuoteCalculationResult,{code:'OK'}>{
 const checked=calculationHours(input);if(checked.code!=='OK')return checked;
 if(!Number.isSafeInteger(previousQuantity)||previousQuantity<1||!Number.isSafeInteger(nextQuantity)||nextQuantity<1)
  return {code:'VALIDATION_ERROR',field:'total',message:'Mengenfaktor ist ungueltig.'};
 const denominator=BigInt(previousQuantity);
 const hours=(checked.hours*BigInt(nextQuantity)+denominator/BigInt(2))/denominator;
 const calculation={...input,hours:(hours/BigInt(10000)).toString()+'.'+(hours%BigInt(10000)).toString().padStart(4,'0')};
 const scaled=calculationHours(calculation);
 return scaled.code==='OK'?{code:'OK',calculation}:scaled;
}

export type QuoteQuantityLine={position:number;quantity:number;lineTotalCents:number;unit?:string|null;plannedMinutes?:number|null};

/** One monetary scaler: agreed line total × received/original quantity, rounded once. */
export function scaleQuotePositions(calculation:QuoteCalculation|null,source:QuoteQuantityLine[],quantities:Array<{position:number;quantity:number}>):
 {code:'OK';positions:QuoteQuantityLine[];totalNetCents:number;calculation:QuoteCalculation|null;plannedHours?:string|null;legacyMinutesAllocated?:boolean}|Exclude<QuoteCalculationResult,{code:'OK'}>{
 const invalid=():Exclude<QuoteCalculationResult,{code:'OK'}>=>({code:'VALIDATION_ERROR',field:'total',message:'KV-Positionen und Mengen sind nicht eindeutig oder passen nicht zur Kalkulation.'});
 // Revision metadata supplies time/unit facts; a missing unit never creates a flat price.
 // Both metadata-rich and historical lines use the same agreed-line monetary scaler.
 if(source.some(row=>Object.hasOwn(row,'unit'))){
  if(!source.length||source.length!==quantities.length||new Set(source.map(row=>row.position)).size!==source.length||new Set(quantities.map(row=>row.position)).size!==quantities.length
   ||source.some(row=>!Object.hasOwn(row,'unit')||!Number.isSafeInteger(row.position)||row.position<1||!Number.isSafeInteger(row.quantity)||row.quantity<1||!Number.isSafeInteger(row.lineTotalCents)||row.lineTotalCents<0||row.plannedMinutes!=null&&(!Number.isSafeInteger(row.plannedMinutes)||row.plannedMinutes<0))
   ||quantities.some(row=>!source.some(original=>original.position===row.position)||!Number.isSafeInteger(row.quantity)||row.quantity<0))return invalid();
  const net=source.reduce((sum,row)=>sum+BigInt(row.lineTotalCents),BigInt(0));
  let legacyMinutesAllocated=false;
  let minutes=source.map(row=>row.plannedMinutes??null);
  if(calculation&&minutes.every(value=>value===null)&&net>BigInt(0)){
   if(calculationHours(calculation).code!=='OK')return invalid();
   const [whole,fraction='']=calculation.hours.replace(',','.').split('.');
   const totalMinutes=(BigInt(whole+fraction.padEnd(4,'0'))*BigInt(60)+BigInt(5000))/BigInt(10000);
   const shares=source.map(row=>totalMinutes*BigInt(row.lineTotalCents)/net);
   const largest=source.reduce((best,row,index)=>row.lineTotalCents>source[best].lineTotalCents?index:best,0);
   shares[largest]+=totalMinutes-shares.reduce((sum,value)=>sum+value,BigInt(0));
   minutes=shares.map(Number);legacyMinutesAllocated=true;
  }
  const priced=scaleQuotePositions(calculation,source.map(row=>({position:row.position,quantity:row.quantity,lineTotalCents:row.lineTotalCents})),quantities);
  if(priced.code!=='OK')return priced;
  const positions=source.map((row,index)=>{
   const quantity=quantities.find(next=>next.position===row.position)!.quantity;
   const denominator=BigInt(row.quantity);
   return {...row,quantity,lineTotalCents:quantity===0?0:priced.positions.find(position=>position.position===row.position)!.lineTotalCents,plannedMinutes:minutes[index]===null?null:Number((BigInt(minutes[index]!)*BigInt(quantity)+denominator/BigInt(2))/denominator)};
  }).filter(row=>row.quantity>0);
  const totalNetCents=positions.reduce((sum,row)=>sum+row.lineTotalCents,0);
  if(!positions.length||!Number.isSafeInteger(totalNetCents)||positions.some(row=>!Number.isSafeInteger(row.lineTotalCents)||row.plannedMinutes!==null&&!Number.isSafeInteger(row.plannedMinutes)))return invalid();
  const knownMinutes=positions.every(row=>row.plannedMinutes!==null);
  const totalMinutes=positions.reduce((sum,row)=>sum+BigInt(row.plannedMinutes??0),BigInt(0));
  const hours=(totalMinutes*BigInt(10000)+BigInt(30))/BigInt(60);
  return {code:'OK',positions,totalNetCents,calculation:priced.calculation,legacyMinutesAllocated,plannedHours:priced.calculation?.hours??(!legacyMinutesAllocated&&knownMinutes?(hours/BigInt(10000)).toString()+'.'+(hours%BigInt(10000)).toString().padStart(4,'0'):null)};
 }
 if(!source.length||source.length!==quantities.length||new Set(source.map(row=>row.position)).size!==source.length||new Set(quantities.map(row=>row.position)).size!==quantities.length||source.some(row=>!Number.isSafeInteger(row.position)||row.position<1||!Number.isSafeInteger(row.quantity)||row.quantity<1||!Number.isSafeInteger(row.lineTotalCents)||row.lineTotalCents<0)||quantities.some(row=>!source.some(original=>original.position===row.position)||!Number.isSafeInteger(row.quantity)||row.quantity<0))return invalid();
 if(calculation&&calculationHours(calculation).code!=='OK')return invalid();
 const positions=source.map(row=>{const quantity=quantities.find(next=>next.position===row.position)!.quantity;return {...row,quantity,lineTotalCents:Number((BigInt(row.lineTotalCents)*BigInt(quantity)+BigInt(row.quantity)/BigInt(2))/BigInt(row.quantity))};}).filter(row=>row.quantity>0);
 const totalNetCents=positions.reduce((sum,row)=>sum+row.lineTotalCents,0);
 if(!positions.length||!Number.isSafeInteger(totalNetCents)||positions.some(row=>!Number.isSafeInteger(row.lineTotalCents)))return invalid();
 let scaledCalculation:QuoteCalculation|null=null;
 const uniform=source.every(row=>BigInt(quantities.find(next=>next.position===row.position)!.quantity)*BigInt(source[0].quantity)===BigInt(quantities.find(next=>next.position===source[0].position)!.quantity)*BigInt(row.quantity));
 if(calculation&&uniform){const scaled=scaleQuoteCalculation(calculation,source[0].quantity,quantities.find(next=>next.position===source[0].position)!.quantity);if(scaled.code!=='OK')return scaled;scaledCalculation=scaled.calculation;}
 return {code:'OK',positions,totalNetCents,calculation:scaledCalculation};
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
