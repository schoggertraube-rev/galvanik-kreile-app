import {expect,it} from 'vitest';
import {OFFLINE_CLOCK_TOLERANCE_MS,offlineOccurrenceTime,normalizeOfflineOriginal} from '../offlineOriginal';
const server=new Date('2026-11-16T12:00:00.000Z');
it('K3 tolerates exactly five future minutes; farther future uses server time and marks the original',()=>{
 expect(OFFLINE_CLOCK_TOLERANCE_MS).toBe(300000);
 expect(offlineOccurrenceTime('2026-11-16T12:05:00.000Z',server)).toEqual({occurredAt:'2026-11-16T12:05:00.000Z',geraetezeit_abweichend:false});
 expect(offlineOccurrenceTime('2026-11-16T12:05:00.001Z',server)).toEqual({occurredAt:server.toISOString(),geraetezeit_abweichend:true});
});
it('K3 preserves older device occurrence and the unchanged actor/time/key original',()=>{
 const original=Object.freeze({deviceCapturedAt:'2026-11-16T09:00:00.000Z',actorId:'12345678-1234-4234-8234-123456789abc',clientEventId:'22345678-1234-4234-8234-123456789abc'});
 expect(offlineOccurrenceTime(original.deviceCapturedAt,server)).toEqual({occurredAt:original.deviceCapturedAt,geraetezeit_abweichend:false});
 expect(normalizeOfflineOriginal(original)).toEqual(original);expect(server.toISOString()).toBe('2026-11-16T12:00:00.000Z');
});
it('K3 unknown clock sources never become zero or a guessed occurrence',()=>{
 expect(()=>offlineOccurrenceTime('not-a-clock',server)).toThrow('OFFLINE_OCCURRENCE_TIME_INVALID');
 expect(()=>offlineOccurrenceTime(server.toISOString(),new Date('invalid'))).toThrow('OFFLINE_OCCURRENCE_TIME_INVALID');
});
