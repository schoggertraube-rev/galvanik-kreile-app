import {describe,expect,it} from 'vitest';
import {recognizeInvoiceXml} from '../invoiceRecognition';

describe('structured invoice XML',()=>{
 it('rejects DTD and unknown XML',()=>{
  expect(recognizeInvoiceXml(Buffer.from('<!DOCTYPE Invoice [<!ENTITY x SYSTEM "file:///no-access">]><Invoice>&x;</Invoice>'))).toEqual({code:'UNSUPPORTED'});
  expect(recognizeInvoiceXml(Buffer.from('<unknown/>'))).toEqual({code:'UNSUPPORTED'});
 });
});
