import 'server-only';
import type {IntakeTextRecognition} from '@/lib/server/intakeTextRecognition';
import {calculateQuote,scaleQuoteCalculation,scaleQuotePositions,type QuoteCalculation} from '../quoteCalculation';
import {readQuoteCopyCommand} from './quoteCommands';
import type {QuoteCommandContext,UpdateQuoteInput} from './types';

/** A proposal has no side effects. Applying it uses the unchanged updateQuote writer. */
export async function prepareQuoteTextChangeCommand(auth:QuoteCommandContext,quoteId:string,recognition:IntakeTextRecognition){
 const source=await readQuoteCopyCommand(auth,{quoteId});if(source.code!=='OK')return source;
 const before=source.quote;if(before.linkedOrderId)return {code:'CONFLICT' as const,message:'Der KV ist bereits zum Auftrag geworden. Auftrag oeffnen.'};
 const positions=source.positions.map(position=>({...position})),changes:string[]=[],missing:string[]=[];
 const command=recognition.quoteChanges;
 if(command?.quoteNumber&&(Number(before.quoteNumber.split('-').at(-1))!==command.quoteNumber.number||command.quoteNumber.year!==null&&before.quoteNumber.split('-')[1]!==command.quoteNumber.year))return {code:'CONFLICT' as const,message:'Im Text steht ein anderer KV. Richtigen KV oeffnen.'};
 const dueDate=recognition.fields.find(field=>field.field==='dueDate')?.value??before.dueDate;
 if(dueDate!==before.dueDate)changes.push('Liefertermin');
 const calculation:QuoteCalculation|undefined=before.lifecycle?.calculation?{...before.lifecycle.calculation}:undefined;
 const fraction=(numerator:bigint,denominator:bigint)=>{const scaled=(numerator+denominator/BigInt(2))/denominator;return (scaled/BigInt(10000)).toString()+'.'+(scaled%BigInt(10000)).toString().padStart(4,'0');};
 if(command?.quantity){
  const edit=command.quantity,tokens=edit.name.toLocaleLowerCase('de-DE').split(/[^\p{L}]+/u).filter(word=>word.length>=3);
  const matches=before.positions.map((position,index)=>({position,index})).filter(({position})=>tokens.some(word=>position.name.toLocaleLowerCase('de-DE').split(/[^\p{L}]+/u).includes(word)));
  if(matches.length!==1||!Number.isSafeInteger(edit.value)||edit.value<1)missing.push('Position und positive Menge eindeutig zuordnen');
  else{
   const {position:original,index}=matches[0];if(edit.previous!==undefined&&edit.previous!==original.quantity)missing.push('Genannte Ausgangsmenge passt nicht zum aktuellen KV');const next=edit.mode==='add'?original.quantity+edit.value:edit.value;
   positions[index].quantity=next;positions[index].lineTotalCents=Number((BigInt(original.lineTotalCents)*BigInt(next)+BigInt(original.quantity)/BigInt(2))/BigInt(original.quantity));changes.push('Menge: '+original.quantity+' → '+next);
   if(calculation){if(positions.length===1){const scaled=scaleQuoteCalculation(calculation,original.quantity,next);if(scaled.code!=='OK')missing.push(scaled.message);else{Object.assign(calculation,scaled.calculation);positions[index].lineTotalCents=scaled.totalNetCents;}}else{const scaled=scaleQuotePositions(calculation,before.positions,positions.map((row,index)=>({position:before.positions[index].position,quantity:row.quantity})));if(scaled.code!=='OK')missing.push(scaled.message);else for(const line of scaled.positions){const target=positions[before.positions.findIndex(row=>row.position===line.position)];target.lineTotalCents=line.lineTotalCents;}missing.push('Arbeitszeit fuer geaenderten Umfang bestaetigen');}}
  }
 }
 if(command?.hours!==undefined||command?.targetNetCents!==undefined){
  if(!calculation)missing.push('Kalkulationsansaetze aus Einstellungen bestaetigen');
  else{
   if(command.hours!==undefined){calculation.hours=command.hours;changes.push('Arbeitszeit');}
   if(command.targetNetCents!==undefined){
    if(command.hours!==undefined){const stated=calculateQuote(calculation);if(stated.code!=='OK'||stated.totalNetCents!==command.targetNetCents)missing.push('Arbeitszeit und Preisziel widersprechen sich');}
    if(calculation.hourlyRateCents===null||calculation.setupCents===null||calculation.materialCents===null||calculation.hourlyRateCents<=0||command.targetNetCents<calculation.setupCents+calculation.materialCents)missing.push('Preisziel und Kalkulation pruefen');
    else{calculation.hours=fraction(BigInt(command.targetNetCents-calculation.setupCents-calculation.materialCents)*BigInt(10000),BigInt(calculation.hourlyRateCents));const exact=calculateQuote(calculation);if(exact.code!=='OK'||exact.totalNetCents!==command.targetNetCents)missing.push('Preisziel ist mit vier Stunden-Nachkommastellen nicht exakt darstellbar');else changes.push('Preisziel → Arbeitszeit');}
   }
   const total=calculateQuote(calculation);
   if(total.code!=='OK')missing.push(total.message);
   else if(positions.length!==1)missing.push('Gesamtpreis auf Positionen bestaetigen');
   else positions[0].lineTotalCents=total.totalNetCents;
  }
 }
 if(calculation){const total=calculateQuote(calculation);if(total.code!=='OK'||total.totalNetCents!==positions.reduce((sum,position)=>sum+(position.lineTotalCents??position.quantity*position.unitPriceCents),0))missing.push('Kalkulation und Positionspreise angleichen');}
 if(!changes.length)missing.push('Keine eindeutige Aenderung erkannt');
 const dateOnly=changes.length===1&&changes[0]==='Liefertermin';
 // Preserve the persisted position shape on a date-only change: adding an equivalent
 // explicit line total would otherwise look like a commercial edit to the SQL writer.
 const writePositions=dateOnly?positions.map((row,index)=>{const {lineTotalCents,...base}=row;return source.storedLineTotals[index]===null?base:{...base,lineTotalCents};}):positions;
 const candidate:Omit<UpdateQuoteInput,'clientEventId'>={quoteId,expectedVersion:before.version,dueDate,note:before.note,positions:writePositions,...(calculation?{calculation}:{})};
 return {code:'OK' as const,preparation:{dateOnly,before,after:{dueDate,positions,totalNetCents:positions.reduce((sum,row)=>sum+(row.lineTotalCents??row.quantity*row.unitPriceCents),0),calculation:missing.includes('Arbeitszeit fuer geaenderten Umfang bestaetigen')?null:calculation??null},changes,missing:[...new Set(missing)],canApply:missing.length===0,candidate:missing.length?null:candidate}};
}
