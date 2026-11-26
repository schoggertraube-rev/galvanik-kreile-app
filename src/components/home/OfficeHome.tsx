import {loadOfficeHome} from '@/lib/server/officeHomeRead';
import {Suspense,use} from 'react';
import {PAGE_READ_COPY,TODAY_MODEL_COPY,TODAY_WEEK_COPY} from '@/ui/situationCatalog';
import {Button,SeitenKopf} from '@/ui/kr';
import {readTodayCalendar} from '@/lib/today/todayDashboardPolicy';
export {loadOfficeHome} from '@/lib/server/officeHomeRead';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {OfficeHomeClient} from './OfficeHomeClient';
import {OfficeWeekControl} from './OfficeWeekControl';
import {saveTodayPreferencesAction,saveTodayReminderAction} from '@/app/actions/today.actions';
import {assignOrderTaskAction,getProductionWeekAction,handBackOrderTaskAction} from '@/app/actions/orders.actions';

/** RSC owns the frame immediately; only the qualified primary list suspends.
 * Canonical supplementary readers start after that primary model is available. */
export function OfficeHome({ authorization }: { authorization: AuthorizationSnapshot }) {
 const model=loadOfficeHome(authorization,true);
 return <Suspense fallback={<section data-testid="today-primary-loading"><SeitenKopf titel={TODAY_MODEL_COPY.homeTitle}/><p role="status">{TODAY_MODEL_COPY.mainRefreshing}</p></section>}><TodayPrimary source={model} authorization={authorization}/></Suspense>;
}
function TodayPrimary({source,authorization}:{source:ReturnType<typeof loadOfficeHome>;authorization:AuthorizationSnapshot}){
 const model=use(source);
 const today=('dashboard'in model&&model.dashboard.calendar?.today)||readTodayCalendar().today;
 const weekControl=<Suspense fallback={<Button art="leise" text={TODAY_WEEK_COPY.title} aria-label={PAGE_READ_COPY.loading} disabled/>}>
   <TodayProductionWeekSlot authorization={authorization} today={today}/>
  </Suspense>;
 return <OfficeHomeClient model={model} weekControl={weekControl} ports={{
    savePreferences: saveTodayPreferencesAction,
    saveReminder: saveTodayReminderAction,
    assignOrder: assignOrderTaskAction,
    handBackOrder: handBackOrderTaskAction,
  }} />;
}

// Same authorization snapshot as the day, separate Suspense boundary.
async function TodayProductionWeekSlot({authorization,today}:{
 authorization:AuthorizationSnapshot;today:string;
}){
 const {readProductionWeek}=await import('@/lib/server/productionSnapshotPort');
 const initial=await readProductionWeek(authorization);
 return <OfficeWeekControl initial={initial} read={getProductionWeekAction} today={today}/>;
}
