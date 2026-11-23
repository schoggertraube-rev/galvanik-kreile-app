"use client";

import { useState, useTransition } from "react";
import { liesFahrzeugPflegeAction, speichereFahrzeugAction } from "@/app/actions/settings.actions";
import type { FahrzeugEingabe, FahrzeugPflege } from "@/modules/fundament/public";
import { FAHRZEUG_COPY as copy } from "@/ui/situationCatalog";
import styles from "./settings.module.css";

type Entwurf = Omit<FahrzeugEingabe,"startKm"> & { startKm: string };

export function FahrzeugeEditor() {
  const [pflege,setPflege] = useState<FahrzeugPflege>();
  const [entwurf,setEntwurf] = useState<Entwurf>();
  const [meldung,setMeldung] = useState("");
  const [pending,startTransition] = useTransition();

  function laden() {
    startTransition(async () => {
      const ergebnis = await liesFahrzeugPflegeAction().catch(() => ({code:"UNAVAILABLE" as const}));
      if (ergebnis.code === "OK") {
        setPflege(ergebnis.pflege);
        setMeldung("");
      } else {
        setMeldung(copy[ergebnis.code]);
      }
    });
  }

  function neu() {
    setEntwurf({id:crypto.randomUUID(),version:0,kennzeichen:"",art:"",kraftstoff:"",tankkarte:null,
      fahrerId:null,startKm:"",aktiv:true});
    setMeldung("");
  }

  function speichern() {
    if (!entwurf) return;
    if (!/^\d+$/.test(entwurf.startKm)) {
      setMeldung(copy.INVALID);
      return;
    }
    startTransition(async () => {
      const ergebnis = await speichereFahrzeugAction({...entwurf,startKm:Number(entwurf.startKm)})
        .catch(() => ({code:"UNAVAILABLE" as const}));
      if (ergebnis.code !== "OK") {
        setMeldung(copy[ergebnis.code]);
        return;
      }
      const fahrzeug = ergebnis.fahrzeug;
      setPflege(alt => alt && ({
        ...alt, fahrzeuge:[...alt.fahrzeuge.filter(eintrag=>eintrag.id!==fahrzeug.id),fahrzeug]
          .sort((a,b)=>Number(b.aktiv)-Number(a.aktiv) || a.kennzeichen.localeCompare(b.kennzeichen,"de")),
      }));
      setEntwurf({...fahrzeug,startKm:String(fahrzeug.startKm)});
      setMeldung(copy.gespeichert);
    });
  }

  const fahrer = pflege?.fahrer ?? [];
  return <details data-spec-id="firmendaten.fahrzeuge" onToggle={event=>{
    if (event.currentTarget.open && !pflege && !pending) laden();
  }}>
    <summary>{copy.titel}</summary>
    {meldung ? <p role="status">{meldung}</p> : null}
    {pflege ? <>
      <div className={styles.list}>
        {pflege.fahrzeuge.map(fahrzeug=><button type="button" key={fahrzeug.id} disabled={pending} onClick={()=>{
          setEntwurf({...fahrzeug,startKm:String(fahrzeug.startKm)});
          setMeldung("");
        }}>
          <strong>{fahrzeug.kennzeichen}</strong><span>{fahrzeug.aktiv ? fahrzeug.art : copy.inaktiv}</span>
        </button>)}
      </div>
      <button disabled={pending} type="button" onClick={neu}>{copy.anlegen}</button>
    </> : null}
    {entwurf ? <form onSubmit={event=>{event.preventDefault();speichern();}}>
      <fieldset disabled={pending} className={styles.grid}>
        <label>{copy.kennzeichen}<input required maxLength={24} value={entwurf.kennzeichen}
          onChange={event=>setEntwurf({...entwurf,kennzeichen:event.target.value})} /></label>
        <label>{copy.art}<input required maxLength={80} value={entwurf.art}
          onChange={event=>setEntwurf({...entwurf,art:event.target.value})} /></label>
        <label>{copy.kraftstoff}<input required maxLength={80} value={entwurf.kraftstoff}
          onChange={event=>setEntwurf({...entwurf,kraftstoff:event.target.value})} /></label>
        <label>{copy.tankkarte}<input maxLength={80} value={entwurf.tankkarte ?? ""}
          onChange={event=>setEntwurf({...entwurf,tankkarte:event.target.value || null})} /></label>
        <label>{copy.fahrer}<select aria-label={copy.fahrer} value={entwurf.fahrerId ?? ""}
          onChange={event=>setEntwurf({...entwurf,fahrerId:event.target.value || null})}>
          <option value="">{copy.ohneFahrer}</option>
          {entwurf.fahrerId && !fahrer.some(person=>person.id===entwurf.fahrerId)
            ? <option value={entwurf.fahrerId} disabled>{copy.fahrerInaktiv}</option> : null}
          {fahrer.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}
        </select></label>
        <label>{copy.startKm}<input required inputMode="numeric" value={entwurf.startKm}
          onChange={event=>setEntwurf({...entwurf,startKm:event.target.value})} /></label>
        <label className={styles.check}><input type="checkbox" checked={entwurf.aktiv}
          onChange={event=>setEntwurf({...entwurf,aktiv:event.target.checked})} />{copy.aktiv}</label>
      </fieldset>
      <button disabled={pending} type="submit">{copy.speichern}</button>
    </form> : null}
    <button disabled={pending} type="button" onClick={laden}>{copy.neuLaden}</button>
  </details>;
}
