import {afterEach,expect,it,vi} from 'vitest';
import {evaluateOrderPriority} from '../priority';
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
it.each(['2026-07-15T22:30:00.000Z','2026-12-15T23:30:00.000Z'])('K7 UTC server at %s still calls the Berlin calendar deadline today',now=>{
 vi.stubEnv('TZ','UTC');vi.useFakeTimers();vi.setSystemTime(new Date(now));
 const dueDate=now.startsWith('2026-07')?'2026-07-16':'2026-12-16';
 expect(evaluateOrderPriority({dueDate})).toMatchObject({risk:'orange',dueLabel:'Fällig',dueValue:'Heute'});
});
it('K7 Berlin calendar day difference remains one day across the daylight-saving change and yesterday stays overdue',()=>{
 vi.stubEnv('TZ','UTC');vi.useFakeTimers();vi.setSystemTime(new Date('2026-03-28T23:30:00.000Z'));
 expect(evaluateOrderPriority({dueDate:'2026-03-30'})).toMatchObject({risk:'yellow',dueValue:'1 Tagen'});
 expect(evaluateOrderPriority({dueDate:'2026-03-28'})).toMatchObject({risk:'red',dueValue:'1 Tag'});
});
