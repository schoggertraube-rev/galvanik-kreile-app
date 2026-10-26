import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ list: vi.fn(), reserve: vi.fn(), finalize: vi.fn(), original: vi.fn() }));
vi.mock("@/app/actions/domainAttachments.actions", () => ({
  getDomainAttachmentsAction: actions.list,
  reserveDomainAttachmentAction: actions.reserve,
  finalizeDomainAttachmentAction: actions.finalize,
  getDomainAttachmentOriginalAction: actions.original,
}));

import { DomainAttachmentPanel } from "../DomainAttachmentPanel";

const ATTACHMENT = "11111111-1111-4111-8111-111111111111";

describe("DomainAttachmentPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    actions.list.mockResolvedValue({ code: "OK", data: [] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ Key: `scans/domain-attachments/v1/${ATTACHMENT}.pdf` }) }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("shows the honest empty state for the selected domain target", async () => {
    render(<DomainAttachmentPanel targetType="CUSTOMER" targetId="customer-1" />);
    expect(await screen.findByText("Noch keine Fotos oder Dokumente hinterlegt.")).toBeInTheDocument();
    expect(actions.list).toHaveBeenCalledWith({ targetType: "CUSTOMER", targetId: "customer-1" });
  });

  it("uploads and finalizes a PDF before it appears in the list", async () => {
    actions.list
      .mockResolvedValueOnce({ code: "OK", data: [] })
      .mockResolvedValueOnce({ code: "OK", data: [{ attachmentId: ATTACHMENT, mimeType: "application/pdf", fileBytes: 19, recordedAt: "2026-10-26T12:00:00.000Z" }] });
    actions.reserve.mockResolvedValue({
      code: "OK",
      data: { receipt: { attachmentId: ATTACHMENT }, upload: { path: `domain-attachments/v1/${ATTACHMENT}.pdf`, token: "signed" }, replayed: false },
    });
    actions.finalize.mockResolvedValue({ code: "OK", data: { receipt: { attachmentId: ATTACHMENT }, replayed: false } });
    const { container } = render(<DomainAttachmentPanel targetType="ORDER" targetId="order-1" />);
    await screen.findByText("Noch keine Fotos oder Dokumente hinterlegt.");

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["%PDF-synthetic-file"], "beleg.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText("PDF-Dokument");
    expect(actions.reserve).toHaveBeenCalledWith(expect.objectContaining({ targetType: "ORDER", targetId: "order-1", mimeType: "application/pdf" }));
    expect(actions.finalize).toHaveBeenCalledWith(expect.objectContaining({ attachmentId: ATTACHMENT }));
    await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(2));
  });
});
