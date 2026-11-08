import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkshopViewModel, WerkstattViewPorts } from "../server/types";
import { WerkstattView } from "./WerkstattView";

const view: WorkshopViewModel = {
  kind: "data",
  source: "Auftragsbestand",
  loadedAt: "2026-09-24T08:00:00.000Z",
  dominant: null,
  greetingName: "Rolf",
  dringendCount: 0,
  weitereCount: 0,
  held: [],
  bundleSuggestion: null,
  wipCount: 0,
  dueThisWeekCount: 0,
  pickerOrders: [],
  goodsOutCandidates: [],
  canCreateOrder: true,
};

const ports: WerkstattViewPorts = {
  onOpenOrder: vi.fn(),
  onOpenGoodsOut: vi.fn(),
  onOpenWip: vi.fn(),
  onScanOrder: vi.fn(),
  onCreateOrder: vi.fn(),
};

afterEach(() => {
  cleanup();
});

describe("WerkstattView projection", () => {
  it("keeps status, WIP and actions inside the named Werkstatt region", () => {
    render(<WerkstattView view={view} ports={ports} onRetry={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Werkstatt" })).toBeVisible();
    expect(screen.getByTestId("werkstatt-status")).toBeVisible();
    expect(screen.getByTestId("werkstatt-wip-tile")).toBeVisible();
    expect(screen.getByRole("group", { name: "Werkstattaktionen" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Werkstattaktionen" })).not.toBeInTheDocument();
  });

  it("keeps every action attached to an injected real port", () => {
    render(<WerkstattView view={view} ports={ports} onRetry={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Auftrag öffnen" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Neu erfassen" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ware raus" })).toBeVisible();
  });
});

it('KV goods filters partition the actual reader rows and open the exact quote',()=>{
 const open=vi.fn();render(<WerkstattView onRetry={vi.fn()} ports={{...ports,onOpenQuote:open}} view={{...view,kind:'data',quoteGoods:[{id:'TEST-KV-A',number:'TEST-KV-1',customer:'TEST Kunde A',parts:'3 × TEST Halter',due:'2026-12-01',kind:'expected',locations:[],reason:null},{id:'TEST-KV-B',number:'TEST-KV-2',customer:'TEST Kunde B',parts:'4 × TEST Griff',due:'2026-12-01',kind:'blocked',locations:['TEST Regal'],reason:'Zusage fehlt'}]}}/>);
 expect(screen.getByRole('button',{name:'Alle · 2'})).toBeVisible();
 expect(screen.getByRole('button',{name:'Ware erwartet · 1'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Gesperrt · 1'}));
 expect(screen.queryByRole('heading',{name:'TEST-KV-1 · TEST Kunde A'})).toBeNull();
 expect(screen.getByText('gesperrt · TEST Regal · Zusage fehlt')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'KV öffnen'}));expect(open).toHaveBeenCalledWith('TEST-KV-B');
});

it('never hides the canonical list limit when no loaded quote is a goods candidate',()=>{
 render(<WerkstattView view={{...view,kind:'data',quoteGoods:[],quoteGoodsLimited:true}} ports={ports} onRetry={vi.fn()}/>);
 expect(screen.getByText('Anzeige auf die 100 zuletzt geänderten offenen KVs beschränkt.')).toBeVisible();
});
