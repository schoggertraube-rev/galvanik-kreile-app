import { describe, expect, it } from "vitest";
import { recognizeIntakeText } from "../intakeTextRecognition";

describe("recognizeIntakeText", () => {
  it("extracts contact data, due date and separate positions without prices", () => {
    const result = recognizeIntakeText(
      "TEST Kreile GmbH\ninfo@example.invalid\n0711 / 123456\n70173 Stuttgart\n2 Stück Flansch verzinken matt; 3 kg Halter vernickeln bis 12.11.",
      new Date("2026-10-28T00:00:00.000Z"),
    );

    expect(result.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "companyName", value: "TEST Kreile GmbH" }),
      expect.objectContaining({ field: "email", value: "info@example.invalid" }),
      expect.objectContaining({ field: "zipCode", value: "70173" }),
      expect.objectContaining({ field: "city", value: "Stuttgart" }),
      expect.objectContaining({ field: "dueDate", value: "2026-11-12" }),
    ]));
    expect(result.positions).toEqual([
      expect.objectContaining({ name: "Flansch", quantity: "2", unit: "Stück", surfaceRequested: "Verzinken", executionRequested: "matt" }),
      expect.objectContaining({ name: "Halter bis 12.11", quantity: "3", unit: "kg", surfaceRequested: "Vernickeln" }),
    ]);
  });

  it("returns no guessed values for text without an explicit pattern", () => {
    expect(recognizeIntakeText("Bitte wie besprochen bearbeiten.")).toEqual({ fields: [], positions: [] });
  });
});
