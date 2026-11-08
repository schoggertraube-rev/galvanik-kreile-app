"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, Dialog, Textfeld, Hinweis, Icon } from "@/ui/kr";
import type { GlobalCreatePorts } from "../GlobalCreateFlow";
import { recognizeNoteConcerns, type IntakeCapture } from "../captureContract";
import { retainPendingOriginal, readPendingOriginals, acknowledgePendingOriginal } from "../pendingOriginals";
import { findRecognizedCustomers } from "../customerRecognition";
import { uploadIntakeOriginal } from "../intakeOriginalUpload";
import QRCode from "qrcode";
import Image from "next/image";
import { getIntakeDeviceId, type IntakeDeviceRequest } from "../deviceContract";
import {intakeStartTitle,SITUATION_COPY,CAPTURE_COPY,type IntakeQuoteCandidate} from '@/ui/situationCatalog';
import {IntakeSituation} from "./IntakeSituation";
import type { CaptureKind } from "../captureRecognition";

type Props = { ports: GlobalCreatePorts; handoverToken?: string | null; mode?:"eingang"|"datei"|"eingangsfoto"|"visitenkarte"; onClose: (message?: string) => void;
  onAdopt?:(capture:IntakeCapture,message:string)=>void; onOrder: (customerId?: string, capture?: IntakeCapture) => void; onCustomer: (capture?: IntakeCapture) => void | string };
