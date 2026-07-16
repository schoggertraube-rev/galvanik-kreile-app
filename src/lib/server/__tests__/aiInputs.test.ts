import { describe, expect, it } from "vitest";
import {
  parseCustomerEnrichmentResult,
  parseCustomerEnrichInput,
  parseCustomerFreetextResult,
  parseFreetextInput,
  parseInquiryInput,
  parseNotesInput,
} from "@/lib/server/aiInputs";

describe("AI request input contracts", () => {
  it("normalizes bounded valid inputs", () => {
    expect(parseCustomerEnrichInput({ company_name: "  Kreile GmbH  ", city: "Hanau" }))
      .toEqual({ company_name: "Kreile GmbH", city: "Hanau" });
    expect(parseFreetextInput({ text: " Auftrag " })).toEqual({ text: "Auftrag" });
    expect(parseInquiryInput({ text: "Mail", subject: " Anfrage " }))
      .toEqual({ text: "Mail", subject: "Anfrage" });
    expect(parseNotesInput({ text: "Rückruf" })).toEqual({ text: "Rückruf" });
  });

  it("rejects unknown keys, empty values and oversized inputs", () => {
    expect(() => parseCustomerEnrichInput({ city: "Hanau" })).toThrow("INVALID_AI_INPUT");
    expect(() => parseCustomerEnrichInput({ name: "Kreile", role: "admin" })).toThrow("INVALID_AI_INPUT");
    expect(() => parseFreetextInput({ text: "x".repeat(8_001) })).toThrow("INVALID_AI_INPUT");
    expect(() => parseInquiryInput({ text: "Mail", subject: "x".repeat(301) })).toThrow("INVALID_AI_INPUT");
    expect(() => parseNotesInput({ text: " " })).toThrow("INVALID_AI_INPUT");
  });

  it("accepts only bounded customer extraction and source-backed enrichment output", () => {
    expect(parseCustomerFreetextResult({
      type: "business",
      company: "Kreile GmbH",
      contactName: null,
      email: "info@example.test",
      phone: null,
      street: null,
      zipCode: null,
      city: "Hanau",
      notes: null,
    })).toEqual(expect.objectContaining({ type: "business", company: "Kreile GmbH" }));

    expect(parseCustomerEnrichmentResult({
      website: "https://example.test",
      phone: null,
      email: null,
      street: null,
      zipCode: null,
      city: "Hanau",
      country: "DE",
      confidence: 0.8,
      groundingSources: [{ url: "https://source.example.test/page", title: "Quelle" }],
    })).toEqual(expect.objectContaining({ confidence: 0.8, country: "DE" }));
  });

  it("rejects ungrounded enrichment, invalid email and unknown output fields", () => {
    expect(() => parseCustomerEnrichmentResult({
      website: "https://invented.example",
      phone: null,
      email: null,
      street: null,
      zipCode: null,
      city: null,
      country: null,
      confidence: 0.4,
      groundingSources: [],
    })).toThrow("INVALID_AI_OUTPUT");
    expect(() => parseCustomerFreetextResult({
      type: "lead",
      company: null,
      contactName: null,
      email: "not-an-email",
      phone: null,
      street: null,
      zipCode: null,
      city: null,
      notes: null,
    })).toThrow("INVALID_AI_OUTPUT");
  });
});
