import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-pdf/renderer", async () => {
  const React = await import("react");
  const wrapper = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Document: wrapper,
    Page: wrapper,
    Text: wrapper,
    View: wrapper,
    Image: wrapper,
    StyleSheet: { create: <T,>(styles: T) => styles },
  };
});

import { OrderLabelDocument } from "@/lib/pdf/OrderLabel";

afterEach(() => vi.restoreAllMocks());

const renderLabel = (intakeDate: string | null, dueDate: string | null) => render(
  <OrderLabelDocument
    data={{
      orderNumber: "A-2026-0001",
      customerName: "Kunde",
      partSummary: "2 Stück",
      intakeDate,
      dueDate,
      qrCodeDataUrl: "data:image/png;base64,qr",
    }}
  />,
);

describe("W2C-B2M5U label date truth", () => {
  it.each([[null, null], ["", "   "], ["invalid", "not-a-date"], ["2026-02-30", "2026-13-01"]])(
    "renders missing or invalid persisted dates as fehlt for %p / %p",
    (intakeDate, dueDate) => {
      renderLabel(intakeDate, dueDate);
      expect(screen.getByText("Eingangsdatum")).toBeInTheDocument();
      expect(screen.getByText("Liefertermin")).toBeInTheDocument();
      expect(screen.getAllByText("fehlt")).toHaveLength(2);
      expect(screen.queryByText("11.08.2026")).not.toBeInTheDocument();
    },
  );

  it("renders the fixed 62 × 40 mm label fields with persisted dates", () => {
    renderLabel("2026-08-06T10:00:00.000Z", "2026-08-12T10:00:00.000Z");

    expect(screen.getByText("Auftrag")).toBeInTheDocument();
    expect(screen.getAllByText("Kunde")).toHaveLength(2);
    expect(screen.getByText("Anzahl Teile")).toBeInTheDocument();
    expect(screen.getByText("KREILE:A-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("06.08.2026")).toBeInTheDocument();
    expect(screen.getByText("12.08.2026")).toBeInTheDocument();
  });
});
