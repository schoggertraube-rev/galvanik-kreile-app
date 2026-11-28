import {existsSync,readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

it('routes new card and workshop files through the same intake queue while retaining historical readers',()=>{
 const source=(path:string)=>readFileSync(path,'utf8');
 const card=source('src/components/attachments/DomainAttachmentPanel.tsx');
 const workshop=source('src/app/warendurchlauf/galvanik/GalvanikHandoffAttachmentAppAdapter.tsx');
 expect(card).toContain('return uploadContextOriginal');
 expect(card).toContain('await retainPendingOriginal');
 expect(workshop).toContain('=>uploadContextOriginal');
 expect(source('src/app/warendurchlauf/actions.ts')).toContain('reserveOrderStationAttachment(authorization.data, input,true)');
 expect(source('src/modules/eingang/server/intakeFile.ts')).toContain('.createSignedUploadUrl(');

 const historical=source('src/app/actions/domainAttachments.actions.ts');
 expect(historical).toContain('function getDomainAttachmentOriginalAction');
 expect(historical).not.toMatch(/export async function (?:reserve|finalize|analyze)DomainAttachmentAction/);
 expect(existsSync('src/components/layout/F1SourceDialogs.tsx')).toBe(false);
 expect(existsSync('src/components/intake/SuggestedItemsPanel.tsx')).toBe(false);
 const legacySource=source('src/lib/server/documentIntelligencePort.ts');
 expect(legacySource).toContain('FROM public.scan_uploads');
 expect(legacySource).not.toMatch(/analyzeDomainAttachment|createSignedUploadUrl|\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
 expect(source('src/lib/server/domainAttachment.ts')).toContain('readSecuredDomainAttachmentSource(tx,');
});
