import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobalCreatePorts } from "../GlobalCreateFlow";
import { IntakeCaptureDialog } from "../ui/IntakeCaptureDialog";
import type { IntakeCapture } from "../captureContract";

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
    for (const name of [...Object.values(labels), "Anderen Kunden oder Vorgang wählen", "Text ändern"])
      expect(screen.getByRole("button", { name })).toBeEnabled();
    expect(screen.getByRole("button",{name:"Original ansehen · "+capture.files[0].name})).toBeEnabled();
    expect(screen.queryByRole("textbox",{name:"Notiz"})).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: labels[kind] }));
    await waitFor(() => expect(chooseCaptureKind).toHaveBeenCalledWith(expect.objectContaining({ itemId: capture.id, version: 1, kind })));
    if (kind === "anfrage") await waitFor(() => expect(onOrder).toHaveBeenCalledWith(undefined, chosen));
    else if(kind === "ware"){await screen.findByRole("heading",{name:"Absender nicht erkannt"});expect(onOrder).not.toHaveBeenCalled();expect(screen.getByRole("button",{name:"Anderen Kunden oder Vorgang wählen"})).toBeEnabled();}
    else await waitFor(() => expect(openCaptureObject).toHaveBeenCalledWith(kind === "rechnung" ? "rechnungein" : "mailein", capture.id + (kind === "dokument" ? "#rein" : "")));
  });
});

describe('BA automatic invoice route after secured recognition',()=>{
 it.each([true,false])('opens the sole invoice route once only with money right=%s and retains unprivileged originals',async allowed=>{
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));vi.stubGlobal('fetch',vi.fn(async()=>Response.json([])));
  const capture:IntakeCapture={id:crypto.randomUUID(),version:2,text:null,customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:['rechnung'],recognition:{kind:'rechnung',text:''},files:[{id:crypto.randomUUID(),name:'TEST BA invoice.jpg',mime:'image/jpeg',bytes:1,readable:true,secured:true,status:'fertig'}]};
  const openCaptureObject=vi.fn(()=>true),onClose=vi.fn(),ports={getCaptureScope:vi.fn(async()=>({code:'OK',scope:'TEST-BA-scope'})),getCapture:vi.fn(async()=>({code:'OK',capture})),prepareCaptureFile:vi.fn(async()=>({code:'OK',upload:null})),finishCaptureFile:vi.fn(async()=>({code:'OK',capture})),openCaptureObject,canManageMoney:allowed} as unknown as GlobalCreatePorts;
  const {container}=render(<IntakeCaptureDialog ports={ports} onClose={onClose} onOrder={vi.fn()} onCustomer={vi.fn()}/>);await waitFor(()=>expect(ports.getCaptureScope).toHaveBeenCalled());const file=new File(['x'],capture.files[0].name,{type:'image/jpeg'});Object.defineProperty(file,'arrayBuffer',{value:async()=>new Uint8Array([1]).buffer});fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[file]}});
  await screen.findByRole('button',{name:'Original ansehen · '+capture.files[0].name});if(allowed){await waitFor(()=>expect(openCaptureObject).toHaveBeenCalledExactlyOnceWith('rechnungein',capture.id));expect(onClose).toHaveBeenCalledOnce();}else{expect(openCaptureObject).not.toHaveBeenCalled();expect(onClose).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Original ansehen · '+capture.files[0].name})).toBeEnabled();}
 });
});
