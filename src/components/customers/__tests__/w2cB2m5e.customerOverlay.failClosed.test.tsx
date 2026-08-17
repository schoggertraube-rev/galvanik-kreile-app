import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  const close = vi.fn();
  return {
    close,
    useCustomerOverlay: vi.fn(() => ({ customerId: "foreign-customer", isOpen: true, close })),
    useOverlayStore: vi.fn((selector: (state: { stack: Array<{ type: "customer"; id: string }> }) => unknown) => selector({
      stack: [{ type: "customer", id: "foreign-customer" }],
    })),
    AppOverlayPortal: vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>),
  };
});

vi.mock("../useCustomerOverlay", () => ({ useCustomerOverlay: mocked.useCustomerOverlay }));
vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: mocked.useOverlayStore }));
vi.mock("@/components/ui/AppOverlayPortal", () => ({ AppOverlayPortal: mocked.AppOverlayPortal }));

import { CustomerOverlay } from "../CustomerOverlay";

const message = "NOT_AVAILABLE: Die Kundenakte benötigt einen tenant- und ownership-geprüften W3-Read-/Command-Vertrag.";

describe("W2C-B2M5E customer overlay privacy containment", () => {
  it("renders the global overlay endpoint as a closable denial", () => {
    render(<CustomerOverlay />);

    expect(screen.getByText(message)).toBeVisible();
    expect(mocked.useCustomerOverlay).toHaveBeenCalledOnce();
    expect(mocked.useOverlayStore).toHaveBeenCalledOnce();
    expect(mocked.AppOverlayPortal).toHaveBeenCalledOnce();

    fireEvent.click(screen.getAllByRole("button", { name: "Kundenakte schließen" })[1]);
    fireEvent.click(screen.getByTestId("customer-overlay-backdrop"));
    expect(mocked.close).toHaveBeenCalledTimes(2);
  });

  it("contains no customer data hook, action port, tabs, or former data-state branch", async () => {
    const source = await readFile(resolve(process.cwd(), "src/components/customers/CustomerOverlay.tsx"), "utf8");
    const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    expect(executableSource).toMatch(/import\s+\{\s*useCustomerOverlay\s*\}\s+from\s+["']\.\/useCustomerOverlay["']/);
    expect(executableSource).toMatch(/import\s+\{\s*useOverlayStore\s*\}\s+from\s+["']@\/lib\/overlayStore["']/);
    expect(executableSource).toMatch(/<AppOverlayPortal>/);
    expect(executableSource).not.toMatch(/useCustomerData|customerCard\.actions|Customer(?:Header|KpiRow|OverviewTab|OrdersTab|HistorySimilarTab|ItemsProfileTab|PricesTab|CommunicationTab|ComplaintsTab|InvoicesTab|PhotosTab|AnalysisTab|NotesTab)|activeTab|setActiveTab|isLoading|customerData|Kunde nicht gefunden|Noch keine belastbaren/);
  });
});
