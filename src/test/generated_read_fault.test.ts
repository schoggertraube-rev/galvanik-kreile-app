// Explicit isolated transport/manifest fixtures, not a real N09 app acceptance.
import {expect,it} from 'vitest';
import {protocolDiagnosticActionIds,isApplicationDataLoad} from '../../e2e/generated/_readFault';
const file='src/app/actions/logging.actions.ts';
const metadata='a'.repeat(40),write='b'.repeat(40),list='c'.repeat(40);
const fixture=()=>({node:{
 [metadata]:{filename:file,exportedName:'getProtocolLogAction'},
 [write]:{filename:file,exportedName:'recordProtocolClicksAction'},
 [list]:{filename:'src/app/actions/eingang.actions.ts',exportedName:'getIntakeMessagesAction'},
}});
it('a next-load interruption survives both diagnostic RPCs and still targets the actual application read',()=>{
 const diagnostics=protocolDiagnosticActionIds(fixture());
 const requests=[metadata,write,list].map(nextAction=>({method:'POST',resourceType:'fetch',nextAction}));
 expect(requests.find(request=>isApplicationDataLoad(request,diagnostics))?.nextAction).toBe(list);
 expect(diagnostics.has(list)).toBe(false);
});
it('resolves actual top-level Turbopack and worker reference metadata without fixed hashes, including Windows paths',()=>{
 const top=fixture();top.node[metadata].filename='C:\\TEST\\src\\app\\actions\\logging.actions.ts';
 expect([...protocolDiagnosticActionIds(top)]).toEqual([metadata,write]);
 const workers={node:{[metadata]:{workers:{app:{filename:file,exportedName:'getProtocolLogAction'}}},[write]:{workers:{app:{filename:file,exportedName:'recordProtocolClicksAction'}}}}};
 expect([...protocolDiagnosticActionIds(workers)]).toEqual([metadata,write]);
});
it('missing, ambiguous or wrongly sourced diagnostics stop the test setup rather than silently disabling the fault',()=>{
 const missing=fixture();delete (missing.node as Record<string,unknown>)[metadata];expect(()=>protocolDiagnosticActionIds(missing)).toThrow('FLOW_DIAGNOSTIC_ACTION_ID_AMBIGUOUS:getProtocolLogAction:0');
 const duplicate=fixture();Object.assign(duplicate.node,{other:{filename:file,exportedName:'getProtocolLogAction'}});expect(()=>protocolDiagnosticActionIds(duplicate)).toThrow('FLOW_DIAGNOSTIC_ACTION_ID_AMBIGUOUS:getProtocolLogAction:2');
 const wrong=fixture();wrong.node[metadata].filename='src/app/actions/other.actions.ts';expect(()=>protocolDiagnosticActionIds(wrong)).toThrow('FLOW_DIAGNOSTIC_ACTION_ID_AMBIGUOUS:getProtocolLogAction:0');
});
it('preserves load failure coverage for ordinary RPCs, fetch/XHR reads and excludes navigation/assets exactly as before',()=>{
 const diagnostics=protocolDiagnosticActionIds(fixture());
 expect(isApplicationDataLoad({method:'POST',nextAction:'unrelated-read',resourceType:'fetch'},diagnostics)).toBe(true);
 expect(isApplicationDataLoad({method:'GET',resourceType:'fetch'},diagnostics)).toBe(true);
 expect(isApplicationDataLoad({method:'GET',resourceType:'xhr'},diagnostics)).toBe(true);
 expect(isApplicationDataLoad({method:'GET',resourceType:'fetch',rsc:'1'},diagnostics)).toBe(false);
 expect(isApplicationDataLoad({method:'GET',resourceType:'script'},diagnostics)).toBe(false);
});
