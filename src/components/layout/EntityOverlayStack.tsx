"use client";
import { useOverlayStore } from "@/lib/overlayStore";
import { OrderCardAppAdapter } from "@/app/orders/OrderCardAppAdapter";
import { CustomerCardAppAdapter } from "@/app/customers/CustomerCardAppAdapter";
export function EntityOverlayStack(){const stack=useOverlayStore(s=>s.stack);const pop=useOverlayStore(s=>s.pop);const openOrder=useOverlayStore(s=>s.openOrder);const openCustomer=useOverlayStore(s=>s.openCustomer);const top=stack.at(-1);if(!top||(top.type!=="order"&&top.type!=="customer"))return null;if(top.type==="order")return <OrderCardAppAdapter key={top.id} orderId={top.id} onOpenCustomer={openCustomer} onClose={pop}/>;return <CustomerCardAppAdapter key={top.id} customerId={top.id} onOpenOrder={openOrder} onClose={pop}/>}
