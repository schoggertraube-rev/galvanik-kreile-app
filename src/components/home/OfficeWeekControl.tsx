'use client';

import {useState} from 'react';
import {formatEuro} from '@/lib/domain/formatEuro';
import {useOverlayStore} from '@/lib/overlayStore';
import {projectTodayProductionWeek,type TodayProductionPosition,type TodayProductionWeek} from '@/lib/today/todayDashboardPolicy';
import {PAGE_READ_COPY,TODAY_WEEK_COPY} from '@/ui/situationCatalog';
import {Button,Icon,Hinweis} from '@/ui/kr';
import {GlasDialog} from '@/ui/kr/design-final/GlasDialog';
import styles from './OfficeWeekControl.module.css';

export type ProductionWeekRead =
  | {code:'OK'; data:TodayProductionWeek}
  | {code:'UNAVAILABLE'|'UNAUTHENTICATED'|'VALIDATION_ERROR'};
type WeekLoad = ProductionWeekRead | {code:'LOADING'};
type WeekRetry = {initial:ProductionWeekRead; current:WeekLoad};
type PositionPeriod = {kind:'week'} | {kind:'day'|'through'; date:string};
type PositionSheet = {period:PositionPeriod; weekStart:string; opener:HTMLButtonElement; current:WeekLoad};
type OpenPositions = (period:PositionPeriod,opener:HTMLButtonElement)=>void;

const weekday = new Intl.DateTimeFormat('de-DE',{weekday:'long',timeZone:'UTC'});
const weekdayShort = new Intl.DateTimeFormat('de-DE',{weekday:'short',timeZone:'UTC'});
const shortDay = new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'short',timeZone:'UTC'});
const weekRange = new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const axisValue = new Intl.NumberFormat('de-DE',{notation:'compact',maximumFractionDigits:1});
const atNoon = (date:string) => new Date(date + 'T12:00:00Z');

function WeekChart({rows}: {rows:NonNullable<ReturnType<typeof projectTodayProductionWeek>>}) {
  const values = rows.flatMap(row => [row.netCents,row.runningCents]);
  const upper = Math.max(0,...values);
  const lower = Math.min(0,...values);
  const y = (cents:number) => 116 - 96 * (cents - lower) / Math.max(1,upper-lower);
  const x = (index:number) => rows.length===1 ? 218 : 61+327*index/(rows.length-1);
  const baseline = y(0);
  const ticks = [...new Set([lower,(lower+upper)/2,upper])];
  return <div className={styles.figure}>
    <div className={styles.legend}><span>{TODAY_WEEK_COPY.daily}</span><span>{TODAY_WEEK_COPY.running}</span></div>
    <svg className={styles.plot} viewBox="-54 0 479 150" role="img" aria-label={TODAY_WEEK_COPY.graph}>
      {ticks.map(value => <g key={value}>
        <line className={styles.axis} x1={38} x2={414} y1={y(value)} y2={y(value)} />
        <text x={30} y={y(value)+4} textAnchor="end">{axisValue.format(value/100)}</text>
      </g>)}
      {rows.map((row,index) => <g key={row.date}>
        <rect className={styles.daily} x={x(index)-14} y={Math.min(baseline,y(row.netCents))}
          width={28} height={Math.abs(y(row.netCents)-baseline)} rx={3} />
        <text x={x(index)} y={138} textAnchor="middle">{weekdayShort.format(atNoon(row.date)).replace('.','')}</text>
      </g>)}
      <polyline className={styles.running} points={rows.map((row,index) => x(index)+','+y(row.runningCents)).join(' ')} />
      {rows.map((row,index) => <circle key={row.date} className={styles.point} cx={x(index)} cy={y(row.runningCents)} r={4} />)}
    </svg>
  </div>;
}

