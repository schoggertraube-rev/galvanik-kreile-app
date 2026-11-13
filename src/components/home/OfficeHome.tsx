import {loadOfficeHome} from '@/lib/server/officeHomeRead';
export {loadOfficeHome} from '@/lib/server/officeHomeRead';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {OfficeHomeClient} from './OfficeHomeClient';
import {saveTodayPreferencesAction,saveTodayReminderAction} from '@/app/actions/today.actions';
import {assignOrderTaskAction,handBackOrderTaskAction} from '@/app/actions/orders.actions';

export async function OfficeHome({ authorization }: { authorization: AuthorizationSnapshot }) {
  return <OfficeHomeClient model={await loadOfficeHome(authorization)} ports={{
    savePreferences: saveTodayPreferencesAction,
    saveReminder: saveTodayReminderAction,
    assignOrder: assignOrderTaskAction,
    handBackOrder: handBackOrderTaskAction,
  }} />;
}
