"use client";

import { useEffect,useState } from "react";
import { getCustomersDb } from "@/app/actions/customers.actions";
import { CustomersView,type CustomersViewState } from "@/modules/customers/public";
import { useOverlayStore } from "@/lib/overlayStore";
export function CustomersAppAdapter(){const openCustomer=useOverlayStore(s=>s.openCustomer);const[state,setState]=useState<CustomersViewState>({kind:"loading"});useEffect(()=>{let active=true;getCustomersDb().then(result=>{if(!active)return;if(!result.ok){setState(result.error==="UNAUTHORIZED"||result.error==="FORBIDDEN"?{kind:"denied",message:"Kundenstamm ist für diese Sitzung nicht freigegeben."}:{kind:"error",message:"Kundenstamm konnte nicht sicher geladen werden."});return}setState({kind:"data",customers:result.data.map(c=>({id:c.id,customerNumber:c.customerNumber,name:c.name,type:c.type,city:c.city??null}))})}).catch(()=>{if(active)setState({kind:"error",message:"Kundenstamm konnte nicht sicher geladen werden."})});return()=>{active=false}},[]);return <CustomersView state={state} onOpenCustomer={openCustomer}/>}
