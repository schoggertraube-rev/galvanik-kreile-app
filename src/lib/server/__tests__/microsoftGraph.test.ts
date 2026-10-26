import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listMicrosoftGraphInbox,
  readMicrosoftGraphAttachments,
  readMicrosoftGraphConfigurationStatus,
  sendMicrosoftGraphMail,
} from "../microsoftGraph";

const env = {
  MS_GRAPH_TENANT_ID: "tenant",
  MS_GRAPH_CLIENT_ID: "client",
  MS_GRAPH_CLIENT_SECRET: "secret",
  MS_GRAPH_MAILBOX: "mailbox@example.invalid",
};

afterEach(() => vi.restoreAllMocks());

describe("Microsoft Graph port", () => {
  it("fails closed without persisting or exposing missing values", () => {
    expect(readMicrosoftGraphConfigurationStatus({})).toEqual({
      code: "IN_KLAERUNG",
      missing: ["MS_GRAPH_TENANT_ID", "MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET", "MS_GRAPH_MAILBOX"],
    });
  });

  it("reads only validated inbox messages as text", async () => {
    const fetchPort = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "a".repeat(30) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{
        id: "graph-1", internetMessageId: "internet-1", subject: "Anfrage", receivedDateTime: "2026-10-26T10:00:00Z",
        from: { emailAddress: { name: "Kunde", address: "KUNDE@example.invalid" } }, bodyPreview: "Bitte prüfen",
        body: { contentType: "text", content: "Bitte prüfen und melden." }, hasAttachments: true,
      }, { id: "invalid" }] }), { status: 200 }));
    const result = await listMicrosoftGraphInbox(env, fetchPort);
    expect(result).toEqual({ code: "OK", data: [{
      id: "graph-1", internetMessageId: "internet-1", subject: "Anfrage", senderName: "Kunde",
      senderAddress: "kunde@example.invalid", receivedAt: "2026-10-26T10:00:00.000Z", preview: "Bitte prüfen",
      body: "Bitte prüfen und melden.", hasAttachments: true,
    }] });
    expect(fetchPort.mock.calls[1]?.[1]?.headers).toMatchObject({ prefer: 'outlook.body-content-type="text"' });
  });

  it("sends a PDF attachment only after Graph accepts it", async () => {
    const fetchPort = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "a".repeat(30) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const result = await sendMicrosoftGraphMail({
      to: "kunde@example.invalid", subject: "KV", body: "Anbei Ihr KV.",
      attachment: { filename: "K-2026-0001.pdf", contentType: "application/pdf", bytes: new Uint8Array([37, 80, 68, 70]) },
    }, env, fetchPort);
    expect(result).toEqual({ code: "OK", data: { accepted: true } });
    const request = JSON.parse(String(fetchPort.mock.calls[1]?.[1]?.body));
    expect(request.message.attachments[0]).toMatchObject({ name: "K-2026-0001.pdf", contentType: "application/pdf", contentBytes: "JVBERg==" });
  });

  it("reads supported non-inline inbox attachments and skips the rest", async () => {
    const fetchPort = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "a".repeat(30) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [
        { id: "a-1", name: "Anfrage.pdf", contentType: "application/pdf", contentBytes: "JVBERg==", size: 4, isInline: false },
        { id: "a-2", name: "Signatur.png", contentType: "image/png", contentBytes: "AQID", size: 3, isInline: true },
        { id: "a-3", name: "Dokument.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", contentBytes: "AQID", size: 3, isInline: false },
      ] }), { status: 200 }));
    const result = await readMicrosoftGraphAttachments("message-1", env, fetchPort);
    expect(result.code).toBe("OK");
    if (result.code !== "OK") return;
    expect(result.data.attachments).toHaveLength(1);
    expect(result.data.attachments[0]).toMatchObject({ id: "a-1", filename: "Anfrage.pdf", contentType: "application/pdf" });
    expect(result.data.skipped).toBe(2);
  });
});
