import { describe, expect, it } from "vitest";

import {
  getNextOperationalProcessStation,
  isCanonicalClientEventId,
  normalizeOperationalProcessStatus,
} from "@/lib/orders/processContract";

describe("process receipt contract", () => {
  it("accepts only stable UUID event IDs", () => {
    expect(isCanonicalClientEventId("01a16b83-0176-4d63-a8c8-606a2d7a0d0a")).toBe(true);
    expect(isCanonicalClientEventId("not-a-uuid")).toBe(false);
    expect(isCanonicalClientEventId("")).toBe(false);
  });

  it("keeps the approved station and status contracts closed", () => {
    expect(getNextOperationalProcessStation("qualitaetssicherung")).toBe("warenausgang");
    expect(normalizeOperationalProcessStatus("ready")).toBe("ready");
    expect(normalizeOperationalProcessStatus("cancelled")).toBeNull();
  });
});
