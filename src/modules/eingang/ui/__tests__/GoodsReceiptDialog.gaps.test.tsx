import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GoodsReceiptDialog, type GoodsReceiptPorts } from "../GoodsReceiptDialog";
import type { GoodsReceiptReadResult } from "../../goodsReceiptContract";

vi.mock("../../pendingOriginals", () => ({
  readPendingOriginals: vi.fn(async () => []),
  retainPendingOriginal: vi.fn(async () => undefined),
  acknowledgePendingOriginal: vi.fn(async () => undefined),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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
  expect(await screen.findByRole("alert")).toHaveTextContent("Noch offen: Position 2 prüfen");
  const second=screen.getByText("SYNTHETISCH Teil 2").closest("article");
  if(!second)throw Error("SECOND_POSITION_MISSING");
  await waitFor(()=>expect(within(second).getByRole("button",{name:"stimmt"})).toHaveFocus());
  expect(save.mock.calls.every(([value])=>value.command!=="galvanik")).toBe(true);
});
