"use client";
import { Search, ArrowRight, ClipboardList } from "lucide-react";
import type { OrdersQueryPort, OrdersViewState } from "../server/types";
import styles from "./orders.module.css";

function normalized(value:string){return value.trim().toLocaleLowerCase("de")}
export function OrdersView({state,query,onOpenOrder}:{state:OrdersViewState;query:OrdersQueryPort;onOpenOrder:(id:string)=>void}){
  if(state.kind==="loading")return <section className={styles.state} aria-busy="true" role="status"><h1>Aufträge werden geladen</h1></section>;
  if(state.kind!=="data")return <section className={styles.state} role={state.kind==="error"?"alert":"status"}><h1>{state.kind==="denied"?"Aufträge nicht freigegeben":state.kind==="conflict"?"Auftragsstand nicht eindeutig":"Aufträge nicht verfügbar"}</h1><p>{state.message}</p></section>;
  const needle=normalized(query.value);const orders=needle?state.orders.filter(o=>normalized([o.orderNumber,o.customerName,o.title,o.station,o.status,o.material??"",o.surface??""].join(" ")).includes(needle)):state.orders;
  return <section className={styles.listScreen} aria-labelledby="orders-title">
    <header className={styles.listHero}><div><p>Auftragsbestand</p><h1 id="orders-title">Aufträge</h1><span>Reale Aufträge nach Kunde, Nummer, Material, Oberfläche und Status.</span></div><strong aria-label={`${orders.length} Aufträge`}>{orders.length}</strong></header>
    <label className={styles.filter}><Search aria-hidden="true"/><span className="sr-only">Aufträge filtern</span><input value={query.value} onChange={e=>query.onChange(e.target.value)} placeholder="Auftrag, Kunde, Material oder Oberfläche"/></label>
    {orders.length===0?<div className={styles.empty} role="status"><ClipboardList/><h2>{state.orders.length===0?"Noch keine Aufträge erfasst":"Kein belegter Auftrag passt zu diesem Filter."}</h2><p>{state.orders.length===0?"Ein neuer Auftrag erscheint hier, sobald er sicher gespeichert ist.":"Filter ändern oder den vollständigen Auftragsbestand anzeigen."}</p></div>:<ol className={styles.orderList}>{orders.map(order=><li key={order.id}><button type="button" onClick={()=>onOpenOrder(order.id)}><span className={styles.listRisk} data-risk={order.risk}/><span><small>{order.orderNumber}</small><strong>{order.customerName}</strong><em>{order.title}</em></span><span><b>{order.station}</b><small>{order.dueAt?new Date(order.dueAt).toLocaleDateString("de-DE"):"Kein Termin"}</small></span><ArrowRight/></button></li>)}</ol>}
  </section>
}
