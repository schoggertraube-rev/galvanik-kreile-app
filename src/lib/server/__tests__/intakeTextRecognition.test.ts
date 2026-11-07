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

  it("erkennt Zahlwörter und bevorzugt die ausdrücklich genannte Ersatzoberfläche", () => {
    const result = recognizeIntakeText("Bitte zwölf Teile nicht verchromen, nur vernickeln.");
    expect(result.positions).toEqual([
      expect.objectContaining({ name: "Teile", quantity: "12", surfaceRequested: "Vernickeln" }),
    ]);
  });

  it("übernimmt bei unbestimmter Menge keine Zahl", () => {
    const result = recognizeIntakeText("Ein paar Teile verzinken.");
    expect(result.positions).toEqual([
      expect.objectContaining({ name: "Teile", quantity: "", surfaceRequested: "Verzinken" }),
    ]);
  });

  it.each([["ein Dutzend", "12"], ["zwanzig", "20"], ["dreißig", "30"], ["hundert", "100"]])("erkennt die Menge %s", (word, quantity) => {
    expect(recognizeIntakeText(`${word} Teile verzinken`).positions).toEqual([
      expect.objectContaining({ name: "Teile", quantity }),
    ]);
  });

  it("erkennt den Wunsch-Wochentag statt des Maildatums", () => {
    const result = recognizeIntakeText("Mail vom 01.11.: Brauche die Teile bis Mittwoch.", new Date("2026-11-02T00:00:00.000Z"));
    expect(result.fields).toEqual(expect.arrayContaining([expect.objectContaining({ field: "dueDate", value: "2026-11-04" })]));
    expect(recognizeIntakeText("Mail vom 01.11.: Bitte bearbeiten.", new Date("2026-11-02T00:00:00.000Z")).fields).not.toEqual(expect.arrayContaining([expect.objectContaining({ field: "dueDate" })]));
    expect(recognizeIntakeText("Nicht bis 12.11., sondern bis 13.11.", new Date("2026-11-02T00:00:00.000Z")).fields).toEqual(expect.arrayContaining([expect.objectContaining({ field: "dueDate", value: "2026-11-13" })]));
    expect(recognizeIntakeText("Bitte bearbeiten.\nMit freundlichen Grüßen\nIm Urlaub bis 12.11.", new Date("2026-11-02T00:00:00.000Z")).fields).not.toEqual(expect.arrayContaining([expect.objectContaining({ field: "dueDate" })]));
    expect(recognizeIntakeText("Bitte bis 02.11. liefern", new Date("2026-11-02T15:00:00.000Z")).fields).toEqual(expect.arrayContaining([expect.objectContaining({ field: "dueDate", value: "2026-11-02" })]));
  });
});
