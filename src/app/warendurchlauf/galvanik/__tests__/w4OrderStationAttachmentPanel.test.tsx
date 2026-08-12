import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  getOrders: vi.fn(),
  getAttachments: vi.fn(),
  reserve: vi.fn(),
  finalize: vi.fn(),
  original: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
  randomUUID: vi.fn(),
  digest: vi.fn(),
}));

vi.mock("@/app/warendurchlauf/actions", () => ({
  getGalvanikOrdersAction: ports.getOrders,
  getGalvanikHandoffAttachmentsAction: ports.getAttachments,
  reserveGalvanikHandoffAttachmentAction: ports.reserve,
  finalizeGalvanikHandoffAttachmentAction: ports.finalize,
  getGalvanikHandoffAttachmentOriginalAction: ports.original,
}));
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    storage: {
      from: ports.storageFrom,
    },
  },
}));
vi.mock("@/components/orders/OrderModalProvider", () => ({
  useOrderModal: () => ({ openOrder: vi.fn() }),
}));
vi.mock("@/components/orders/OrderCompactCard", () => ({
  OrderCompactCard: ({ orderNumber, onClick }: { orderNumber: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}>{orderNumber}</button>
  ),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
vi.mock("lucide-react", () => {
  const Icon = () => null;
  return {
    AlertTriangle: Icon,
    ArrowRight: Icon,
    CheckCircle2: Icon,
    ChevronRight: Icon,
    Download: Icon,
    Layers: Icon,
    Loader2: Icon,
    Paperclip: Icon,
    PlayCircle: Icon,
    ShieldCheck: Icon,
    Upload: Icon,
  };
});

import { GalvanikHandoffAttachmentPanel } from "@/components/orders/GalvanikHandoffAttachmentPanel";
import GalvanikPage from "@/app/warendurchlauf/galvanik/page";
import type { EvidenceReadRecord } from "@/lib/server/evidenceRead";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const OTHER_ACTOR = "22222222-2222-4222-8222-222222222222";
const RESERVATION = "33333333-3333-4333-8333-333333333333";
const NEW_RESERVATION = "44444444-4444-4444-8444-444444444444";
const RECEIPT = "55555555-5555-4555-8555-555555555555";
const REQUEST = "66666666-6666-4666-8666-666666666666";
const NEW_REQUEST = "77777777-7777-4777-8777-777777777777";
const EVENT = "88888888-8888-4888-8888-888888888888";
const ZERO_SHA = "0".repeat(64);
const ORDER_ID = "order-a";
const ITEM_ID = "item-a";
const FILE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    reservationId: RESERVATION,
    receiptId: null,
    clientRequestId: REQUEST,
    customerId: "customer-a",
    orderId: ORDER_ID,
    itemId: ITEM_ID,
    transitionEventId: EVENT,
    orderVersion: 2,
    actorId: ACTOR,
    actorDisplayName: "Werkstatt",
    mimeType: "image/png" as const,
    fileBytes: FILE_BYTES.byteLength,
    contentSha256: ZERO_SHA,
    uploadExpiresAt: "2026-08-11T12:00:00.000Z",
    reservedAt: "2026-08-11T10:00:00.000Z",
    state: "PENDING" as const,
    verifiedAt: null,
    ...overrides,
  };
}

function finalized(overrides: Record<string, unknown> = {}) {
  return receipt({
    receiptId: RECEIPT,
    state: "FINALIZED",
    verifiedAt: "2026-08-11T10:05:00.000Z",
    ...overrides,
  });
}

function evidenceRecord(overrides: Record<string, unknown> = {}): EvidenceReadRecord {
  return {
    evidenceKey: `order-station-attachment:${RECEIPT}`,
    source: "ORDER_STATION_ATTACHMENT" as const,
    sourceId: RECEIPT,
    original: {
      state: "VERIFIED" as const,
      hash: ZERO_SHA,
      hashAlgorithm: "SHA256" as const,
      sizeBytes: FILE_BYTES.byteLength,
      securedAt: "2026-08-11T10:04:00.000Z",
      mimeType: "image/png",
    },
    extraction: {
      state: "NOT_REQUESTED" as const,
      provider: null,
      detectedType: null,
      detectionConfidence: null,
      extractedData: null,
      fieldConfidence: {},
    },
    targets: [
      { targetType: "ORDER" as const, targetId: ORDER_ID },
      { targetType: "ORDER_ITEM" as const, targetId: ITEM_ID },
    ],
    recordedAt: "2026-08-11T10:05:00.000Z",
    ...overrides,
  };
}

function legacyEvidenceRecord(): EvidenceReadRecord {
  return {
    ...evidenceRecord(),
    evidenceKey: "legacy-scan-upload:legacy-scan-1",
    source: "LEGACY_SCAN_UPLOAD" as const,
    sourceId: "legacy-scan-1",
    original: {
      state: "LEGACY_RECORDED" as const,
      hash: "b".repeat(64),
      hashAlgorithm: "SHA256" as const,
      sizeBytes: 321,
      securedAt: "2026-08-11T09:01:00.000Z",
      mimeType: "application/pdf",
    },
    extraction: {
      state: "LEGACY_RECORDED" as const,
      provider: "legacy-ocr",
      detectedType: "Lieferschein",
      detectionConfidence: 0.91,
      extractedData: { documentNumber: "LS-1" },
      fieldConfidence: { documentNumber: 0.89 },
    },
    targets: [
      { targetType: "CUSTOMER" as const, targetId: "customer-a" },
      { targetType: "ORDER" as const, targetId: ORDER_ID },
    ],
    recordedAt: "2026-08-11T09:02:00.000Z",
  };
}

function envelope(
  receipts: ReturnType<typeof receipt>[],
  canOperate = true,
  currentActorId = ACTOR,
  evidenceRecords: EvidenceReadRecord[] = [],
) {
  return { code: "OK" as const, data: { receipts, evidenceRecords, canOperate, currentActorId } };
}

function file(): File {
  return {
    type: "image/png",
    size: FILE_BYTES.byteLength,
    arrayBuffer: vi.fn().mockResolvedValue(FILE_BYTES.buffer.slice(0)),
  } as unknown as File;
}

function reserveOk(
  pending = receipt({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST }),
  token = "upload-token",
) {
  return {
    code: "OK" as const,
    data: {
      receipt: pending,
      upload: {
        path: `order-station-evidence/v1/${pending.reservationId}.png`,
        token,
      },
      replayed: false,
    },
  };
}

function signedOriginal(overrides: Record<string, unknown> = {}) {
  return {
    code: "OK" as const,
    data: {
      downloadUrl: `http://127.0.0.1:54321/storage/v1/object/sign/item-photos/order-station-evidence/v1/${RESERVATION}.png?token=download-token&download=galvanik-uebergabe-original.png`,
      expiresInSeconds: 60,
      mimeType: "image/png" as const,
      ...overrides,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function chooseFile() {
  const input = screen.getByLabelText(/Neues Original|Datei erneut wählen/i, { selector: "input" });
  fireEvent.change(input, { target: { files: [file()] } });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  ports.randomUUID.mockReturnValue(NEW_REQUEST);
  ports.digest.mockResolvedValue(new Uint8Array(32).buffer);
  ports.storageFrom.mockReturnValue({ uploadToSignedUrl: ports.upload });
  vi.stubGlobal("crypto", {
    randomUUID: ports.randomUUID,
    subtle: { digest: ports.digest },
  });
  ports.getAttachments.mockResolvedValue(envelope([]));
  ports.upload.mockResolvedValue({ data: { path: `order-station-evidence/v1/${NEW_RESERVATION}.png` }, error: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("W4 Galvanik handoff attachment panel", () => {
  it("renders zero/many fail-closed and readonly metadata without mutation controls", async () => {
    const zero = render(<GalvanikHandoffAttachmentPanel orderId={ORDER_ID} expectedVersion={2} items={[]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Kein eindeutig zugeordnetes Teil");
    expect(screen.getByLabelText("Galvanik-Übergabeoriginal")).toHaveAttribute("aria-busy", "false");
    expect(zero.container.querySelector("input[type=file]")).not.toBeInTheDocument();
    expect(ports.getAttachments).not.toHaveBeenCalled();
    zero.unmount();

    const many = render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }, { id: "item-b", name: "Teil B" }]}
    />);
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.getByLabelText("Galvanik-Übergabeoriginal")).toHaveAttribute("aria-busy", "false");
    expect(ports.getAttachments).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: ITEM_ID } });
    await waitFor(() => expect(ports.getAttachments).toHaveBeenCalledWith({ orderId: ORDER_ID, itemId: ITEM_ID }));
    many.unmount();

    ports.getAttachments.mockResolvedValueOnce(envelope([
      receipt(),
      finalized({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST }),
    ], false));
    const readonly = render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    expect(await screen.findByText("Upload ausstehend")).toBeInTheDocument();
    expect(screen.getByText("Bestätigt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bestätigung prüfen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Original freigeben" })).not.toBeInTheDocument();
    expect(ports.original).not.toHaveBeenCalled();
    expect(readonly.container.querySelector("input[type=file]")).not.toBeInTheDocument();
  });

  it("renders verified no-extraction truth and read-only legacy confidence with polymorphic targets", async () => {
    ports.getAttachments.mockResolvedValueOnce(envelope(
      [finalized()],
      true,
      ACTOR,
      [evidenceRecord(), legacyEvidenceRecord()],
    ));
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);

    expect(await screen.findByText("Nachweis-Metadaten")).toBeInTheDocument();
    expect(screen.getByText("Keine Extraktion angefordert.")).toBeInTheDocument();
    expect(screen.getByText(/Extraktion übernommen: Lieferschein · Konfidenz 91 %/)).toBeInTheDocument();
    expect(screen.getByText(/ORDER_ITEM item-a/)).toBeInTheDocument();
    expect(screen.getByText(/CUSTOMER customer-a/)).toBeInTheDocument();
    expect(screen.getByText("Bestehender Legacy-Nachweis (nur lesen)")).toBeInTheDocument();
    expect(ports.reserve).not.toHaveBeenCalled();
    expect(ports.finalize).not.toHaveBeenCalled();
    expect(ports.original).not.toHaveBeenCalled();
  });

  it("offers a scoped, single-flight metadata retry after rejection", async () => {
    const retryResult = deferred<ReturnType<typeof envelope>>();
    ports.getAttachments
      .mockRejectedValueOnce(new Error("offline"))
      .mockReturnValueOnce(retryResult.promise);
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    const retry = await screen.findByRole("button", { name: "Metadaten erneut laden" });
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(ports.getAttachments).toHaveBeenCalledTimes(2);
    retryResult.resolve(envelope([]));
    expect(await screen.findByText("Noch kein Übergabeoriginal erfasst.")).toBeInTheDocument();
    expect(ports.getAttachments).toHaveBeenCalledTimes(2);
  });

  it("uploads the exact hashed bytes and shows success only after FINALIZED fresh readback", async () => {
    const reserve = deferred<ReturnType<typeof reserveOk>>();
    const upload = deferred<{ data: { path: string }; error: null }>();
    const finalize = deferred<{ code: "OK"; data: { receipt: ReturnType<typeof finalized>; replayed: false } }>();
    const readback = deferred<ReturnType<typeof envelope>>();
    const pending = receipt({
      reservationId: NEW_RESERVATION,
      clientRequestId: NEW_REQUEST,
    });
    const done = finalized({
      reservationId: NEW_RESERVATION,
      clientRequestId: NEW_REQUEST,
    });
    ports.getAttachments
      .mockResolvedValueOnce(envelope([]))
      .mockReturnValueOnce(readback.promise);
    ports.reserve.mockReturnValueOnce(reserve.promise);
    ports.upload.mockReturnValueOnce(upload.promise);
    ports.finalize.mockReturnValueOnce(finalize.promise);
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await waitFor(() => expect(ports.reserve).toHaveBeenCalledTimes(1));
    expect(ports.upload).not.toHaveBeenCalled();
    expect(ports.finalize).not.toHaveBeenCalled();
    expect(ports.getAttachments).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
    reserve.resolve(reserveOk(pending));
    await waitFor(() => expect(ports.upload).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("Original wird hochgeladen");
    expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
    expect(ports.finalize).not.toHaveBeenCalled();
    expect(ports.getAttachments).toHaveBeenCalledTimes(1);
    const uploadBody = ports.upload.mock.calls[0][2];
    expect(ports.storageFrom).toHaveBeenCalledWith("item-photos");
    expect(ports.upload.mock.calls[0][0]).toBe(`order-station-evidence/v1/${NEW_RESERVATION}.png`);
    expect(ports.upload.mock.calls[0][1]).toBe("upload-token");
    expect(uploadBody).toBeInstanceOf(Uint8Array);
    expect(Array.from(uploadBody as Uint8Array)).toEqual(Array.from(FILE_BYTES));
    expect(ports.upload.mock.calls[0][3]).toEqual({ contentType: "image/png", upsert: false });

    upload.resolve({
      data: { path: `order-station-evidence/v1/${NEW_RESERVATION}.png` },
      error: null,
    });
    await waitFor(() => expect(ports.finalize).toHaveBeenCalledWith({ reservationId: NEW_RESERVATION }));
    expect(screen.getByRole("status")).toHaveTextContent("Gespeichertes Original wird geprüft");
    expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
    expect(ports.getAttachments).toHaveBeenCalledTimes(1);
    finalize.resolve({ code: "OK", data: { receipt: done, replayed: false } });
    await waitFor(() => expect(ports.getAttachments).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status")).toHaveTextContent("Metadaten werden erneut aus der Datenbank bestätigt");
    expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
    readback.resolve(envelope([done]));
    expect(await screen.findByText("Bestätigt")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Original sicher gespeichert");
    expect(ports.reserve).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      itemId: ITEM_ID,
      expectedVersion: 2,
      clientRequestId: NEW_REQUEST,
      mimeType: "image/png",
      fileBytes: FILE_BYTES.byteLength,
      contentSha256: ZERO_SHA,
    });
  });

  it.each([
    ["order scope", { orderId: "other-order" }],
    ["item scope", { itemId: "other-item" }],
    ["order version", { orderVersion: 3 }],
    ["client request", { clientRequestId: REQUEST }],
    ["MIME", { mimeType: "image/webp" }],
    ["byte count", { fileBytes: FILE_BYTES.byteLength + 1 }],
    ["SHA-256", { contentSha256: "f".repeat(64) }],
  ] as const)("rejects a reserve response with a wrong %s before upload", async (_label, wrongBinding) => {
    const pending = receipt({
      reservationId: NEW_RESERVATION,
      clientRequestId: NEW_REQUEST,
      ...wrongBinding,
    });
    ports.reserve.mockResolvedValueOnce(reserveOk(pending));
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await waitFor(() => expect(ports.getAttachments).toHaveBeenCalledTimes(2));
    expect(ports.upload).not.toHaveBeenCalled();
    expect(ports.finalize).not.toHaveBeenCalled();
    expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
  });

  it("treats a changed authorized session actor as a recoverable foreign reservation without upload", async () => {
    const actorBPending = receipt({
      reservationId: NEW_RESERVATION,
      clientRequestId: NEW_REQUEST,
      actorId: OTHER_ACTOR,
    });
    ports.getAttachments
      .mockResolvedValueOnce(envelope([]))
      .mockResolvedValueOnce(envelope([actorBPending], true, OTHER_ACTOR));
    ports.reserve.mockResolvedValueOnce(reserveOk(actorBPending));
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await waitFor(() => expect(ports.getAttachments).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Upload ausstehend")).toBeInTheDocument();
    expect(ports.upload).not.toHaveBeenCalled();
    expect(ports.finalize).not.toHaveBeenCalled();
    expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
  });

  it("rejects an exact-replay response that switches the reservation id", async () => {
    const pending = receipt();
    ports.getAttachments.mockResolvedValue(envelope([pending]));
    ports.finalize.mockResolvedValueOnce({
      code: "CONFLICT",
      reason: "UPLOAD_NOT_READY",
      message: "not ready",
    });
    ports.reserve.mockResolvedValueOnce(reserveOk(receipt({
      reservationId: NEW_RESERVATION,
      clientRequestId: REQUEST,
    })));
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Upload ausstehend");
    await chooseFile();
    await waitFor(() => expect(ports.reserve).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(ports.getAttachments).toHaveBeenCalledTimes(3));
    expect(ports.reserve).toHaveBeenCalledWith(expect.objectContaining({ clientRequestId: REQUEST }));
    expect(ports.upload).not.toHaveBeenCalled();
    expect(ports.finalize).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
  });

  it.each(["grant path", "upload error", "upload response path"])(
    "stops before finalize on a wrong %s",
    async (failure) => {
      const pending = receipt({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST });
      const response = reserveOk(pending);
      if (failure === "grant path") {
        response.data.upload.path = `order-station-evidence/v1/${RESERVATION}.png`;
      }
      ports.reserve.mockResolvedValueOnce(response);
      ports.upload.mockResolvedValueOnce(failure === "upload error"
        ? { data: null, error: { message: "provider detail must stay irrelevant" } }
        : {
            data: { path: failure === "upload response path"
              ? `order-station-evidence/v1/${RESERVATION}.png`
              : `order-station-evidence/v1/${NEW_RESERVATION}.png` },
            error: null,
          });
      render(<GalvanikHandoffAttachmentPanel
        orderId={ORDER_ID}
        expectedVersion={2}
        items={[{ id: ITEM_ID, name: "Teil A" }]}
      />);
      await screen.findByText("Noch kein Übergabeoriginal erfasst.");
      await chooseFile();
      await waitFor(() => expect(ports.getAttachments).toHaveBeenCalledTimes(2));
      expect(ports.finalize).not.toHaveBeenCalled();
      expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
      if (failure === "grant path") expect(ports.upload).not.toHaveBeenCalled();
    },
  );

  it("rejects a finalize response with a wrong immutable binding", async () => {
    const pending = receipt({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST });
    ports.reserve.mockResolvedValueOnce(reserveOk(pending));
    ports.finalize.mockResolvedValueOnce({
      code: "OK",
      data: { receipt: finalized({
        reservationId: NEW_RESERVATION,
        clientRequestId: NEW_REQUEST,
        contentSha256: "f".repeat(64),
      }), replayed: false },
    });
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await waitFor(() => expect(ports.finalize).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(ports.getAttachments).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
  });

  it.each([
    ["reservationId", "99999999-9999-4999-8999-999999999999"],
    ["receiptId", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    ["clientRequestId", REQUEST],
    ["customerId", "other-customer"],
    ["orderId", "other-order"],
    ["itemId", "other-item"],
    ["transitionEventId", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    ["orderVersion", 3],
    ["actorId", OTHER_ACTOR],
    ["actorDisplayName", "Changed"],
    ["mimeType", "image/webp"],
    ["fileBytes", FILE_BYTES.byteLength + 1],
    ["contentSha256", "f".repeat(64)],
    ["uploadExpiresAt", "2026-08-11T12:01:00.000Z"],
    ["reservedAt", "2026-08-11T10:01:00.000Z"],
    ["state", "PENDING"],
    ["verifiedAt", "2026-08-11T10:06:00.000Z"],
  ] as const)("requires fresh readback equality for %s", async (field, wrongValue) => {
    const pending = receipt({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST });
    const done = finalized({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST });
    const wrongFresh = finalized({
      reservationId: NEW_RESERVATION,
      clientRequestId: NEW_REQUEST,
      [field]: wrongValue,
    });
    ports.getAttachments
      .mockResolvedValueOnce(envelope([]))
      .mockResolvedValueOnce(envelope([wrongFresh]))
      .mockResolvedValueOnce(envelope([wrongFresh]));
    ports.reserve.mockResolvedValueOnce(reserveOk(pending));
    ports.finalize.mockResolvedValueOnce({ code: "OK", data: { receipt: done, replayed: false } });
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await waitFor(() => expect(ports.getAttachments).toHaveBeenCalledTimes(3));
    expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
  });

  it("rejects fresh confirmation when the server session actor changed", async () => {
    const pending = receipt({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST });
    const done = finalized({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST });
    ports.getAttachments
      .mockResolvedValueOnce(envelope([]))
      .mockResolvedValueOnce(envelope([done], true, OTHER_ACTOR))
      .mockResolvedValueOnce(envelope([done], true, OTHER_ACTOR));
    ports.reserve.mockResolvedValueOnce(reserveOk(pending));
    ports.finalize.mockResolvedValueOnce({ code: "OK", data: { receipt: done, replayed: false } });
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await waitFor(() => expect(ports.getAttachments).toHaveBeenCalledTimes(3));
    expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
  });

  it("routes same-intent retry to the newest owned PENDING and never a coworker row", async () => {
    const older = receipt({
      reservationId: "99999999-9999-4999-8999-999999999991",
      clientRequestId: "99999999-9999-4999-8999-999999999992",
      reservedAt: "2026-08-11T09:00:00.000Z",
    });
    const newer = receipt({ reservedAt: "2026-08-11T10:00:00.000Z" });
    const coworker = receipt({
      reservationId: "99999999-9999-4999-8999-999999999993",
      clientRequestId: "99999999-9999-4999-8999-999999999994",
      actorId: OTHER_ACTOR,
      reservedAt: "2026-08-11T11:00:00.000Z",
    });
    ports.getAttachments
      .mockResolvedValueOnce(envelope([older, newer, coworker]))
      .mockResolvedValueOnce(envelope([older, newer, coworker]))
      .mockResolvedValueOnce(envelope([older, newer, coworker]));
    ports.finalize.mockResolvedValueOnce({
      code: "CONFLICT",
      reason: "UPLOAD_NOT_READY",
      message: "not ready",
    });
    ports.reserve.mockResolvedValueOnce({
      code: "CONFLICT",
      reason: "ORDER_CHANGED",
      message: "stop",
    });
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findAllByText("Upload ausstehend");
    await chooseFile();
    await waitFor(() => expect(ports.reserve).toHaveBeenCalledTimes(1));
    expect(ports.finalize).toHaveBeenCalledWith({ reservationId: newer.reservationId });
    expect(ports.reserve).toHaveBeenCalledWith(expect.objectContaining({
      clientRequestId: newer.clientRequestId,
    }));
  });

  it("replays one actor-owned PENDING intent without minting a new client request", async () => {
    const pending = receipt();
    const done = finalized();
    ports.getAttachments
      .mockResolvedValueOnce(envelope([pending]))
      .mockResolvedValueOnce(envelope([pending]))
      .mockResolvedValueOnce(envelope([done]));
    ports.finalize
      .mockResolvedValueOnce({ code: "CONFLICT", reason: "UPLOAD_NOT_READY", message: "not ready" })
      .mockResolvedValueOnce({ code: "OK", data: { receipt: done, replayed: false } });
    ports.reserve.mockResolvedValueOnce({
      code: "OK",
      data: {
        receipt: pending,
        upload: { path: `order-station-evidence/v1/${RESERVATION}.png`, token: "replay-token" },
        replayed: true,
      },
    });
    ports.upload.mockResolvedValueOnce({
      data: { path: `order-station-evidence/v1/${RESERVATION}.png` },
      error: null,
    });
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Upload ausstehend");
    await chooseFile();
    expect(await screen.findByText("Bestätigt")).toBeInTheDocument();
    expect(ports.reserve).toHaveBeenCalledWith(expect.objectContaining({ clientRequestId: REQUEST }));
    expect(ports.randomUUID).not.toHaveBeenCalled();
    expect(ports.upload).toHaveBeenCalledTimes(1);
    expect(ports.finalize).toHaveBeenCalledTimes(2);
  });

  it("uses a keyed two-selection restart and rechecks an expired reservation before any new path", async () => {
    const pending = receipt();
    const done = finalized();
    ports.getAttachments
      .mockResolvedValueOnce(envelope([pending]))
      .mockResolvedValueOnce(envelope([pending]))
      .mockResolvedValueOnce(envelope([pending]))
      .mockResolvedValueOnce(envelope([done]));
    ports.finalize
      .mockResolvedValueOnce({ code: "CONFLICT", reason: "UPLOAD_NOT_READY", message: "not ready" })
      .mockResolvedValueOnce({ code: "OK", data: { receipt: done, replayed: false } });
    ports.reserve.mockResolvedValueOnce({
      code: "CONFLICT",
      reason: "UPLOAD_GRANT_EXPIRED",
      message: "expired",
    });
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Upload ausstehend");
    await chooseFile();
    expect(await screen.findByText("Erneute Prüfung erforderlich")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/alte Objekt geprüft/);
    expect(ports.reserve).toHaveBeenCalledTimes(1);
    expect(ports.upload).not.toHaveBeenCalled();

    await chooseFile();
    expect(await screen.findByText("Bestätigt")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Original sicher gespeichert");
    expect(ports.finalize).toHaveBeenCalledTimes(2);
    expect(ports.reserve).toHaveBeenCalledTimes(1);
    expect(ports.upload).not.toHaveBeenCalled();
  });

  it("creates a new immutable path only after an expired replay is rechecked and still not ready", async () => {
    const pending = receipt();
    const newPending = receipt({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST });
    const done = finalized({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST });
    ports.getAttachments
      .mockResolvedValueOnce(envelope([pending]))
      .mockResolvedValueOnce(envelope([pending]))
      .mockResolvedValueOnce(envelope([pending]))
      .mockResolvedValueOnce(envelope([pending]))
      .mockResolvedValueOnce(envelope([pending, done]));
    ports.finalize
      .mockResolvedValueOnce({ code: "CONFLICT", reason: "UPLOAD_NOT_READY", message: "not ready" })
      .mockResolvedValueOnce({ code: "CONFLICT", reason: "UPLOAD_NOT_READY", message: "still not ready" })
      .mockResolvedValueOnce({ code: "OK", data: { receipt: done, replayed: false } });
    ports.reserve
      .mockResolvedValueOnce({ code: "CONFLICT", reason: "UPLOAD_GRANT_EXPIRED", message: "expired" })
      .mockResolvedValueOnce({
        code: "OK",
        data: {
          receipt: newPending,
          upload: { path: `order-station-evidence/v1/${NEW_RESERVATION}.png`, token: "new-token" },
          replayed: false,
        },
      });
    ports.upload.mockResolvedValueOnce({
      data: { path: `order-station-evidence/v1/${NEW_RESERVATION}.png` },
      error: null,
    });
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Upload ausstehend");
    await chooseFile();
    expect(await screen.findByText("Erneute Prüfung erforderlich")).toBeInTheDocument();
    expect(ports.upload).not.toHaveBeenCalled();

    await chooseFile();
    expect(await screen.findByText("Bestätigt")).toBeInTheDocument();
    expect(ports.finalize).toHaveBeenNthCalledWith(2, { reservationId: RESERVATION });
    expect(ports.reserve).toHaveBeenNthCalledWith(2, expect.objectContaining({
      clientRequestId: NEW_REQUEST,
    }));
    expect(ports.upload).toHaveBeenCalledTimes(1);
  });

  it.each(["UPLOAD_MISMATCH", "UPLOAD_OUTSIDE_WINDOW"] as const)(
    "requires a separate selection after irreparable %s before minting a new request id",
    async (reason) => {
    const pending = receipt();
    ports.getAttachments
      .mockResolvedValueOnce(envelope([pending]))
      .mockResolvedValueOnce(envelope([pending]))
      .mockResolvedValueOnce(envelope([pending]));
    ports.finalize.mockResolvedValueOnce({
      code: "CONFLICT",
      reason,
      message: "immutable object cannot be reused",
    });
    ports.reserve.mockResolvedValueOnce({
      code: "CONFLICT",
      reason: "ORDER_CHANGED",
      message: "stop",
    });
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Upload ausstehend");
    await chooseFile();
    expect(await screen.findByText("Neue Reservierung erforderlich")).toBeInTheDocument();
    expect(ports.reserve).not.toHaveBeenCalled();
    await chooseFile();
    await waitFor(() => expect(ports.reserve).toHaveBeenCalledTimes(1));
    expect(ports.reserve).toHaveBeenCalledWith(expect.objectContaining({ clientRequestId: NEW_REQUEST }));
    },
  );

  it.each([
    ["unsupported MIME", "text/plain", FILE_BYTES.byteLength],
    ["empty file", "image/png", 0],
    ["oversized file", "image/png", 12 * 1024 * 1024 + 1],
  ])("rejects %s before hashing or reserving", async (_label, type, size) => {
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    const input = screen.getByLabelText(/Neues Original/i, { selector: "input" });
    fireEvent.change(input, {
      target: { files: [{ type, size, arrayBuffer: vi.fn() }] },
    });
    await screen.findByText("Nur JPG, PNG oder WebP bis 12 MiB sind erlaubt.");
    expect(ports.digest).not.toHaveBeenCalled();
    expect(ports.reserve).not.toHaveBeenCalled();
  });

  it("keeps a cloned-equal item scope stable during upload through fresh readback", async () => {
    const upload = deferred<{ data: { path: string }; error: null }>();
    const done = finalized({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST });
    ports.getAttachments
      .mockResolvedValueOnce(envelope([]))
      .mockResolvedValueOnce(envelope([done]));
    ports.reserve.mockResolvedValueOnce(reserveOk());
    ports.upload.mockReturnValueOnce(upload.promise);
    ports.finalize.mockResolvedValueOnce({ code: "OK", data: { receipt: done, replayed: false } });
    const view = render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await waitFor(() => expect(ports.upload).toHaveBeenCalledTimes(1));
    view.rerender(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await act(async () => { await Promise.resolve(); });
    expect(ports.getAttachments).toHaveBeenCalledTimes(1);
    upload.resolve({ data: { path: `order-station-evidence/v1/${NEW_RESERVATION}.png` }, error: null });
    expect(await screen.findByText("Bestätigt")).toBeInTheDocument();
    expect(ports.getAttachments).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["order", { orderId: "order-b", expectedVersion: 2, items: [{ id: ITEM_ID, name: "Teil A" }] }, { orderId: "order-b", itemId: ITEM_ID }],
    ["version", { orderId: ORDER_ID, expectedVersion: 3, items: [{ id: ITEM_ID, name: "Teil A" }] }, { orderId: ORDER_ID, itemId: ITEM_ID }],
    ["item", { orderId: ORDER_ID, expectedVersion: 2, items: [{ id: "item-b", name: "Teil B" }] }, { orderId: ORDER_ID, itemId: "item-b" }],
  ] as const)("invalidates a deferred workflow when only the %s scope changes", async (_label, nextProps, expectedRead) => {
    const reserve = deferred<ReturnType<typeof reserveOk>>();
    ports.reserve.mockReturnValueOnce(reserve.promise);
    const view = render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await waitFor(() => expect(ports.reserve).toHaveBeenCalledTimes(1));
    view.rerender(<GalvanikHandoffAttachmentPanel
      orderId={nextProps.orderId}
      expectedVersion={nextProps.expectedVersion}
      items={[...nextProps.items]}
    />);
    await waitFor(() => expect(ports.getAttachments).toHaveBeenCalledTimes(2));
    expect(ports.getAttachments).toHaveBeenLastCalledWith(expectedRead);
    reserve.resolve(reserveOk());
    await act(async () => { await Promise.resolve(); });
    expect(ports.upload).not.toHaveBeenCalled();
    expect(ports.finalize).not.toHaveBeenCalled();
    expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
  });

  it("does not finalize an upload that resolves after a committed scope switch", async () => {
    const upload = deferred<{ data: { path: string }; error: null }>();
    ports.reserve.mockResolvedValueOnce(reserveOk());
    ports.upload.mockReturnValueOnce(upload.promise);
    const view = render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await waitFor(() => expect(ports.upload).toHaveBeenCalledTimes(1));
    view.rerender(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={3}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    upload.resolve({ data: { path: `order-station-evidence/v1/${NEW_RESERVATION}.png` }, error: null });
    await act(async () => { await Promise.resolve(); });
    expect(ports.finalize).not.toHaveBeenCalled();
    expect(screen.queryByText(/Original sicher gespeichert/)).not.toBeInTheDocument();
  });

  it("enforces synchronous single-flight for two file events", async () => {
    const hash = deferred<ArrayBuffer>();
    ports.digest.mockReturnValueOnce(hash.promise);
    ports.reserve.mockResolvedValueOnce({ code: "CONFLICT", reason: "ORDER_CHANGED", message: "stop" });
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await chooseFile();
    expect(ports.digest).toHaveBeenCalledTimes(1);
    expect(ports.reserve).not.toHaveBeenCalled();
    hash.resolve(new Uint8Array(32).buffer);
    await waitFor(() => expect(ports.reserve).toHaveBeenCalledTimes(1));
  });

  it("stops after a deferred hash when unmounted", async () => {
    const bytes = deferred<ArrayBuffer>();
    const customFile = {
      type: "image/png",
      size: FILE_BYTES.byteLength,
      arrayBuffer: vi.fn().mockReturnValue(bytes.promise),
    } as unknown as File;
    const view = render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    fireEvent.change(screen.getByLabelText(/Neues Original/i, { selector: "input" }), {
      target: { files: [customFile] },
    });
    await waitFor(() => expect(customFile.arrayBuffer).toHaveBeenCalledTimes(1));
    view.unmount();
    bytes.resolve(FILE_BYTES.buffer.slice(0));
    await act(async () => { await Promise.resolve(); });
    expect(ports.reserve).not.toHaveBeenCalled();
    expect(ports.upload).not.toHaveBeenCalled();
    expect(ports.finalize).not.toHaveBeenCalled();
    expect(ports.getAttachments).toHaveBeenCalledTimes(1);
  });

  it("stops every downstream side effect when unmounted during a deferred reserve", async () => {
    const reserve = deferred<{
      code: "OK";
      data: {
        receipt: ReturnType<typeof receipt>;
        upload: { path: string; token: string };
        replayed: false;
      };
    }>();
    ports.getAttachments.mockResolvedValueOnce(envelope([]));
    ports.reserve.mockReturnValueOnce(reserve.promise);
    const view = render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await waitFor(() => expect(ports.reserve).toHaveBeenCalledTimes(1));
    view.unmount();
    reserve.resolve({
      code: "OK",
      data: {
        receipt: receipt({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST }),
        upload: {
          path: `order-station-evidence/v1/${NEW_RESERVATION}.png`,
          token: "upload-token",
        },
        replayed: false,
      },
    });
    await act(async () => { await Promise.resolve(); });
    expect(ports.upload).not.toHaveBeenCalled();
    expect(ports.finalize).not.toHaveBeenCalled();
    expect(ports.getAttachments).toHaveBeenCalledTimes(1);
  });

  it("stops before finalize when unmounted during a deferred upload", async () => {
    const upload = deferred<{ data: { path: string }; error: null }>();
    ports.reserve.mockResolvedValueOnce(reserveOk());
    ports.upload.mockReturnValueOnce(upload.promise);
    const view = render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await waitFor(() => expect(ports.upload).toHaveBeenCalledTimes(1));
    view.unmount();
    upload.resolve({ data: { path: `order-station-evidence/v1/${NEW_RESERVATION}.png` }, error: null });
    await act(async () => { await Promise.resolve(); });
    expect(ports.finalize).not.toHaveBeenCalled();
    expect(ports.getAttachments).toHaveBeenCalledTimes(1);
  });

  it("stops before fresh readback when unmounted during a deferred finalize", async () => {
    const done = finalized({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST });
    const finalize = deferred<{ code: "OK"; data: { receipt: ReturnType<typeof finalized>; replayed: false } }>();
    ports.reserve.mockResolvedValueOnce(reserveOk());
    ports.finalize.mockReturnValueOnce(finalize.promise);
    const view = render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Noch kein Übergabeoriginal erfasst.");
    await chooseFile();
    await waitFor(() => expect(ports.finalize).toHaveBeenCalledTimes(1));
    view.unmount();
    finalize.resolve({ code: "OK", data: { receipt: done, replayed: false } });
    await act(async () => { await Promise.resolve(); });
    expect(ports.getAttachments).toHaveBeenCalledTimes(1);
  });

  it("binds the signed original exactly and expires it from request start", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T10:00:00.000Z"));
    const original = deferred<ReturnType<typeof signedOriginal>>();
    ports.getAttachments.mockResolvedValueOnce(envelope([finalized()]));
    ports.original.mockReturnValueOnce(original.promise);
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Original freigeben" }));
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(screen.queryByRole("link", { name: "Privates Original jetzt öffnen" })).not.toBeInTheDocument();
    original.resolve(signedOriginal());
    await act(async () => { await Promise.resolve(); });
    const link = screen.getByRole("link", { name: "Privates Original jetzt öffnen" });
    expect(link).toHaveAttribute("href", signedOriginal().data.downloadUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("status")).toHaveTextContent("kurzzeitig verfügbar");
    await act(async () => { vi.advanceTimersByTime(29_999); });
    expect(screen.getByRole("link", { name: "Privates Original jetzt öffnen" })).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole("link", { name: "Privates Original jetzt öffnen" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("abgelaufen");
  });

  it.each([
    ["wrong origin", { downloadUrl: `https://evil.example/storage/v1/object/sign/item-photos/order-station-evidence/v1/${RESERVATION}.png?token=x&download=galvanik-uebergabe-original.png` }],
    ["wrong path", { downloadUrl: `http://127.0.0.1:54321/storage/v1/object/sign/item-photos/order-station-evidence/v1/${NEW_RESERVATION}.png?token=x&download=galvanik-uebergabe-original.png` }],
    ["extra query", { downloadUrl: `http://127.0.0.1:54321/storage/v1/object/sign/item-photos/order-station-evidence/v1/${RESERVATION}.png?token=x&download=galvanik-uebergabe-original.png&extra=1` }],
    ["duplicate token", { downloadUrl: `http://127.0.0.1:54321/storage/v1/object/sign/item-photos/order-station-evidence/v1/${RESERVATION}.png?token=x&token=y&download=galvanik-uebergabe-original.png` }],
    ["wrong download name", { downloadUrl: `http://127.0.0.1:54321/storage/v1/object/sign/item-photos/order-station-evidence/v1/${RESERVATION}.png?token=x&download=wrong.png` }],
    ["wrong MIME", { mimeType: "image/webp" }],
    ["wrong TTL", { expiresInSeconds: 61 }],
  ] as const)("rejects a signed original with %s", async (_label, wrong) => {
    ports.getAttachments.mockResolvedValueOnce(envelope([finalized()]));
    ports.original.mockResolvedValueOnce(signedOriginal(wrong));
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Bestätigt");
    fireEvent.click(screen.getByRole("button", { name: "Original freigeben" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("nicht exakt gebunden"));
    expect(screen.queryByRole("link", { name: "Privates Original jetzt öffnen" })).not.toBeInTheDocument();
  });

  it("rejects a valid-shaped download response that arrives after its request-start TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T10:00:00.000Z"));
    const original = deferred<ReturnType<typeof signedOriginal>>();
    ports.getAttachments.mockResolvedValueOnce(envelope([finalized()]));
    ports.original.mockReturnValueOnce(original.promise);
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Original freigeben" }));
    await act(async () => { vi.advanceTimersByTime(60_000); });
    original.resolve(signedOriginal());
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole("link", { name: "Privates Original jetzt öffnen" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("abgelaufen");
  });

  it("removes an issued link when a fresh metadata response revokes operation capability", async () => {
    const done = finalized();
    const pending = receipt({ reservationId: NEW_RESERVATION, clientRequestId: NEW_REQUEST });
    ports.getAttachments
      .mockResolvedValueOnce(envelope([done, pending], true))
      .mockResolvedValueOnce(envelope([done, pending], false));
    ports.original.mockResolvedValueOnce(signedOriginal());
    ports.finalize.mockResolvedValueOnce({ code: "CONFLICT", reason: "UPLOAD_NOT_READY", message: "not ready" });
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    await screen.findByText("Bestätigt");
    fireEvent.click(screen.getByRole("button", { name: "Original freigeben" }));
    expect(await screen.findByRole("link", { name: "Privates Original jetzt öffnen" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bestätigung prüfen" }));
    await waitFor(() => expect(ports.getAttachments).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("link", { name: "Privates Original jetzt öffnen" })).not.toBeInTheDocument();
    expect(screen.getByText("Bestätigt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Original freigeben" })).not.toBeInTheDocument();
  });

  it("fails closed for wrong metadata graph rows before any original action", async () => {
    ports.getAttachments.mockResolvedValueOnce(envelope([
      finalized({ orderId: "other-order" }),
    ]));
    render(<GalvanikHandoffAttachmentPanel
      orderId={ORDER_ID}
      expectedVersion={2}
      items={[{ id: ITEM_ID, name: "Teil A" }]}
    />);
    expect(await screen.findByRole("alert")).toHaveTextContent("nicht exakt an Auftrag und Teil");
    expect(screen.queryByRole("button", { name: "Original freigeben" })).not.toBeInTheDocument();
    expect(ports.original).not.toHaveBeenCalled();
  });
});

describe("W4 Galvanik page placement", () => {
  it("mounts exactly one panel only in the active canonical Ready card", async () => {
    ports.getOrders.mockResolvedValueOnce({
      ok: true,
      data: [{
        id: ORDER_ID,
        version: 2,
        orderNumber: "A-1",
        customerId: "customer-a",
        customerName: "Kunde",
        title: "Auftrag",
        task: null,
        itemDescription: "Teil",
        surfaceRequested: "Zink",
        station: "galvanik",
        currentStationId: "galvanik",
        status: "ready",
        statusText: "DRINGEND",
        risk: "red",
        parts: [{ id: ITEM_ID, name: "Teil A" }],
        intakeDate: "",
        dueDate: "",
        dueLabel: "Termin",
        dueValue: "Heute",
        createdAt: undefined,
      }],
    });
    ports.getAttachments.mockResolvedValue(envelope([]));
    ports.reserve.mockResolvedValueOnce({ code: "CONFLICT", reason: "ORDER_CHANGED", message: "stop" });
    render(<GalvanikPage />);
    await screen.findAllByText("A-1");
    expect(screen.getAllByLabelText("Galvanik-Übergabeoriginal")).toHaveLength(1);
    expect(ports.getAttachments).toHaveBeenCalledWith({ orderId: ORDER_ID, itemId: ITEM_ID });
    expect(await screen.findByText("Neues Original für Teil A")).toBeInTheDocument();
    await chooseFile();
    await waitFor(() => expect(ports.reserve).toHaveBeenCalledWith(expect.objectContaining({
      orderId: ORDER_ID,
      itemId: ITEM_ID,
      expectedVersion: 2,
    })));
    fireEvent.click(screen.getByRole("button", { name: /In Bearbeitung/ }));
    expect(screen.queryByLabelText("Galvanik-Übergabeoriginal")).not.toBeInTheDocument();
  });
});
