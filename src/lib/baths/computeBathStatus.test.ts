import { describe, expect, it } from "vitest";
import { computeBathStatus } from "./computeBathStatus";

describe("computeBathStatus", () => {
  it("does not claim stability without configured and supplied evidence", () => {
    expect(computeBathStatus({}, {})).toBe("not_evaluated");
    expect(computeBathStatus({ temperature: null }, { temperatureMin: 18, temperatureMax: 24 })).toBe("not_evaluated");
    expect(
      computeBathStatus(
        { temperature: 21, ph: null },
        { temperatureMin: 18, temperatureMax: 24, phMin: 6, phMax: 7 },
      ),
    ).toBe("not_evaluated");
  });

  it("uses worst-status-wins while preserving incomplete evidence", () => {
    expect(
      computeBathStatus(
        { temperature: 30, ph: null },
        { temperatureMin: 18, temperatureMax: 24, phMin: 6, phMax: 7 },
      ),
    ).toBe("critical");
    expect(
      computeBathStatus(
        { temperature: 21, ph: 6.5 },
        { temperatureMin: 18, temperatureMax: 24, phMin: 6, phMax: 7 },
      ),
    ).toBe("stable");
  });
});
