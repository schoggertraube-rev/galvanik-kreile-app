import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobalCreatePorts } from "../GlobalCreateFlow";
import { IntakeCaptureDialog } from "../ui/IntakeCaptureDialog";
import type { IntakeCapture } from "../captureContract";
import { readPendingOriginals } from "../pendingOriginals";
import { IntakeSituation } from "../ui/IntakeSituation";

vi.mock("../pendingOriginals", () => ({
  readPendingOriginals: vi.fn(async () => []),
  retainPendingOriginal: vi.fn(async () => undefined),
  acknowledgePendingOriginal: vi.fn(async () => undefined),
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

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
    expect(getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Foto"}));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    const shutter = screen.getByRole("button", { name: /^Foto$/u });
    expect(shutter).toBeDisabled();
    const video = screen.getByLabelText("Rückkamera");
    Object.defineProperties(video, { readyState: { value: 2 }, videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
    fireEvent.loadedData(video);
    expect(shutter).toBeEnabled();
    expect(shutter.closest(".kr-dialog-fuss")).not.toBeNull();
    cleanup();
    expect(stop).toHaveBeenCalledOnce();
  });
});

describe("U241: unknown originals always have a concrete next step", () => {
  it.each(["anfrage", "ware", "rechnung", "dokument"] as const)("persists %s on the existing capture before continuing", async kind => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    const capture: IntakeCapture = { id: crypto.randomUUID(), version: 1, text: null, customerId: null, orderId: null,
      assignment: "offen", usage: "offen", concerns: [], recognition: { kind: "unklar", text: "" },
      files: [{ id: crypto.randomUUID(), name: "SYNTHETISCH-u241.png", mime: "image/png", bytes: 1, readable: false, secured: true, status: "fertig" }] };
    const chosen: IntakeCapture = { ...capture, version: 2, recognition: { kind, text: "", source: "hand" } };
    const chooseCaptureKind = vi.fn(async () => ({ code: "OK", capture: chosen }));
    const openCaptureObject = vi.fn(() => true), onOrder = vi.fn(), onClose = vi.fn();
    const ports = { getCaptureScope: vi.fn(async () => ({ code: "OK", scope: "synthetic-u241-only" })),
      getCapture: vi.fn(async () => ({ code: "OK", capture })),
      prepareCaptureFile: vi.fn(async () => ({ code: "OK", upload: null })),
      finishCaptureFile: vi.fn(async () => ({ code: "OK", capture })),
      chooseCaptureKind, openCaptureObject, canManageMoney: true,
    } as unknown as GlobalCreatePorts;
    const { container } = render(<IntakeCaptureDialog ports={ports} onClose={onClose} onOrder={onOrder} onCustomer={vi.fn()} />);
    await waitFor(() => expect(ports.getCaptureScope).toHaveBeenCalled());
    const file = new File(["x"], capture.files[0].name, { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new Uint8Array([1]).buffer });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    const labels = { anfrage: "Auftrag/KV", ware: "Ware", rechnung: "Eingangsrechnung", dokument: "Dokument/Notiz zum Kunden" };
    await screen.findByText("Anders zuordnen");
    fireEvent.click(screen.getByText("Anders zuordnen"));
    await screen.findByRole("button", { name: labels[kind] });
    for (const name of [...Object.values(labels), "Anderen Kunden oder Vorgang wählen"])
      expect(screen.getByRole("button", { name })).toBeEnabled();
    expect(screen.queryByRole("button",{name:"Text ändern"})).toBeNull();
    expect(screen.getByRole("button",{name:"Original ansehen · "+capture.files[0].name})).toBeEnabled();
    expect(screen.queryByRole("textbox",{name:"Notiz"})).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: labels[kind] }));
    await waitFor(() => expect(chooseCaptureKind).toHaveBeenCalledWith(expect.objectContaining({ itemId: capture.id, version: 1, kind })));
    if (kind === "anfrage") await waitFor(() => expect(onOrder).toHaveBeenCalledWith(undefined, chosen));
    else if(kind === "ware"){await screen.findByRole("heading",{name:"Absender nicht erkannt"});expect(onOrder).not.toHaveBeenCalled();expect(screen.getByRole("button",{name:"Anderen Kunden oder Vorgang wählen"})).toBeEnabled();}
    else await waitFor(() => expect(openCaptureObject).toHaveBeenCalledWith(kind === "rechnung" ? "rechnungein" : "mailein", capture.id + (kind === "dokument" ? "#rein" : "")));
  });
});


