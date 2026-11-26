import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GoodsReceiptDialog, type GoodsReceiptPorts } from "../GoodsReceiptDialog";
import type { GoodsReceiptReadResult } from "../../goodsReceiptContract";
import {webcrypto} from 'node:crypto';
import {readPendingOriginals,retainPendingOriginal,acknowledgePendingOriginal} from '../../pendingOriginals';

vi.mock("../../pendingOriginals", () => ({
  readPendingOriginals: vi.fn(async () => []),
  retainPendingOriginal: vi.fn(async () => undefined),
  acknowledgePendingOriginal: vi.fn(async () => undefined),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("U242 names and focuses the first unchecked position, not the first row", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  Element.prototype.scrollIntoView=vi.fn();
  const order={id:"synthetic-order",number:"SYNTHETISCH-1",customerId:"synthetic-customer",customerName:"SYNTHETISCH",title:null,note:null,version:1,station:"eingang",status:"offen",ware:"erwartet",fromQuote:false,
    items:[{id:"first",name:"SYNTHETISCH Teil 1",quantity:1,unit:"stueck",surface:"verzinken",note:null},{id:"second",name:"SYNTHETISCH Teil 2",quantity:1,unit:"stueck",surface:"verzinken",note:null}]};
  const receipt={id:crypto.randomUUID(),client_key:crypto.randomUUID(),item_id:null,auftrag_id:order.id,modus:"erwartet" as const,status:"entwurf" as const,version:1,karte:3,packstuecke_da:1,packstuecke_gesamt:1,zustand:"unauffaellig" as const,abweichung:[],abgestellt:false,fund_zeit:null,verfahren_wie_kv:null,verfahren_abweichung:null,
    fotos:[{fileId:crypto.randomUUID(),kind:"uebersicht" as const}],mengen:[{teil_id:"first",erwartet:1,bestaetigt:1,geaendert:false,hinweis:null},{teil_id:"second",erwartet:1,bestaetigt:null,geaendert:false,hinweis:null}],offen:[],bestaetigt_von:null};
  const read:GoodsReceiptReadResult={code:"OK",order,receipts:[receipt],canStartGalvanik:true};
  const save=vi.fn();
  const ports={read:vi.fn(async()=>read),scope:vi.fn(async()=>({code:"OK",scope:"synthetic-gaps"})),save} as unknown as GoodsReceiptPorts;
  render(<GoodsReceiptDialog orderId={order.id} ports={ports} onClose={vi.fn()} onOriginal={vi.fn()} onMessage={vi.fn()}/>);
  await screen.findByText("SYNTHETISCH Teil 2");
  fireEvent.click(screen.getByRole("button",{name:"Annehmen · in Galvanik"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Noch offen: Menge bestätigen · Position 2");
  const second=screen.getByText("SYNTHETISCH Teil 2").closest("article");
  if(!second)throw Error("SECOND_POSITION_MISSING");
  await waitFor(()=>expect(within(second).getByRole("button",{name:"stimmt"})).toHaveFocus());
  expect(save.mock.calls.every(([value])=>value.command!=="galvanik")).toBe(true);
});

it('W03 keeps the photo gap actionable when the background draft save completes', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
  Element.prototype.scrollIntoView = vi.fn();
  const order = {id:'synthetic-w03-order', number:'SYNTHETISCH-W03', customerId:'synthetic-customer', customerName:'SYNTHETISCH', title:null, note:null, version:1, station:'eingang', status:'offen', ware:'erwartet', fromQuote:false, items:[]};
  const receipt = {id:crypto.randomUUID(), client_key:crypto.randomUUID(), item_id:null, auftrag_id:order.id, modus:'erwartet' as const, status:'entwurf' as const, version:1, karte:3, packstuecke_da:1, packstuecke_gesamt:1, zustand:'unauffaellig' as const, abweichung:[], abgestellt:false, fund_zeit:null, verfahren_wie_kv:null, verfahren_abweichung:null, fotos:[], mengen:[], offen:[], bestaetigt_von:null};
  const read: GoodsReceiptReadResult = {code:'OK', order, receipts:[receipt], canStartGalvanik:true};
  let acknowledge!: (result: Awaited<ReturnType<GoodsReceiptPorts['save']>>) => void;
  const save = vi.fn<GoodsReceiptPorts['save']>(() => new Promise(resolve => { acknowledge = resolve; }));
  const ports: GoodsReceiptPorts = {read:vi.fn(async () => read), scope:vi.fn(async () => ({code:'OK' as const, scope:'synthetic-w03'})), save, prepareFile:vi.fn(), finishFile:vi.fn()};
  const onClose = vi.fn();

  render(<GoodsReceiptDialog orderId={order.id} ports={ports} onClose={onClose} onOriginal={vi.fn()} onMessage={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', {name:'Annehmen · in Galvanik'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Noch offen: Foto Paket oder Teile');
  const jump = screen.getByRole('button', {name:'Zur Lücke'});
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({command:'draft', card:1})));
  await act(async () => acknowledge({code:'OK', receipt:{...receipt, version:2, karte:1}, replayed:false}));

  expect(screen.getByRole('button', {name:'Zur Lücke'})).toBe(jump);
  expect(screen.getByRole('alert')).toHaveTextContent('Noch offen: Foto Paket oder Teile');
  expect(save).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(jump);
  await waitFor(() => expect(screen.getByRole('button', {name:'Paket gesamt'})).toHaveFocus());
});

it('K2 retains the same real device identifier before preparing a resumed goods photo and keeps it after upload failure',async()=>{
 vi.stubGlobal('crypto',webcrypto);
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.spyOn(console,'error').mockImplementation(()=>{});
 const deviceId=crypto.randomUUID();localStorage.setItem('kreile-browser-device-v1',deviceId);
 const file=new File(['SYNTHETIC photo bytes'],'TEST-K2.png',{type:'image/png'});
 Object.defineProperty(file,'arrayBuffer',{value:async()=>new Uint8Array([1,2,3]).buffer});
 const context={orderId:'synthetic-k2-order',receiptId:crypto.randomUUID(),clientKey:crypto.randomUUID(),photoKind:'uebersicht' as const};
 const fileId=crypto.randomUUID(),itemId=crypto.randomUUID();
 vi.mocked(readPendingOriginals).mockResolvedValueOnce([{id:fileId,itemId,kind:'file',file,captureOrigin:'warenfoto',context}]);
 vi.mocked(retainPendingOriginal).mockClear();vi.mocked(acknowledgePendingOriginal).mockClear();
 const read:GoodsReceiptReadResult={code:'OK',order:{id:context.orderId,number:'SYNTHETISCH-K2',customerId:'synthetic-customer',customerName:'SYNTHETISCH',title:null,note:null,version:1,station:'eingang',status:'offen',ware:'erwartet',fromQuote:false,items:[{id:'synthetic-part',name:'SYNTHETISCH Teil',quantity:1,unit:'stueck',surface:'verzinken',note:null}]},receipts:[],canStartGalvanik:true};
 const prepareFile=vi.fn(async()=>({code:'UNAVAILABLE' as const,message:'SYNTHETIC Netzfehler'}));
 const ports={read:vi.fn(async()=>read),scope:vi.fn(async()=>({code:'OK' as const,scope:'synthetic-k2-scope'})),save:vi.fn(),prepareFile,finishFile:vi.fn()};
 render(<GoodsReceiptDialog orderId={context.orderId} ports={ports} onClose={vi.fn()} onOriginal={vi.fn()} onMessage={vi.fn()}/>);
 await waitFor(()=>expect(prepareFile).toHaveBeenCalledTimes(1));
 expect(retainPendingOriginal).toHaveBeenCalledWith('synthetic-k2-scope',expect.objectContaining({id:fileId,itemId,file,deviceId,captureOrigin:'warenfoto',context}));
 expect(prepareFile).toHaveBeenCalledWith(expect.objectContaining({itemId,fileId,deviceId,captureOrigin:'warenfoto'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('SYNTHETIC Netzfehler');
 expect(screen.getByRole('button',{name:'Erneut übertragen'})).toBeVisible();
 expect(acknowledgePendingOriginal).not.toHaveBeenCalled();expect(ports.save).not.toHaveBeenCalled();
});
