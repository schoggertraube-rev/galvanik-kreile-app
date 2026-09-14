"use client";
import { ArrowRight, Search, Users } from "lucide-react";
import { useState } from "react";
import type { CustomersViewState } from "../server/types";
import styles from "./customers.module.css";
function normalize(value:string){return value.trim().toLocaleLowerCase("de")}
export function CustomersView({state,onOpenCustomer}:{state:CustomersViewState;onOpenCustomer:(id:string)=>void}){
  const[query,setQuery]=useState("");
  if(state.kind==="loading")return <section className={styles.state} aria-busy="true"><h1>Kunden werden geladen</h1></section>;
  if(state.kind!=="data")return <section className={styles.state} role={state.kind==="error"?"alert":"status"}><h1>{state.kind==="denied"?"Kunden nicht freigegeben":state.kind==="conflict"?"Kundenstand nicht eindeutig":"Kunden nicht verfügbar"}</h1><p>{state.message}</p></section>;
  const needle=normalize(query);const customers=needle?state.customers.filter(c=>normalize([c.customerNumber,c.name,c.type,c.city??""].join(" ")).includes(needle)):state.customers;
  return <section className={styles.listScreen} aria-labelledby="customers-title"><header className={styles.listHero}><div><p>Kunden & Kontakt</p><h1 id="customers-title">Kunden</h1><span>Realer Kundenstamm mit direktem Weg zur gemeinsamen Kundenkarte.</span></div><strong>{customers.length}</strong></header><label className={styles.filter}><Search/><span className="sr-only">Kunden filtern</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name, Kundennummer, Ort"/></label>{customers.length===0?<div className={styles.empty} role="status"><Users/><h2>Kein belegter Kunde passt zu diesem Filter.</h2><p>Filter ändern oder den vollständigen Kundenstamm anzeigen.</p></div>:<ol className={styles.customerList}>{customers.map(customer=><li key={customer.id}><button type="button" onClick={()=>onOpenCustomer(customer.id)}><span className={styles.monogram}>{customer.name.slice(0,2).toUpperCase()}</span><span><small>{customer.customerNumber}</small><strong>{customer.name}</strong><em>{customer.type}{customer.city?` · ${customer.city}`:""}</em></span><ArrowRight/></button></li>)}</ol>}</section>
}
