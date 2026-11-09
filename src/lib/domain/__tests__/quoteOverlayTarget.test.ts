import {expect,it} from 'vitest';
import {quoteOverlayTarget,parseQuoteOverlayTarget} from '../quoteOverlayTarget';
it('preserves source and send intent independently, including old links',()=>{
 expect(parseQuoteOverlayTarget(quoteOverlayTarget('TEST-kv','TEST-source','send'))).toEqual({id:'TEST-kv',sourceId:'TEST-source',initialIntent:'send'});
 expect(parseQuoteOverlayTarget('TEST-kv#TEST-source')).toEqual({id:'TEST-kv',sourceId:'TEST-source',initialIntent:undefined});
 expect(parseQuoteOverlayTarget('TEST-kv#send')).toEqual({id:'TEST-kv',sourceId:undefined,initialIntent:'send'});
});
