// @vitest-environment node
import { Children, isValidElement, type ReactNode } from "react";
import { expect, it } from "vitest";
import { DeliveryNoteDocument, type PaidDeliveryNoteSnapshot } from "../DeliveryNote";

const snapshot: PaidDeliveryNoteSnapshot = {
  schemaVersion: 2,
  createdAt: "2026-11-26T10:00:00.000Z",
  company: { companyName: "TEST Betrieb", street: "TEST Straße 1", zip: "00000", city: "TEST Ort", country: "Deutschland" },
  customer: { id: "TEST-K", name: "TEST Kunde", street: "TEST Weg 1", zip: "00000", city: "TEST Ort", country: "Deutschland" },
  orders: [{
    id: "TEST-A",
    number: "TEST-1",
    version: 1,
    title: "TEST Lieferung",
    parts: [{ itemId: "TEST-T", name: "TEST Teil", quantity: 2 }],
    payments: [],
  }],
};

function texte(knoten: ReactNode): string[] {
  if (typeof knoten === "string") return [knoten];
  if (isValidElement<{ children?: ReactNode }>(knoten)) {
    return Children.toArray(knoten.props.children).flatMap(texte);
  }
  return [];
}

it.each([
  ["delivery_note.preview_payment_required", "Vorab-Lieferschein – Ware erst nach Zahlung"],
  [undefined, undefined],
] as const)("zeigt den Vermerk für %s ausschließlich auf der Vorabfassung", (vorab, erwarteterText) => {
  const dokument = DeliveryNoteDocument({ snapshot: { ...snapshot, vorab }, logo: null });
  const vermerke = texte(dokument).filter((text) => text.startsWith("Vorab-Lieferschein"));
  expect(vermerke).toEqual(erwarteterText ? [erwarteterText] : []);
});
