import {expect,it} from 'vitest';
import {plusWorkingDays,workingDaysBetween} from '../workingDays';
it('the existing calendar excludes configured closures as well as weekends and national holidays in both directions',()=>{
 expect(workingDaysBetween('2026-12-23','2026-12-28',['2026-12-24'])).toBe(1);
 expect(workingDaysBetween('2026-12-28','2026-12-23',['2026-12-24'])).toBe(-1);
 expect(plusWorkingDays('2026-12-23',1,['2026-12-24'])).toBe('2026-12-28');
 expect(workingDaysBetween('2026-12-23','2026-12-28',['2026-02-30'])).toBeNull();
});
