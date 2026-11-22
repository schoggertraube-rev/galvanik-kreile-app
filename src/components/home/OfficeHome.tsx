import {loadOfficeHome} from '@/lib/server/officeHomeRead';
import {Suspense,use} from 'react';
import {TODAY_MODEL_COPY} from '@/ui/situationCatalog';
import {SeitenKopf} from '@/ui/kr';
export {loadOfficeHome} from '@/lib/server/officeHomeRead';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {OfficeHomeClient} from './OfficeHomeClient';
import {saveTodayPreferencesAction,saveTodayReminderAction} from '@/app/actions/today.actions';
import {assignOrderTaskAction,handBackOrderTaskAction} from '@/app/actions/orders.actions';

/** RSC owns the frame immediately; only the qualified primary list suspends.
 * Canonical supplementary readers start after that primary model is available. */
export function OfficeHome({ authorization }: { authorization: AuthorizationSnapshot }) {
 const model=loadOfficeHome(authorization,true);
 return <Suspense fallback={<section data-testid="today-primary-loading"><SeitenKopf titel={TODAY_MODEL_COPY.homeTitle}/><p role="status">{TODAY_MODEL_COPY.mainRefreshing}</p></section>}><TodayPrimary source={model}/></Suspense>;
}
function TodayPrimary({source}:{source:ReturnType<typeof loadOfficeHome>}){
 const model=use(source);
 return <OfficeHomeClient model={model} ports={{
    savePreferences: saveTodayPreferencesAction,
    saveReminder: saveTodayReminderAction,
    assignOrder: assignOrderTaskAction,
    handBackOrder: handBackOrderTaskAction,
  }} />;
}
