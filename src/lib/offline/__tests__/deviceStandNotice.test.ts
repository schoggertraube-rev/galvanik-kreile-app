import {expect,it} from 'vitest';
import {deviceStandNotice} from '../deviceStandNotice';
const serverReadAt='2026-11-13T09:30:00.000Z',stamp=Date.parse(serverReadAt);
const source={stand:{code:'COMPLETE' as const,serverReadAt},storageUnavailable:false,online:false,pending:2,quarantined:1,now:stamp+60_000};
it('shows the actual Berlin server time and separates quarantined originals from pending work',()=>{
 expect(deviceStandNotice(source)).toEqual({text:'Offline – Stand 10:30, 2 Änderungen warten',warning:true,quarantine:'1 Eingaben zurückgehalten - tippe zum Zuordnen'});
});
it('expires at exactly24h and rejects a clock before the confirmed server stamp',()=>{
 expect(deviceStandNotice({...source,now:stamp+24*3600_000-1}).text).toContain('Stand 10:30');
 expect(deviceStandNotice({...source,now:stamp+24*3600_000}).text).toBe('Seit über 24 Stunden kein Netz – neue Eingaben erst wieder mit Verbindung');
 expect(deviceStandNotice({...source,now:stamp-1}).text).toBe('Die Geräteuhr passt nicht zum letzten Stand - neue Eingaben erst wieder mit Verbindung.');
});
it('never calls missing or unreadable storage a completed empty stand',()=>{
 expect(deviceStandNotice({...source,stand:{code:'INCOMPLETE'}}).warning).toBe(true);
 expect(deviceStandNotice({...source,storageUnavailable:true}).text).toBe('Offline-Speicher auf diesem Gerät nicht verfügbar - Eingaben gehen nur mit Netz');
 expect(deviceStandNotice({...source,stand:{code:'UNAVAILABLE'}}).text).toBe('Offline-Speicher auf diesem Gerät nicht verfügbar - Eingaben gehen nur mit Netz');
 expect(deviceStandNotice({...source,online:true,quarantined:0})).toEqual({text:null,warning:false,quarantine:null});
});
