import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PhillipWerkstattViewModel, WerkstattViewPorts } from "../server/types";
import { WerkstattView } from "./WerkstattView";

const view: PhillipWerkstattViewModel = {
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
  delete (window as Window & { __kreileWerkstattViewRegistry?: unknown })
    .__kreileWerkstattViewRegistry;
});

describe("WerkstattView projection ownership", () => {
  it("keeps exactly one projection active while a preserved route instance is still mounted", async () => {
    render(
      <>
        <WerkstattView view={view} ports={ports} onRetry={vi.fn()} />
        <WerkstattView view={view} ports={ports} onRetry={vi.fn()} />
      </>,
    );

    await waitFor(() => expect(screen.getAllByTestId("werkstatt-status")).toHaveLength(1));
    expect(screen.getAllByTestId("werkstatt-wip-tile")).toHaveLength(1);
    expect(screen.getAllByRole("navigation", { name: "Werkstattaktionen" })).toHaveLength(1);
  });

  it("takes document-wide ownership from a projection registered by another route chunk", async () => {
    const previousOwner = Symbol("previous-route-chunk");
    (window as Window & { __kreileWerkstattViewRegistry?: unknown })
      .__kreileWerkstattViewRegistry = {
        mounted: [previousOwner],
        listeners: new Set(),
        active: previousOwner,
      };

    render(<WerkstattView view={view} ports={ports} onRetry={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByTestId("werkstatt-status")).toHaveLength(1));
    const registry = (window as Window & {
      __kreileWerkstattViewRegistry?: { active: symbol | null };
    }).__kreileWerkstattViewRegistry;
    expect(registry?.active).not.toBe(previousOwner);
  });
});