it.each(['enter','lesen'])('E1 %s persists text through the same note port without opening a photo situation',async trigger=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json([])));
 const save=vi.fn(async(input)=>({code:'OK',capture:{id:input.itemId,version:1,text:input.text,customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:[],recognition:{kind:'anfrage',text:input.text},files:[]}}));
 const ports={getCaptureScope:vi.fn(async()=>({code:'OK',scope:'TEST-e1-text'})),saveCaptureNote:save,readCaptureNote:vi.fn(async()=>({code:'OK',data:{recognition:{fields:[],positions:[]},concerns:[]}}))} as unknown as GlobalCreatePorts;
 const {container}=render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()}/>);
 await waitFor(()=>expect(ports.getCaptureScope).toHaveBeenCalled());
 const input=screen.getByRole('textbox',{name:'Notiz'});fireEvent.change(input,{target:{value:'TEST Anfrage 4 Halter verchromen'}});
 if(trigger==='enter'){fireEvent.keyDown(input,{key:'Enter'});fireEvent.keyDown(input,{key:'Enter'});}else{const button=screen.getByRole('button',{name:'Lesen'});fireEvent.click(button);fireEvent.click(button);}
 await waitFor(()=>expect(save).toHaveBeenCalledOnce());
 await waitFor(()=>expect(screen.getByRole('textbox',{name:'Notiz'})).toHaveValue('TEST Anfrage 4 Halter verchromen'));
 expect(container.querySelector('[data-spec-id="rein.situation"]')).toBeNull();expect(screen.queryByRole('button',{name:/^Original ansehen/})).toBeNull();
 expect(save.mock.calls[0][0]).toMatchObject({text:'TEST Anfrage 4 Halter verchromen',textstand:expect.any(String),itemId:expect.any(String)});
 const row=container.querySelector('[data-spec-id="rein.textvorschlag"]')!;
 expect(row.querySelectorAll('.kr-btn--erledigen')).toHaveLength(1);
 expect(screen.getByRole('button',{name:'Anfrage übernehmen'})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'Anders'}));
 expect(screen.getByRole('group',{name:'Anders'}).querySelectorAll('button').length).toBeLessThanOrEqual(2);
});

it.each(['photo-text','typed-text','unsecured-text','discarded-text'])('E1 photo editing follows secured OCR provenance: %s',async source=>{
 const fileId=crypto.randomUUID();
 const capture:IntakeCapture={id:crypto.randomUUID(),version:1,text:'TEST typed note',customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:[],recognition:{kind:'unklar',text:'TEST text'},files:[{id:fileId,name:'TEST-original.png',mime:'image/png',bytes:1,readable:true,secured:source!=='unsecured-text',status:'fertig'}],suggestions:source==='typed-text'?[]:[{id:crypto.randomUUID(),fileId,orderId:null,field:'DOCUMENT_TEXT',value:'TEST photographed text',confidence:'high',rule:null,reason:null,source:{},status:source==='discarded-text'?'verworfen':'offen'}]};
 const onEdit=vi.fn();render(<IntakeSituation capture={capture} kind="unklar" busy={false} primary={null} onAssign={vi.fn()} onOriginal={vi.fn()} onOrder={vi.fn()} onMore={vi.fn()} onEdit={onEdit} onKind={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Anders zuordnen'}));
 const edit=screen.queryByRole('button',{name:'Text ändern'});
 if(source==='photo-text'){expect(edit).toBeEnabled();fireEvent.click(edit!);expect(onEdit).toHaveBeenCalledOnce();}else expect(edit).toBeNull();
});

it('E1 server rejection stays in the dialog without leaking raw server text',async()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json([])));
 const save=vi.fn(async()=>({code:'FORBIDDEN',message:'TEST RAW INTERNAL MESSAGE MUST NOT BE SHOWN'}));
 const ports={getCaptureScope:vi.fn(async()=>({code:'OK',scope:'TEST-e1-failure'})),saveCaptureNote:save} as unknown as GlobalCreatePorts;
 render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()}/>);
 await waitFor(()=>expect(ports.getCaptureScope).toHaveBeenCalled());
 const input=screen.getByRole('textbox',{name:'Notiz'});fireEvent.change(input,{target:{value:'TEST preserved note'}});
 fireEvent.click(screen.getByRole('button',{name:'Lesen'}));
 await screen.findByText(/Dir fehlt die Freigabe/);
 expect(screen.queryByText(/TEST RAW INTERNAL MESSAGE/)).toBeNull();
 expect(input).toHaveValue('TEST preserved note');expect(screen.getByRole('button',{name:'Lesen'})).toBeEnabled();
});

