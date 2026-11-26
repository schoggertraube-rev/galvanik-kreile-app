import { expect, it } from "vitest";
import { leseBetriebsruhetage, plusWorkingDays, previousWorkingDay, workingDaysBetween } from "../workingDays";

it("zählt Betriebsruhe neben Wochenenden und Feiertagen in beiden Richtungen", () => {
  const betriebsruhe = new Set(["2026-12-24"]);
  expect(workingDaysBetween("2026-12-23", "2026-12-28", betriebsruhe)).toBe(1);
  expect(workingDaysBetween("2026-12-28", "2026-12-23", betriebsruhe)).toBe(-1);
  expect(plusWorkingDays("2026-12-23", 1, betriebsruhe)).toBe("2026-12-28");
  expect(plusWorkingDays("2026-12-28", -1, betriebsruhe)).toBe("2026-12-23");
  expect(previousWorkingDay("2026-12-24", betriebsruhe)).toBe("2026-12-23");
  expect(plusWorkingDays("0100-01-01", -1)).toBeNull();
  expect(plusWorkingDays("2026-12-23", 1, ["2026-12-24"])).toBe("2026-12-28");
  expect(workingDaysBetween("2026-12-23", "2026-12-28", ["2026-02-30"])).toBeNull();
});

it("übernimmt beide Grenzen sowie einzelne Ruhetage und fasst Überschneidungen zusammen", () => {
  expect([...leseBetriebsruhetage([
    { von: "2026-12-28", bis: "2026-12-28" },
    { von: "2026-12-23", bis: "2026-12-24" },
    { von: "2026-12-24", bis: "2026-12-24" },
  ]) ?? []]).toEqual(["2026-12-23", "2026-12-24", "2026-12-28"]);
  expect(leseBetriebsruhetage([])).toEqual(new Set());
  expect(leseBetriebsruhetage(null)).toBeNull();
  expect(leseBetriebsruhetage([{ von: "2026-02-30", bis: "2026-03-01" }])).toBeNull();
  expect(leseBetriebsruhetage([{ von: "2026-12-24", bis: "2026-12-23" }])).toBeNull();
});
