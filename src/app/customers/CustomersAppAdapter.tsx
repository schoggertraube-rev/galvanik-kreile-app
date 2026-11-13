"use client";

import { useEffect, useMemo, useState } from "react";
import {captureDeviceReadFence,retainDevicePortResponse,readDevicePortResponse} from '@/lib/offline/devicePortRead';
import {foldSearchText,nameSearchAlternative} from '@/lib/domain/searchText';
import {SEARCH_NAME_MATCH_COPY} from '@/ui/situationCatalog';
import { getCustomersDb } from "@/app/actions/customers.actions";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { CustomerListItem, CustomersViewState } from "@/modules/customers/public";
import { Button, Kundenzeile, SeitenKopf, SuchFeld, Zustand,Hinweis } from "@/ui/kr";

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("de-DE");
}

function matchesFilter(customer: CustomerListItem, query: string,folded=false) {
  return (folded?foldSearchText:normalize)([customer.customerNumber, customer.name, customer.type, customer.city ?? "",customer.contactPerson??'',customer.email??'',...(customer.hints?.map(hint=>hint.text)??[])].join(" ")).includes((folded?foldSearchText:normalize)(query));
}

function customerNumberLabel(customerNumber: string) {
  const value = customerNumber.trim();
  return /^(?:[0-9a-f]{8}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.test(value) ? null : value || null;
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)?.[0] ?? ""}` : words[0]?.slice(0, 2) ?? "K").toLocaleUpperCase("de-DE");
}

export function CustomersAppAdapter() {
  const openCustomer = useOverlayStore((state) => state.openCustomer);
  const { canAction, loading: permissionsLoading,offlineScope,offline24h } = usePermissions();
  const [state, setState] = useState<CustomersViewState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [fromDevice,setFromDevice]=useState(false);

  useEffect(() => {
    let active = true;
    let loadRevision=0;
    const load = async () => {
      const revision=++loadRevision;
      setState({ kind: "loading" });
      try {
        const device=!!(offline24h&&offlineScope&&navigator.onLine===false);
        let result:Awaited<ReturnType<typeof getCustomersDb>>;
        if(device&&offlineScope){
          const read=await readDevicePortResponse(offlineScope,true,{port:'customers.list',objectId:'customers'});
          if(read.code!=='OK'||read.value.port!=='customers.list')throw Error('OFFLINE_CUSTOMER_LIST_SOURCE_INCOMPLETE');
          result=read.value.response.result;
        }else{
          const fence=offlineScope?await captureDeviceReadFence(offlineScope,offline24h):null;
          result=await getCustomersDb();
          if(!active||revision!==loadRevision)return;
          if(offline24h&&offlineScope&&result.serverReadAt&&result.cacheLoginScope&&(result.ok||result.error==='FORBIDDEN'||result.error==='UNAUTHORIZED'))await retainDevicePortResponse(offlineScope,true,{port:'customers.list',portVersion:1,objectId:'customers',serverReadAt:result.serverReadAt,sourceLoginScope:result.cacheLoginScope,response:{result:result.ok?{ok:true,data:result.data}:{ok:false,error:result.error,message:result.message},datenluecken:[]}},fence);
        }
        if(!active||revision!==loadRevision)return;
        setFromDevice(device);
        if (!result.ok) {
          setState(
            result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN"
              ? { kind: "denied", message: "Kundenstamm ist für diese Sitzung nicht freigegeben." }
              : result.error === "CONFLICT"
                ? { kind: "conflict", message: "Kundenstand hat sich geändert. Bitte neu laden." }
                : { kind: "error", message: "Kundenstamm konnte nicht sicher geladen werden." },
          );
          return;
        }
        setState({
          kind: "data",
          customers: result.data.map((customer) => ({
            id: customer.id,
            customerNumber: customer.customerNumber,
            name: customer.name,
            type: customer.type,
            city: customer.city ?? null,
            activeOrderCount: customer.activeOrderCount,
            activeQuoteCount:customer.activeQuoteCount,contactPerson:customer.contactPerson,email:customer.email,hints:customer.hints,complete:customer.complete,
          })),
        });
      } catch(error) {
        console.error('[CUSTOMER_LIST_READ_FAILED]',error);
        if (active&&revision===loadRevision) setState({ kind: "error", message: "Kundenstamm konnte nicht sicher geladen werden." });
      }
    };
    void load();
    window.addEventListener("kreile-sync-customers", load);
    window.addEventListener("online",load);
    return () => {
      active = false;
      window.removeEventListener("kreile-sync-customers", load);
      window.removeEventListener("online",load);
    };
  }, [offline24h,offlineScope]);

  const canCreate = !permissionsLoading && canAction("createCustomer");
  const customers = useMemo(() => state.kind === "data"
    ? state.customers.filter((customer) => matchesFilter(customer, query,fromDevice)||fromDevice&&nameSearchAlternative(customer.name,query)!==null)
    : [], [query, state,fromDevice]);
  const createAction = canCreate ? { text: "Kunde anlegen", icon: "plus" as const, onClick: () => requestGlobalCreate("CUSTOMER") } : undefined;

  if (state.kind === "loading") return <section data-testid="customers-v11">
    <SeitenKopf titel="Kunden & Kontakt" />
    <Zustand art="laedt" text="Kunden werden geladen." />
  </section>;

  if (state.kind !== "data") return <section data-testid="customers-v11">
    <SeitenKopf titel="Kunden & Kontakt" />
    <Zustand art={state.kind === "error" ? "fehler" : "gesperrt"} text={state.message} />
  </section>;

  if (state.customers.length === 0) return <section data-testid="customers-v11">
    <SeitenKopf titel="Kunden & Kontakt" />
    <Zustand art="leer" text="Noch keine Kunden." aktion={createAction} />
  </section>;

  return <section data-testid="customers-v11">
    <SeitenKopf titel="Kunden & Kontakt" werkzeug={createAction ? <Button art="primaer" icon={createAction.icon} text={createAction.text} onClick={createAction.onClick} /> : undefined} />
    <div className="kr-stapel">
      <SuchFeld wert={query} onWert={setQuery} platzhalter="Name, Ort, Auftrag oder Stichwort" />
      {customers.length ? <div className="kr-stapel" style={{ gap: 8 }}>
        {customers.map((customer) => <div key={customer.id} className="kr-stapel" style={{gap:4}} data-customer-id={customer.id}><Kundenzeile
          kuerzel={initials(customer.name)}
          name={customer.name}
          meta={[customerNumberLabel(customer.customerNumber),customer.contactPerson,customer.city, fromDevice&&!matchesFilter(customer,query,true)?SEARCH_NAME_MATCH_COPY[nameSearchAlternative(customer.name,query)!]:null, `${customer.activeOrderCount} ${customer.activeOrderCount === 1 ? "aktiver Auftrag" : "aktive Aufträge"}`,customer.activeQuoteCount!==undefined?`${customer.activeQuoteCount} KV`:null].filter(Boolean).join(" · ")}
          hinweis={Boolean(customer.hints?.length)}
          karte
          onOeffnen={() => openCustomer(customer.id)}
        />{customer.hints?.length?<Hinweis ton="warn"><span aria-label="Kundenhinweise">{customer.hints.map((hint,index)=><span key={hint.kind+':'+index} style={hint.urgent?{color:'var(--ral)'}:undefined}>{index?' · ':''}{hint.text}</span>)}</span></Hinweis>:null}</div>)}
      </div> : <Zustand art="leer" text={`Kein Kunde für „${query}“.`} />}
    </div>
  </section>;
}
