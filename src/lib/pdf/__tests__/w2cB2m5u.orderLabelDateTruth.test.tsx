import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-pdf/renderer", async () => {
  const React = await import("react");
  const wrapper = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Document: wrapper, Page: wrapper, Text: wrapper, View: wrapper, Image: wrapper, StyleSheet: { create: <T,>(styles: T) => styles } };
});

import { OrderLabelDocument } from "@/lib/pdf/OrderLabel";

afterEach(() => vi.restoreAllMocks());
const renderLabel = (intakeDate: unknown, dueDate: unknown) => render(
  <OrderLabelDocument
    data={[{ order: { id: "1", orderNumber: "A-1", title: "Teil", intakeDate, dueDate, parts: [] } as never, customerName: "Kunde", qrCodeBase64: "" }]}
    settings={{ companyName: "Kreile" } as never}
  />,
);

describe("W2C-B2M5U label date truth", () => {
  it.each([[undefined, undefined], ["", "   "], ["invalid", "not-a-date"]])("renders both missing date values as unrecorded for %p / %p", (intakeDate, dueDate) => {
    renderLabel(intakeDate, dueDate);
    expect(screen.getByText("EINGANGSDATUM")).toBeInTheDocument();
    expect(screen.getByText("ZIELDATUM")).toBeInTheDocument();
    expect(screen.getAllByText("Nicht erfasst")).toHaveLength(2);
    expect(screen.queryByText("11.08.2026")).not.toBeInTheDocument();
  });

  it("renders valid persisted dates exactly in the label format", () => {
    renderLabel("2026-08-06T10:00:00.000Z", "2026-08-12T10:00:00.000Z");
    expect(screen.getByText("06.08.2026")).toBeInTheDocument();
    expect(screen.getByText("12.08.2026")).toBeInTheDocument();
  });
});