it.each(['order','customer'] as const)('E1 %s hands off the latest saved text once, rather than an older capture',async action=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json([])));
 const save=vi.fn(async(input)=>({code:'OK',capture:{id:input.itemId,version:1,text:input.text,customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:[],recognition:{kind:'anfrage',text:input.text},files:[]}}));
 const ports={getCaptureScope:vi.fn(async()=>({code:'OK',scope:'TEST-e1-handoff'})),saveCaptureNote:save} as unknown as GlobalCreatePorts;
 const onOrder=vi.fn(),onCustomer=vi.fn();render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={onOrder} onCustomer={onCustomer}/>);
 await waitFor(()=>expect(ports.getCaptureScope).toHaveBeenCalled());
 const input=screen.getByRole('textbox',{name:'Notiz'});fireEvent.change(input,{target:{value:'TEST Anfrage old'}});fireEvent.click(screen.getByRole('button',{name:'Lesen'}));
 await screen.findByRole('button',{name:'Anfrage übernehmen'});
 fireEvent.change(input,{target:{value:'TEST Anfrage latest preserved text'}});
 if(action==='customer')fireEvent.click(screen.getByRole('button',{name:'Anders'}));
 const button=screen.getByRole('button',{name:action==='order'?'Anfrage übernehmen':'Kunde anlegen'});fireEvent.click(button);fireEvent.click(button);
 const called=action==='order'?onOrder:onCustomer;
 await waitFor(()=>expect(called).toHaveBeenCalledOnce());
 expect(save).toHaveBeenCalledTimes(2);
 const latest=expect.objectContaining({id:save.mock.calls[1][0].itemId,text:'TEST Anfrage latest preserved text'});
 if(action==='order')expect(onOrder).toHaveBeenCalledWith(undefined,latest);else expect(onCustomer).toHaveBeenCalledWith(latest);
});

it('EV-11 denied camera keeps a gallery action and browser permission guidance',async()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn(async()=>{throw new DOMException('TEST denied','NotAllowedError');})}});
 const ports={getCaptureScope:vi.fn(async()=>({code:'OK',scope:'TEST-e1-camera-denied'}))} as unknown as GlobalCreatePorts;
 const {container}=render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Foto'}));const gallery=await screen.findByRole('button',{name:'Foto aus der Galerie wählen'});expect(gallery).toBeEnabled();expect(gallery).toHaveClass('kr-btn--erledigen');
 const click=vi.spyOn(container.querySelector('input[type=file]') as HTMLInputElement,'click');fireEvent.click(gallery);expect(click).toHaveBeenCalledOnce();
 expect(screen.getByText('Kamera im Browser freigeben').closest('details')).not.toBeNull();expect(screen.getByRole('textbox',{name:'Notiz'})).toBeEnabled();
});

