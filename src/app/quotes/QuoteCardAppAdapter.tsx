'use client';
import {useMemo} from 'react';
import {getGoodsReceiptsAction} from '@/app/actions/eingang.actions';
import {transitionWareneingangToGalvanikAction} from '@/app/actions/orders.actions';
import {QuoteCard,type QuoteCardPorts} from '@/modules/quotes/public';
import {readQuoteAction,convertQuoteToOrderAction,changeQuoteLifecycleAction,prepareQuoteTextChangeAction,updateQuoteAction} from '@/app/actions/quotes.actions';

export function QuoteCardAppAdapter({quoteId,onClose,onOpenCustomer,onOpenOrder}:{quoteId:string;onClose:()=>void;onOpenCustomer:(id:string)=>void;onOpenOrder:(id:string)=>void}){
 const ports=useMemo<QuoteCardPorts>(()=>({read:async id=>{const result=await readQuoteAction({quoteId:id});if(result.code!=='OK'||!result.quote.linkedOrderId)return result;const goods=await getGoodsReceiptsAction(result.quote.linkedOrderId);if(goods.code!=='OK')return {...result,progress:null,progressError:goods.message};return {...result,progress:{orderId:goods.order.id,number:goods.order.number??result.quote.linkedOrderId,version:goods.order.version,station:goods.order.station,status:goods.order.status,ware:goods.order.ware,canStart:goods.canStartGalvanik,receipts:goods.receipts.map(row=>({status:row.status,location:row.lagerort??null,open:row.offen}))}};},startGalvanik:transitionWareneingangToGalvanikAction,change:changeQuoteLifecycleAction,convert:(input,telephone)=>convertQuoteToOrderAction(input,undefined,telephone),prepare:prepareQuoteTextChangeAction,update:updateQuoteAction}),[]);
 return <QuoteCard quoteId={quoteId} ports={ports} onClose={onClose} onCustomer={onOpenCustomer} onOrder={onOpenOrder} onGoods={id=>window.dispatchEvent(new CustomEvent("kreile:oeffne",{cancelable:true,detail:{ziel:"kvware",arg:id}}))}/>;
}
