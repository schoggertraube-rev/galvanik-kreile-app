import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/customerSummaryRead", () => ({ readCustomerProfile: vi.fn() }));

import { customerWriteObject, parseCustomerFreeTextAgreements } from "../server/customerWriteContract";

const customerId = "4dd2a51d-8342-421d-9ae1-31a024f7d44c";
const clientEventId = "ebcf6240-b16e-4a97-a799-b5a1d81e8791";

const agreement = {
  id: null,
  bezeichnung: "Verpackung",
  wert: "Bitte stoßfest verpacken",
  geld: false,
  hinweis: true,
  gueltigBis: null,
};

describe("customer free-text agreement contract", () => {
  it("accepts exactly the complete ordered list on the existing update command", () => {
    expect(parseCustomerFreeTextAgreements([agreement])).toEqual([agreement]);
    expect(customerWriteObject({ customerId, clientEventId, agreements: [agreement] }, true)).toMatchObject({
      customerId,
      clientEventId,
      agreements: [agreement],
    });
  });

  it("rejects malformed, incomplete, duplicate, and invalid-date rows before a write", () => {
    expect(parseCustomerFreeTextAgreements([{ ...agreement, wert: "" }])).toBeNull();
    expect(parseCustomerFreeTextAgreements([{ ...agreement, gueltigBis: "2026-02-29" }])).toBeNull();
    expect(parseCustomerFreeTextAgreements([{ ...agreement, unexpected: true }])).toBeNull();
    expect(parseCustomerFreeTextAgreements([{ ...agreement, id: customerId }, { ...agreement, id: customerId }])).toBeNull();
    expect(customerWriteObject({ customerId, clientEventId, agreements: [{ ...agreement, hint: true }] }, true)).toBeNull();
  });
});
