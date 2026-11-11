import {expect,it} from 'vitest';
import {deliveryReportFromOriginal} from '../deliveryReport';
function report(action='failed',status='5.1.1',original='Message-ID: <TEST-original@example.invalid>'){
 return Buffer.from('Message-ID: <TEST-report@example.invalid>\r\nReceived: TEST-one\r\nReceived: TEST-two\r\nContent-Type: multipart/report; report-type=delivery-status; boundary="TEST-boundary"\r\n\r\n--TEST-boundary\r\nContent-Type: text/plain\r\n\r\nTEST human text is not evidence\r\n--TEST-boundary\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; TEST.example.invalid\r\n\r\nFinal-Recipient: rfc822; TEST-customer@example.invalid\r\nAction: '+action+'\r\nStatus: '+status+'\r\n\r\n--TEST-boundary\r\nContent-Type: text/rfc822-headers\r\n\r\n'+original+'\r\n--TEST-boundary--\r\n');
}
it('qualifies exact failed-recipient and original headers, not delayed reports or human subjects',()=>{
 expect(deliveryReportFromOriginal(report())).toMatchObject({source:'original_mime',status:'failed',recipient:'test-customer@example.invalid',originalMessageId:'<TEST-original@example.invalid>'});
 expect(deliveryReportFromOriginal(report('delayed','4.2.0'))).toMatchObject({status:'other'});
 expect(deliveryReportFromOriginal(Buffer.from('Subject: Unzustellbar TEST\r\n\r\nAction: failed\r\nMessage-ID: <TEST-original@example.invalid>'))).toBeNull();
 expect(deliveryReportFromOriginal(report('failed','4.2.0'))).toMatchObject({status:'invalid'});
 expect(deliveryReportFromOriginal(report('delayed','5.1.1'))).toMatchObject({status:'invalid'});
 expect(deliveryReportFromOriginal(report('failed','5.1.1','Message-ID: <TEST-one@example.invalid>\r\nMessage-ID: <TEST-two@example.invalid>'))).toMatchObject({status:'invalid'});
 expect(deliveryReportFromOriginal(Buffer.from(report().toString().replace('Final-Recipient: rfc822; TEST-customer@example.invalid','Final-Recipient: rfc822; TEST-customer@example.invalid\r\nAction: failed')))).toMatchObject({status:'invalid'});
});
