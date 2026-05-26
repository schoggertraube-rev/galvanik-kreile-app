import { describe, it, expect } from "vitest";
import { getGreeting } from "../lib/greeting";

describe("Greeting Service Buckets", () => {
  it("should greet Guten Morgen in the morning (4:00 - 10:59)", () => {
    const d = new Date();
    d.setHours(8);
    const greeting = getGreeting(d, "Meister");
    expect(greeting.text).toBe("Guten Morgen, Meister!");
    expect(greeting.emoji).toBe("👋");
  });

  it("should greet Mahlzeit at lunchtime (11:00 - 13:59)", () => {
    const d = new Date();
    d.setHours(12);
    const greeting = getGreeting(d, "Werkstatt");
    expect(greeting.text).toBe("Mahlzeit, Werkstatt!");
    expect(greeting.emoji).toBe("🍽");
  });

  it("should greet Schönen Nachmittag in the afternoon (14:00 - 17:59)", () => {
    const d = new Date();
    d.setHours(15);
    const greeting = getGreeting(d, "Büro");
    expect(greeting.text).toBe("Schönen Nachmittag, Büro!");
    expect(greeting.emoji).toBe("☀️");
  });

  it("should greet Guten Abend in the evening (18:00 - 21:59)", () => {
    const d = new Date();
    d.setHours(19);
    const greeting = getGreeting(d, "Chef");
    expect(greeting.text).toBe("Guten Abend, Chef!");
    expect(greeting.emoji).toBe("🌙");
  });

  it("should handle late night shift (22:00 - 03:59)", () => {
    const d = new Date();
    d.setHours(23);
    const greeting = getGreeting(d, "Meister");
    expect(greeting.text).toBe("Späte Schicht, Meister.");
    expect(greeting.emoji).toBe("🌙");
  });
});
