import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobalCreatePorts } from "../GlobalCreateFlow";
import { IntakeCaptureDialog } from "../ui/IntakeCaptureDialog";
import type { IntakeCapture } from "../captureContract";
import {readPendingOriginals,acknowledgePendingOriginal} from '../pendingOriginals';

vi.mock("../pendingOriginals", () => ({
  readPendingOriginals: vi.fn(async () => []),
  retainPendingOriginal: vi.fn(async () => undefined),
  acknowledgePendingOriginal: vi.fn(async () => undefined),
}));

afterEach(() => { cleanup();vi.mocked(readPendingOriginals).mockResolvedValue([]);vi.clearAllMocks();vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('resumes the selected offline original and binds its actual capture command to the original login scope',async()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
 const id=crypto.randomUUID(),scope='a'.repeat(64),textstand=crypto.randomUUID(),deviceCapturedAt='2026-11-13T10:00:00.000Z',takeover={sourceId:'quarantine:TEST-held',deviceId:crypto.randomUUID(),sha256:'b'.repeat(64),originalRecord:'TEST synthetic source descriptor'};
 vi.mocked(readPendingOriginals).mockResolvedValue([{kind:'note',id,itemId:id,text:'TEST held original',textstand,dismissed:[],expectedVersion:0,deviceCapturedAt,takeover}]);
 const capture:IntakeCapture={id,version:1,text:'TEST held original',customerId:null,orderId:null,assignment:'offen',usage:'info',concerns:[],files:[],takeovers:[{...takeover,actorId:crypto.randomUUID(),actorName:'TEST original actor',deviceCapturedAt,sourceCommandId:textstand}]};
 const save=vi.fn(async()=>({code:'OK',capture})),getScope=vi.fn();
 const ports={offlineScope:scope,getCaptureScope:getScope,saveCaptureNote:save} as unknown as GlobalCreatePorts;
 render(<IntakeCaptureDialog resumePendingId={id} ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()}/>);
 await screen.findByDisplayValue('TEST held original');expect(getScope).not.toHaveBeenCalled();
 fireEvent.click(await screen.findByRole('button',{name:'Später zuordnen'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({itemId:id,textstand,text:'TEST held original',takeover,deviceCapturedAt,expectedVersion:0}),scope));
 await waitFor(()=>expect(acknowledgePendingOriginal).toHaveBeenCalledWith(scope,id,textstand,capture.takeovers));
});

it('PE204 loads package expectation once per version outside the file polling interval',async()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 const capture:IntakeCapture={id:crypto.randomUUID(),version:1,text:'TEST Paket',customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:[],recognition:{kind:'ware',text:'TEST Paket'},files:[{id:crypto.randomUUID(),name:'TEST-paket.png',mime:'image/png',bytes:1,readable:false,secured:true,status:'fertig'}]};
 const packageContext={status:'OK' as const,customers:[],candidates:[],ambiguous:false,moreCandidates:false};
 const getCapture=vi.fn<NonNullable<GlobalCreatePorts['getCapture']>>(async(_id,_context,options)=>({code:'OK',capture:{...capture,...(options?.packageExpectation?{packageContext}:{})}}));
 let timerId=0;const timers=new Map<number,()=>void>();
 vi.stubGlobal('setInterval',vi.fn((callback:()=>void)=>{timers.set(++timerId,callback);return timerId;}));vi.stubGlobal('clearInterval',vi.fn((id:number)=>timers.delete(id)));
 const fetchPort=vi.fn(async()=>Response.json([]));vi.stubGlobal('fetch',fetchPort);
 const ports={getCapture,getCaptureScope:vi.fn(async()=>({code:'OK',scope:'TEST-pe-poll'})),prepareCaptureFile:vi.fn(async()=>({code:'OK',upload:null})),finishCaptureFile:vi.fn(async()=>({code:'OK',capture}))} as unknown as GlobalCreatePorts;
 const {container}=render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()}/>);
 await waitFor(()=>expect(ports.getCaptureScope).toHaveBeenCalled());
 const file=new File(['TEST'],capture.files[0].name,{type:'image/png'});Object.defineProperty(file,'arrayBuffer',{value:async()=>new Uint8Array([1]).buffer});
 fireEvent.change(container.querySelector('input[type="file"]')!,{target:{files:[file]}});
 await waitFor(()=>expect(getCapture.mock.calls.filter(call=>call[2]?.packageExpectation===true)).toHaveLength(1));
 await screen.findByRole('heading',{name:'Absender nicht erkannt'});
 fetchPort.mockResolvedValueOnce(Response.json([{id:crypto.randomUUID(),itemId:capture.id,fileId:capture.files[0].id,at:new Date().toISOString()}]));
 for(const callback of timers.values())callback();
 await waitFor(()=>expect(getCapture.mock.calls.some(call=>call[2]?.packageExpectation===false)).toBe(true));
 window.dispatchEvent(new CustomEvent('kreile:intake-changed'));
 await waitFor(()=>expect(getCapture.mock.calls.filter(call=>call[2]?.packageExpectation===false).length).toBeGreaterThan(1));
 expect(getCapture.mock.calls.filter(call=>call[2]?.packageExpectation===true)).toHaveLength(1);
});

