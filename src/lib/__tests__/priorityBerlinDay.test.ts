import {afterEach,expect,it,vi} from 'vitest';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {zeigeFertigtermin} from '@/modules/orders/public';

const kalender={betriebsruhe:new Set<string>(),versandpufferArbeitstage:0,knappAbArbeitstagen:2};
const termin=(dueDate:string)=>zeigeFertigtermin({dueDate,handoverMode:'pickup'},kalender,berlinCalendarDay(),false);
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
it.each(['2026-07-15T22:30:00.000Z','2026-12-15T23:30:00.000Z'])('K7 UTC server at %s still calls the Berlin calendar deadline today',now=>{
 vi.stubEnv('TZ','UTC');vi.useFakeTimers();vi.setSystemTime(new Date(now));
 const dueDate=now.startsWith('2026-07')?'2026-07-16':'2026-12-16';
 expect(termin(dueDate)).toMatchObject({risk:'orange',dueLabel:'Termin',dueValue:'Heute fällig'});
});
it('K7 Berlin calendar day difference remains one day across the daylight-saving change and yesterday stays overdue',()=>{
 vi.stubEnv('TZ','UTC');vi.useFakeTimers();vi.setSystemTime(new Date('2026-03-28T23:30:00.000Z'));
 expect(termin('2026-03-30')).toMatchObject({risk:'orange',dueValue:'Fällig in 1 Arbeitstag'});
 expect(termin('2026-03-28')).toMatchObject({risk:'red'});
});
