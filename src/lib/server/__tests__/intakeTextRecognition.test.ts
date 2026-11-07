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

  it("verwirft die verneinte Menge und übernimmt nur die korrigierte Position", () => {
    const result = recognizeIntakeText("Nicht 5 Stück Bolzen, sondern 12 Stück Muttern verzinken.");
    expect(result.positions).toEqual([
      expect.objectContaining({ name: "Muttern", quantity: "12", surfaceRequested: "Verzinken" }),
    ]);
  });

  it("erfindet keine Oberfläche, wenn im Text keine genannt wird", () => {
    expect(recognizeIntakeText("2 Stück Halter").positions).toEqual([
      expect.objectContaining({ name: "Halter", quantity: "2", surfaceRequested: "" }),
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

  it("meldet mehr als zwanzig erkannte Positionen ohne eine falsche Anzahl", () => {
    const text = Array.from({ length: 23 }, (_, index) => `1 Stück Prüfkörper ${index + 1} verzinken`).join("\n") + "\nMitteilung ohne Position";
    const result = recognizeIntakeText(text);
    expect(result.positions).toHaveLength(20);
    expect(result.totalPositions).toBe(23);
  });

  it("erkennt den Wunsch-Wochentag statt des Maildatums", () => {
    const result = recognizeIntakeText("Mail vom 01.11.: Brauche die Teile bis Mittwoch.", new Date("2026-11-02T00:00:00.000Z"));
    expect(result.fields).toEqual(expect.arrayContaining([expect.objectContaining({ field: "dueDate", value: "2026-11-04" })]));
    expect(recognizeIntakeText("Mail vom 01.11.: Bitte bearbeiten.", new Date("2026-11-02T00:00:00.000Z")).fields).not.toEqual(expect.arrayContaining([expect.objectContaining({ field: "dueDate" })]));
    expect(recognizeIntakeText("Nicht bis 12.11., sondern bis 13.11.", new Date("2026-11-02T00:00:00.000Z")).fields).toEqual(expect.arrayContaining([expect.objectContaining({ field: "dueDate", value: "2026-11-13" })]));
    expect(recognizeIntakeText("Bitte bearbeiten.\nMit freundlichen Grüßen\nIm Urlaub bis 12.11.", new Date("2026-11-02T00:00:00.000Z")).fields).not.toEqual(expect.arrayContaining([expect.objectContaining({ field: "dueDate" })]));
    expect(recognizeIntakeText("Bitte bis 02.11. liefern", new Date("2026-11-02T15:00:00.000Z")).fields).toEqual(expect.arrayContaining([expect.objectContaining({ field: "dueDate", value: "2026-11-02" })]));
    expect(recognizeIntakeText("Lieferung nächste Woche Freitag", new Date("2026-11-02T00:00:00.000Z")).fields).toEqual(expect.arrayContaining([expect.objectContaining({ field: "dueDate", value: "2026-11-13" })]));
  });

  it("verwendet für relative Termine den Kalendertag in Berlin", () => {
    const lateUtc = new Date("2026-11-01T23:30:00.000Z");
    expect(recognizeIntakeText("Lieferung bis Sonntag", lateUtc).fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "dueDate", value: "2026-11-08" }),
    ]));
  });
});
