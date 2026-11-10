import 'server-only';
import {CUSTOMER_COLLECTION_COPY,COLLECTION_REMINDER_COPY} from '@/ui/situationCatalog';
import { berlinCalendarDay, plusWorkingDays } from '@/lib/domain/workingDays';
import type { DispatchPolicy } from '@/modules/fundament/public';

/** The promise belongs to this original, never to later company settings. */
export function freezeStorageDeadline(policy: DispatchPolicy | null | undefined, date = berlinCalendarDay()) {
  const days = policy?.finalStageAfterLetterDays;
  const due = days == null ? null : plusWorkingDays(date, days, policy!.holidays);
  if (days != null && !due) throw Error('STORAGE_ORIGINAL_CALENDAR_INVALID');
  return { date, due };
}

/** Retain the original's facts and promise when a group is narrowed. Legacy originals keep their exact legacy template. */
export function restrictStorageLetterSnapshot(before:import('@/lib/pdf/StorageLetterDocument').StorageLetterSnapshot,numbers:string[]){
 if(before.customerText){const customerText={...before.customerText,members:before.customerText.members.filter(member=>numbers.includes(member.number))};if(customerText.members.length!==numbers.length)throw Error('LETTER_CUSTOMER_SCOPE_INVALID');return {...before,orderNumbers:numbers,customerText,body:CUSTOMER_COLLECTION_COPY.render('E4',customerText).body};}
 const prefix=COLLECTION_REMINDER_COPY.letterBody(before.orderNumbers,null);if(!before.body.startsWith(prefix))throw Error('POSTAL_REPLACEMENT_TEMPLATE_UNAVAILABLE');return {...before,orderNumbers:numbers,body:COLLECTION_REMINDER_COPY.letterBody(numbers,null)+before.body.slice(prefix.length)};
}
