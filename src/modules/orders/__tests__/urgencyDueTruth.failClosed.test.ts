import { describe, expect, it, vi } from "vitest";
import { getUrgency } from "../domain/getUrgency";

describe("W2C-B2M5U urgency date truth", () => {
  it("returns unknown for no usable date", () => {
    for (const dueDate of [null, "", "  ", "invalid"]) expect(getUrgency(dueDate)).toBe("unknown");
  });
  it("retains valid critical behavior", () => expect(getUrgency("2000-01-01")).toBe("kritisch"));
});

// K13K-5: explicit synthetic clock boundaries, independent of the server zone.
describe('S13K Berlin calendar around midnight',()=>{
 it.each([
  {name:'winter 23:30',now:'2026-01-15T22:30:00Z',due:'2026-01-16T23:30:00Z',expected:'im_plan'},
  {name:'winter 00:30',now:'2026-01-15T23:30:00Z',due:'2026-01-15',expected:'kritisch'},
  {name:'summer 23:30',now:'2026-07-15T21:30:00Z',due:'2026-07-16T22:30:00Z',expected:'im_plan'},
  {name:'summer 00:30',now:'2026-07-15T22:30:00Z',due:'2026-07-15',expected:'kritisch'},
 ])('$name',scenario=>{
  vi.stubEnv('TZ','UTC');
  try{expect(getUrgency(scenario.due,new Date(scenario.now))).toBe(scenario.expected);}
  finally{vi.unstubAllEnvs();}
 });
});
