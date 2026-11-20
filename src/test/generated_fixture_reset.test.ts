import { describe, expect, it, vi } from "vitest";
import { retryFixtureResetDeadlock,lockFixtureResetTables,fixtureResetTargets,settleFixtureReads } from "../../e2e/generated/_fixtureReset";

describe("isolated replay fixture cleanup", () => {
  it('awaits the existing browser request drain before completing cleanup',async()=>{
    let release!:()=>void,done=false;
    const waitForLoadState=vi.fn(()=>new Promise<void>(resolve=>{release=resolve;}));
    const pending=settleFixtureReads({isClosed:()=>false,waitForLoadState}).then(()=>{done=true;});
    await Promise.resolve();expect(done).toBe(false);expect(waitForLoadState).toHaveBeenCalledExactlyOnceWith('networkidle');
    release();await pending;expect(done).toBe(true);
  });
  it('does not hide a browser drain failure or invent requests for a closed page',async()=>{
    const waitForLoadState=vi.fn().mockRejectedValue(Error('TEST actual browser drain failed'));
    await expect(settleFixtureReads({isClosed:()=>false,waitForLoadState})).rejects.toThrow('TEST actual browser drain failed');
    waitForLoadState.mockClear();await settleFixtureReads({isClosed:()=>true,waitForLoadState});expect(waitForLoadState).not.toHaveBeenCalled();
  });
  it("retries one aborted deadlock transaction and reports it", async () => {
    const reset = vi.fn().mockRejectedValueOnce({ code: "40P01" }).mockResolvedValueOnce("clean");
    const warn = vi.fn();
    await expect(retryFixtureResetDeadlock(reset, warn)).resolves.toBe("clean");
    expect(reset).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith("FLOW_REPLAY_FIXTURE_RESET_RETRY",{attempt:1,code:'40P01'});
  });

  it("does not hide other errors and bounds fallback to three attempts", async () => {
    const other = vi.fn().mockRejectedValue({ code: "23505" });
    await expect(retryFixtureResetDeadlock(other, vi.fn())).rejects.toMatchObject({ code: "23505" });
    expect(other).toHaveBeenCalledTimes(1);
    const deadlock = vi.fn().mockRejectedValue({ code: "40P01" });
    await expect(retryFixtureResetDeadlock(deadlock, vi.fn())).rejects.toMatchObject({ code: "40P01" });
    expect(deadlock).toHaveBeenCalledTimes(3);
  });
  it('locks all tables alphabetically before reset and rejects unsafe targets',async()=>{
    const unsafe=vi.fn().mockResolvedValue([]);
    await lockFixtureResetTables({unsafe},[{schema:'public',name:'beta'},{schema:'private',name:'alpha'},{schema:'public',name:'beta'}]);
    expect(unsafe).toHaveBeenCalledExactlyOnceWith('LOCK TABLE "private"."alpha", "public"."beta" IN ACCESS EXCLUSIVE MODE NOWAIT');
    expect(()=>fixtureResetTargets([{schema:'public',name:'beta;drop'}])).toThrow('FLOW_REPLAY_TABLE_NAME_INVALID');
  });
});
