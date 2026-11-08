import type {QuoteReadback,QuotePosition} from './server/types';
/** The same persisted quote, with financial fields absent for operational purpose. */
export type QuoteUiReadback=Omit<QuoteReadback,'totalNetCents'|'positions'>&{totalNetCents:number|null;positions:Array<Omit<QuotePosition,'unitPriceCents'|'lineTotalCents'>&{unitPriceCents:number|null;lineTotalCents:number|null}>;plannedHours?:string|null};
export function quoteForUi(quote:QuoteReadback,financial:boolean):QuoteUiReadback{
 if(financial)return quote;
 return {...quote,totalNetCents:null,positions:quote.positions.map(row=>({...row,unitPriceCents:null,lineTotalCents:null})),plannedHours:quote.lifecycle?.calculation?.hours??null,lifecycle:quote.lifecycle?{...quote.lifecycle,calculation:null}:undefined};
}
export function hasQuoteFinancials(quote:QuoteUiReadback):quote is QuoteReadback{return typeof quote.totalNetCents==='number'&&quote.positions.every(row=>typeof row.unitPriceCents==='number'&&typeof row.lineTotalCents==='number');}
