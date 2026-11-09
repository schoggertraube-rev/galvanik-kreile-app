/** Intent and source are distinct overlay parameters; old source-only links still open. */
export function quoteOverlayTarget(id:string,sourceId?:string,intent?:'send'){
 const query=new URLSearchParams();if(sourceId)query.set('sourceId',sourceId);if(intent)query.set('intent',intent);return id+(query.size?'#'+query.toString():'');
}
export function parseQuoteOverlayTarget(target:string){
 const at=target.indexOf('#'),id=at<0?target:target.slice(0,at),suffix=at<0?'':target.slice(at+1);
 const query=new URLSearchParams(suffix);return {id,sourceId:suffix.includes('=')?query.get('sourceId')??undefined:suffix&&suffix!=='send'?suffix:undefined,initialIntent:(suffix==='send'||query.get('intent')==='send'?'send':undefined) as 'send'|undefined};
}
