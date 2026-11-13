import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  delete: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
};
const revalidatePath = vi.fn();
const denial = "Kommt nach dem Start dazu - bis dahin ausgeschaltet.";
const root = process.cwd();

// PL13.11.00:14 now requires canonical authorization before the existing denial.
vi.mock("@/lib/server/authorization", async()=>{
 const contract=await import("@/lib/auth/authorizationContract");
 return {hasAuthorizationArea:contract.hasAuthorizationArea,resolveAuthorization:vi.fn(async()=>({ok:true,data:{userId:"TEST-authorized",tenantId:"TEST-marketing-unit",role:"buero",areas:["geld"],permissions:[],active:true}}))};
});
vi.mock("@/db", () => ({ db }));
vi.mock("@/db/schema_marketing", () => ({ aktion: {}, kanal: {}, segment: {}, touchpoint: {} }));
vi.mock("drizzle-orm", () => ({ desc: vi.fn(), eq: vi.fn(), ilike: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const routeFiles = [
  "src/app/marketing/page.tsx",
  "src/app/marketing/aktion/page.tsx",
  "src/app/marketing/aktion/neu/page.tsx",
  "src/app/marketing/segmente/page.tsx",
  "src/app/marketing/segmente/neu/page.tsx",
  "src/app/marketing/segmente/[id]/page.tsx",
  "src/app/marketing/kanaele/page.tsx",
  "src/app/marketing/attribution/page.tsx",
  "src/app/marketing/einwilligungen/page.tsx",
];

function expectNoEffects() {
  for (const port of Object.values(db)) expect(port).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
}

describe("W2C-B2M4B Marketing fail-closed truth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies all six marketing writers before database or revalidation effects", async () => {
    const [aktion, segmente, kanaele] = await Promise.all([
      import("../aktion/actions"),
      import("../segmente/actions"),
      import("../kanaele/actions"),
    ]);
    const formData = new FormData();

    await expect(aktion.createAktion(formData)).rejects.toThrow(denial);
    await expect(aktion.changeAktionStatus("aktion-1", "ausgefuehrt")).rejects.toThrow(denial);
    await expect(segmente.createSegment(formData)).rejects.toThrow(denial);
    await expect(segmente.updateSegment("segment-1", formData)).rejects.toThrow(denial);
    await expect(segmente.deleteSegment("segment-1")).rejects.toThrow(denial);
    await expect(kanaele.updateKanalConfig("kanal-1", true, {})).rejects.toThrow(denial);

    expectNoEffects();
  });

  it.each(routeFiles)("keeps the removed marketing product route %s physically absent", (file) => {
    expect(existsSync(resolve(root, file))).toBe(false);
  });
});
