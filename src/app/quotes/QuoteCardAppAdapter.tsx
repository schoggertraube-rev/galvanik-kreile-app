'use client';
import {useMemo} from 'react';
import {QuoteCard,type QuoteCardPorts} from '@/modules/quotes/public';
import {readQuoteAction,changeQuoteLifecycleAction,prepareQuoteTextChangeAction,updateQuoteAction} from '@/app/actions/quotes.actions';

export function QuoteCardAppAdapter({quoteId,onClose,onOpenCustomer,onOpenOrder}:{quoteId:string;onClose:()=>void;onOpenCustomer:(id:string)=>void;onOpenOrder:(id:string)=>void}){
 const ports=useMemo<QuoteCardPorts>(()=>({read:id=>readQuoteAction({quoteId:id}),change:changeQuoteLifecycleAction,prepare:prepareQuoteTextChangeAction,update:updateQuoteAction}),[]);
 return <QuoteCard quoteId={quoteId} ports={ports} onClose={onClose} onCustomer={onOpenCustomer} onOrder={onOpenOrder}/>;
}
