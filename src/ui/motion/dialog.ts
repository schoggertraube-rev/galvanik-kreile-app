'use client';

/** PL20.11.03:10 / A22: the single approved dialog moment from v10
 * openOv/backTo. Only transform/opacity animate; reduced motion is immediate.
 * No timer, queue, focus owner or event listener is installed here. */
export const dialog = {
  oeffnen(box:HTMLElement,opener:HTMLElement|null){
    if(matchMedia('(prefers-reduced-motion:reduce)').matches||!opener)return;
    const from=opener.getBoundingClientRect(),to=box.getBoundingClientRect();
    if(!from.width||!from.height||!to.width||!to.height)return;
    box.animate([
      {transform:`translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`,opacity:.4},
      {transform:'none',opacity:1},
    ],{duration:250,easing:'cubic-bezier(.34,1.56,.64,1)'});
    box.querySelector<HTMLElement>('[data-overlay-body]')?.animate([{opacity:0},{opacity:0,offset:.4},{opacity:1}],{duration:250});
  },
  zurueck(box:HTMLElement,opener:HTMLElement|null,beendet:()=>void){
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){beendet();return;}
    const a=box.getBoundingClientRect(),b=opener?.isConnected&&opener.offsetParent?opener.getBoundingClientRect():null;
    const transform=b&&a.width&&a.height?`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) scale(${Math.max(.06,b.width/a.width)},${Math.max(.06,b.height/a.height)})`:'scale(.97)';
    void box.animate([{opacity:1,transform:'none'},{opacity:0,transform}],{duration:190,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'}).finished.then(beendet,beendet);
  },
};
