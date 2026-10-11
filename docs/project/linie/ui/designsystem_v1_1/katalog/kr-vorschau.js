/* Kreile-Designsystem V1.1 · kr-vorschau.js
   Vorschau-Spiegel der TSX-Komponenten (components/*.tsx) für Katalog und Kundenansicht ohne Build.
   Gleiche Klassen, gleiche Struktur. Quelle für den App-Bau sind die TSX-Dateien. Keine Daten hier. */
(function(){
'use strict';
const ICONS={
  sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8M21 20a6 6 0 0 0-4-5.6"/>',
  euro:'<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5"/><path d="M5 10.5h8M5 13.5h8"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4 12H1M23 12h-3M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
  inbox:'<path d="M4 13l2.5 5h11L20 13"/><path d="M4 13V5h16v8"/><path d="M9 9l3 3 3-3"/>',
  truck:'<path d="M3 6.5h11v9H3z"/><path d="M14 9.5h4l3 3v3h-7z"/><circle cx="7.5" cy="17" r="1.7"/><circle cx="17.5" cy="17" r="1.7"/>',
  alert:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chev:'<path d="M6 9l6 6 6-6"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  camera:'<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.4"/>',
  card:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14.5h4"/>',
  check:'<path d="M5 12l4.5 4.5L19 7"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  box:'<path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  handoff:'<circle cx="17" cy="7.5" r="3"/><path d="M12 20a5 5 0 0 1 10 0"/><path d="M2 12h7M6 9l3 3-3 3"/>',
  grid:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4"/>',
  lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  user:'<circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  flask:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/>',
  back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  open:'<path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
  droplet:'<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  flag:'<path d="M6 21V4h12l-2.5 4L18 12H6"/>',
  phone:'<path d="M15.8 21A13.5 13.5 0 0 1 3 8.2 2.4 2.4 0 0 1 5.4 6h1.9L9 9.6 7 11a10 10 0 0 0 6 6l1.4-2 3.6 1.7v1.9A2.4 2.4 0 0 1 15.8 21z"/>',
  file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12.5h6M9 16h6"/>',
  receipt:'<path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21z"/><path d="M9.5 8.5h5M9.5 12.5h5"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  photo:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.7"/><path d="M4 18l5-5 3.5 3L16 13l4 4"/>',
  photooff:'<path d="M3.5 4.2l16.3 16.3"/><path d="M5 6.5V19h13"/><circle cx="9" cy="10.2" r="1.4"/>',
  edit:'<path d="M5 19h4L20 8l-4-4L5 15z"/>',
  send:'<path d="M4.5 12l15.5-7.5-6 15-2.8-5.4z"/>',
  msg:'<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
  checkc:'<circle cx="12" cy="12" r="9"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  scan:'<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
  more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  logout:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>'
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const at=o=>o?Object.entries(o).filter(([,v])=>v!==undefined&&v!==false).map(([k,v])=>v===true?` ${k}`:` ${k}="${esc(v)}"`).join(''):'';
const i=n=>`<svg class="kr-i" aria-hidden="true" viewBox="0 0 24 24">${ICONS[n]||''}</svg>`;

function btn({text='',art,icon,attrs,disabled,label}={}){
  const cls=['kr-btn',art&&`kr-btn--${art}`,!text&&'kr-btn--icon'].filter(Boolean).join(' ');
  return `<button type="button" class="${cls}"${at({...attrs,disabled,'aria-label':label||(!text?attrs?.title:undefined)})}>${icon?i(icon):''}${esc(text)}</button>`;
}
const chip=(text,ton,icon)=>`<span class="kr-chip${ton?' kr-chip--'+ton:''}">${icon?i(icon):''}${esc(text)}</span>`;
const punkt=ton=>`<span class="kr-punkt${ton?' kr-punkt--'+ton:''}"></span>`;

/* Zustand: laedt · leer · fehler · gesperrt  (klaerung/aufbau → Ausgrau) */
function zustand({art='leer',text,aktion}={}){
  const std={laedt:'Wird geladen …',leer:'Keine Einträge.',fehler:'Konnte nicht geladen werden.',gesperrt:'Kein Zugriff · vom Admin gesperrt'};
  const ic=art==='laedt'?'<span class="kr-drehen"></span>':i(art==='fehler'?'alert':art==='gesperrt'?'lock':'check');
  return `<div class="kr-zustand kr-zustand--${art}" role="${art==='fehler'?'alert':'status'}">${ic}<span class="kr-zustand-text">${esc(text||std[art])}</span>${aktion?btn({art:art==='fehler'?'sekundaer':'primaer',icon:art==='fehler'?'refresh':aktion.icon,...aktion}):''}</div>`;
}
function ausgrau({art='aufbau',text,icon,variante}={}){
  const tag=art==='klaerung'?'In Klärung':'In Aufbau';
  return `<div class="kr-ausgrau kr-ausgrau--${art}${variante?' kr-ausgrau--'+variante:''}" aria-disabled="true">${i(icon||(art==='klaerung'?'clock':'lock'))}<span class="kr-ausgrau-text">${esc(text)}</span><span class="kr-ausgrau-tag">${tag}</span></div>`;
}
function mitZustand(z,daten,o={}){
  if(!z||z==='daten')return daten;
  if(z==='klaerung'||z==='aufbau')return ausgrau({art:z,text:o.titel||o.text||'Funktion'});
  return zustand({art:z,text:o[z+'Text'],aktion:o[z+'Aktion']});
}

/* Handlungsbedarf */
const HB_LABEL={konflikt:['Konflikt','rot'],warnung:['Warnung','warn'],entscheidung:['Entscheidung','info']};
function hbEintrag(e,geraet){
  const [lbl,ton]=HB_LABEL[e.art]||HB_LABEL.warnung;
  const handy=geraet==='handy';
  const titel=(handy&&e.titelKurz)||e.titel;
  const aktionen=(e.aktionen||[]);
  let aHtml='';
  if(e.status)aHtml=`<span class="kr-hb-status${e.statusTon?' kr-hb-status--'+e.statusTon:''}">${e.statusTon==='laedt'?'<span class="kr-drehen"></span>':i(e.statusIcon||'clock')}${esc(e.status)}</span>`;
  else if(e.fokus){
    /* V1.1 B1: genau eine Hauptaktion + „Später“ + weitere */
    const sp=aktionen.find(a=>a.text==='Später'),haupt=aktionen[0],andere=aktionen.slice(1).filter(a=>a!==sp);
    aHtml=btn({...haupt,art:haupt.art||'erledigen',text:handy?(haupt.kurz||haupt.text):haupt.text});
    if(sp)aHtml+=btn({...sp,art:'leise'});
    if(andere.length)aHtml+=btn({text:'Weitere',icon:'more',art:'leise',attrs:{...e.mehrAttrs}}); /* Owner 2026-09-27: keine Auswahl im Fokus */
  }
  else{
    const zeig=handy?aktionen.slice(0,1).map(a=>({...a,text:a.kurz||a.text})):aktionen;
    aHtml=zeig.map((a,n)=>btn({art:n===0?(a.art||'erledigen'):(a.art||'leise'),...a})).join('');
    if(handy&&aktionen.length>1)aHtml+=btn({icon:'more',art:'leise',label:'Weitere Aktionen',attrs:{...e.mehrAttrs,title:'Weitere Aktionen'}});
  }
  const cls=['kr-hb-eintrag','kr-hb-eintrag--'+e.art,e.fokus&&'kr-fokus',e.fokusNeu&&'kr-fokus--neu',e.gewaehlt&&'kr-hb-eintrag--gewaehlt'].filter(Boolean).join(' ');
  const h=`<div class="${cls}"${at(e.attrs)}>${punkt()}<div class="kr-hb-main"><div class="kr-hb-titel">${e.id&&!handy?`<span class="kr-id">${esc(e.id)}</span>`:''}${esc(titel)}</div><div class="kr-hb-meta">${chip(e.von?'von '+e.von:lbl,e.von?'info':ton,e.von?'user':undefined)}${e.id&&handy?`<span class="kr-id">${esc(e.id)}</span> · `:''}${esc((handy&&e.metaKurz)||e.meta||'')}</div></div><div class="kr-hb-aktionen">${aHtml}</div></div>`;
  /* V1.1 B5: Wischen nur Touch, nur zusätzlich; nie für Freigaben/Geld (e.wisch fehlt dann) */
  if(!e.wisch||e.status||geraet==='desktop')return h;
  return `<div class="kr-wisch" data-wisch="${esc(e.wisch.k)}"><div class="kr-wisch-bg"><span>${i('check')}${esc(e.wisch.rechts)}</span><span>Später ${i('clock')}</span></div>${h}</div>`;
}
function hbListe({eintraege=[],label,zustand:z,geraet,max,offen,fokus}={}){
  if(z&&z!=='daten')return `<section class="kr-hb" aria-label="Handlungsbedarf">${label?`<h2 class="kr-hb-label">${i('clock')}${esc(label)}</h2>`:''}${mitZustand(z,'',{titel:'Handlungsbedarf',leerText:'Nichts Dringendes.',fehlerText:'Handlungsbedarf konnte nicht geladen werden.',fehlerAktion:{text:'Erneut laden'}})}</section>`;
  if(!eintraege.length&&!label)return ''; // nichts dringend → Block entfällt (§6.1)
  if(fokus){const f=eintraege.find(e=>!e.status);if(f)eintraege=[{...f,fokus:true},...eintraege.filter(e=>e!==f)];}
  /* Owner 2026-09-27: Konflikte werden nie eingeklappt, nur Entscheidungen und Warnungen */
  const sicht=max&&eintraege.length>max?eintraege.filter((e,n)=>e.art==='konflikt'||n<max):eintraege;
  const restE=eintraege.filter(e=>!sicht.includes(e));
  const klapp=restE.length?`<div class="kr-klapp${offen?' kr-klapp--offen':''}" data-klapp><div>${restE.map(e=>hbEintrag(e,geraet)).join('')}</div></div><button type="button" class="kr-hb-mehr" data-hb-alle aria-expanded="${!!offen}"><span data-mehr-text>${offen?'weniger':restE.length+' weitere'}</span>${i('chev')}</button>`:'';
  return `<section class="kr-hb" aria-label="Handlungsbedarf">${label?`<h2 class="kr-hb-label">${i('clock')}${esc(label)}</h2>`:''}${sicht.map(e=>hbEintrag(e,geraet)).join('')}${klapp}</section>`;
}

/* Zeilen */
function zeile({punkt:p,vorne,id,titel,meta,seite,attrs,klick,karte}={}){
  const tag=klick?'button':'div';
  return `<${tag}${klick?' type="button"':''} class="kr-zeile${karte?' kr-zeile--karte':''}"${at(attrs)}>${vorne||punkt(p)}<div class="kr-zeile-main"><div class="kr-zeile-t">${id?`<span class="kr-id">${esc(id)}</span>`:''}${esc(titel)}</div>${meta?`<div class="kr-zeile-s">${esc(meta)}</div>`:''}</div><div class="kr-zeile-seite">${seite||''}</div></${tag}>`;
}
const auftragszeile=a=>zeile({punkt:a.ton,id:a.id,titel:`${a.kunde} · ${a.titel}`,meta:a.meta,seite:(a.chip?chip(a.chip,a.chipTon):'')+(a.aktion?btn({art:'sekundaer',...a.aktion}):'')+(a.pfeil?i('arrow'):''),attrs:a.attrs,klick:a.klick,karte:a.karte});
const kundenzeile=k=>zeile({vorne:`<span class="kr-av">${esc(k.kuerzel)}</span>`,titel:k.name,meta:k.meta,seite:(k.chips||[]).map(c=>chip(c[0],c[1])).join('')+(k.pfeil?i('arrow'):''),attrs:k.attrs,klick:k.klick,karte:k.karte});
const TERMIN_TON={Wunsch:'warn',bestätigt:'ok',verschoben:'rot',Abholung:'info',Versand:'info',Betrieb:''};
const terminzeile=t=>zeile({vorne:`<span class="kr-zeit">${esc(t.zeit)}</span>`,id:t.id,titel:t.kunde,meta:t.meta,seite:chip(t.art,TERMIN_TON[t.art]),attrs:t.attrs,klick:t.klick});
const abwesenheitszeile=a=>zeile({vorne:`<span class="kr-av">${esc(a.kuerzel)}</span>`,titel:a.person,meta:a.zeitraum,seite:chip(a.art,'info','calendar'),attrs:a.attrs});

/* Kachel */
function kachel({titel,icon,icTon,zahl,inhalt,fuss,zustand:z,zText={}}={}){
  const body=z&&z!=='daten'?mitZustand(z,'',{titel,...zText}):inhalt;
  return `<section class="kr-kachel"><header class="kr-kachel-kopf"><h2 class="kr-kachel-titel">${icon?`<span class="kr-kachel-ic${icTon?' kr-kachel-ic--'+icTon:''}">${i(icon)}</span>`:''}${esc(titel)}</h2>${zahl!=null&&(!z||z==='daten')?`<span class="kr-kachel-zahl">${esc(zahl)}</span>`:''}</header><div class="kr-kachel-inhalt">${body}</div>${fuss&&(!z||z==='daten')?`<button type="button" class="kr-kachel-fuss"${at(fuss.attrs)}>${esc(fuss.text)} ${i('arrow')}</button>`:''}</section>`;
}
function buendel({titel,meta,aktion,zustand:z}={}){
  if(z&&z!=='daten')return mitZustand(z,'',{titel:'Bündel-Vorschlag',leerText:'Kein Bündel möglich.'});
  return `<div class="kr-buendel">${i('layers')}<div><div class="kr-buendel-t">${titel}</div>${meta?`<div class="kr-buendel-s">${esc(meta)}</div>`:''}</div>${aktion?btn({art:'sekundaer',icon:'layers',...aktion}):''}</div>`;
}
function wip({zahl,meta,attrs,zustand:z}={}){
  if(z&&z!=='daten')return mitZustand(z,'',{titel:'In Arbeit',leerText:'Nichts in Arbeit.'});
  return `<button type="button" class="kr-wip"${at(attrs)}>${i('flask')}<span><span class="kr-wip-t">In Arbeit<span class="kr-wip-zahl">${esc(zahl)}</span></span>${meta?`<span class="kr-wip-s" style="display:block">${esc(meta)}</span>`:''}</span><span class="kr-wip-go">${i('arrow')}</span></button>`;
}
const treffer=t=>`<button type="button" class="kr-treffer"${at(t.attrs)}>${punkt(t.ton)}<span style="min-width:0"><span class="kr-treffer-t" style="display:block">${t.id?`<span class="kr-id">${esc(t.id)}</span> `:''}${esc(t.titel)}</span><span class="kr-treffer-grund" style="display:block">${t.grund}</span></span>${chip(t.quelle,'info')}</button>`;

/* Formular */
const feld=({label,html,fehler,voll,cls})=>`<label class="kr-feld${fehler?' kr-feld--fehler':''}${voll?' kr-voll':''}${cls?' '+cls:''}"><span class="kr-feld-label">${esc(label)}</span>${html}${fehler?`<span class="kr-feld-fehler">${esc(fehler)}</span>`:''}</label>`;
const eingabe=a=>`<input class="kr-eingabe"${at(a)}>`;
const auswahl=(opts,a,wert)=>`<select class="kr-auswahl"${at(a)}>${opts.map(o=>{const [v,t,dis]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}"${v===wert?' selected':''}${dis?' disabled':''}>${esc(t)}</option>`}).join('')}</select>`;
const textfeld=(a,wert)=>`<textarea class="kr-textfeld"${at(a)}>${esc(wert)}</textarea>`;
const check=(text,a)=>`<label class="kr-check"><input type="checkbox"${at(a)}><span>${text}</span></label>`;
const segment=(opts,aktiv,a)=>`<div class="kr-segment" role="group"${at(a)}>${opts.map(o=>{const [v,t,dis]=Array.isArray(o)?o:[o,o];return `<button type="button" data-wert="${esc(v)}" aria-pressed="${v===aktiv}"${dis?' disabled':''}>${esc(t)}</button>`}).join('')}</div>`;

/* Dialog · Toast · Picker */
function dialog({titel,icon='file',inhalt='',fuss='',groesse,zurueck,attrs,schliessenAttrs}={}){
  return `<div class="kr-ebene"${at(attrs)}><section class="kr-dialog${groesse?' kr-dialog--'+groesse:''}" role="dialog" aria-modal="true" aria-label="${esc(titel)}"><header class="kr-dialog-kopf">${zurueck?btn({icon:'back',art:'leise',label:'Zurück',attrs:zurueck}):''}<span class="kr-dialog-ic">${i(icon)}</span><h2 class="kr-dialog-titel">${esc(titel)}</h2>${btn({icon:'x',art:'leise',label:'Schließen',attrs:{title:'Schließen',...schliessenAttrs}})}</header><div class="kr-dialog-inhalt">${inhalt}</div>${fuss?`<footer class="kr-dialog-fuss">${fuss}</footer>`:''}</section></div>`;
}
const toast=({text,aktion})=>`<div class="kr-toast" role="status">${i('check')}<span>${text}</span>${aktion?btn({...aktion}):''}</div>`;
function picker({suche='Auftragsnummer, Teil oder Oberfläche',wert='',optionen=[],zustand:z,scan=true,sucheAttrs}={}){
  const liste=z&&z!=='daten'?mitZustand(z,'',{titel:'Auswahl',leerText:'Kein passender Auftrag.'}):`<div class="kr-wahl-liste">${optionen.map(o=>`<button type="button" class="kr-wahl"${at({...o.attrs,disabled:o.gesperrt})}><span style="min-width:0"><span class="kr-zeile-t" style="font-size:14px;display:block">${o.id?`<span class="kr-id">${esc(o.id)}</span>`:''}${esc(o.titel)}</span><span class="kr-zeile-s" style="display:block">${esc(o.meta||'')}</span></span><span style="display:flex;gap:8px;align-items:center">${o.chip?chip(o.chip,o.chipTon):''}${o.gesperrt?i('lock'):i('arrow')}</span></button>`).join('')}</div>`;
  return `<div class="kr-picker-werkzeug"><label class="kr-suchfeld">${i('search')}<input placeholder="${esc(suche)}" value="${esc(wert)}" autocomplete="off"${at(sucheAttrs)}></label>${scan?btn({text:'Scannen',icon:'scan',art:'sekundaer',attrs:{'data-scan':''}}):''}</div>${liste}`;
}

/* Shell */
const NAV_BUERO=[
  {gruppe:'schnell',id:'eingang',text:'Neuer Eingang',icon:'inbox'},
  {gruppe:'schnell',id:'raus',text:'Ware raus',icon:'truck'},
  {trenner:true},
  {id:'tag',text:'Der Tag',icon:'sun'},
  {id:'werkstatt',text:'Werkstatt',icon:'flask'},
  {id:'auftraege',text:'Aufträge',icon:'list'},
  {id:'kunden',text:'Kunden & Kontakt',icon:'users'},
  {id:'geld',text:'Geld & Rechnungen',icon:'euro'},
  {trenner:true,unten:true},
  {id:'einstellungen',text:'Einstellungen',icon:'settings'}
];
const DOCK=[{id:'tag',text:'Der Tag',icon:'sun'},{id:'auftraege',text:'Aufträge',icon:'list'},{id:'kunden',text:'Kunden',icon:'users'},{id:'geld',text:'Geld',icon:'euro'},{id:'mehr',text:'Mehr',icon:'grid'}];
const AKTIONEN=[
  {id:'oeffnen',text:'Auftrag öffnen / scannen',kurz:'Öffnen',icon:'open',primaer:true},
  {id:'mehrarbeit',text:'Mehrarbeit',kurz:'Mehrarbeit',icon:'layers'},
  {id:'fertig',text:'Fertig melden',kurz:'Fertig',icon:'check'},
  {id:'eingang',text:'Neuer Eingang',kurz:'Eingang',icon:'inbox',ruhig:true},
  {id:'raus',text:'Ware raus',kurz:'Raus',icon:'truck',ruhig:true}
];
function kopf({geraet,kuerzel,suchePh,datum,werkstatt}){
  return `<header class="kr-kopf"><button type="button" class="kr-marke" data-nav="start" aria-label="Startseite"><span class="kr-logo">GK</span><span class="kr-marke-name">KREILE</span></button><button type="button" class="kr-suche" data-aktion="suche">${i('search')}<span class="kr-suche-ph">${esc(suchePh||'Auftrag, Kunde oder Nummer suchen')}</span><span class="kr-suche-kbd">${werkstatt?'scannen':'Strg K'}</span></button>${datum&&geraet==='desktop'?`<span class="kr-datum">${datum}</span>`:''}<button type="button" class="kr-plus" data-aktion="plus" aria-label="Neu anlegen">${i('plus')}</button><button type="button" class="kr-avatar" data-aktion="konto" aria-label="Konto">${esc(kuerzel)}</button></header>`;
}
function appShell({geraet='desktop',variante='buero',aktiv='tag',badges={},inhalt='',kuerzel='RK',datum,suchePh,nav=NAV_BUERO,dock=DOCK,ausgeblendet=[],ebene=''}={}){
  const streifen='<div class="kr-streifen"></div>';
  if(variante==='werkstatt'){
    const leiste=`<nav class="kr-aktionsleiste" aria-label="Werkstatt-Aktionen">${AKTIONEN.map(a=>`<button type="button" class="kr-aktion${a.primaer?' kr-aktion--primaer':''}${a.ruhig?' kr-aktion--ruhig':''}" data-aktion="${a.id}">${i(a.icon)}${esc(geraet==='handy'?a.kurz:a.text)}</button>`).join('')}</nav>`;
    return `${streifen}<div class="kr-tshell kr-wshell">${kopf({geraet,kuerzel,suchePh:suchePh||'Auftrag oder Nummer suchen',werkstatt:true})}<main class="kr-inhalt">${inhalt}</main>${leiste}</div>${ebene}`;
  }
  if(geraet==='desktop'){
    const side=nav.filter(n=>!ausgeblendet.includes(n.id)).map(n=>{
      if(n.trenner)return `<div class="kr-nav-trenner${n.unten?' kr-nav-unten':''}"></div>`;
      if(n.ausgrau)return ausgrau({art:n.ausgrau,text:n.text,icon:n.icon,variante:'nav'});
      const b=badges[n.id];
      return `<button type="button" class="kr-nav${n.gruppe==='schnell'?' kr-nav--schnell':''}${aktiv===n.id?' kr-nav--aktiv':''}" data-nav="${n.id}"${aktiv===n.id?' aria-current="page"':''}>${i(n.icon)}<span>${esc(n.text)}</span>${b?`<span class="kr-nav-badge${b.rot?' kr-nav-badge--rot':''}">${esc(b.n)}</span>`:''}</button>`;
    }).join('');
    return `${streifen}<div class="kr-shell">${kopf({geraet,kuerzel,suchePh,datum}).replace('<header class="kr-kopf">','<header class="kr-kopf">')}<nav class="kr-seitenleiste kr-scroll" aria-label="Hauptnavigation">${side}</nav><main class="kr-inhalt">${inhalt}</main></div>${ebene}`;
  }
  const d=`<nav class="kr-dock" aria-label="Hauptnavigation">${dock.map(n=>{const b=badges[n.id];return `<button type="button" class="kr-dock-el${aktiv===n.id?' kr-dock-el--aktiv':''}" data-nav="${n.id}">${i(n.icon)}${esc(n.text)}${b&&b.rot?`<span class="kr-dock-badge">${esc(b.n)}</span>`:''}</button>`}).join('')}</nav>`;
  return `${streifen}<div class="kr-tshell">${kopf({geraet,kuerzel,suchePh})}<main class="kr-inhalt">${inhalt}</main>${d}</div>${ebene}`;
}
const seitenKopf=(titel,werkzeug)=>`<div class="kr-seite-kopf"><h1 class="kr-seite-titel">${esc(titel)}</h1>${werkzeug?`<div class="kr-seite-werkzeug">${werkzeug}</div>`:''}</div>`;

/* Karte */
function kette(schritte){return `<div class="kr-kette">${schritte.map(s=>`<${s.klick?'button type="button"':'div'} class="kr-schritt kr-schritt--${s.st}${s.schwelle?' kr-schwelle'+(s.frei?' kr-schwelle--frei':''):''}"${at(s.attrs)}><span class="kr-schritt-dot">${i(s.icon)}</span><span class="kr-schritt-lbl">${esc(s.lbl)}</span>${s.sub?`<span class="kr-schritt-st">${esc(s.sub)}</span>`:''}${s.balken!=null?`<span class="kr-schritt-balken" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(s.balken*100)}"><i style="width:${Math.round(s.balken*100)}%"></i></span>`:''}</${s.klick?'button':'div'}>`).join('')}</div>`}
function verlauf(el){return `<div class="kr-verlauf">${el.map(e=>`<div class="kr-verlauf-el"><span class="kr-verlauf-d${e.ton?' kr-verlauf-d--'+e.ton:''}">${i(e.icon||'check')}</span><div><div class="kr-verlauf-z">${esc(e.zeit)}</div><div class="kr-verlauf-t">${esc(e.text)}</div></div></div>`).join('')}</div>`}
const fakten=f=>`<div class="kr-fakten">${f.map(([k,v,st])=>`<div class="kr-fakt"><span>${esc(k)}</span><b${st?` style="color:var(--${st})"`:''}>${v}</b></div>`).join('')}</div>`;
const block=(label,inhalt,rechts)=>`<div class="kr-block">${label?`<h3 class="kr-block-label">${esc(label)}${rechts||''}</h3>`:''}${inhalt}</div>`;

/* Lage-Leiste: Filter nach Art + Firmengesundheit (Termintreue · Liquidität 30 Tage) */
function lage({zaehler={},filter='alle',gesund=[]}={}){
  const f=[['konflikt','Konflikte','rot'],['entscheidung','Entscheidungen','info'],['warnung','Warnungen','warn']].filter(([k])=>zaehler[k]).map(([k,t,ton])=>{const n=zaehler[k]||0;return `<button type="button" class="kr-lage-f" data-lage="${k}" aria-pressed="${filter===k}"${n?'':' disabled'}><span class="kr-punkt kr-punkt--${ton}"></span><b>${n}</b><span class="kr-lage-lbl">${t}</span></button>`}).join('');
  const g=gesund.map(x=>x.st==='aufbau'?`<span class="kr-gesund kr-gesund--aufbau" aria-disabled="true">${i(x.icon)}${esc(x.t).replace(' 30 Tage','<span class="kr-gesund-z"> 30 Tage</span>')}<span class="kr-ausgrau-tag">In Aufbau</span></span>`:`<button type="button" class="kr-gesund kr-gesund--${x.st}" data-a="gesund" data-arg="${esc(x.t)}">${i(x.icon)}${esc(x.t).replace(' 30 Tage','<span class="kr-gesund-z"> 30 Tage</span>')}<span class="kr-gesund-s">· ${esc(x.s)}</span></button>`).join('');
  return `<div class="kr-lage" role="region" aria-label="Lage"><div class="kr-lage-filter">${f}</div>${g?`<div class="kr-lage-gesund">${g}</div>`:''}</div>`;
}
/* V1.1 B2 Befehlspalette „Suchen oder tun“: Treffer (Grund + Quelle wie Suche) + Aktionen aus V1 */
function palette({wert='',treffer=[],aktionen=[],zustand:z,sel=-1,inAttrs,texte={}}={}){
  let n=-1;const s=()=>{n++;return n===sel?' aria-selected="true"':''};
  const tr=z&&z!=='daten'?mitZustand(z,'',{titel:'Suche',...texte}):treffer.length?`<div class="kr-palette-gr">Treffer</div><div class="kr-treffer-liste">${treffer.map(t=>treffer1(t,s())).join('')}</div>`:(wert?zustand({art:'leer',text:`Kein Treffer für „${wert}“.`}):'');
  const ak=aktionen.length?`<div class="kr-palette-gr">Tun</div>${aktionen.map(a=>`<button type="button" class="kr-tun" data-pal${s()}${at(a.attrs)}><span class="kr-tun-ic">${i(a.icon)}</span><span>${esc(a.text)}</span>${a.kbd?`<span class="kr-tun-kbd">${esc(a.kbd)}</span>`:''}</button>`).join('')}`:'';
  return `<section class="kr-palette" role="dialog" aria-modal="true" aria-label="Suchen oder tun"><label class="kr-palette-in">${i('search')}<input placeholder="Suchen oder tun" value="${esc(wert)}" autocomplete="off"${at(inAttrs)}>${btn({icon:'x',art:'leise',label:'Schließen',attrs:{title:'Schließen','data-a':'zu'}})}</label><div class="kr-palette-liste" data-pal-liste>${tr}${ak}</div></section>`;
}
const treffer1=(t,sel)=>treffer(t).replace('class="kr-treffer"','class="kr-treffer" data-pal'+sel);
/* V1.1 C1 Zeitstrahl „Heute & Woche“ */
function zeitstrahl({gruppen=[],jetzt,zustand:z,texte={}}={}){
  if(z&&z!=='daten')return mitZustand(z,'',{titel:'Heute & Woche',leerText:'Keine Termine und kein Warenausgang.',...texte});
  return `<div class="kr-zeitstrahl">${gruppen.map((g,gi)=>`<div class="kr-zeit-gr">${esc(g.titel)}</div>${gi===0&&jetzt?`<div class="kr-jetzt"><span>${esc(jetzt)}</span><i></i></div>`:''}${g.zeilen.map(r=>`<div class="kr-zeit-el kr-zeit-el--${r.ton||'info'}"><span class="kr-zeit-z">${esc(r.zeit)}</span><span class="kr-zeit-p"></span><button type="button" class="kr-zeit-t"${at(r.attrs)}><span>${r.id?`<span class="kr-id">${esc(r.id)}</span>`:''}${esc(r.titel)}</span>${r.meta?`<small>${esc(r.meta)}</small>`:''}</button><span class="kr-zeit-seite">${r.chip?chip(r.chip,r.chipTon):''}${r.aktion?btn({art:'sekundaer',...r.aktion}):''}</span></div>`).join('')}`).join('')}</div>`;
}
window.KR={palette,zeitstrahl,lage,ICONS,esc,at,i,btn,chip,punkt,zustand,ausgrau,mitZustand,hbEintrag,hbListe,zeile,auftragszeile,kundenzeile,terminzeile,abwesenheitszeile,kachel,buendel,wip,treffer,feld,eingabe,auswahl,textfeld,check,segment,dialog,toast,picker,appShell,seitenKopf,kette,verlauf,fakten,block,NAV_BUERO,DOCK,AKTIONEN};
})();