it('E1 invoice text asks for an original and cannot enter the invoice writer',async()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json([])));
 const save=vi.fn(async(input)=>({code:'OK',capture:{id:input.itemId,version:1,text:input.text,customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:[],recognition:{kind:'rechnung',text:input.text},files:[]}}));
 const openCaptureObject=vi.fn(()=>true);const ports={getCaptureScope:vi.fn(async()=>({code:'OK',scope:'TEST-e1-invoice-text'})),saveCaptureNote:save,openCaptureObject,canManageMoney:true} as unknown as GlobalCreatePorts;
 const {container}=render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()}/>);
 await waitFor(()=>expect(ports.getCaptureScope).toHaveBeenCalled());
 const input=screen.getByRole('textbox',{name:'Notiz'});fireEvent.change(input,{target:{value:'TEST Rechnung Rechnungsnummer TEST-4711'}});fireEvent.keyDown(input,{key:'Enter'});
 const photo=await screen.findByRole('button',{name:'Rechnung fotografieren oder Datei anhängen'});expect(photo).toHaveClass('kr-btn--erledigen');
 const pick=vi.spyOn(container.querySelector('input[type=file]') as HTMLInputElement,'click');fireEvent.click(photo);expect(pick).toHaveBeenCalledOnce();expect(openCaptureObject).not.toHaveBeenCalled();expect(container.querySelector('[data-spec-id="rein.situation"]')).toBeNull();
});

it.each([true,false])('E1 invoice caption uses only an actually recognized number: %s',async hasNumber=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json([])));
 const fileId=crypto.randomUUID(),capture:IntakeCapture={id:crypto.randomUUID(),version:1,text:null,customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:[],recognition:{kind:'rechnung',text:'TEST invoice'},files:[{id:fileId,name:'TEST-invoice.png',mime:'image/png',bytes:1,readable:true,secured:true,status:'fertig'}],suggestions:hasNumber?[{id:crypto.randomUUID(),fileId,orderId:null,field:'rechnung.nummer',value:'TEST-4711',confidence:'high',rule:null,reason:null,source:{},status:'offen'}]:[]};
 const openCaptureObject=vi.fn(()=>true);const ports={getCaptureScope:vi.fn(async()=>({code:'OK',scope:'TEST-e1-invoice-original'})),getCapture:vi.fn(async()=>({code:'OK',capture})),prepareCaptureFile:vi.fn(async()=>({code:'OK',upload:null})),finishCaptureFile:vi.fn(async()=>({code:'OK',capture})),openCaptureObject,canManageMoney:true} as unknown as GlobalCreatePorts;
 const {container}=render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()}/>);
 await waitFor(()=>expect(ports.getCaptureScope).toHaveBeenCalled());const file=new File(['TEST'],capture.files[0].name,{type:'image/png'});Object.defineProperty(file,'arrayBuffer',{value:async()=>new Uint8Array([1]).buffer});fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[file]}});
 const action=await screen.findByRole('button',{name:hasNumber?'Rechnung TEST-4711 ablegen':'Rechnungsnummer ergänzen'});expect(action).toBeEnabled();
 if(hasNumber)expect(screen.queryByText('Fehlt noch: Rechnungsnummer')).toBeNull();else expect(screen.getByText('Fehlt noch: Rechnungsnummer')).toBeVisible();
 fireEvent.click(action);expect(openCaptureObject).toHaveBeenCalledWith('rechnungein',capture.id);
});

