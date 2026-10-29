import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunicationPanel } from "../CommunicationPanel";

const actions = vi.hoisted(() => ({
  getStatus: vi.fn(),
  listGlobal: vi.fn(),
  listLinked: vi.fn(),
  attach: vi.fn(),
  send: vi.fn(),
  listQuotes: vi.fn(),
}));

vi.mock("@/app/actions/communications.actions", () => ({
  getMicrosoftGraphStatusAction: actions.getStatus,
  listOutlookInboxAction: actions.listGlobal,
  listLinkedOutlookMailsAction: actions.listLinked,
  attachOutlookMailAction: actions.attach,
  sendCustomerMailAction: actions.send,
}));

vi.mock("@/app/actions/quotes.actions", () => ({
  listOpenQuotesAction: actions.listQuotes,
}));

vi.mock("@/components/layout/GlobalCreateFlow", () => ({
  requestGlobalCreate: vi.fn(),
}));

describe("CommunicationPanel order assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.getStatus.mockResolvedValue({ code: "OK" });
    actions.listQuotes.mockResolvedValue({ code: "OK", quotes: [] });
  });

  it("shows only locally assigned order mail and never opens the global inbox", async () => {
    actions.listLinked.mockResolvedValue({
      code: "OK",
      data: [{
        threadId: "11111111-1111-4111-8111-111111111111",
        graphMessageId: "graph-requested",
        subject: "Anfrage zum Auftrag",
        body: "Bitte Auftrag prüfen.",
        senderLabel: "Kunde A <kunde-a@example.test>",
        receivedAt: "2026-10-29T16:30:00.000Z",
      }],
    });
    actions.listGlobal.mockResolvedValue({
      code: "OK",
      data: [{ id: "foreign", subject: "Unzustellbar fremder Auftrag" }],
    });

    render(<CommunicationPanel targetType="ORDER" targetId="order-a" />);

    expect(await screen.findByText("Anfrage zum Auftrag")).toBeInTheDocument();
    expect(screen.getByText("Bitte Auftrag prüfen.")).toBeInTheDocument();
    expect(screen.queryByText("Unzustellbar fremder Auftrag")).not.toBeInTheDocument();
    expect(actions.listLinked).toHaveBeenCalledWith({ targetType: "ORDER", targetId: "order-a" });
    expect(actions.listGlobal).not.toHaveBeenCalled();
  });

  it("shows an honest empty state when no mail is assigned to the order", async () => {
    actions.listLinked.mockResolvedValue({ code: "OK", data: [] });

    render(<CommunicationPanel targetType="ORDER" targetId="order-empty" />);

    await waitFor(() => expect(screen.getByText("Diesem Auftrag sind keine Mails zugeordnet.")).toBeInTheDocument());
  });
});
