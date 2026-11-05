"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Hinweis, Kachel } from "@/ui/kr";
import { requestGlobalCreate } from "../requestGlobalCreate";
import type { IntakeDraft, IntakeDraftPorts } from "../draftContract";

/** X12 reads the existing server store; this list owns no second draft state. */
export function IntakeDraftList({ readDrafts, discardDraft }: Pick<IntakeDraftPorts, "readDrafts" | "discardDraft">) {
  const [drafts, setDrafts] = useState<IntakeDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const deletion = useRef<{ id: string; key: string } | null>(null);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const result = await readDrafts();
      if (current !== sequence.current) return;
      if (result.code !== "OK") { setError(result.message); return; }
      setDrafts(result.drafts); setError(null);
    } catch (cause) {
      console.error("[INTAKE_DRAFT_LIST_READ_FAILED]", cause);
      if (current === sequence.current) setError("Entwürfe nicht erreichbar · letzter Stand bleibt sichtbar. Code: INTAKE_DRAFT_LIST_READ_FAILED.");
    }
  }, [readDrafts]);
  useEffect(() => {
    const initialRead = window.setTimeout(() => void reload(), 0);
    const changed = () => void reload();
    window.addEventListener("kreile:intake-drafts-changed", changed);
    window.addEventListener("focus", changed);
    return () => { window.clearTimeout(initialRead); sequence.current += 1; window.removeEventListener("kreile:intake-drafts-changed", changed); window.removeEventListener("focus", changed); };
  }, [reload]);
  const remove = async (draft: IntakeDraft) => {
    if (deletion.current) return;
    const operation = { id: draft.id, key: crypto.randomUUID() };
    deletion.current = operation; setBusy(draft.id);
    try {
      const result = await discardDraft({ id: draft.id, clientEventId: operation.key, expectedUpdatedAt: draft.updated_at });
      if (result.code !== "OK") { setError(result.message); return; }
      setDrafts(result.drafts); setError(null);
    } catch (cause) {
      console.error("[INTAKE_DRAFT_LIST_DISCARD_FAILED]", cause);
      setError("Entwurf konnte nicht gelöscht werden. Code: INTAKE_DRAFT_LIST_DISCARD_FAILED.");
    } finally { deletion.current = null; setBusy(null); }
  };
  if (!drafts.length && !error) return null;
  return <Kachel titel="Entwürfe" icon="file"><div className="kr-stapel">
    {error ? <Hinweis ton="warn"><span>{error}</span><Button text="Erneut laden" onClick={() => void reload()} /></Hinweis> : null}
    {drafts.map(draft => <div className="kr-stapel" key={draft.id}>
      <strong>Entwurf · {typeof draft.payload.customerName === "string" && draft.payload.customerName || (draft.art === "kunde" ? "Kunde" : "Auftrag oder KV")}</strong>
      <div className="kr-schnellleiste">
        <Button data-spec-id="tag.entwurf.weiter-bearbeiten" text="Weiter bearbeiten" icon="edit" onClick={() => requestGlobalCreate({ intent: "DIRECT_INTAKE", draftId: draft.id })} disabled={busy !== null} />
        <Button data-spec-id="tag.entwurf.loeschen" text={busy === draft.id ? "Wird gelöscht …" : "Löschen"} icon="x" onClick={() => void remove(draft)} disabled={busy !== null} />
      </div>
    </div>)}
  </div></Kachel>;
}