it('GW desktop keeps the photo handover until the phone finishes, then shows the same secured capture',async()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json([])));
 let serial=0;const timers=new Map<number,()=>Promise<void>|void>();vi.stubGlobal('setInterval',vi.fn(callback=>{timers.set(++serial,callback);return serial;}));vi.stubGlobal('clearInterval',vi.fn(id=>timers.delete(id)));
 const id=crypto.randomUUID(),fileId=crypto.randomUUID(),requestId=crypto.randomUUID();let ended=false;
 const capture:IntakeCapture={id,version:1,text:null,customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:[],recognition:{kind:'unklar',text:''},files:[{id:fileId,name:'TEST-phone.png',mime:'image/png',bytes:1,readable:false,secured:true,status:'fertig'}]};
 const request=()=>({id:requestId,itemId:id,status:ended?'beendet':'fotos_da',expiresAt:'2027-01-01T12:00:00Z',acceptedOn:[],finishedOn:[],photoCount:1});
 const deviceRequest=vi.fn(async input=>({code:'OK',requests:input.command==='refresh'&&!input.requestId?[]:[request()]}));
 const ports={getCaptureScope:vi.fn(async()=>({code:'OK',scope:'TEST-e1-handover'})),deviceRequest,getCapture:vi.fn(async()=>({code:'OK',capture})),prepareCaptureFile:vi.fn(async()=>({code:'OK',upload:null})),finishCaptureFile:vi.fn(async()=>({code:'OK',capture}))} as unknown as GlobalCreatePorts;
 const {container}=render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()}/>);
 await waitFor(()=>expect(ports.getCaptureScope).toHaveBeenCalled());fireEvent.click(screen.getByRole('button',{name:'Foto'}));
 await screen.findByText('Öffne die App auf Handy oder Tablet – die Kamera ist dort offen');
 const file=new File(['TEST'],capture.files[0].name,{type:'image/png'});Object.defineProperty(file,'arrayBuffer',{value:async()=>new Uint8Array([1]).buffer});fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[file]}});
 await screen.findByText('1 Fotos am Eingang');expect(container.querySelector('[data-spec-id="rein.situation"]')).toBeNull();
 ended=true;await Promise.all([...timers.values()].map(callback=>callback()));
 await waitFor(()=>expect(container.querySelector('[data-spec-id="rein.situation"]')).not.toBeNull());expect(screen.queryByText('Öffne die App auf Handy oder Tablet – die Kamera ist dort offen')).toBeNull();
 expect(deviceRequest.mock.calls.filter(([value])=>value.command==='request')).toHaveLength(1);
});

it('E1 start shell has one personal heading and compact real photo/file actions, never a speech stub',async()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json([])));
 const deviceRequest=vi.fn(async()=>({code:'OK',requests:[]}));const ports={actorDisplayName:'Rolf Muster',getCaptureScope:vi.fn(async()=>({code:'OK',scope:'TEST-e1-shell'})),deviceRequest} as unknown as GlobalCreatePorts;
 const {container}=render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()}/>);
 expect(screen.getAllByRole('heading',{name:'Hey Rolf, was kann ich für dich tun?'})).toHaveLength(1);
 expect(screen.getByRole('dialog',{name:'Hey Rolf, was kann ich für dich tun?'})).toBeVisible();
 expect(screen.getByRole('button',{name:'Foto'})).toBeEnabled();expect(screen.getByRole('button',{name:'Datei'})).toBeEnabled();expect(screen.queryByRole('button',{name:/Sprechen|Mikrofon/})).toBeNull();
 expect(container.querySelector('.ev-rein-karten')).toBeNull();expect(screen.getByRole('button',{name:'Auftrag oder KV erfassen'})).toBeEnabled();expect(screen.getByRole('button',{name:'Kunde anlegen'})).toBeEnabled();
});

it('E1 replacing the old proposal box preserves excluded concerns from an existing local draft',async()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json([])));
 const id=crypto.randomUUID(),stand=crypto.randomUUID(),text='TEST bitte anrufen. Bitte die Maschine reparieren.';
 vi.mocked(readPendingOriginals).mockResolvedValueOnce([{id,itemId:id,kind:'note',text,textstand:stand,dismissed:['aufgabe']}]);
 const save=vi.fn(async input=>({code:'OK',capture:{id:input.itemId,version:1,text:input.text,customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:input.concerns,files:[]}}));
 const ports={getCaptureScope:vi.fn(async()=>({code:'OK',scope:'TEST-e1-retained-concerns'})),saveCaptureNote:save} as unknown as GlobalCreatePorts;
 render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()}/>);
 await waitFor(()=>expect(screen.getByRole('textbox',{name:'Notiz'})).toHaveValue(text));fireEvent.click(await screen.findByRole('button',{name:'Lesen'}));
 await waitFor(()=>expect(save).toHaveBeenCalledOnce());expect(save.mock.calls[0][0]).toMatchObject({itemId:id,textstand:stand,text,concerns:['rueckruf']});
 expect(screen.queryByText('ERKANNT · Vorschläge')).toBeNull();expect(screen.queryByRole('button',{name:/×/})).toBeNull();expect(screen.getByRole('textbox',{name:'Notiz'})).toHaveValue(text);
});