describe("P63: the camera action is reachable in the fixed footer", () => {
  it.each(["tablet", "handy"])("starts the %s camera immediately and keeps Foto in the dialog footer", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const stop = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const ports = { getCaptureScope: vi.fn(async () => ({ code: "OK", scope: "synthetic-p63-only" })) } as unknown as GlobalCreatePorts;
    render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    const shutter = screen.getByRole("button", { name: /^Foto$/u });
    expect(shutter).toBeDisabled();
    const video = screen.getByLabelText("Rückkamera");
    Object.defineProperties(video, { readyState: { value: 2 }, videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
    fireEvent.loadedData(video);
    expect(shutter).toBeEnabled();
    expect(shutter.closest("footer[data-dialog-actions]")).not.toBeNull();
    cleanup();
    expect(stop).toHaveBeenCalledOnce();
  });
});

describe("S23a: follow-up on a saved original",()=>{
  it("uses the suggested command and rereads the same original without a manual kind choice",async()=>{
    vi.stubGlobal("matchMedia",vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json([])));
    const capture:IntakeCapture={id:crypto.randomUUID(),version:1,text:null,customerId:null,orderId:null,
      assignment:"offen",usage:"offen",concerns:[],recognition:{kind:"unklar",text:""},
      files:[{id:crypto.randomUUID(),name:"SYNTHETISCH-s23.png",mime:"image/png",bytes:1,readable:false,secured:true,status:"fertig"}]};
    const option={vorschlagId:"a".repeat(64),knopf:"Ja, zuordnen",satz:"Soll ich den Eingang TEST Kunde zuordnen?",grund:"TEST Originalhinweis",kunde:"TEST Kunde"};
    const vorschlag={satz:option.satz,haupt:option,oder:[],frage:null,anliegenRest:[]};
    const taskOption={...option,vorschlagId:"b".repeat(64),knopf:"Aufgabe anlegen",satz:"Weiter mit Aufgabe anlegen"};
    const taskProposal={...vorschlag,satz:taskOption.satz,haupt:taskOption,anliegenRest:["aufgabe"]};
    const readCaptureProposal=vi.fn(async()=>({code:"OK",vorschlag:taskProposal})).mockResolvedValueOnce({code:"OK",vorschlag});
    const runCaptureProposal=vi.fn(async(input:{vorschlagId:string})=>input.vorschlagId===taskOption.vorschlagId
      ?{code:"OK",vorschlag:taskProposal,oeffne:"aufgabe"}
      :{code:"OK",vorschlag:{...vorschlag,satz:null,haupt:null}});
    const getCapture=vi.fn(async()=>({code:"OK",capture:{...capture,version:2,customerId:"TEST-kunde",assignment:"bestaetigt"}}));
    const ports={getCaptureScope:vi.fn(async()=>({code:"OK",scope:"synthetic-s23a-only"})),getCapture,
      prepareCaptureFile:vi.fn(async()=>({code:"OK",upload:null})),finishCaptureFile:vi.fn(async()=>({code:"OK",capture})),
      readCaptureProposal,runCaptureProposal} as unknown as GlobalCreatePorts;
    const {container}=render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()}/>);
    await waitFor(()=>expect(ports.getCaptureScope).toHaveBeenCalled());
    const file=new File(["x"],capture.files[0].name,{type:"image/png"});
    Object.defineProperty(file,"arrayBuffer",{value:async()=>new Uint8Array([1]).buffer});
    fireEvent.change(container.querySelector('input[type="file"]')!,{target:{files:[file]}});
    await waitFor(()=>expect(readCaptureProposal).toHaveBeenCalledWith(capture.id));
    const follow=await screen.findByRole("button",{name:option.knopf});
    expect(screen.getByRole("button",{name:"Original ansehen · "+capture.files[0].name})).toBeEnabled();
    fireEvent.click(screen.getByRole("button",{name:"Anders zuordnen"}));
    expect(screen.queryByRole("button",{name:"Eingangsrechnung"})).toBeNull();
    fireEvent.click(follow);
    await waitFor(()=>expect(runCaptureProposal).toHaveBeenCalledWith({itemId:capture.id,vorschlagId:option.vorschlagId,clientEventId:expect.any(String)}));
    expect(getCapture).toHaveBeenCalledWith(capture.id,undefined,{packageExpectation:false});
    const opened=vi.fn();
    const consume=(event:Event)=>{
      opened((event as CustomEvent).detail);
      event.preventDefault();
    };
    window.addEventListener("kreile:oeffne",consume);
    try{
      fireEvent.click(await screen.findByRole("button",{name:taskOption.knopf}));
      await waitFor(()=>expect(opened).toHaveBeenCalledExactlyOnceWith({ziel:"aufgabe",
        taskRequest:{reference:{type:"eingang",id:capture.id},kind:"aufgabe",itemId:capture.id}}));
    }finally{
      window.removeEventListener("kreile:oeffne",consume);
    }
  });
});
