/** Defer initial background reads; event-driven/manual reads keep their own immediate path. */
export function scheduleIdleRead(read:()=>void,timeout:number,delay=0):()=>void{
 let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
 const run=()=>{if(!stopped)read();};
 const idle=()=>{if(stopped)return;if(delay)timer=setTimeout(run,delay);else run();};
 if(typeof window.requestIdleCallback==='function'){
  const handle=window.requestIdleCallback(idle,{timeout});
  return()=>{stopped=true;window.cancelIdleCallback(handle);if(timer!==undefined)clearTimeout(timer);};
 }
 timer=setTimeout(idle,timeout);
 return()=>{stopped=true;if(timer!==undefined)clearTimeout(timer);};
}