type PendingFile = { file: File; id: string; itemId: string; captureOrigin: "warenfoto" | "dokument" };
const CAMERA_DEVICE_QUERY = "(max-width: 1279px), (pointer: coarse)";
const subscribeDevice = (changed: () => void) => { const query = matchMedia(CAMERA_DEVICE_QUERY); query.addEventListener("change", changed); return () => query.removeEventListener("change", changed); };
const deviceSnapshot = () => matchMedia(CAMERA_DEVICE_QUERY).matches;
const serverDeviceSnapshot = () => false;
export function IntakeCaptureDialog({ ports, handoverToken, mode, onAdopt, onClose, onOrder, onCustomer }: Props) {
  const { readCaptureNote, searchIntakeCustomers, getCaptureScope, getCapture, deviceRequest, saveCaptureNote, discardCapture } = ports;
  const [itemId, setItemId] = useState(() => crypto.randomUUID());
  const [scope, setScope] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [situationRequested,setSituationRequested]=useState(false);
  const [capture, setCapture] = useState<IntakeCapture | null>(null);
  const [quoteCandidates,setQuoteCandidates]=useState<IntakeQuoteCandidate[]>([]);
  const [quotesLoading,setQuotesLoading]=useState(false);
  const [quoteCustomer,setQuoteCustomer]=useState<string|null>(null);
  const candidateCustomer=capture?.customerId??null,candidateKind=capture?.recognition?.kind;
  const concerns = useMemo(() => recognizeNoteConcerns(text), [text]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(()=>{if(!candidateCustomer||candidateKind!=='ware')return;let active=true;Promise.resolve().then(()=>{if(active){setQuotesLoading(true);setQuoteCandidates([]);}return ports.listOpenQuotes();}).then(result=>{if(!active)return;if(result.code!=='OK'){setError(result.message);return;}setQuoteCustomer(candidateCustomer);setQuoteCandidates(result.quotes.filter(q=>q.customerId===candidateCustomer&&!q.linkedOrderId&&q.lifecycle?.stage!=='abgesagt').map(q=>({id:q.quoteId,number:q.quoteNumber,customer:q.customerDisplayName,accepted:Boolean(q.lifecycle?.acceptedAt&&q.lifecycle.acceptedEdition===q.lifecycle.edition),edition:q.lifecycle?.edition??1,goodsHere:Boolean(q.lifecycle?.goods?.some(row=>!row.orderId)),location:q.lifecycle?.goods?.find(row=>!row.orderId)?.location??null})));}).catch(cause=>{console.error('[INTAKE_QUOTE_CANDIDATES_FAILED]',cause);if(active)setError('Passende KVs konnten nicht sicher gelesen werden.');}).finally(()=>{if(active)setQuotesLoading(false);});return()=>{active=false;};},[ports,candidateCustomer,candidateKind]);
  const [createContext, setCreateContext] = useState<{ customerId: string; label: string } | null>(null);
  const [contextLoading, setContextLoading] = useState(!mode && Boolean(ports.getCreateContext));
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextAttempt, setContextAttempt] = useState(0);
  const getCreateContext = ports.getCreateContext;
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const openedAt = useRef(new Date().toISOString());
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [automaticRetry, setAutomaticRetry] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [photoRequest, setPhotoRequest] = useState<IntakeDeviceRequest | null>(null);
  const [pendingRequests, setPendingRequests] = useState<IntakeDeviceRequest[]>([]);
  const [receiving, setReceiving] = useState(handoverToken !== undefined && handoverToken !== null);
  const [deviceWorking, setDeviceWorking] = useState(false);
  const deviceInFlight = useRef(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLink, setQrLink] = useState<string | null>(null);
  const [closeRequested, setCloseRequested] = useState(false);
  const [hidePreviousResult,setHidePreviousResult]=useState(false);
  const discardKey=useRef(crypto.randomUUID());
  const kindKeys = useRef(new Map<string, string>());
  const [kindWorking, setKindWorking] = useState<Exclude<CaptureKind, "unklar"> | null>(null);
  const [goodsChoice, setGoodsChoice] = useState(false);
  const localInput = useRef(false);
  const earlyNote = useRef<{ text: string; stand: string; dismissed: string[] } | null>(null);
  const photoRequestId = photoRequest?.id;
  const blockedReceiver = receiving && photoRequest === null;
  const cameraAvailable = useSyncExternalStore(subscribeDevice, deviceSnapshot, serverDeviceSnapshot);
  const [cameraRequested, setCameraRequested] = useState(true);
  const photoInFlight = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<"missing" | "permission" | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const inFlight = useRef(false);
  const textstand = useRef(crypto.randomUUID());
  const lastSaved = useRef("");
  const savedCapture = useRef<IntakeCapture | null>(null);
  const pendingNoteWrites = useRef(Promise.resolve());
  useEffect(() => {
    if (!getCapture) return;
    let current = true, running = false;
    const closing = new AbortController();
    let cursor: { at: string; id: string | null } = { at: openedAt.current, id: null };
    const poll = async () => {
      if (running || !current) return;
      running = true;
      try {
        for (let page = 0; page < 10 && current; page += 1) {
          const query = new URLSearchParams({ since: cursor.at });
          if (cursor.id) query.set("after", cursor.id);
          const response = await fetch("/api/device-file-changes?" + query, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.any([closing.signal, AbortSignal.timeout(5_000)]) });
          if (!response.ok) throw new Error("INTAKE_LIVE_HTTP_" + response.status);
          const changes: unknown = await response.json();
          if (!Array.isArray(changes) || changes.some(change => !change || typeof change !== "object" || typeof change.id !== "string" || typeof change.itemId !== "string" || typeof change.fileId !== "string" || typeof change.at !== "string")) throw new Error("INTAKE_LIVE_RESPONSE_INVALID");
          if (!current) return;
          if (changes.some(change => change.itemId === itemId)) {
            const loaded = await getCapture(itemId);
            if (loaded.code !== "OK") throw new Error(loaded.message);
            if (current) setCapture(loaded.capture);
          }
          if (!current) return;
          const last = changes.at(-1);
          if (last) {
            if (last.id === cursor.id && last.at === cursor.at) throw new Error("INTAKE_LIVE_CURSOR_NOT_ADVANCING");
            cursor = { id: last.id, at: last.at };
          }
          setLiveError(null);
          if (changes.length < 100) break;
        }
      } catch (cause) {
        if (!closing.signal.aborted) {
          console.error("[INTAKE_LIVE_READ_FAILED]", cause);
          if (current) setLiveError("Neue Aufnahmen konnten nicht geladen werden · der letzte Stand bleibt erhalten. Code: INTAKE_LIVE_READ_FAILED.");
        }
      } finally { running = false; }
    };
    void poll();
    const timer = setInterval(() => void poll(), 3_000);
    return () => { current = false; clearInterval(timer); closing.abort(); };
  }, [getCapture, itemId]);
  const hasCapturedContent = Boolean(capture && (capture.files.length > 0 || capture.text?.trim()));
  const hasContent = text.trim().length > 0 || hasCapturedContent || pending.length > 0 || photoRequest !== null;
  const capturedId = capture?.id;
  useEffect(() => {
    if (!getCapture || !capturedId) return;
    let active = true;
    const changed = async () => {
      try {
        const read = await getCapture(itemId);
        if (!active) return;
        if (read.code === "OK") setCapture(read.capture);
        else setError(read.message);
      } catch (cause) { console.error("[INTAKE_CAPTURE_REFRESH_FAILED]", cause); if (active) setError("Zuordnung konnte nicht erneut gelesen werden · Original bleibt erhalten. Code: INTAKE_CAPTURE_REFRESH_FAILED."); }
    };
    window.addEventListener("kreile:intake-changed", changed);
    return () => { active = false; window.removeEventListener("kreile:intake-changed", changed); };
  }, [getCapture, itemId, capturedId]);
  const savedMessage = ports.canReadMails ? "Gespeichert · wartet unter Nachrichten › Zuordnen" : "Gespeichert · Büro ordnet zu";

  useEffect(() => {
    if (mode || !getCreateContext) return;
    let current = true;
    void getCreateContext().then(result => {
      if (!current) return;
      if (result.code !== "OK") { setContextError(result.message); return; }
      setCreateContext(result.context);
      setContextError(null);
    }).catch(cause => {
      console.error("[INTAKE_CREATE_CONTEXT_READ_FAILED]", cause);
      if (current) setContextError("Kontext konnte nicht geladen werden. Code: INTAKE_CREATE_CONTEXT_READ_FAILED.");
    }).finally(() => { if (current) setContextLoading(false); });
    return () => { current = false; };
  }, [mode, getCreateContext, contextAttempt]);

  useEffect(() => {
    if (!deviceRequest || handoverToken === undefined || handoverToken === null) return;
    let current = true;
    void deviceRequest({ command: "accept", token: handoverToken, deviceId: getIntakeDeviceId() }).then(async result => {
      if (!current) return;
      if (result.code !== "OK" || !result.requests[0]) { setError(result.code === "OK" ? "Foto-Anfrage fehlt." : result.message); return; }
      const request = result.requests[0]; setPhotoRequest(request); setItemId(request.itemId); setReceiving(true);
      if (getCapture) { const loaded = await getCapture(request.itemId); if (current && loaded.code === "OK") setCapture(loaded.capture); }
    }).catch(cause => { console.error("[INTAKE_HANDOVER_ACCEPT_FAILED]", cause); if (current) setError("Foto-Anfrage konnte nicht geöffnet werden. Code: INTAKE_HANDOVER_ACCEPT_FAILED."); });
    return () => { current = false; };
  }, [handoverToken, deviceRequest, getCapture]);
  useEffect(() => {
    if (!deviceRequest) return;
    let current = true, running = false;
    const refresh = async () => {
      if (running || !current) return;
      running = true;
      try {
        const result = await deviceRequest({ command: "refresh", ...(photoRequestId ? { requestId: photoRequestId } : {}) });
        if (!current) return;
        if (result.code !== "OK") { setError(result.message); return; }
        if (photoRequestId) {
          const updated = result.requests.find(request => request.id === photoRequestId);
          if (updated) {
            setPhotoRequest(updated);
            if (updated.status === "abgelaufen") { setError("Übergabe abgelaufen"); setQrImage(null); setQrLink(null); }
          }
        } else setPendingRequests(result.requests);
      } catch (cause) { console.error("[INTAKE_DEVICE_REFRESH_FAILED]", cause); if (current) setError("Foto-Anfragen konnten nicht geladen werden. Code: INTAKE_DEVICE_REFRESH_FAILED."); }
      finally { running = false; }
    };
    void refresh(); const timer = setInterval(() => void refresh(), 3_000);
    return () => { current = false; clearInterval(timer); };
  }, [deviceRequest, photoRequestId]);

  const requestPhotos = async () => {
    if (!deviceRequest || deviceInFlight.current) return;
    deviceInFlight.current = true; setDeviceWorking(true); setError(null);
    try {
      const result = await deviceRequest({ command: "request", itemId });
      if (result.code !== "OK" || !result.requests[0]) { setError(result.code === "OK" ? "Foto-Anfrage fehlt." : result.message); return; }
      setPhotoRequest(result.requests[0]);
      if (result.token) { const link = location.origin + "/rein#uebergabe:" + result.token; setQrLink(link); setQrImage(await QRCode.toDataURL(link, { width: 216, margin: 1 })); }
    } catch (cause) { console.error("[INTAKE_PHOTOS_REQUEST_FAILED]", cause); setError("Foto-Anfrage konnte nicht angelegt werden. Code: INTAKE_PHOTOS_REQUEST_FAILED."); }
    finally { deviceInFlight.current = false; setDeviceWorking(false); }
  };
  const acceptRequest = async (requestId: string) => {
    if (!deviceRequest || deviceInFlight.current) return;
    deviceInFlight.current = true; setDeviceWorking(true);
    try {
      const result = await deviceRequest({ command: "accept", requestId, deviceId: getIntakeDeviceId() });
      if (result.code !== "OK" || !result.requests[0]) { setError(result.code === "OK" ? "Foto-Anfrage fehlt." : result.message); return; }
      const request = result.requests[0]; setPhotoRequest(request); setItemId(request.itemId); setReceiving(true); setPendingRequests([]);
      if (getCapture) { const loaded = await getCapture(request.itemId); if (loaded.code === "OK") setCapture(loaded.capture); else setError(loaded.message); }
    } catch (cause) { console.error("[INTAKE_DEVICE_ACCEPT_FAILED]", cause); setError("Foto-Anfrage konnte nicht angenommen werden. Code: INTAKE_DEVICE_ACCEPT_FAILED."); }
    finally { deviceInFlight.current = false; setDeviceWorking(false); }
  };
  const finishPhotos = async (reason: "fertig" | "abgebrochen") => {
    if (!deviceRequest || !photoRequest || deviceInFlight.current || busy || pending.length) return;
    deviceInFlight.current = true; setDeviceWorking(true);
    try {
      const result = await deviceRequest({ command: "end", requestId: photoRequest.id, deviceId: getIntakeDeviceId(), reason });
      if (result.code !== "OK" || !result.requests[0]) { setError(result.code === "OK" ? "Foto-Anfrage fehlt." : result.message); return; }
      if (receiving) onClose(result.requests[0].photoCount + " Fotos an den PC gesendet");
      else { setPhotoRequest(null); setQrImage(null); setQrLink(null); }
    } catch (cause) { console.error("[INTAKE_DEVICE_FINISH_FAILED]", cause); setError("Übergabe konnte nicht beendet werden. Code: INTAKE_DEVICE_FINISH_FAILED."); }
    finally { deviceInFlight.current = false; setDeviceWorking(false); }
  };

  useEffect(() => {
    if (!cameraAvailable || !cameraRequested || blockedReceiver) return;
    let current = true;
    void Promise.resolve().then(() => {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("Kamera nicht verfügbar", "NotFoundError");
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    }).then(stream => {
      if (!current) { stream.getTracks().forEach(track => track.stop()); return; }
      cameraStream.current = stream;
      setCameraError(null);
      setCameraReady(false);
      if (video.current && video.current.srcObject !== stream) video.current.srcObject = stream;
    }).catch(cause => {
      const name = cause instanceof Error || cause instanceof DOMException ? cause.name : "UnknownError";
      console.error("[INTAKE_CAMERA_OPEN_FAILED]", { name });
      if (current) setCameraError(["NotAllowedError", "SecurityError"].includes(name) ? "permission" : "missing");
    });
    return () => { current = false; cameraStream.current?.getTracks().forEach(track => track.stop()); cameraStream.current = null; };
  }, [cameraAvailable, cameraRequested, cameraAttempt, blockedReceiver]);

  useEffect(() => {
    if (!text.trim()) return;
    let current = true;
    const timer = setTimeout(() => {
      setReading(true);
      if (!readCaptureNote) { setReading(false); setError("Lesen ist nicht verbunden. Code: INTAKE_NOTE_READ_PORT_UNAVAILABLE."); return; }
      void Promise.all([readCaptureNote(text), findRecognizedCustomers(text, searchIntakeCustomers)])
        .then(([result, matched]) => {
          if (!current) return;
          if (result.code !== "OK") { setError(result.message); return; }
          if (matched.code !== "OK") { setError(matched.message); return; }
          setCustomers(matched.customers.map(customer => ({ id: customer.id, name: customer.companyName ?? customer.name })));
        }).catch(cause => {
          console.error("[INTAKE_NOTE_LIVE_READ_FAILED]", { name: cause instanceof Error ? cause.name : "UnknownError" });
          if (current) setError("Lesen fehlgeschlagen · der Text bleibt erhalten. Code: INTAKE_NOTE_LIVE_READ_FAILED.");
        }).finally(() => { if (current) setReading(false); });
    }, 400);
    return () => { current = false; clearTimeout(timer); };
  }, [text, searchIntakeCustomers, readCaptureNote]);

  const saveNote = useCallback(async (): Promise<IntakeCapture | null> => {
    if (!text.trim()) return capture;
    if (!scope) { setError("Lokale Aufnahme wird noch vorbereitet."); return null; }
    const key = JSON.stringify([text, concerns.filter(value => !dismissed.includes(value.id)).map(value => value.id)]);
    const savingStand = textstand.current;
    await pendingNoteWrites.current;
    if (lastSaved.current === key && savedCapture.current) {
      try { await acknowledgePendingOriginal(scope, itemId, savingStand); }
      catch (cause) { console.error("[INTAKE_NOTE_LOCAL_ACK_FAILED]", cause); setError("Notiz ist auf dem Server gespeichert · lokale Bestätigung fehlgeschlagen. Bitte erneut prüfen. Code: INTAKE_NOTE_LOCAL_ACK_FAILED."); return null; }
      return savedCapture.current;
    }
    if (!saveCaptureNote) { setError("Speichern ist nicht verbunden. Code: INTAKE_NOTE_WRITE_PORT_UNAVAILABLE."); return null; }
    const result = await saveCaptureNote({ itemId, textstand: savingStand, text, ...(createContext ? { context: { customerId: createContext.customerId } } : {}),
      concerns: concerns.filter(value => !dismissed.includes(value.id)).map(value => value.id) });
    if (result.code !== "OK") { setError(result.message); return null; }
    setCapture(result.capture); savedCapture.current = result.capture; lastSaved.current = key;
    try { await acknowledgePendingOriginal(scope, itemId, savingStand); }
    catch (cause) { console.error("[INTAKE_NOTE_LOCAL_ACK_FAILED]", cause); setError("Notiz ist auf dem Server gespeichert · lokale Bestätigung fehlgeschlagen. Bitte erneut prüfen. Code: INTAKE_NOTE_LOCAL_ACK_FAILED."); return null; }
    return result.capture;
  }, [text,capture,scope,concerns,dismissed,itemId,saveCaptureNote,createContext]);
  const upload = async (files: PendingFile[]) => {
    if (inFlight.current) return;
    if (!scope || !ports.prepareCaptureFile || !ports.finishCaptureFile) { setError("Dateiübertragung ist nicht verbunden. Code: INTAKE_UPLOAD_PORT_UNAVAILABLE."); return; }
    inFlight.current = true; setBusy(true); setError(null); setPending(files); setAutomaticRetry(true);
    setProgress({ done: 0, total: files.length });
    const remaining = [...files];
    try {
      for (const entry of files) {
        const bytes = await entry.file.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
        await retainPendingOriginal(scope, { id: entry.id, itemId: entry.itemId, kind: "file", file: entry.file, captureOrigin: entry.captureOrigin });
        const grant = await ports.prepareCaptureFile({ itemId: entry.itemId, fileId: entry.id, name: entry.file.name, mime: entry.file.type || "application/octet-stream", bytes: entry.file.size, sha256, deviceId: getIntakeDeviceId(), captureOrigin: entry.captureOrigin });
        if (grant.code !== "OK") { setAutomaticRetry(grant.code === "UNAVAILABLE"); setError(grant.message); return; }
        if (grant.upload) {
          const result = await uploadIntakeOriginal(grant.upload, entry.file);
          // An interrupted retry can meet the already stored immutable hash. The server verifies it.
          if (!result.ok) console.error("[INTAKE_FILE_UPLOAD_REQUIRES_VERIFICATION]", { code: "UNCONFIRMED" });
        }
        const finished = await ports.finishCaptureFile(entry.id);
        if (finished.code !== "OK") { setAutomaticRetry(finished.code === "UNAVAILABLE"); setError(finished.message); return; }
        try { await acknowledgePendingOriginal(scope, entry.id); }
        catch (cause) { console.error("[INTAKE_FILE_LOCAL_ACK_FAILED]", cause); setCapture(finished.capture); setError("Original ist auf dem Server gesichert · lokale Bestätigung fehlgeschlagen. Bitte erneut übertragen. Code: INTAKE_FILE_LOCAL_ACK_FAILED."); return; }
        setCapture(finished.capture); setItemId(finished.capture.id); remaining.shift(); setPending([...remaining]);
        setProgress({ done: files.length - remaining.length, total: files.length });
      }
    } catch (cause) {
      console.error("[INTAKE_FILE_UPLOAD_FAILED]", { name: cause instanceof Error ? cause.name : "UnknownError" });
      setError("Übertragung unterbrochen · erneut versuchen. Dateien und Kennungen bleiben erhalten. Code: INTAKE_FILE_UPLOAD_FAILED.");
    } finally { inFlight.current = false; setBusy(false); }
  };
  const chooseFiles = (list: FileList | File[] | null) => {
    if (!list || !list.length) return;
    if (blockedReceiver) { setError("Foto-Anfrage wird noch geöffnet · Dateien danach erneut wählen."); return; }
    if (inFlight.current) { setError("Eine Übertragung läuft bereits · weitere Dateien bitte danach wählen."); return; }
    const files = Array.from(list);
    if (files.some(file => file.size < 1 || file.size > 150 * 1024 * 1024)) { setError("Dateien müssen 1 Byte bis 150 MB groß sein."); return; }
    if (mode === "eingangsfoto" && files.some(file => !["image/jpeg","image/png","image/heic","image/webp"].includes(file.type.toLowerCase()))) { setError("Eingangsfoto benötigt JPG, PNG, HEIC oder WEBP."); return; }
    const captureOrigin = mode === "eingangsfoto" ? "warenfoto" as const : "dokument" as const;
    const entries = files.map(file => ({ file, id: crypto.randomUUID(), itemId, captureOrigin }));
    localInput.current = true;setHidePreviousResult(false);
    setCameraRequested(false);
    setPending(entries);
    if (scope) void upload(entries);
  };
  const takePhoto = () => {
    if (photoInFlight.current || inFlight.current || blockedReceiver) return;
    const source = video.current;
    if (!source || source.readyState < 2 || !source.videoWidth || !source.videoHeight) { setError("Kamera ist noch nicht bereit · bitte kurz warten."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth; canvas.height = source.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) { setError("Foto konnte nicht aufgenommen werden. Code: INTAKE_CAMERA_CANVAS_UNAVAILABLE."); return; }
    context.drawImage(source, 0, 0);
    photoInFlight.current = true;
    canvas.toBlob(blob => {
      photoInFlight.current = false;
      if (!blob) { setError("Foto konnte nicht gesichert werden. Code: INTAKE_CAMERA_BLOB_UNAVAILABLE."); return; }
      setCameraRequested(false);
      chooseFiles([new File([blob], "Foto-" + new Date().toISOString().replace(/[:.]/g, "-") + ".jpg", { type: "image/jpeg", lastModified: Date.now() })]);
    }, "image/jpeg", 0.92);
  };
  const close = useCallback(async () => {
    if (inFlight.current || deviceWorking) { setCloseRequested(true); return; }
    inFlight.current = true; setBusy(true);
    try {
      if (pending.length) { setCloseRequested(true); setError("Übertragung ist noch offen · das Fenster schließt nach der Bestätigung."); return; }
      const saved = await saveNote();
      if (text.trim() && !saved) return;
      if(mode&&(saved??capture)){
        if(!discardCapture){setError("Kennzeichnung ist nicht verbunden. Code: INTAKE_DISCARD_PORT_UNAVAILABLE.");return;}
        const original=saved??capture!;
        const discarded=await discardCapture({itemId:original.id,version:original.version,clientEventId:discardKey.current});
        if(discarded.code!=="OK"){setError(discarded.message);return;}
      }
      if (deviceRequest && photoRequest) {
        const ended = await deviceRequest({ command: "end", requestId: photoRequest.id, deviceId: getIntakeDeviceId(), reason: receiving ? "abgebrochen" : "geschlossen" });
        if (ended.code !== "OK") { setError(ended.message); return; }
      }
      onClose(!mode&&hasContent ? savedMessage : undefined);
    } catch (cause) {
      console.error("[INTAKE_CAPTURE_CLOSE_FAILED]", { name: cause instanceof Error ? cause.name : "UnknownError" });
      setError("Speichern fehlgeschlagen · alle Eingaben sind noch da. Code: INTAKE_CAPTURE_CLOSE_FAILED.");
    } finally { inFlight.current = false; setBusy(false); }
  }, [deviceWorking,pending.length,saveNote,text,deviceRequest,photoRequest,receiving,onClose,hasContent,savedMessage,mode,capture,discardCapture]);
  useEffect(() => {
    if (!closeRequested || busy || deviceWorking || inFlight.current || pending.length) return;
    setCloseRequested(false);
    void close();
  }, [closeRequested,busy,deviceWorking,pending.length,close]);
  useEffect(() => {
    let current = true;
    let retry: number | undefined;
    if (!getCaptureScope) return;
    const initialize = async () => { for (let attempt=0;attempt<3&&current;attempt+=1) { try {
      const result = await getCaptureScope();
      if (result.code !== "OK") throw new Error("INTAKE_PENDING_SCOPE_UNAVAILABLE");
      const originals = (await readPendingOriginals(result.scope)).filter(original=>original.kind!=='file'||!original.context);
      if (current) {
        setScope(result.scope);
        setError(message=>message?.includes("INTAKE_PENDING_RESUME_FAILED")||message?.includes("Lokale Sicherung wird vorbereitet")?null:message);
      }
      if (!current) return;
      if (earlyNote.current?.text.trim()) {
        const note = earlyNote.current;
        await retainPendingOriginal(result.scope,{id:itemId,itemId,kind:"note",text:note.text,textstand:note.stand,dismissed:note.dismissed});
      }
      if (!originals.length || handoverToken || localInput.current) return;
      const firstId = originals[0].itemId;
      setItemId(firstId);
      const note = originals.find(original => original.kind === "note" && original.itemId === firstId);
      if (note?.kind === "note") { setText(note.text); setDismissed(note.dismissed); textstand.current = note.textstand; }
      const files = originals.filter(original => original.kind === "file" && original.itemId === firstId).map(original => ({ id: original.id, itemId: original.itemId, file: (original as Extract<typeof original, { kind: "file" }>).file, captureOrigin: (original as Extract<typeof original, { kind: "file" }>).captureOrigin ?? "dokument" as const }));
      if (files.length) setPending(files);
      return;
    } catch(cause) {
      console.error("[INTAKE_PENDING_RESUME_FAILED]",cause);
      if(current)setError("Lokale Aufnahmen werden vorbereitet · ausgewählte Dateien bleiben hier erhalten. Code: INTAKE_PENDING_RESUME_FAILED.");
      if(attempt<2&&current)await new Promise<void>(resolve=>{retry=window.setTimeout(resolve,1_000);});
    } } };
    void initialize();
    return () => { current = false; if(retry!==undefined)clearTimeout(retry); };
  }, [getCaptureScope, handoverToken, itemId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (pending.length || text.trim() && lastSaved.current !== JSON.stringify([text, concerns.filter(value => !dismissed.includes(value.id)).map(value => value.id)])) { event.preventDefault(); event.returnValue = ""; } };
    const resume = () => { if (pending.length && !inFlight.current) void upload(pending); };
    window.addEventListener("beforeunload", warn); window.addEventListener("online", resume);
    const retry = pending.length && !busy && automaticRetry && scope
      ? setTimeout(() => { if (navigator.onLine && !inFlight.current) void upload(pending); }, 1_000) : null;
    return () => { if (retry !== null) clearTimeout(retry); window.removeEventListener("beforeunload", warn); window.removeEventListener("online", resume); };
  });
  const changeText = (value: string) => {
    localInput.current = true;
    setSituationRequested(false);
    setText(value); textstand.current = crypto.randomUUID(); setDismissed([]); setError(null);
    setCustomers([]);
    const stand = textstand.current;
    earlyNote.current = { text:value,stand,dismissed:[] };
    if (!scope) { setError("Lokale Sicherung wird vorbereitet · Text bleibt erhalten."); return; }
    pendingNoteWrites.current = pendingNoteWrites.current.then(() => value.trim()
      ? retainPendingOriginal(scope, { id: itemId, itemId, kind: "note", text: value, textstand: stand, dismissed: [] })
      : acknowledgePendingOriginal(scope, itemId))
      .catch(cause => { console.error("[INTAKE_PENDING_NOTE_FAILED]", cause); setError("Text bleibt hier erhalten, die lokale Sicherung ist nicht verfügbar. Bitte Lesen. Code: INTAKE_PENDING_NOTE_FAILED."); });
  };
  const dismissConcern = (id: string) => {
    const next = [...dismissed, id]; const stand = crypto.randomUUID();
    setDismissed(next); textstand.current = stand;
    localInput.current = true; earlyNote.current = {text,stand,dismissed:next};
    if (!scope) return;
    pendingNoteWrites.current = pendingNoteWrites.current.then(() => retainPendingOriginal(scope, { id: itemId, itemId, kind: "note", text, textstand: stand, dismissed: next }))
      .catch(cause => { console.error("[INTAKE_PENDING_CONCERN_FAILED]", cause); setError("Auswahl konnte lokal nicht gesichert werden. Bitte Lesen. Code: INTAKE_PENDING_CONCERN_FAILED."); });
  };
  const modeTitle = receiving || photoRequest ? "Fotos für den PC" : mode ? { eingang: "Zettel lesen · für die Erfassung", eingangsfoto: "Eingangsfoto aufnehmen", visitenkarte: "Visitenkarte lesen", datei: "Datei lesen · für die Erfassung" }[mode] : undefined;
  const failedFile = capture?.files.some(file => file.status === "fehler") === true;
  const firstOriginal = capture?.files.find(file => file.secured === true);
  const showCamera = cameraAvailable && cameraRequested && !cameraError;
  const recognizedKind = capture?.recognition?.kind ?? (capture?.text ? "notiz" : "unklar");
  const kindNames = { ware: "Ware", anfrage: "Anfrage oder Bestellung", rechnung: "Rechnung (Lieferant)", dokument: "Dokument", kontakt: "Kontakt", notiz: "Notiz", unklar: "unklar" };
  const openObject = (target: "mailein" | "original" | "ware" | "rechnungein" | "kvware", arg: string) => {
    if (!ports.openCaptureObject) { setError("Diese Ansicht ist in diesem Stand noch nicht verbunden · Code: INTAKE_CAPTURE_TARGET_UNAVAILABLE."); return; }
    if (!ports.openCaptureObject(target, arg)) {
      setError("Die angeforderte Ansicht konnte nicht geöffnet werden · Original und Eingaben bleiben erhalten. Code: INTAKE_CAPTURE_TARGET_UNAVAILABLE.");
      console.error("[INTAKE_CAPTURE_TARGET_UNAVAILABLE]", { target });
    } else if (target === "ware" || target === "rechnungein" || target === "kvware") onClose();
  };
  const assign = async () => {
    try { const saved = await saveNote(); if (saved) openObject("mailein", saved.id + "#rein"); }
    catch (cause) { console.error("[INTAKE_CAPTURE_ASSIGN_OPEN_FAILED]", cause); setError("Zuordnung konnte nicht geöffnet werden · Eingaben bleiben erhalten. Code: INTAKE_CAPTURE_ASSIGN_OPEN_FAILED."); }
  };
  const chooseKind = async (kind: Exclude<CaptureKind, "unklar">) => {
    if (!capture || inFlight.current) return;
    if (!ports.chooseCaptureKind) { setError("Die Art des Eingangs kann nicht gespeichert werden · Code: INTAKE_KIND_PORT_MISSING."); return; }
    inFlight.current = true; setBusy(true); setError(null); setKindWorking(kind);
    const request = capture.id + ":" + capture.version + ":" + kind;
    if (!kindKeys.current.has(request)) kindKeys.current.set(request, crypto.randomUUID());
    try {
      const result = await ports.chooseCaptureKind({ itemId: capture.id, version: capture.version, clientEventId: kindKeys.current.get(request)!, kind });
      if (result.code !== "OK") { setError(result.message); return; }
      setCapture(result.capture);
      if (kind === "anfrage") onOrder(result.capture.customerId ?? undefined, result.capture);
      else if (kind === "rechnung") {
        if (ports.canManageMoney) openObject("rechnungein", result.capture.id);
        else onClose("Gespeichert · Büro prüft");
      } else if (kind === "ware") {
        setGoodsChoice(true);
      } else openObject("mailein", result.capture.id + "#rein");
    } catch (cause) { console.error("[INTAKE_KIND_UI_WRITE_FAILED]", cause); setError("Die Art des Eingangs wurde nicht bestätigt · Original bleibt erhalten. Code: INTAKE_KIND_UI_WRITE_FAILED."); }
    finally { inFlight.current = false; setBusy(false); setKindWorking(null); }
  };
  const showSituation=Boolean(!mode&&!receiving&&capture&&hasCapturedContent&&!showCamera&&!hidePreviousResult&&(capture.files.some(file=>file.secured===true)||situationRequested&&Boolean(capture.recognition?.text.trim())&&!["notiz","unklar"].includes(capture.recognition?.kind??"unklar")));
  const readSituation=async()=>{if(inFlight.current)return;inFlight.current=true;setBusy(true);try{const saved=await saveNote();if(saved){setSituationRequested(true);setHidePreviousResult(false);}}catch(cause){console.error("[INTAKE_NOTE_SAVE_FAILED]",cause);setError("Speichern fehlgeschlagen · Text bleibt erhalten. Code: INTAKE_NOTE_SAVE_FAILED.");}finally{inFlight.current=false;setBusy(false);}};
  const resultMain = capture && hasCapturedContent && !mode && !receiving && !busy && !showCamera && !hidePreviousResult ? recognizedKind === "anfrage" ?
    <Button data-spec-id="rein.erfassen-aus-eingang" art="primaer" text={CAPTURE_COPY.order} onClick={() => onOrder(capture.customerId ?? undefined, capture)} />
    : recognizedKind === "kontakt" ? <Button data-spec-id="rein.kontakt-anlegen" art="primaer" text={CAPTURE_COPY.customer} onClick={() => { const reason = onCustomer(capture); if (reason) setError(reason); }} />
    : recognizedKind === "rechnung" ? ports.canManageMoney ? <Button data-spec-id="rein.rechnung-pruefen" art="primaer" text={CAPTURE_COPY.invoice} onClick={() => openObject("rechnungein", capture.id)} />
      : <Button data-spec-id="rein.fuers-buero" art="primaer" text={CAPTURE_COPY.office} onClick={() => onClose("Gespeichert · Büro prüft")} />
    : recognizedKind === "ware" && capture.expectedOrders?.length === 1 && capture.customerId === capture.expectedOrders[0].customerId ?
      <Button data-spec-id="rein.ware-annehmen-kunde" art="primaer" text={"Ware annehmen · " + capture.expectedOrders[0].number} onClick={() => openObject("ware", capture.expectedOrders![0].id + "#" + capture.id)} />
    : null : null;
  const anotherPage = () => { setCameraReady(false); setCameraAttempt(value => value + 1); setCameraRequested(true); setHidePreviousResult(true); };
  const finishReading = async () => {
    if (inFlight.current || !capture || !getCapture) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const read = await getCapture(capture.id);
      if (read.code !== "OK") { setError(read.message); return; }
      setCapture(read.capture); setCameraRequested(false); setHidePreviousResult(false);
    } catch (cause) { console.error("[INTAKE_CAPTURE_FINAL_READ_FAILED]", cause); setError("Das Ergebnis konnte nicht erneut gelesen werden · Originale bleiben erhalten. Code: INTAKE_CAPTURE_FINAL_READ_FAILED."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const adopt = () => {
    if (capture && !busy) onAdopt?.(capture, mode === "eingangsfoto" ? "Eingangsfoto übernommen" : failedFile ? "Als Dokument übernommen · ohne Vorschläge" : "Übernommen · erkannt markiert");
  };
  return <Dialog titel={SITUATION_COPY.header} unterzeile={modeTitle} icon="plus" groesse="breit" schliessenSpecId="rein.schliessen" onSchliessen={() => void close()} vorSchliessen={() => { void close(); return false; }}
    fuss={<>
      <Button text={CAPTURE_COPY.close} onClick={() => void close()} disabled={busy || deviceWorking} />
      {!showSituation?<>{showCamera ? <Button data-spec-id="rein.ausloesen" icon="camera" art="primaer" text={busy ? "Wird gesichert …" : "Foto"} disabled={busy || blockedReceiver || deviceWorking || !cameraReady} onClick={takePhoto} /> : null}
      {receiving ? <Button data-spec-id="rein.handy-fertig" art={showCamera ? "leise" : "erledigen"} text={CAPTURE_COPY.done} disabled={busy || deviceWorking || pending.length > 0} onClick={() => void finishPhotos("fertig")} />
        : mode && capture && hasCapturedContent && !showCamera && !hidePreviousResult ? <Button data-spec-id={failedFile ? "rein.als-dokument" : "rein.uebernehmen"} art="erledigen" text={failedFile ? "Als Dokument übernehmen" : "Übernehmen"} disabled={busy} onClick={adopt} />
          : !mode && hasContent ? <Button data-spec-id="rein.spaeter-zuordnen" text={CAPTURE_COPY.later} disabled={busy} onClick={() => void close()} /> : null}
      {resultMain}
      {firstOriginal && !showCamera && !receiving ? <Button data-spec-id="rein.original" art="leise" text={CAPTURE_COPY.original} title={firstOriginal.name}
        onClick={() => openObject("original", capture!.id + "#" + firstOriginal.id)} /> : null}
      {!mode && !receiving && hasContent && (!capture || ["anfrage", "kontakt", "rechnung", "ware"].includes(recognizedKind)) ?
        <Button data-spec-id="rein.wem-gehoert" art="leise" text={CAPTURE_COPY.assign} disabled={busy} onClick={() => void assign()} /> : null}
      </>:null}
    </>}>
    <div data-spec-id="rein" className={`ev-rein${mode ? " ev-rein--erg" : ""}`} onKeyDown={event => {
      if (showCamera && (event.key === " " || event.key === "Enter") && !(event.target as HTMLElement).closest("input,textarea,select,button,a,[contenteditable=true]")) { event.preventDefault(); takePhoto(); }
    }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseFiles(event.dataTransfer.files); }}
      onPaste={event => { if (event.clipboardData.files.length) { event.preventDefault(); chooseFiles(event.clipboardData.files); } }}>
      {showSituation&&capture?<IntakeSituation capture={capture} kind={recognizedKind} busy={busy||quotesLoading} quotes={quoteCustomer===candidateCustomer&&candidateCustomer&&candidateKind==="ware"?quoteCandidates:[]} onQuote={id=>openObject("kvware",id+"#"+capture.id)} primary={resultMain} onAssign={()=>void assign()} onOriginal={file=>openObject("original",capture.id+"#"+file)} onOrder={order=>openObject("ware",order+"#"+capture.id)} onMore={()=>cameraAvailable?anotherPage():input.current?.click()} onEdit={()=>{setSituationRequested(false);setHidePreviousResult(true);}} onKind={kind=>void chooseKind(kind)} onTask={()=>{const opened=!window.dispatchEvent(new CustomEvent("kreile:oeffne",{cancelable:true,detail:{ziel:"aufgabe",taskRequest:{reference:{type:"eingang",id:capture.id},kind:"aufgabe",itemId:capture.id}}}));if(!opened){console.error("[INTAKE_TASK_TARGET_UNAVAILABLE]");setError("Aufgabe konnte nicht geöffnet werden · Code: INTAKE_TASK_TARGET_UNAVAILABLE.");}}}/>:null}
      <div className="ev-rein-feld" hidden={showSituation} style={showSituation?{display:"none"}:undefined}>
        {!mode&&ports.actorDisplayName?.trim()?<h2>{intakeStartTitle(ports.actorDisplayName)}</h2>:null}
        {contextLoading ? <p role="status">Kontext wird gelesen …</p> : null}
        {createContext ? <div data-spec-id="rein.kontext" className="ev-rein-kontext">
          <strong>für {createContext.label}</strong>
          <Button data-spec-id="rein.kontext-entfernen" text={CAPTURE_COPY.removeContext} icon="x" onClick={() => setCreateContext(null)} />
        </div> : null}
        {contextError ? <div role="alert" className="kr-stapel"><Hinweis ton="warn">{contextError}</Hinweis>
          <Button text={CAPTURE_COPY.readContext} onClick={() => { setContextLoading(true); setContextAttempt(value => value + 1); }} />
        </div> : null}
        {blockedReceiver && !error ? <p role="status">Foto-Anfrage wird geöffnet …</p> : null}
        {closeRequested ? <p role="status">Aufnahmen werden gesichert · das Fenster schließt nach der Bestätigung.</p> : null}
        {cameraAvailable && !receiving && pendingRequests.map(request => <Button key={request.id} text={CAPTURE_COPY.acceptDevice} onClick={() => void acceptRequest(request.id)} disabled={deviceWorking} />)}
        {receiving && photoRequest ? <p role="status">{photoRequest.photoCount} an den PC gesendet</p> : null}
        {cameraRequested && cameraAvailable ? cameraError ? <div data-spec-id={cameraError === "permission" ? "rein.zustand.teilweise" : "rein.zustand.leer"} className="kr-stapel">
          <Hinweis ton="warn">{cameraError === "permission" ? "Kamera nicht freigegeben · im Browser erlauben oder Datei wählen" : "Keine Kamera gefunden · Datei wählen oder Notiz schreiben"}</Hinweis>
          <Button text={CAPTURE_COPY.file} onClick={() => input.current?.click()} />
          <Button text={CAPTURE_COPY.retry} onClick={() => setCameraAttempt(attempt => attempt + 1)} />
        </div> : <div className="ev-rein-kamera">
          <div className="ev-sucher"><video ref={node => { video.current = node; if (node && cameraStream.current && node.srcObject !== cameraStream.current) node.srcObject = cameraStream.current; }} aria-label="Rückkamera" tabIndex={0} autoPlay playsInline muted
            onLoadedData={event => { const node = event.currentTarget; setCameraReady(node.readyState >= 2 && node.videoWidth > 0 && node.videoHeight > 0); }} onEmptied={() => setCameraReady(false)} /></div>
          {!cameraReady ? <p role="status">Kamera wird vorbereitet …</p> : null}
        </div> : null}
        <Textfeld data-spec-id="rein.notiz" aria-label="Notiz" rows={7} maxLength={20_000} placeholder="Schreib, füge ein oder zieh eine Datei hierher …" value={text}
          onChange={event => changeText(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();if(text.trim()&&!busy)void readSituation();}}} />
        {text.trim() ? <Button data-spec-id="rein.notiz-lesen" text={!scope?"Wird vorbereitet …":reading ? "Wird gelesen …" : "Lesen"} disabled={busy||!scope} onClick={()=>void readSituation()} /> : null}
        {concerns.length || customers.length ? <div aria-label="Erkannt" className="ev-rein-erkannt"><strong>ERKANNT · Vorschläge</strong>
          {customers.map(customer => <span key={customer.id}>{customer.name} · Vorschlag aus dem Namen</span>)}
          {concerns.filter(value => !dismissed.includes(value.id)).map(concern => <Button key={concern.id} text={`${concern.label} ×`} onClick={() => dismissConcern(concern.id)} />)}
        </div> : null}
      </div>
      <div className="ev-rein-rechts" hidden={showSituation} style={showSituation?{display:"none"}:undefined}>
        <div className="ev-rein-karten">
          <button type="button" className="ev-karte" data-spec-id="rein.datei" aria-label="Datei" onClick={() => input.current?.click()} disabled={busy || blockedReceiver}><Icon name="upload" /><b>Datei</b><small>Datei hierher ziehen oder auswählen</small></button>
          {cameraAvailable ? <button type="button" className="ev-karte" data-spec-id="rein.handy" aria-label="Fotos mit Tablet/Handy" onClick={() => setCameraRequested(true)} disabled={busy}><Icon name="camera" /><b>Fotos mit Tablet/Handy</b><small>Kamera auf diesem Gerät öffnen</small></button> : deviceRequest ? <button type="button" className="ev-karte" data-spec-id="rein.handy" aria-label="Fotos mit Tablet/Handy" onClick={() => void requestPhotos()} disabled={deviceWorking || busy}><Icon name="camera" /><b>Fotos mit Tablet/Handy</b><small>Kamera öffnet auf deinem Gerät</small></button> : null}
        </div>
        {photoRequest && !receiving ? <div data-spec-id="rein.zustand.uebergabe" className="ev-rein-qr">
          <p>QR mit dem Handy scannen oder dort „Fotos für den PC“ antippen · 10 Minuten gültig</p>
          {qrImage ? <Image src={qrImage} width={216} height={216} unoptimized alt="QR-Code für Fotos mit Tablet/Handy" /> : null}
          {qrLink ? <a href={qrLink}>Fotos für den PC öffnen</a> : null}
          <p>{photoRequest.photoCount} Fotos am Eingang</p>
          {photoRequest.photoCount > 0 ? <Button data-spec-id="rein.fertig-lesen" text={CAPTURE_COPY.readDone} onClick={() => void finishPhotos("fertig")} disabled={deviceWorking} /> : null}
          <Button data-spec-id="rein.uebergabe-abbrechen" text={CAPTURE_COPY.cancel} onClick={() => void finishPhotos("abgebrochen")} disabled={deviceWorking} />
        </div> : null}
        <input ref={input} type="file" multiple hidden disabled={blockedReceiver||busy} onChange={event => { chooseFiles(event.target.files); event.target.value = ""; }} />
        {!hasContent&&!mode ? <section aria-label="Ohne Vorlage" className="ev-rein-ohne"><span>Ohne Vorlage</span>
          <Button art="leise" icon="inbox" title="Taste A" text={CAPTURE_COPY.order} disabled={contextLoading || Boolean(contextError)} data-spec-id="rein.auftrag-erfassen" onClick={() => onOrder(createContext?.customerId)} />
          <Button art="leise" icon="user" title="Taste K" text={CAPTURE_COPY.customer} data-spec-id="rein.kunde-anlegen" onClick={() => onCustomer()} />
        </section> : null}
        {busy ? <p role="status">{kindWorking ? `Art „${kindNames[kindWorking]}“ wird gespeichert …` : `${progress.done} von ${progress.total} hochgeladen · wird übertragen und geprüft …`}</p> : null}
        {capture&&hasCapturedContent&&!hidePreviousResult ? <div data-spec-id={capture.files.some(file => file.status === "fehler") ? "rein.zustand.fehler" : capture.files.some(file => ["wartet", "laeuft"].includes(file.status)) ? "rein.zustand.laden" : "rein.zustand.erkannt"}>
          <strong>{capture.files.some(file => file.status === "fehler") ? capture.files.every(file => file.secured === true) ? "Nicht lesbar · Original gesichert" : "Original noch nicht gesichert" : capture.files.some(file => ["wartet", "laeuft"].includes(file.status)) ? "Wird gelesen · Original gesichert" : mode === "eingangsfoto" ? "Eingangsfoto gesichert" : (capture.recognition?.source === "hand" ? "Gewählt · " : "Erkannt · ") + kindNames[recognizedKind]}</strong>
          {!mode && !receiving && recognizedKind === "unklar" && !busy ? <section data-spec-id="rein.was-ist-das" className="kr-stapel"><h3>Was ist das?</h3><div className="ev-rein-karten">
            <button type="button" className="ev-karte" data-spec-id="rein.was-ist.auftrag" onClick={() => void chooseKind("anfrage")}><Icon name="inbox"/><b>Auftrag/KV</b></button>
            <button type="button" className="ev-karte" data-spec-id="rein.was-ist.ware" onClick={() => void chooseKind("ware")}><Icon name="box"/><b>Ware</b></button>
            <button type="button" className="ev-karte" data-spec-id="rein.was-ist.rechnung" onClick={() => void chooseKind("rechnung")}><Icon name="file"/><b>Eingangsrechnung</b></button>
            <button type="button" className="ev-karte" data-spec-id="rein.was-ist.dokument" onClick={() => void chooseKind(capture.files.length ? "dokument" : "notiz")}><Icon name="file"/><b>Dokument/Notiz zum Kunden</b></button>
          </div></section> : null}
          {capture.recognition?.text ? <p className="ev-rein-original">{capture.recognition.text}</p> : null}
          {capture.files.map(file => <div key={file.id}><p>{file.name} · {file.secured === true ? "Original gesichert" : "Übertragung offen"}</p>
            {file.secured === true ? <Button data-spec-id={"rein.original." + file.id} art="leise" text={file.name + " anzeigen"} onClick={() => openObject("original", capture.id + "#" + file.id)} /> : null}
          </div>)}
          {!mode && (recognizedKind === "unklar" || recognizedKind === "ware") && Boolean(capture.expectedOrders?.length) ? <section data-spec-id="rein.erwartet" className="kr-stapel"><h3>Erwartete Ware</h3>
            {goodsChoice ? <p role="status">Auftrag für die erwartete Ware wählen</p> : null}
            {capture.expectedOrders!.map(order => <Button key={order.id} data-spec-id="rein.erwartet-waehlen" text={order.number + " · " + (order.customerName ?? "Kunde fehlt") + " · " + (order.title ?? "Titel fehlt")}
              onClick={() => openObject("ware", order.id + "#" + capture.id)} />)}
          </section> : null}
          {cameraAvailable && capture.files.length > 0 && !busy ? <div className="kr-stapel">
            <Button data-spec-id="rein.weitere-seite" icon="camera" text={CAPTURE_COPY.anotherPage} onClick={anotherPage} />
            {!receiving && !photoRequest ? <Button data-spec-id="rein.fertig-lesen" text={CAPTURE_COPY.readDone} onClick={() => void finishReading()} /> : null}
          </div> : null}
          {mode&&capture.files.length&&!busy?<div className="kr-stapel">
            <Button data-spec-id="rein.neues-foto" text={CAPTURE_COPY.newPhoto} onClick={()=>setHidePreviousResult(true)}/>
          </div>:null}
        </div> : null}
        {pending.length && !busy ? <Button text={CAPTURE_COPY.uploadRetry} onClick={() => void upload(pending)} /> : null}
      </div>
      {liveError ? <Hinweis ton="warn">{liveError}</Hinweis> : null}
      {error ? <div role="alert"><Hinweis ton="warn">{error}</Hinweis></div> : null}
    </div>
  </Dialog>;
}
