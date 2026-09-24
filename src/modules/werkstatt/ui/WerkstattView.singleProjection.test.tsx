import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    expect(within(workshop).getByRole("group", { name: "Werkstattaktionen" })).toBeVisible();
    expect(within(workshop).queryByRole("navigation", { name: "Werkstattaktionen" })).not.toBeInTheDocument();
  });

  it("keeps the action group in page flow and reserves the mobile create-button lane", () => {
    const css = readFileSync(
      join(process.cwd(), "src/modules/werkstatt/ui/WerkstattView.module.css"),
      "utf8",
    );

    expect(css).toMatch(/\.actionBar\s*\{[^}]*position:\s*static;/);
    expect(css).not.toMatch(/\.actionBar\s*\{[^}]*position:\s*(?:fixed|sticky);/);
    expect(css).toMatch(
      /@media \(max-width: 520px\)[\s\S]*\.actionBar\s*\{[^}]*margin-bottom:\s*96px;[\s\S]*\.actionBar > \.actionSecondary:last-child\s*\{[^}]*max-width:\s*calc\(100% - 112px\);/,
    );
  });
});
