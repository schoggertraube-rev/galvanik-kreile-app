'use client';

import type {projectOrderSchedule,readTodayCalendar,TodayOrderScheduleRow} from '@/lib/today/todayDashboardPolicy';
import {PAGE_READ_COPY,TODAY_PLAN_COPY} from '@/ui/situationCatalog';
import {Button,Hinweis} from '@/ui/kr';
import {Tagesband,type TagesbandTermin} from '@/ui/kr/design-final/Tagesband';

const periods=[{id:'today',label:TODAY_PLAN_COPY.today},{id:'week',label:TODAY_PLAN_COPY.week}];
const dateLabel=new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'short',timeZone:'UTC'});

export function OfficeDaySchedule({calendar,schedule,orders,period,onPeriod,onOpen,onEdit}:{
 calendar:ReturnType<typeof readTodayCalendar>;
 schedule:ReturnType<typeof projectOrderSchedule>;
 orders:readonly TodayOrderScheduleRow[];
 period:string;
 onPeriod:(period:string)=>void;
 onOpen:(orderId:string)=>void;
 onEdit:(opener:HTMLButtonElement)=>void;
}){
 const numberByVersion=new Map(orders.map(order=>[`${order.orderId}:${order.version}`,
  order.read.erstblick.find(field=>field.key==='auftrag.lage')?.werte.nummer]));
 const dates=schedule.sources.filter(source=>period==='today'?source.dueDate===calendar.today:
  source.dueDate>calendar.today&&source.dueDate<=calendar.throughDate);
 const datesInOrder=dates.sort((left,right)=>left.dueDate.localeCompare(right.dueDate));
 const terms=datesInOrder.flatMap<TagesbandTermin>(source=>{
  const number=numberByVersion.get(`${source.id}:${source.version}`);
  return typeof number==='string'&&number.length>0?[{
   id:source.id,position:0,uhrzeit:dateLabel.format(new Date(source.dueDate+'T12:00:00Z')),
   titel:number,onOpen:()=>onOpen(source.id),
  }]:[];
 });
 return <Tagesband titel={TODAY_PLAN_COPY.title} zeitraumName={TODAY_PLAN_COPY.period} zeitraeume={periods}
  aktuellerZeitraum={period} onZeitraum={onPeriod} termine={terms} skala={[]} zeigeZeitachse={false}
  bearbeitung={<Button art="leise" text={TODAY_PLAN_COPY.edit} onClick={event=>onEdit(event.currentTarget)}/>}
  belegung={schedule.code!=='OK'||terms.length!==dates.length?<Hinweis ton="warn">{PAGE_READ_COPY.qualificationUnknown}</Hinweis>:null}/>;
}
