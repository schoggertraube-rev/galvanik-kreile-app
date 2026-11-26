import { expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: vi.fn() }));

import { verteileLaufMinuten } from "../arbeitszeit";

test("Ein Lauf verteilt die Zeit proportional und verlangt mindestens eine Minute je Auftrag", () => {
  const auftraege = [{ auftragId: "TEST-A", teile: "1.0" }, { auftragId: "TEST-B", teile: "9" }];
  expect(verteileLaufMinuten(auftraege, 9)).toEqual({ mindestdauer: "10", zuordnung: null });
  expect(verteileLaufMinuten(auftraege, 10)?.zuordnung).toEqual([
    { auftragId: "TEST-A", minuten: 1 },
    { auftragId: "TEST-B", minuten: 9 },
  ]);
  expect(verteileLaufMinuten(auftraege, 60)?.zuordnung).toEqual([
    { auftragId: "TEST-A", minuten: 6 },
    { auftragId: "TEST-B", minuten: 54 },
  ]);
});

test("Bei gleicher Teilezahl erhält der erste Auftrag des Laufs die Restminuten", () => {
  const auftraege = ["TEST-C", "TEST-B", "TEST-A"].map(auftragId => ({ auftragId, teile: "0.125" }));
  expect(verteileLaufMinuten(auftraege, 5)?.zuordnung).toEqual([
    { auftragId: "TEST-C", minuten: 3 },
    { auftragId: "TEST-B", minuten: 1 },
    { auftragId: "TEST-A", minuten: 1 },
  ]);
});
