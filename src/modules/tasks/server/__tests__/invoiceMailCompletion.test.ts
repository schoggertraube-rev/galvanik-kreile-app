import {describe,expect,it} from 'vitest';
import {invoiceMailRemainderAllowsCompletion} from '../../contract';
describe('KORR S38a-2 actual task-reader completion gate',()=>{
 it('keeps an issued unsent remainder disabled',()=>expect(invoiceMailRemainderAllowsCompletion('KNOWN',{pending:true})).toBe(false));
 it('enables the same task after qualified delivery or cancellation settles the remainder',()=>expect(invoiceMailRemainderAllowsCompletion('KNOWN',{pending:false})).toBe(true));
 it('does not invent a restriction for an ordinary task',()=>expect(invoiceMailRemainderAllowsCompletion('KNOWN',null)).toBe(true));
 it.each([null,{pending:true},{pending:false}])('keeps unavailable evidence disabled: %j',remainder=>expect(invoiceMailRemainderAllowsCompletion('SOURCE_INCOMPLETE',remainder)).toBe(false));
});
