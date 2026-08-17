import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrintQueuePage from "../page";

const routePath = resolve(process.cwd(), "src/app/print-queue/page.tsx");
const expectedSource = `import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PrintQueuePage() {
  return <FoundationUnavailable />;
}
`;

describe("F0 W2C print queue unavailable containment", () => {
  it("renders the real route as the shared unavailable state", () => {
    const html = renderToStaticMarkup(<PrintQueuePage />);

    expect(html).toContain("NOT_AVAILABLE");
    expect(html).toContain("Operative Daten sind noch nicht verfügbar");
    expect(html).toContain("Für diesen Bereich ist noch keine kanonische, quellgestützte operative Datenbasis verfügbar.");

    for (const unavailableText of ["Alles erledigt", "Etiketten drucken", "spinner", "checkbox", "PDF"]) {
      expect(html).not.toContain(unavailableText);
    }
  });

  it("source-locks the route to the sole shared unavailable wrapper", () => {
    const source = readFileSync(routePath, "utf8").replace(/\r\n/g, "\n");

    expect(source).toBe(expectedSource);
    for (const forbiddenToken of [
      "useEffect",
      "usePageView",
      "ordersRepository",
      "BulkLabelPrintView",
      "generateOrderLabel",
      "window",
      "PDF",
      "pdf",
      "setOrders",
    ]) {
      expect(source).not.toContain(forbiddenToken);
    }
  });
});
