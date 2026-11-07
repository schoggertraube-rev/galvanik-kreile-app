import { describe, expect, it, vi } from "vitest";
import { retryFixtureResetDeadlock } from "../../e2e/generated/_fixtureReset";

describe("isolated replay fixture cleanup", () => {
  it("retries one aborted deadlock transaction and reports it", async () => {
    const reset = vi.fn().mockRejectedValueOnce({ code: "40P01" }).mockResolvedValueOnce("clean");
    const warn = vi.fn();
    await expect(retryFixtureResetDeadlock(reset, warn)).resolves.toBe("clean");
    expect(reset).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith("FLOW_REPLAY_FIXTURE_RESET_DEADLOCK_RETRY_ONCE");
  });

  it("does not hide other errors or a second deadlock", async () => {
    const other = vi.fn().mockRejectedValue({ code: "23505" });
    await expect(retryFixtureResetDeadlock(other, vi.fn())).rejects.toMatchObject({ code: "23505" });
    expect(other).toHaveBeenCalledTimes(1);
    const deadlock = vi.fn().mockRejectedValue({ code: "40P01" });
    await expect(retryFixtureResetDeadlock(deadlock, vi.fn())).rejects.toMatchObject({ code: "40P01" });
    expect(deadlock).toHaveBeenCalledTimes(2);
  });
});
