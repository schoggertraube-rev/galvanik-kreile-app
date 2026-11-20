import {afterEach,expect,it,vi} from 'vitest';
import {dialog} from './dialog';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
function scenario(reduced:boolean){
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:reduced})));
 const box=document.createElement('section'),body=document.createElement('div'),opener=document.createElement('button');
 body.dataset.overlayBody='';box.append(body);document.body.append(opener,box);
 const rect={x:10,y:20,left:10,top:20,right:110,bottom:70,width:100,height:50,toJSON:()=>({})};
 vi.spyOn(opener,'getBoundingClientRect').mockReturnValue(rect);
 vi.spyOn(box,'getBoundingClientRect').mockReturnValue({...rect,left:30,top:40,width:400,height:300});
 Object.defineProperty(opener,'offsetParent',{configurable:true,value:document.body});
 const animate=vi.fn<(frames:Keyframe[],options:KeyframeAnimationOptions)=>{finished:Promise<void>}>(()=>({finished:Promise.resolve()}));
 Object.defineProperty(box,'animate',{configurable:true,value:animate});Object.defineProperty(body,'animate',{configurable:true,value:animate});
 return {box,opener,animate};
}

it('uses only the approved source transform/opacity, exact timings and no delayed input listener',async()=>{
 const {box,opener,animate}=scenario(false),done=vi.fn();
 dialog.oeffnen(box,opener);dialog.zurueck(box,opener,done);await Promise.resolve();
 expect(animate.mock.calls.map(call=>call[1].duration)).toEqual([250,250,190]);expect(done).toHaveBeenCalledOnce();
 expect(animate.mock.calls[0][0][0]).toEqual({transform:'translate(-20px,-20px) scale(0.25,0.16666666666666666)',opacity:.4});
 for(const [frames]of animate.mock.calls)for(const frame of frames)expect(Object.keys(frame).every(key=>['transform','opacity','offset'].includes(key))).toBe(true);
 expect(animate.mock.calls[0][1].easing).toBe('cubic-bezier(.34,1.56,.64,1)');
 expect(animate.mock.calls[2][1].easing).toBe('cubic-bezier(.4,0,1,1)');
});

it('turns motion entirely off and completes immediately under reduced motion',()=>{
 const {box,opener,animate}=scenario(true),done=vi.fn();
 dialog.oeffnen(box,opener);dialog.zurueck(box,opener,done);
 expect(animate).not.toHaveBeenCalled();expect(done).toHaveBeenCalledOnce();
});

it('does not fabricate an origin and still finishes if the browser cancels the closing animation',async()=>{
 const {box,opener,animate}=scenario(false),done=vi.fn();
 dialog.oeffnen(box,null);expect(animate).not.toHaveBeenCalled();
 animate.mockReturnValue({finished:Promise.reject(new DOMException('TEST cancelled animation','AbortError'))});
 dialog.zurueck(box,opener,done);await Promise.resolve();expect(done).toHaveBeenCalledOnce();
});
