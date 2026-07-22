import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type SourceRecord = {
  id: string;
  kind: "repository" | "external-file" | "external-archive" | "archive-entry";
  name: string;
  repositoryPath?: string;
  containerSourceRef?: string;
  bytes?: number;
  sha256: string;
};

type CapabilityRecord = {
  id: string;
  title: string;
  domain: string;
  mode: string;
  status: string;
  truthClass: string;
  personas: string[];
  sourceRefs: string[];
  protectedRefs: string[];
  codeEvidence: string[];
  testEvidence: string[];
  visibilityTarget: string;
  blocker: string | null;
};

type CapabilityManifest = {
  schemaVersion: number;
  tenantId: string;
  foundationBaselineCommit: string;
  allowedModes: string[];
  allowedStatuses: string[];
  sources: SourceRecord[];
  capabilities: CapabilityRecord[];
};

const root = process.cwd();
const manifestPath = resolve(root, "docs/project/FOUNDATION_CAPABILITIES.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CapabilityManifest;
const sha256 = (value: string) => createHash("sha256").update(value.replace(/\r\n/g, "\n"), "utf8").digest("hex");

describe("foundation capability manifest", () => {
  it("pins a real full-length implementation baseline and a closed schema", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.tenantId).toBe("galvanik-kreile");
    expect(manifest.foundationBaselineCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(manifest.foundationBaselineCommit).not.toMatch(/^0{40}$/);
    expect(manifest.allowedModes).toEqual(["visible", "automatic", "administrative", "later"]);
    expect(manifest.allowedStatuses).toEqual([
      "verified_local",
      "rollout_required",
      "blocked_not_implemented",
      "protected_later",
    ]);
  });

  it("keeps every hashed source identifiable and referenced", () => {
    const sourceIds = new Set(manifest.sources.map((source) => source.id));
    expect(sourceIds.size).toBe(manifest.sources.length);
    const referenced = new Set(manifest.capabilities.flatMap((capability) => capability.sourceRefs));

    for (const source of manifest.sources) {
      expect(source.id).toMatch(/^SRC-[A-Z0-9-]+$/);
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(referenced.has(source.id), `unreferenced source ${source.id}`).toBe(true);
      if (source.kind === "repository") {
        expect(source.repositoryPath).toBeTruthy();
        const path = resolve(root, source.repositoryPath!);
        expect(existsSync(path), source.repositoryPath).toBe(true);
        expect(statSync(path).isFile(), source.repositoryPath).toBe(true);
        expect(sha256(readFileSync(path, "utf8")), source.repositoryPath).toBe(source.sha256);
      }
      if (source.kind === "archive-entry") {
        expect(source.containerSourceRef).toBeTruthy();
        expect(sourceIds.has(source.containerSourceRef!), source.id).toBe(true);
      }
    }
  });

  it("maps every capability to sources, evidence, visibility, and an honest status", () => {
    const sourceIds = new Set(manifest.sources.map((source) => source.id));
    const capabilityIds = new Set(manifest.capabilities.map((capability) => capability.id));
    const allowedPersonas = new Set(["michael", "rolf", "philipp"]);
    expect(manifest.capabilities).toHaveLength(35);
    expect(capabilityIds.size).toBe(manifest.capabilities.length);

    for (const capability of manifest.capabilities) {
      expect(capability.id).toMatch(/^KI-[A-Z0-9-]+-001$/);
      expect(capability.title.trim().length).toBeGreaterThan(5);
      expect(capability.domain.trim().length).toBeGreaterThan(1);
      expect(manifest.allowedModes).toContain(capability.mode);
      expect(manifest.allowedStatuses).toContain(capability.status);
      expect(["A", "B", "C", "D", "E"]).toContain(capability.truthClass);
      expect(capability.visibilityTarget.trim().length).toBeGreaterThan(5);
      expect(capability.personas.length).toBeGreaterThan(0);
      expect(capability.personas.every((persona) => allowedPersonas.has(persona))).toBe(true);
      expect(capability.sourceRefs.length).toBeGreaterThan(0);
      expect(capability.sourceRefs.every((sourceRef) => sourceIds.has(sourceRef))).toBe(true);
      expect(new Set(capability.sourceRefs).size).toBe(capability.sourceRefs.length);
      expect(capability.codeEvidence.length).toBeGreaterThan(0);
      expect(capability.testEvidence.length).toBeGreaterThan(0);

      for (const evidencePath of [...capability.codeEvidence, ...capability.testEvidence]) {
        const absolutePath = resolve(root, evidencePath);
        expect(absolutePath.startsWith(root), evidencePath).toBe(true);
        expect(existsSync(absolutePath), `${capability.id}: ${evidencePath}`).toBe(true);
        expect(statSync(absolutePath).isFile(), `${capability.id}: ${evidencePath}`).toBe(true);
      }

      if (capability.status === "verified_local") {
        expect(capability.blocker, capability.id).toBeNull();
      } else {
        expect(typeof capability.blocker, capability.id).toBe("string");
        expect(capability.blocker?.trim().length, capability.id).toBeGreaterThan(10);
      }
    }
  });

  it("covers every protected non-loss ID and all mandatory foundation ports", () => {
    const nonLoss = readFileSync(resolve(root, "docs/project/NON_LOSS_REGISTER.md"), "utf8");
    const protectedIds = [...nonLoss.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
    const mappedProtectedIds = new Set(manifest.capabilities.flatMap((capability) => capability.protectedRefs));
    for (const protectedId of protectedIds) {
      expect(mappedProtectedIds.has(protectedId), `unmapped non-loss ID ${protectedId}`).toBe(true);
    }

    const capabilityIds = new Set(manifest.capabilities.map((capability) => capability.id));
    for (const mandatoryId of [
      "KI-CAPTURE-ORIGINAL-001",
      "KI-BATH-PARTICIPATION-001",
      "KI-RESOURCE-CAPTURE-001",
      "KI-INVOICE-PAYMENT-001",
      "KI-COMMUNICATION-MEMORY-001",
      "KI-DECISION-ANALYTICS-001",
      "KI-MARKETING-ATTRIBUTION-001",
      "KI-OFFLINE-48H-001",
      "KI-MODULAR-PORTS-001",
    ]) {
      expect(capabilityIds.has(mandatoryId), mandatoryId).toBe(true);
    }
  });
});
