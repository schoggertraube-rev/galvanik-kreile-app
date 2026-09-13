"use client";
import { useState } from "react";
import type { CustomersViewState } from "../server/types";
import styles from "./customers.module.css";
export function CustomersView({state,onOpenCustomer}:{state:CustomersViewState;onOpenCustomer:(customerId:string)=>void}){
 const [query,setQuery]=useState(""); const customers=state.kind==="data"?state.customers:[];
 const visible=(()=>{const q=query.trim().toLocaleLowerCase("de-DE");return q?customers.filter(c=>[c.customerNumber,c.name,c.type,c.city].some(v=>v?.toLocaleLowerCase("de-DE").includes(q))):customers})();
 return <section className={styles.page} aria-labelledby="customers-title"><header><div><p className={styles.eyebrow}>Kunden &amp; Kontakt</p><h1 id="customers-title">Kunden</h1></div><p>{customers.length} tenantgebundene Kunden</p></header><label className={styles.search}>Kunden filtern<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, Kundennummer oder Ort …"/></label>
 {state.kind==="loading"&&<p role="status" className={styles.notice}>Kunden werden geladen …</p>}{["denied","error","conflict"].includes(state.kind)&&<p role="alert" className={styles.notice}>{state.kind!=="data"&&state.kind!=="loading"?state.message:""}</p>}
 {state.kind==="data"&&visible.length===0&&<p className={styles.notice}>{customers.length===0?"Noch keine Kunden vorhanden.":"Keine Kunden passen zu diesem Filter."}</p>}
 {state.kind==="data"&&visible.length>0&&<div className={styles.grid}>{visible.map(c=><button key={c.id} onClick={()=>onOpenCustomer(c.id)}><span className={styles.avatar}>{c.name.slice(0,2).toUpperCase()}</span><span><strong>{c.name}</strong><small>{c.customerNumber} · {c.type}{c.city?` · ${c.city}`:""}</small></span><span aria-hidden="true">→</span></button>)}</div>}</section>
}
