'use client';
import {useSyncExternalStore} from 'react';
import {useKrVorfinalStyle} from '@/ui/kr/AppShell';

const readRoot=()=>document.documentElement.dataset.ui==='v45';
function subscribeRoot(change:()=>void){
 const observer=new MutationObserver(change);
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-ui']});
 return ()=>observer.disconnect();
}
/** Presentation only: stay with the server's currently rendered sheet, never a grant. */
export function useVorfinalStyle(){
 const serverStyle=useKrVorfinalStyle();
 return useSyncExternalStore(subscribeRoot,readRoot,()=>serverStyle);
}
