"use client";

import { useOverlayStore } from "@/lib/overlayStore";
import { OrderCardAppAdapter } from "@/app/orders/OrderCardAppAdapter";
import { CustomerCardAppAdapter } from "@/app/customers/CustomerCardAppAdapter";
import styles from "./EntityOverlayStack.module.css";
export function EntityOverlayStack(){const stack=useOverlayStore(s=>s.stack);const pop=useOverlayStore(s=>s.pop);const openOrder=useOverlayStore(s=>s.openOrder);const openCustomer=useOverlayStore(s=>s.openCustomer);const top=stack.at(-1);if(!top||(top.type!=="order"&&top.type!=="customer"))return null;return <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={top.type==="order"?"Auftragskarte":"Kundenkarte"} onMouseDown={event=>{if(event.target===event.currentTarget)pop()}}>{top.type==="order"?<OrderCardAppAdapter key={top.id} orderId={top.id} onOpenCustomer={openCustomer} onClose={pop}/>:<CustomerCardAppAdapter key={top.id} customerId={top.id} onOpenOrder={openOrder} onClose={pop}/>}</div>}