function WeekValues({week,today,openPositions}: {week:TodayProductionWeek;today:string;openPositions?:OpenPositions}) {
  const rows = projectTodayProductionWeek(week,today);
  return <div className={styles.sheet}>
    <p>{TODAY_WEEK_COPY.source}</p>
    <section className={styles.summary}>
      <div className={styles.total}>
        <span>{TODAY_WEEK_COPY.total}</span>
        <strong>{openPositions ? <button type="button" className={styles.totalButton} aria-label={TODAY_WEEK_COPY.weekPositions}
          onClick={event=>openPositions({kind:'week'},event.currentTarget)}>{formatEuro(week.netCents)}</button> : formatEuro(week.netCents)}</strong>
        <small>{TODAY_WEEK_COPY.since}</small>
      </div>
      {rows?.length ? <WeekChart rows={rows}/> : null}
    </section>
    {rows?.length ? <div className={styles.ledger}>
      <table role="table">
        <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">{TODAY_WEEK_COPY.workday}</th><th role="columnheader" scope="col">{TODAY_WEEK_COPY.daily}</th><th role="columnheader" scope="col">{TODAY_WEEK_COPY.running}</th></tr></thead>
        <tbody role="rowgroup">{rows.map(row => <tr role="row" key={row.date} className={row.date===today?styles.current:undefined}>
          <th role="rowheader" scope="row">{openPositions ? <button type="button" className={styles.valueButton}
            onClick={event=>openPositions({kind:'day',date:row.date},event.currentTarget)}>
            {weekday.format(atNoon(row.date))}
            <small>{shortDay.format(atNoon(row.date))}{row.date===today?' · '+TODAY_WEEK_COPY.today:''}</small>
          </button> : <>{weekday.format(atNoon(row.date))}
            <small>{shortDay.format(atNoon(row.date))}{row.date===today?' · '+TODAY_WEEK_COPY.today:''}</small></>}
          </th>
          <td role="cell"><span className={styles.mobileLabel} aria-hidden="true">{TODAY_WEEK_COPY.daily}</span>{openPositions ? <button type="button" className={styles.valueButton}
            aria-label={TODAY_WEEK_COPY.dayPositions(weekday.format(atNoon(row.date)))}
            onClick={event=>openPositions({kind:'day',date:row.date},event.currentTarget)}>{formatEuro(row.netCents)}</button> : formatEuro(row.netCents)}</td>
          <td role="cell"><span className={styles.mobileLabel} aria-hidden="true">{TODAY_WEEK_COPY.running}</span>{openPositions ? <button type="button" className={styles.valueButton}
            aria-label={TODAY_WEEK_COPY.throughPositions(weekday.format(atNoon(row.date)))}
            onClick={event=>openPositions({kind:'through',date:row.date},event.currentTarget)}>{formatEuro(row.runningCents)}</button> : formatEuro(row.runningCents)}</td>
        </tr>)}</tbody>
      </table>
    </div> : null}
    <details><summary>{TODAY_WEEK_COPY.method}</summary><p>{TODAY_WEEK_COPY.methodBody}</p></details>
  </div>;
}

function positionHeading(period:PositionPeriod){
  if(period.kind==='week')return TODAY_WEEK_COPY.weekPositions;
  const day=weekday.format(atNoon(period.date));
  return period.kind==='day'?TODAY_WEEK_COPY.dayPositions(day):TODAY_WEEK_COPY.throughPositions(day);
}

function WeekPositionList({selection,retry}: {selection:PositionSheet;retry:()=>void}){
  const openOrder=useOverlayStore(state=>state.openOrder);
  const {current,period,weekStart}=selection;
  if(current.code==='LOADING')return <p role="status">{PAGE_READ_COPY.loading}</p>;
  const detail=current.code==='OK'&&current.data.weekStart===weekStart?current.data.positions:undefined;
  const days=new Map<string,TodayProductionPosition[]>();
  for(const position of detail?.rows??[]){
    const visible=period.kind==='week'||(period.kind==='day'?position.date===period.date:position.date<=period.date);
    if(!visible)continue;
    const rows=days.get(position.date)??[];
    rows.push(position);
    days.set(position.date,rows);
  }
  return <div className={styles.sheet}>
    {!detail?.complete ? <Hinweis ton="warn">{PAGE_READ_COPY.sourceIncomplete}
      <Button art="leise" text={PAGE_READ_COPY.reload} onClick={retry}/>
    </Hinweis> : days.size===0 ? <p>{TODAY_WEEK_COPY.noPositions}</p> : null}
    {[...days].map(([date,rows])=><section key={date} className={styles.positionDay}>
      <h3>{weekRange.format(atNoon(date))}</h3>
      <ul>{rows.map(position=><li key={position.itemId}>
        <Button art="leise" text={position.customerName ? `${position.orderNumber} · ${position.customerName}` : position.orderNumber}
          onClick={event=>{event.currentTarget.focus({preventScroll:true});openOrder(position.orderId);}}/>
        <span>{position.name} · {position.netCents===null?TODAY_WEEK_COPY.unvalued:formatEuro(position.netCents)}</span>
      </li>)}</ul>
    </section>)}
  </div>;
}

