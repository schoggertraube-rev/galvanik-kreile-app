import { cleanup, render, screen, within } from "@testing-library/react";
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
});

describe("WerkstattView projection", () => {
  it("keeps status, WIP and actions inside the named Werkstatt region", () => {
    render(<WerkstattView view={view} ports={ports} onRetry={vi.fn()} />);

    const workshop = screen.getByRole("region", { name: "Werkstatt" });
    expect(within(workshop).getByTestId("werkstatt-status")).toBeVisible();
    expect(within(workshop).getByTestId("werkstatt-wip-tile")).toBeVisible();
    expect(within(workshop).getByRole("navigation", { name: "Werkstattaktionen" })).toBeVisible();
  });
});
