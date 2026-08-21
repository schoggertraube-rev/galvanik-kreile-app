import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

export type CardSearchDocument = {
  type: "ORDER" | "CUSTOMER";
  id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  searchDocument: string;
};

export type CardSearchReadResult =
  | { code: "OK"; data: CardSearchDocument[] }
  | { code: "FORBIDDEN"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type SearchDocumentRow = {
  document_type: string;
  record_id: string;
  tenant_id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  search_document: string;
  integrity_ok: boolean;
};

function mapSearchDocument(
  row: SearchDocumentRow,
  authorization: AuthorizationSnapshot,
): CardSearchDocument {
  if (
    (row.document_type !== "ORDER" && row.document_type !== "CUSTOMER")
    || row.tenant_id !== authorization.tenantId
    || row.integrity_ok !== true
    || typeof row.record_id !== "string"
    || row.record_id.trim().length === 0
    || typeof row.title !== "string"
    || row.title.trim().length === 0
    || (row.subtitle !== null && typeof row.subtitle !== "string")
    || (row.status !== null && typeof row.status !== "string")
    || typeof row.search_document !== "string"
    || row.search_document.trim().length === 0
  ) {
    throw new Error("CARD_SEARCH_DOCUMENT_INVALID");
  }

  if (row.document_type === "CUSTOMER" && row.status !== null) {
    throw new Error("CARD_SEARCH_DOCUMENT_INVALID");
  }

  return {
    type: row.document_type,
    id: row.record_id,
    title: row.title,
    subtitle: row.subtitle,
    status: row.status,
    searchDocument: row.search_document,
  };
}

/**
 * F1.3 L4 read-only cross-module port. The document is derived entirely from
 * tenant-bound private views/tables and remains an implementation detail for a
 * later search package; this module does not expose or wire a search UI.
 */
export async function readCardSearchDocuments(
  authorization: AuthorizationSnapshot,
): Promise<CardSearchReadResult> {
  if (!authorization.permissions.includes("perm_view_leitstand")) {
    return { code: "FORBIDDEN", message: "Kartensuche ist mit dieser Rolle nicht erlaubt." };
  }

  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<SearchDocumentRow>(sql`
        SELECT
          document_type,
          record_id,
          tenant_id,
          title,
          subtitle,
          status,
          search_document,
          integrity_ok
        FROM private.v_card_search_documents_v1
        ORDER BY document_type, title, record_id
      `);

      const mapped = rows.map((row) => mapSearchDocument(row, authorization));
      const keys = new Set<string>();
      for (const document of mapped) {
        const key = `${document.type}:${document.id}`;
        if (keys.has(key)) throw new Error("CARD_SEARCH_DOCUMENT_DUPLICATE");
        keys.add(key);
      }
      return mapped;
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Kartensuchdokumente konnten nicht sicher geladen werden." };
  }
}
