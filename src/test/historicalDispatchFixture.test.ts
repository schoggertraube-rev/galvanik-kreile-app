import {expect,it} from 'vitest';
import {historicalDispatchDate,dispatchFollowupBoundary} from '../../e2e/ablauf/historicalDispatchFixture';
import {berlinCalendarDay,plusWorkingDays} from '@/lib/domain/workingDays';

// Synthetic calendar boundaries only; no simulated product-clock claim.
it.each(['2026-11-14T00:30:00+01:00','2026-11-15T00:30:00+01:00','2026-11-16T00:30:00+01:00'])('never dates a source after DB time and uses completed workdays at %s',databaseNow=>{
 for(const count of [0,1,2,5,10]){
  const source=historicalDispatchDate(databaseNow,count);
  expect(Date.parse(source)).toBeLessThanOrEqual(Date.parse(databaseNow));
  expect(plusWorkingDays(berlinCalendarDay(new Date(source)),count)).not.toBeNull();
  expect(plusWorkingDays(berlinCalendarDay(new Date(source)),count)!<=berlinCalendarDay(new Date(databaseNow))).toBe(true);
 }
});
it('uses the same holiday calendar and rejects missing or invalid DB time',()=>{
 const base='2026-11-16T12:00:00.000Z',holidays=['2026-11-13'];
 const source=historicalDispatchDate(base,1,holidays);
 expect(berlinCalendarDay(new Date(source))).toBe('2026-11-12');
 expect(plusWorkingDays(berlinCalendarDay(new Date(source)),1,holidays)).toBe('2026-11-16');
 expect(()=>historicalDispatchDate('',1)).toThrow('TEST_HISTORICAL_DATE_INVALID');
 expect(()=>historicalDispatchDate(base,-1)).toThrow('TEST_HISTORICAL_DATE_INVALID');
});
it('keeps Friday to Saturday due, Sunday to Monday waiting, and respects a real holiday',()=>{
 expect(dispatchFollowupBoundary('2026-11-13T12:00:00Z',0,'2026-11-14T12:00:00Z')).toEqual({due:'2026-11-13',state:'DUE'});
 expect(dispatchFollowupBoundary('2026-11-15T12:00:00Z',0,'2026-11-15T12:00:00Z')).toEqual({due:'2026-11-16',state:'WAIT'});
 expect(dispatchFollowupBoundary('2026-11-13T12:00:00Z',1,'2026-11-16T12:00:00Z',['2026-11-16'])).toEqual({due:'2026-11-17',state:'WAIT'});
});
