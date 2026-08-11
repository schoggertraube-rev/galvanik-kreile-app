import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackupRestoreCenter } from "../BackupRestoreCenter";

const sync = vi.hoisted(() => ({ outboxItems: [] as unknown[] }));

vi.mock("@/lib/offline/SyncContext", () => ({
  useSync: () => sync,
}));

const legacyClaims = [
  "Verbunden & Aktiv",
  "Intakt",
  "Heute, 03:00",
  "Automatisch",
  "Manuell",
  "Letztes Backup",
  "Backup wird generiert",
  "Backup erfolgreich erstellt",
  "Vollständiges Backup herunterladen",
  ".zip",
  "vollständige Kopie",
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  sync.outboxItems = [];
});

describe("BackupRestoreCenter", () => {
  it.each([
    { outboxItems: [], count: 0 },
    { outboxItems: [{ id: "pending" }, { id: "retry" }], count: 2 },
  ])("real-renders truthful unavailable states for $count outbox items", ({ outboxItems, count }) => {
    vi.useFakeTimers();
    sync.outboxItems = outboxItems;
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    const { container } = render(<BackupRestoreCenter />);

    expect(screen.getAllByText("Sicherungsstatus nicht verfügbar")).toHaveLength(2);
    expect(screen.getAllByText("Kein verifizierter Statusvertrag angebunden.")).toHaveLength(2);
    expect(screen.getAllByText("Sicherung nicht verfügbar")).toHaveLength(2);
    expect(screen.getAllByText("Wiederherstellung nicht verfügbar")).toHaveLength(2);
    expect(screen.getByText(`${count} ${count === 1 ? "Eintrag" : "Einträge"} lokal vorhanden`)).toBeInTheDocument();
    expect(screen.getByText("Dies ist keine Bestätigung einer Sicherung oder Synchronisierung.")).toBeInTheDocument();

    const unavailableButtons = screen.getAllByRole("button");
    expect(unavailableButtons).toHaveLength(2);
    unavailableButtons.forEach((button) => {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("disabled");
      fireEvent.click(button);
    });

    expect(vi.getTimerCount()).toBe(0);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(anchorClickSpy).not.toHaveBeenCalled();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.querySelector("a[download]")).toBeNull();
    legacyClaims.forEach((claim) => expect(screen.queryByText(claim)).not.toBeInTheDocument());
  });

  it("contains no legacy side-effect primitives as a secondary source check", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/admin/BackupRestoreCenter.tsx"), "utf8");

    [/<[^>]*\s+on[A-Z][A-Za-z0-9_$]*\s*=/, /setTimeout/, /\bDate\b/, /\balert\b/, /\bdownload\b/, /<input/].forEach((forbidden) => {
      expect(source).not.toMatch(forbidden);
    });
  });
});