export function OfficeWeekControl({initial,read,today}: {
  initial:ProductionWeekRead;
  read:(input?:{onDate?:string;includePositions?:boolean})=>Promise<ProductionWeekRead>;
  today:string;
}) {
  const [open,setOpen] = useState(false);
  const [opener,setOpener] = useState<HTMLButtonElement|null>(null);
  const [retry,setRetry] = useState<WeekRetry|null>(null);
  const [selection,setSelection] = useState<PositionSheet|null>(null);
  const [positionsOpen,setPositionsOpen] = useState(false);
  const state = retry?.initial===initial ? retry.current : initial;
  const week = state.code==='OK' ? state.data : undefined;
  const through = week && today>=week.weekStart && today<week.weekEndExclusive ? today : week?.weekStart;
  function refresh() {
    const pending:WeekRetry = {initial,current:{code:'LOADING'}};
    setRetry(pending);
    const finish = (current:ProductionWeekRead) => setRetry(previous => previous===pending ? {initial,current} : previous);
    void read().then(finish,()=>finish({code:'UNAVAILABLE'}));
  }
  function loadPositions(input:Omit<PositionSheet,'current'>) {
    const pending:PositionSheet={...input,current:{code:'LOADING'}};
    setSelection(pending);
    const finish=(current:ProductionWeekRead)=>setSelection(previous=>previous===pending?{...pending,current}:previous);
    void read({onDate:pending.weekStart,includePositions:true}).then(finish,()=>finish({code:'UNAVAILABLE'}));
  }
  function openPositions(period:PositionPeriod,opener:HTMLButtonElement){
    if(!week?.canReadPositions)return;
    loadPositions({period,weekStart:week.weekStart,opener});
    setPositionsOpen(true);
  }
  return <>
    <Button art="leise" data-spec-id="kopf.wochenumsatz" aria-label={TODAY_WEEK_COPY.open}
      text={week ? TODAY_WEEK_COPY.header(formatEuro(week.netCents)) : TODAY_WEEK_COPY.title}
      onClick={event => {setOpener(event.currentTarget);setOpen(true);}} />
    <GlasDialog offen={open} titel={TODAY_WEEK_COPY.title} ansicht="blatt" dataSpecId="wochenleistung"
      beschreibung={week&&through?weekRange.formatRange(atNoon(week.weekStart),atNoon(through))+' · '+TODAY_WEEK_COPY.workshop:undefined}
      schliessenText={TODAY_WEEK_COPY.close} schliessenSymbol={<Icon name="x"/>}
      oeffner={opener} onSchliessen={() => setOpen(false)} onGeschlossen={() => setOpener(null)}>
      {opener ? <>
      {state.code==='LOADING' ? <p role="status">{PAGE_READ_COPY.loading}</p> : week ?
        <WeekValues week={week} today={today} openPositions={week.canReadPositions?openPositions:undefined}/> :
        <Hinweis ton="warn">{PAGE_READ_COPY.sourceIncomplete}<Button art="leise" text={PAGE_READ_COPY.reload} onClick={refresh}/></Hinweis>}
      </> : null}
    </GlasDialog>
    {selection ? <GlasDialog offen={positionsOpen} titel={positionHeading(selection.period)} ansicht="blatt" dataSpecId="wochenleistung.positionen"
      beschreibung={TODAY_WEEK_COPY.workshop} schliessenText={TODAY_WEEK_COPY.close} schliessenSymbol={<Icon name="x"/>}
      oeffner={selection.opener} onSchliessen={()=>setPositionsOpen(false)} onGeschlossen={()=>setSelection(null)}>
      <WeekPositionList selection={selection} retry={()=>loadPositions(selection)}/>
    </GlasDialog> : null}
  </>;
}
