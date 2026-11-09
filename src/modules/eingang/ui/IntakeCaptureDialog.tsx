"use client";
import {PACKAGE_ASSIGN_COPY} from '@/ui/situationCatalog';
import {PackageOnsiteEditor} from "./PackageOnsiteEditor";
import {PACKAGE_ONSITE_COPY} from "@/ui/situationCatalog";

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
import {intakeStartTitle,SITUATION_COPY,CAPTURE_COPY,CAPTURE_TEXT_COPY,CAPTURE_ENTRY_COPY,CAPTURE_ERROR_COPY,captureFailureCopy,type IntakeQuoteCandidate} from '@/ui/situationCatalog';
import {IntakeSituation} from "./IntakeSituation";
import type { CaptureKind } from "../captureRecognition";

type Props = { resumeSourceId?:string|null; ports: GlobalCreatePorts; handoverToken?: string | null; mode?:"eingang"|"datei"|"eingangsfoto"|"visitenkarte"; onClose: (message?: string) => void;
  onAdopt?:(capture:IntakeCapture,message:string)=>void; onOrder: (customerId?: string, capture?: IntakeCapture) => void; onCustomer: (capture?: IntakeCapture) => void | string };
type PendingFile = { file: File; id: string; itemId: string; captureOrigin: "warenfoto" | "dokument" };
const CAMERA_DEVICE_QUERY = "(max-width: 1279px), (pointer: coarse)";
const subscribeDevice = (changed: () => void) => { const query = matchMedia(CAMERA_DEVICE_QUERY); query.addEventListener("change", changed); return () => query.removeEventListener("change", changed); };
const deviceSnapshot = () => matchMedia(CAMERA_DEVICE_QUERY).matches;
const serverDeviceSnapshot = () => false;
export function IntakeCaptureDialog({ resumeSourceId, ports, handoverToken, mode, onAdopt, onClose, onOrder, onCustomer }: Props) {
  const { readCaptureNote, searchIntakeCustomers, getCaptureScope, getCapture:readCapture, deviceRequest, saveCaptureNote, discardCapture } = ports;
  const getCapture=useMemo(()=>readCapture?async(id:string)=>readCapture(id,undefined,{packageExpectation:false}):undefined,[readCapture]);
  const [onsite,setOnsite]=useState(Boolean(resumeSourceId));
  const [itemId, setItemId] = useState(() => crypto.randomUUID());
  const [scope, setScope] = useState<string | null>(null);


  const [text, setText] = useState("");
  const [capture, setCapture] = useState<IntakeCapture | null>(null);
  const quoteCandidates:IntakeQuoteCandidate[]=capture?.packageContext?.status==='OK'?capture.packageContext.candidates.filter(row=>row.kind==='quote').map(row=>({id:row.id,number:row.number,customer:row.customerName??'',accepted:row.state==='accepted',edition:row.edition??1,goodsHere:row.goodsHere??false,location:row.location??null})):[];
  const packageAssignKeys=useRef(new Map<string,string>());
  const concerns = useMemo(() => recognizeNoteConcerns(text), [text]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const [createContext, setCreateContext] = useState<{ customerId: string; label: string } | null>(null);
  const [contextLoading, setContextLoading] = useState(!mode && Boolean(ports.getCreateContext));
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextAttempt, setContextAttempt] = useState(0);
  const getCreateContext = ports.getCreateContext;
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [textAlternatives,setTextAlternatives]=useState(false);
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
  const expectationVersions=useRef(new Map<string,Promise<IntakeCapture['packageContext']>>());
  const packageContext=capture?.packageContext;
  const expectationId=capture?.id,expectationVersion=capture?.version,expectationKind=capture?.recognition?.kind,hasExpectation=Boolean(capture?.packageContext);
  useEffect(()=>{
    if(!expectationId||expectationVersion===undefined||expectationKind!=='ware'||!readCapture)return;
    const key=expectationId+':'+expectationVersion;
    if(hasExpectation){expectationVersions.current.set(key,Promise.resolve(packageContext));return;}
    let request=expectationVersions.current.get(key);
    if(!request){request=readCapture(expectationId,undefined,{packageExpectation:true}).then(result=>{
      if(result.code!=='OK'||result.capture.id!==expectationId||result.capture.version!==expectationVersion)throw Error('PACKAGE_EXPECTATION_VERSION_CHANGED');
      return result.capture.packageContext;
    });expectationVersions.current.set(key,request);}
    let active=true;
    void request.then(context=>{
      if(active)setCapture(current=>current?.id===expectationId&&current.version===expectationVersion?{...current,packageContext:context}:current);
    }).catch(failure=>{console.error('[PACKAGE_EXPECTATION_REFRESH_FAILED]',failure);if(active)setError(PACKAGE_ASSIGN_COPY.unavailable);});
    return()=>{active=false;};
  },[expectationId,expectationVersion,expectationKind,hasExpectation,packageContext,readCapture]);
  const pendingNoteWrites = useRef(Promise.resolve());
  useEffect(()=>{if(!resumeSourceId||!getCapture)return;let active=true;void getCapture(resumeSourceId).then(result=>{if(!active)return;if(result.code!=='OK'){setError(captureFailureCopy(result.code));return;}setItemId(result.capture.id);setCapture(result.capture);setText(result.capture.text??'');setCameraRequested(false);}).catch(failure=>{console.error('[PACKAGE_ONSITE_CAPTURE_RESTORE_FAILED]',failure);if(active)setError(PACKAGE_ONSITE_COPY.missing);});return()=>{active=false;};},[resumeSourceId,getCapture]);
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
            if (current) setCapture(previous=>previous?.id===loaded.capture.id&&previous.version===loaded.capture.version?{...loaded.capture,packageContext:previous.packageContext}:loaded.capture);
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
          if (current) setLiveError(CAPTURE_ERROR_COPY.INTAKE_LIVE_READ_FAILED);
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
        else setError(captureFailureCopy(read.code));
      } catch (cause) { console.error("[INTAKE_CAPTURE_REFRESH_FAILED]", cause); if (active) setError(CAPTURE_ERROR_COPY.INTAKE_CAPTURE_REFRESH_FAILED); }
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
      if (result.code !== "OK") { setContextError(captureFailureCopy(result.code)); return; }
      setCreateContext(result.context);
      setContextError(null);
    }).catch(cause => {
      console.error("[INTAKE_CREATE_CONTEXT_READ_FAILED]", cause);
      if (current) setContextError(CAPTURE_ERROR_COPY.INTAKE_CREATE_CONTEXT_READ_FAILED);
    }).finally(() => { if (current) setContextLoading(false); });
    return () => { current = false; };
  }, [mode, getCreateContext, contextAttempt]);

  useEffect(() => {
    if (!deviceRequest || handoverToken === undefined || handoverToken === null) return;
    let current = true;
    void deviceRequest({ command: "accept", token: handoverToken, deviceId: getIntakeDeviceId() }).then(async result => {
      if (!current) return;
      if (result.code !== "OK" || !result.requests[0]) { setError(result.code === "OK" ? CAPTURE_ENTRY_COPY.requestMissing : captureFailureCopy(result.code)); return; }
      const request = result.requests[0]; setPhotoRequest(request); setItemId(request.itemId); setReceiving(true);
      if (getCapture) { const loaded = await getCapture(request.itemId); if (current && loaded.code === "OK") setCapture(loaded.capture); }
    }).catch(cause => { console.error("[INTAKE_HANDOVER_ACCEPT_FAILED]", cause); if (current) setError(CAPTURE_ERROR_COPY.INTAKE_HANDOVER_ACCEPT_FAILED); });
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
        if (result.code !== "OK") { setError(captureFailureCopy(result.code)); return; }
        if (photoRequestId) {
          const updated = result.requests.find(request => request.id === photoRequestId);
          if (updated) {
            setPhotoRequest(updated);
            if (updated.status === "abgelaufen") { setError(CAPTURE_ERROR_COPY.NOTICE_5); setQrImage(null); setQrLink(null); }
          }
        } else setPendingRequests(result.requests);
      } catch (cause) { console.error("[INTAKE_DEVICE_REFRESH_FAILED]", cause); if (current) setError(CAPTURE_ERROR_COPY.INTAKE_DEVICE_REFRESH_FAILED); }
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
      if (result.code !== "OK" || !result.requests[0]) { setError(result.code === "OK" ? CAPTURE_ENTRY_COPY.requestMissing : captureFailureCopy(result.code)); return; }
      setPhotoRequest(result.requests[0]);
      if (result.token) { const link = location.origin + "/rein#uebergabe:" + result.token; setQrLink(link); setQrImage(await QRCode.toDataURL(link, { width: 216, margin: 1 })); }
    } catch (cause) { console.error("[INTAKE_PHOTOS_REQUEST_FAILED]", cause); setError(CAPTURE_ERROR_COPY.INTAKE_PHOTOS_REQUEST_FAILED); }
    finally { deviceInFlight.current = false; setDeviceWorking(false); }
  };
  const acceptRequest = async (requestId: string) => {
    if (!deviceRequest || deviceInFlight.current) return;
    deviceInFlight.current = true; setDeviceWorking(true);
    try {
      const result = await deviceRequest({ command: "accept", requestId, deviceId: getIntakeDeviceId() });
      if (result.code !== "OK" || !result.requests[0]) { setError(result.code === "OK" ? CAPTURE_ENTRY_COPY.requestMissing : captureFailureCopy(result.code)); return; }
      const request = result.requests[0]; setPhotoRequest(request); setItemId(request.itemId); setReceiving(true); setPendingRequests([]);
      if (getCapture) { const loaded = await getCapture(request.itemId); if (loaded.code === "OK") setCapture(loaded.capture); else setError(captureFailureCopy(loaded.code)); }
    } catch (cause) { console.error("[INTAKE_DEVICE_ACCEPT_FAILED]", cause); setError(CAPTURE_ERROR_COPY.INTAKE_DEVICE_ACCEPT_FAILED); }
    finally { deviceInFlight.current = false; setDeviceWorking(false); }
  };
  const finishPhotos = async (reason: "fertig" | "abgebrochen") => {
    if (!deviceRequest || !photoRequest || deviceInFlight.current || busy || pending.length) return;
    deviceInFlight.current = true; setDeviceWorking(true);
    try {
      const result = await deviceRequest({ command: "end", requestId: photoRequest.id, deviceId: getIntakeDeviceId(), reason });
      if (result.code !== "OK" || !result.requests[0]) { setError(result.code === "OK" ? CAPTURE_ENTRY_COPY.requestMissing : captureFailureCopy(result.code)); return; }
      if (receiving) onClose(result.requests[0].photoCount + " Fotos an den PC gesendet");
      else { setPhotoRequest(null); setQrImage(null); setQrLink(null); }
    } catch (cause) { console.error("[INTAKE_DEVICE_FINISH_FAILED]", cause); setError(CAPTURE_ERROR_COPY.INTAKE_DEVICE_FINISH_FAILED); }
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
      if (!readCaptureNote) { setReading(false); setError(CAPTURE_ERROR_COPY.INTAKE_NOTE_READ_PORT_UNAVAILABLE); return; }
      void Promise.all([readCaptureNote(text), findRecognizedCustomers(text, searchIntakeCustomers)])
        .then(([result, matched]) => {
          if (!current) return;
          if (result.code !== "OK") { setError(captureFailureCopy(result.code)); return; }
          if (matched.code !== "OK") { setError(captureFailureCopy(matched.code)); return; }
          setCustomers(matched.customers.map(customer => ({ id: customer.id, name: customer.companyName ?? customer.name })));
        }).catch(cause => {
          console.error("[INTAKE_NOTE_LIVE_READ_FAILED]", { name: cause instanceof Error ? cause.name : "UnknownError" });
          if (current) setError(CAPTURE_ERROR_COPY.INTAKE_NOTE_LIVE_READ_FAILED);
        }).finally(() => { if (current) setReading(false); });
    }, 400);
    return () => { current = false; clearTimeout(timer); };
  }, [text, searchIntakeCustomers, readCaptureNote]);

  const saveNote = useCallback(async (): Promise<IntakeCapture | null> => {
    if (!text.trim()) return capture;
    if (!scope) { setError(CAPTURE_ERROR_COPY.NOTICE_12); return null; }
    const key = JSON.stringify([text, concerns.filter(value => !dismissed.includes(value.id)).map(value => value.id)]);
    const savingStand = textstand.current;
    await pendingNoteWrites.current;
    if (lastSaved.current === key && savedCapture.current) {
      try { await acknowledgePendingOriginal(scope, itemId, savingStand); }
      catch (cause) { console.error("[INTAKE_NOTE_LOCAL_ACK_FAILED]", cause); setError(CAPTURE_ERROR_COPY.INTAKE_NOTE_LOCAL_ACK_FAILED); return null; }
      return savedCapture.current;
    }
    if (!saveCaptureNote) { setError(CAPTURE_ERROR_COPY.INTAKE_NOTE_WRITE_PORT_UNAVAILABLE); return null; }
    const result = await saveCaptureNote({ itemId, textstand: savingStand, text, ...(createContext ? { context: { customerId: createContext.customerId } } : {}),
      concerns: concerns.filter(value => !dismissed.includes(value.id)).map(value => value.id) });
    if (result.code !== "OK") { setError(captureFailureCopy(result.code)); return null; }
    setCapture(result.capture); savedCapture.current = result.capture; lastSaved.current = key;
    try { await acknowledgePendingOriginal(scope, itemId, savingStand); }
    catch (cause) { console.error("[INTAKE_NOTE_LOCAL_ACK_FAILED]", cause); setError(CAPTURE_ERROR_COPY.INTAKE_NOTE_LOCAL_ACK_FAILED); return null; }
    return result.capture;
  }, [text,capture,scope,concerns,dismissed,itemId,saveCaptureNote,createContext]);
  const upload = async (files: PendingFile[]) => {
    if (inFlight.current) return;
    if (!scope || !ports.prepareCaptureFile || !ports.finishCaptureFile) { setError(CAPTURE_ERROR_COPY.INTAKE_UPLOAD_PORT_UNAVAILABLE); return; }
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
        if (grant.code !== "OK") { setAutomaticRetry(grant.code === "UNAVAILABLE"); setError(captureFailureCopy(grant.code)); return; }
        if (grant.upload) {
          const result = await uploadIntakeOriginal(grant.upload, entry.file);
          // An interrupted retry can meet the already stored immutable hash. The server verifies it.
          if (!result.ok) console.error("[INTAKE_FILE_UPLOAD_REQUIRES_VERIFICATION]", { code: "UNCONFIRMED" });
        }
        const finished = await ports.finishCaptureFile(entry.id);
        if (finished.code !== "OK") { setAutomaticRetry(finished.code === "UNAVAILABLE"); setError(captureFailureCopy(finished.code)); return; }
        try { await acknowledgePendingOriginal(scope, entry.id); }
        catch (cause) { console.error("[INTAKE_FILE_LOCAL_ACK_FAILED]", cause); setCapture(finished.capture); setError(CAPTURE_ERROR_COPY.INTAKE_FILE_LOCAL_ACK_FAILED); return; }
        setCapture(finished.capture); setItemId(finished.capture.id); remaining.shift(); setPending([...remaining]);
        setProgress({ done: files.length - remaining.length, total: files.length });
      }
    } catch (cause) {
      console.error("[INTAKE_FILE_UPLOAD_FAILED]", { name: cause instanceof Error ? cause.name : "UnknownError" });
      setError(CAPTURE_ERROR_COPY.INTAKE_FILE_UPLOAD_FAILED);
    } finally { inFlight.current = false; setBusy(false); }
  };
  const chooseFiles = (list: FileList | File[] | null) => {
    if (!list || !list.length) return;
    if (blockedReceiver) { setError(CAPTURE_ERROR_COPY.NOTICE_18); return; }
    if (inFlight.current) { setError(CAPTURE_ERROR_COPY.NOTICE_19); return; }
    const files = Array.from(list);
    if (files.some(file => file.size < 1 || file.size > 150 * 1024 * 1024)) { setError(CAPTURE_ERROR_COPY.NOTICE_20); return; }
    if (mode === "eingangsfoto" && files.some(file => !["image/jpeg","image/png","image/heic","image/webp"].includes(file.type.toLowerCase()))) { setError(CAPTURE_ERROR_COPY.NOTICE_21); return; }
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
    if (!source || source.readyState < 2 || !source.videoWidth || !source.videoHeight) { setError(CAPTURE_ERROR_COPY.NOTICE_22); return; }
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth; canvas.height = source.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) { setError(CAPTURE_ERROR_COPY.INTAKE_CAMERA_CANVAS_UNAVAILABLE); return; }
    context.drawImage(source, 0, 0);
    photoInFlight.current = true;
    canvas.toBlob(blob => {
      photoInFlight.current = false;
      if (!blob) { setError(CAPTURE_ERROR_COPY.INTAKE_CAMERA_BLOB_UNAVAILABLE); return; }
      setCameraRequested(false);
      chooseFiles([new File([blob], "Foto-" + new Date().toISOString().replace(/[:.]/g, "-") + ".jpg", { type: "image/jpeg", lastModified: Date.now() })]);
    }, "image/jpeg", 0.92);
  };
  const close = useCallback(async () => {
    if (inFlight.current || deviceWorking) { setCloseRequested(true); return; }
    inFlight.current = true; setBusy(true);
    try {
      if (pending.length) { setCloseRequested(true); setError(CAPTURE_ERROR_COPY.NOTICE_25); return; }
      const saved = await saveNote();
      if (text.trim() && !saved) return;
      if(mode&&(saved??capture)){
        if(!discardCapture){setError(CAPTURE_ERROR_COPY.INTAKE_DISCARD_PORT_UNAVAILABLE);return;}
        const original=saved??capture!;
        const discarded=await discardCapture({itemId:original.id,version:original.version,clientEventId:discardKey.current});
        if(discarded.code!=="OK"){setError(captureFailureCopy(discarded.code));return;}
      }
      if (deviceRequest && photoRequest) {
        const ended = await deviceRequest({ command: "end", requestId: photoRequest.id, deviceId: getIntakeDeviceId(), reason: receiving ? "abgebrochen" : "geschlossen" });
        if (ended.code !== "OK") { setError(captureFailureCopy(ended.code)); return; }
      }
      onClose(!mode&&hasContent ? savedMessage : undefined);
    } catch (cause) {
      console.error("[INTAKE_CAPTURE_CLOSE_FAILED]", { name: cause instanceof Error ? cause.name : "UnknownError" });
      setError(CAPTURE_ERROR_COPY.INTAKE_CAPTURE_CLOSE_FAILED);
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
      if(current)setError(CAPTURE_ERROR_COPY.INTAKE_PENDING_RESUME_FAILED);
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

    setText(value); textstand.current = crypto.randomUUID(); setDismissed([]); setError(null);
    setCustomers([]);
    const stand = textstand.current;
    earlyNote.current = { text:value,stand,dismissed:[] };
    if (!scope) { setError(CAPTURE_ERROR_COPY.NOTICE_29); return; }
    pendingNoteWrites.current = pendingNoteWrites.current.then(() => value.trim()
      ? retainPendingOriginal(scope, { id: itemId, itemId, kind: "note", text: value, textstand: stand, dismissed: [] })
      : acknowledgePendingOriginal(scope, itemId))
      .catch(cause => { console.error("[INTAKE_PENDING_NOTE_FAILED]", cause); setError(CAPTURE_ERROR_COPY.INTAKE_PENDING_NOTE_FAILED); });
  };
  const dismissConcern = (id: string) => {
    const next = [...dismissed, id]; const stand = crypto.randomUUID();
    setDismissed(next); textstand.current = stand;
    localInput.current = true; earlyNote.current = {text,stand,dismissed:next};
    if (!scope) return;
    pendingNoteWrites.current = pendingNoteWrites.current.then(() => retainPendingOriginal(scope, { id: itemId, itemId, kind: "note", text, textstand: stand, dismissed: next }))
      .catch(cause => { console.error("[INTAKE_PENDING_CONCERN_FAILED]", cause); setError(CAPTURE_ERROR_COPY.INTAKE_PENDING_CONCERN_FAILED); });
  };
  const modeTitle = receiving || photoRequest ? "Fotos für den PC" : mode ? { eingang: "Zettel lesen · für die Erfassung", eingangsfoto: "Eingangsfoto aufnehmen", visitenkarte: "Visitenkarte lesen", datei: "Datei lesen · für die Erfassung" }[mode] : undefined;
  const failedFile = capture?.files.some(file => file.status === "fehler") === true;
  const firstOriginal = capture?.files.find(file => file.secured === true);
  const showCamera = cameraAvailable && cameraRequested && !cameraError;
  const recognizedKind = capture?.recognition?.kind ?? (capture?.text ? "notiz" : "unklar");
  const kindNames = { ware: "Ware", anfrage: "Anfrage oder Bestellung", rechnung: "Rechnung (Lieferant)", dokument: "Dokument", kontakt: "Kontakt", notiz: CAPTURE_ENTRY_COPY.noteLabel, unklar: "unklar" };
  const openObject = (target: "mailein" | "original" | "ware" | "rechnungein" | "kvware", arg: string) => {
    if (!ports.openCaptureObject) { setError(CAPTURE_ERROR_COPY.INTAKE_CAPTURE_TARGET_UNAVAILABLE); return; }
    if (!ports.openCaptureObject(target, arg)) {
      setError(CAPTURE_ERROR_COPY.INTAKE_CAPTURE_TARGET_UNAVAILABLE);
      console.error("[INTAKE_CAPTURE_TARGET_UNAVAILABLE]", { target });
    } else if (target === "ware" || target === "rechnungein" || target === "kvware") onClose();
  };
  const assign = async () => {
    try { const saved = await saveNote(); if (saved) openObject("mailein", saved.id + "#rein"); }
    catch (cause) { console.error("[INTAKE_CAPTURE_ASSIGN_OPEN_FAILED]", cause); setError(CAPTURE_ERROR_COPY.INTAKE_CAPTURE_ASSIGN_OPEN_FAILED); }
  };
  const choosePackageCustomer=async(customerId:string)=>{
    if(inFlight.current||!capture||capture.customerId)return;
    if(!ports.assignCaptureCustomer||!getCapture){setError(PACKAGE_ASSIGN_COPY.notConnected);return;}
    const key=capture.id+':'+capture.version+':'+customerId;if(!packageAssignKeys.current.has(key))packageAssignKeys.current.set(key,crypto.randomUUID());
    inFlight.current=true;setBusy(true);setError(null);
    try{const assigned=await ports.assignCaptureCustomer({itemId:capture.id,version:capture.version,clientEventId:packageAssignKeys.current.get(key)!,customerId,mode:'manual'});
      if(assigned.code!=='OK'){setError(assigned.code==='CONFLICT'?PACKAGE_ASSIGN_COPY.changed:PACKAGE_ASSIGN_COPY.failed);return;}
      const refreshed=await getCapture(capture.id);if(refreshed.code!=='OK'){setError(captureFailureCopy(refreshed.code));return;}setCapture(refreshed.capture);
    }catch(cause){console.error('[PACKAGE_CUSTOMER_ASSIGN_FAILED]',cause);setError(PACKAGE_ASSIGN_COPY.failed);}finally{inFlight.current=false;setBusy(false);}
  };
  const chooseKind = async (kind: Exclude<CaptureKind, "unklar">) => {
    if (!capture || inFlight.current) return;
    if (!ports.chooseCaptureKind) { setError(CAPTURE_ERROR_COPY.INTAKE_KIND_PORT_MISSING); return; }
    inFlight.current = true; setBusy(true); setError(null); setKindWorking(kind);
    const request = capture.id + ":" + capture.version + ":" + kind;
    if (!kindKeys.current.has(request)) kindKeys.current.set(request, crypto.randomUUID());
    try {
      const result = await ports.chooseCaptureKind({ itemId: capture.id, version: capture.version, clientEventId: kindKeys.current.get(request)!, kind });
      if (result.code !== "OK") { setError(captureFailureCopy(result.code)); return; }
      setCapture(result.capture);
      if (kind === "anfrage") onOrder(result.capture.customerId ?? undefined, result.capture);
      else if (kind === "rechnung") {
        if (ports.canManageMoney) openObject("rechnungein", result.capture.id);
        else onClose(CAPTURE_ENTRY_COPY.officeSaved);
      } else if (kind === "ware") {
        setGoodsChoice(true);
      } else openObject("mailein", result.capture.id + "#rein");
    } catch (cause) { console.error("[INTAKE_KIND_UI_WRITE_FAILED]", cause); setError(CAPTURE_ERROR_COPY.INTAKE_KIND_UI_WRITE_FAILED); }
    finally { inFlight.current = false; setBusy(false); setKindWorking(null); }
  };
  const showSituation=Boolean(!mode&&!receiving&&capture&&hasCapturedContent&&!showCamera&&!hidePreviousResult&&capture.files.some(file=>file.secured===true));
  const saveText=async()=>{if(inFlight.current)return;inFlight.current=true;setBusy(true);try{await saveNote();}catch(cause){console.error("[INTAKE_NOTE_SAVE_FAILED]",cause);setError(CAPTURE_TEXT_COPY.saveFailed);}finally{inFlight.current=false;setBusy(false);}};
  const resultMain = capture && hasCapturedContent && !mode && !receiving && !busy && !showCamera && !hidePreviousResult ? recognizedKind === "anfrage" ?
    <Button data-spec-id="rein.erfassen-aus-eingang" art={showSituation?"primaer":"erledigen"} text={showSituation?CAPTURE_COPY.order:CAPTURE_TEXT_COPY.request} onClick={() => onOrder(capture.customerId ?? undefined, capture)} />
    : recognizedKind === "kontakt" ? <Button data-spec-id="rein.kontakt-anlegen" art={showSituation?"primaer":"erledigen"} text={CAPTURE_COPY.customer} onClick={() => { const reason = onCustomer(capture); if (reason) setError(reason); }} />
    : recognizedKind === "rechnung" ? ports.canManageMoney ? <Button data-spec-id="rein.rechnung-pruefen" art="primaer" text={CAPTURE_COPY.invoice} onClick={() => openObject("rechnungein", capture.id)} />
      : <Button data-spec-id="rein.fuers-buero" art="primaer" text={CAPTURE_COPY.office} onClick={() => onClose(CAPTURE_ENTRY_COPY.officeSaved)} />
    : recognizedKind === "ware" && capture.expectedOrders?.length === 1 && capture.customerId === capture.expectedOrders[0].customerId ?
      <Button data-spec-id="rein.ware-annehmen-kunde" art="primaer" text={"Ware annehmen · " + capture.expectedOrders[0].number} onClick={() => openObject("ware", capture.expectedOrders![0].id + "#" + capture.id)} />
    : null : null;
  const anotherPage = () => { setCameraReady(false); setCameraAttempt(value => value + 1); setCameraRequested(true); setHidePreviousResult(true); };
  const finishReading = async () => {
    if (inFlight.current || !capture || !getCapture) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const read = await getCapture(capture.id);
      if (read.code !== "OK") { setError(captureFailureCopy(read.code)); return; }
      setCapture(read.capture); setCameraRequested(false); setHidePreviousResult(false);
    } catch (cause) { console.error("[INTAKE_CAPTURE_FINAL_READ_FAILED]", cause); setError(CAPTURE_ERROR_COPY.INTAKE_CAPTURE_FINAL_READ_FAILED); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const adopt = () => {
    if (capture && !busy) onAdopt?.(capture, mode === "eingangsfoto" ? "Eingangsfoto übernommen" : failedFile ? "Als Dokument übernommen · ohne Vorschläge" : "Übernommen · erkannt markiert");
  };
  return <><Dialog titel={SITUATION_COPY.header} unterzeile={modeTitle} icon="plus" groesse="breit" schliessenSpecId="rein.schliessen" onSchliessen={() => void close()} vorSchliessen={() => { void close(); return false; }}
    fuss={<>
      <Button text={CAPTURE_COPY.close} onClick={() => void close()} disabled={busy || deviceWorking} />
      {!showSituation?<>{showCamera ? <Button data-spec-id="rein.ausloesen" icon="camera" art="primaer" text={busy ? CAPTURE_ENTRY_COPY.photoSaving : CAPTURE_ENTRY_COPY.photo} disabled={busy || blockedReceiver || deviceWorking || !cameraReady} onClick={takePhoto} /> : null}
      {receiving ? <Button data-spec-id="rein.handy-fertig" art={showCamera ? "leise" : "erledigen"} text={CAPTURE_COPY.done} disabled={busy || deviceWorking || pending.length > 0} onClick={() => void finishPhotos("fertig")} />
        : mode && capture && hasCapturedContent && !showCamera && !hidePreviousResult ? <Button data-spec-id={failedFile ? "rein.als-dokument" : "rein.uebernehmen"} art="erledigen" text={failedFile ? CAPTURE_ENTRY_COPY.documentAdopt : CAPTURE_ENTRY_COPY.adopt} disabled={busy} onClick={adopt} />
          : !mode && hasContent ? <Button data-spec-id="rein.spaeter-zuordnen" text={CAPTURE_COPY.later} disabled={busy} onClick={() => void close()} /> : null}
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
      {showSituation&&capture&&recognizedKind==='ware'&&!capture.customerId&&ports.receiveOnsiteQuote&&ports.canCreateQuote&&ports.canCreateCustomer&&capture.packageContext?.status==='OK'&&capture.packageContext.candidates.length===0?<Button text={PACKAGE_ONSITE_COPY.open} onClick={()=>setOnsite(true)} disabled={busy}/>:null}
      {showSituation&&capture?<IntakeSituation readOriginal={ports.readCaptureOriginal} capture={capture} kind={recognizedKind} busy={busy} quotes={quoteCandidates} onCustomerCandidate={id=>void choosePackageCustomer(id)} onQuote={id=>openObject("kvware",id+"#"+capture.id)} primary={resultMain} onAssign={()=>void assign()} onOriginal={file=>openObject("original",capture.id+"#"+file)} onOrder={order=>openObject("ware",order+"#"+capture.id)} onMore={()=>cameraAvailable?anotherPage():input.current?.click()} onEdit={()=>{setHidePreviousResult(true);}} onKind={kind=>void chooseKind(kind)} onTask={()=>{const opened=!window.dispatchEvent(new CustomEvent("kreile:oeffne",{cancelable:true,detail:{ziel:"aufgabe",taskRequest:{reference:{type:"eingang",id:capture.id},kind:"aufgabe",itemId:capture.id}}}));if(!opened){console.error("[INTAKE_TASK_TARGET_UNAVAILABLE]");setError(CAPTURE_ERROR_COPY.INTAKE_TASK_TARGET_UNAVAILABLE);}}}/>:null}
      <div className="ev-rein-feld" hidden={showSituation} style={showSituation?{display:"none"}:undefined}>
        {!mode&&ports.actorDisplayName?.trim()?<h2>{intakeStartTitle(ports.actorDisplayName)}</h2>:null}
        {contextLoading ? <p role="status">{CAPTURE_ENTRY_COPY.contextLoading}</p> : null}
        {createContext ? <div data-spec-id="rein.kontext" className="ev-rein-kontext">
          <strong>für {createContext.label}</strong>
          <Button data-spec-id="rein.kontext-entfernen" text={CAPTURE_COPY.removeContext} icon="x" onClick={() => setCreateContext(null)} />
        </div> : null}
        {contextError ? <div role="alert" className="kr-stapel"><Hinweis ton="warn">{contextError}</Hinweis>
          <Button text={CAPTURE_COPY.readContext} onClick={() => { setContextLoading(true); setContextAttempt(value => value + 1); }} />
        </div> : null}
        {blockedReceiver && !error ? <p role="status">{CAPTURE_ENTRY_COPY.requestOpening}</p> : null}
        {closeRequested ? <p role="status">{CAPTURE_ENTRY_COPY.closePending}</p> : null}
        {cameraAvailable && !receiving && pendingRequests.map(request => <Button key={request.id} text={CAPTURE_COPY.acceptDevice} onClick={() => void acceptRequest(request.id)} disabled={deviceWorking} />)}
        {receiving && photoRequest ? <p role="status">{photoRequest.photoCount} an den PC gesendet</p> : null}
        {cameraRequested && cameraAvailable ? cameraError ? <div data-spec-id={cameraError === "permission" ? "rein.zustand.teilweise" : "rein.zustand.leer"} className="kr-stapel">
          <Hinweis ton="warn">{cameraError === "permission" ? CAPTURE_ENTRY_COPY.cameraPermission : CAPTURE_ENTRY_COPY.cameraMissing}</Hinweis>
          <Button text={CAPTURE_COPY.file} onClick={() => input.current?.click()} />
          <Button text={CAPTURE_COPY.retry} onClick={() => setCameraAttempt(attempt => attempt + 1)} />
        </div> : <div className="ev-rein-kamera">
          <div className="ev-sucher"><video ref={node => { video.current = node; if (node && cameraStream.current && node.srcObject !== cameraStream.current) node.srcObject = cameraStream.current; }} aria-label={CAPTURE_ENTRY_COPY.cameraLabel} tabIndex={0} autoPlay playsInline muted
            onLoadedData={event => { const node = event.currentTarget; setCameraReady(node.readyState >= 2 && node.videoWidth > 0 && node.videoHeight > 0); }} onEmptied={() => setCameraReady(false)} /></div>
          {!cameraReady ? <p role="status">{CAPTURE_ENTRY_COPY.cameraLoading}</p> : null}
        </div> : null}
        <Textfeld data-spec-id="rein.notiz" aria-label={CAPTURE_ENTRY_COPY.noteLabel} rows={7} maxLength={20_000} placeholder={CAPTURE_ENTRY_COPY.notePlaceholder} value={text}
          onChange={event => changeText(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();if(text.trim()&&!busy)void saveText();}}} />
        {text.trim() ? <Button data-spec-id="rein.notiz-lesen" text={!scope?CAPTURE_ENTRY_COPY.preparing:reading ? CAPTURE_ENTRY_COPY.reading : CAPTURE_ENTRY_COPY.read} disabled={busy||!scope} onClick={()=>void saveText()} /> : null}
        {!mode&&!receiving&&!showCamera&&!showSituation&&capture&&hasCapturedContent&&!hidePreviousResult?<div data-spec-id="rein.textvorschlag" className="ev-rein-erkannt">
          {resultMain??<Button art="erledigen" text={CAPTURE_TEXT_COPY.assign} disabled={busy} onClick={()=>void assign()}/>}
          <Button text={CAPTURE_TEXT_COPY.other} aria-expanded={textAlternatives} disabled={busy} onClick={()=>setTextAlternatives(value=>!value)}/>
          {textAlternatives?<div role="group" aria-label={CAPTURE_TEXT_COPY.other}>
            {recognizedKind!=="anfrage"?<Button text={CAPTURE_TEXT_COPY.request} disabled={busy} onClick={()=>onOrder(capture.customerId??undefined,capture)}/>:null}
            {recognizedKind!=="kontakt"?<Button text={CAPTURE_COPY.customer} disabled={busy} onClick={()=>{const reason=onCustomer(capture);if(reason)setError(reason);}}/>:null}
          </div>:null}
        </div>:null}
        {concerns.length || customers.length ? <div aria-label={CAPTURE_ENTRY_COPY.recognizedLabel} className="ev-rein-erkannt"><strong>{CAPTURE_ENTRY_COPY.recognizedHeading}</strong>
          {customers.map(customer => <span key={customer.id}>{customer.name} · Vorschlag aus dem Namen</span>)}
          {concerns.filter(value => !dismissed.includes(value.id)).map(concern => <Button key={concern.id} text={`${concern.label} ×`} onClick={() => dismissConcern(concern.id)} />)}
        </div> : null}
      </div>
      <div className="ev-rein-rechts" hidden={showSituation} style={showSituation?{display:"none"}:undefined}>
        <div className="ev-rein-karten">
          <button type="button" className="ev-karte" data-spec-id="rein.datei" aria-label={CAPTURE_ENTRY_COPY.fileLabel} onClick={() => input.current?.click()} disabled={busy || blockedReceiver}><Icon name="upload" /><b>{CAPTURE_ENTRY_COPY.fileLabel}</b><small>{CAPTURE_ENTRY_COPY.fileHint}</small></button>
          {cameraAvailable ? <button type="button" className="ev-karte" data-spec-id="rein.handy" aria-label={CAPTURE_ENTRY_COPY.cameraTile} onClick={() => setCameraRequested(true)} disabled={busy}><Icon name="camera" /><b>{CAPTURE_ENTRY_COPY.cameraTile}</b><small>{CAPTURE_ENTRY_COPY.cameraLocal}</small></button> : deviceRequest ? <button type="button" className="ev-karte" data-spec-id="rein.handy" aria-label={CAPTURE_ENTRY_COPY.cameraTile} onClick={() => void requestPhotos()} disabled={deviceWorking || busy}><Icon name="camera" /><b>{CAPTURE_ENTRY_COPY.cameraTile}</b><small>{CAPTURE_ENTRY_COPY.cameraRemote}</small></button> : null}
        </div>
        {photoRequest && !receiving ? <div data-spec-id="rein.zustand.uebergabe" className="ev-rein-qr">
          <p>{CAPTURE_ENTRY_COPY.qrHint}</p>
          {qrImage ? <Image src={qrImage} width={216} height={216} unoptimized alt={CAPTURE_ENTRY_COPY.qrLabel} /> : null}
          {qrLink ? <a href={qrLink}>{CAPTURE_ENTRY_COPY.qrOpen}</a> : null}
          <p>{photoRequest.photoCount} Fotos am Eingang</p>
          {photoRequest.photoCount > 0 ? <Button data-spec-id="rein.fertig-lesen" text={CAPTURE_COPY.readDone} onClick={() => void finishPhotos("fertig")} disabled={deviceWorking} /> : null}
          <Button data-spec-id="rein.uebergabe-abbrechen" text={CAPTURE_COPY.cancel} onClick={() => void finishPhotos("abgebrochen")} disabled={deviceWorking} />
        </div> : null}
        <input ref={input} type="file" multiple hidden disabled={blockedReceiver||busy} onChange={event => { chooseFiles(event.target.files); event.target.value = ""; }} />
        {!hasContent&&!mode ? <section aria-label={CAPTURE_ENTRY_COPY.withoutTemplate} className="ev-rein-ohne"><span>{CAPTURE_ENTRY_COPY.withoutTemplate}</span>
          <Button art="leise" icon="inbox" title={CAPTURE_ENTRY_COPY.orderKey} text={CAPTURE_COPY.order} disabled={contextLoading || Boolean(contextError)} data-spec-id="rein.auftrag-erfassen" onClick={() => onOrder(createContext?.customerId)} />
          <Button art="leise" icon="user" title={CAPTURE_ENTRY_COPY.customerKey} text={CAPTURE_COPY.customer} data-spec-id="rein.kunde-anlegen" onClick={() => onCustomer()} />
        </section> : null}
        {busy ? <p role="status">{kindWorking ? `Art „${kindNames[kindWorking]}“ wird gespeichert …` : `${progress.done} von ${progress.total} hochgeladen · wird übertragen und geprüft …`}</p> : null}
        {capture&&hasCapturedContent&&!hidePreviousResult ? <div data-spec-id={capture.files.some(file => file.status === "fehler") ? "rein.zustand.fehler" : capture.files.some(file => ["wartet", "laeuft"].includes(file.status)) ? "rein.zustand.laden" : "rein.zustand.erkannt"}>
          <strong>{capture.files.some(file => file.status === "fehler") ? capture.files.every(file => file.secured === true) ? CAPTURE_ENTRY_COPY.unreadableSecured : CAPTURE_ENTRY_COPY.originalMissing : capture.files.some(file => ["wartet", "laeuft"].includes(file.status)) ? CAPTURE_ENTRY_COPY.readingSecured : mode === "eingangsfoto" ? CAPTURE_ENTRY_COPY.entryPhotoSecured : (capture.recognition?.source === "hand" ? "Gewählt · " : "Erkannt · ") + kindNames[recognizedKind]}</strong>
          {!mode && !receiving && recognizedKind === "unklar" && !busy ? <section data-spec-id="rein.was-ist-das" className="kr-stapel"><h3>{CAPTURE_ENTRY_COPY.whatIsIt}</h3><div className="ev-rein-karten">
            <button type="button" className="ev-karte" data-spec-id="rein.was-ist.auftrag" onClick={() => void chooseKind("anfrage")}><Icon name="inbox"/><b>{SITUATION_COPY.kindLabels.anfrage}</b></button>
            <button type="button" className="ev-karte" data-spec-id="rein.was-ist.ware" onClick={() => void chooseKind("ware")}><Icon name="box"/><b>{SITUATION_COPY.kindLabels.ware}</b></button>
            <button type="button" className="ev-karte" data-spec-id="rein.was-ist.rechnung" onClick={() => void chooseKind("rechnung")}><Icon name="file"/><b>{SITUATION_COPY.kindLabels.rechnung}</b></button>
            <button type="button" className="ev-karte" data-spec-id="rein.was-ist.dokument" onClick={() => void chooseKind(capture.files.length ? "dokument" : "notiz")}><Icon name="file"/><b>{SITUATION_COPY.kindLabels.dokument}</b></button>
          </div></section> : null}
          {capture.recognition?.text ? <p className="ev-rein-original">{capture.recognition.text}</p> : null}
          {capture.files.map(file => <div key={file.id}><p>{file.name} · {file.secured === true ? CAPTURE_ENTRY_COPY.originalSecured : CAPTURE_ENTRY_COPY.uploadOpen}</p>
            {file.secured === true ? <Button data-spec-id={"rein.original." + file.id} art="leise" text={file.name + " anzeigen"} onClick={() => openObject("original", capture.id + "#" + file.id)} /> : null}
          </div>)}
          {!mode && (recognizedKind === "unklar" || recognizedKind === "ware") && Boolean(capture.expectedOrders?.length) ? <section data-spec-id="rein.erwartet" className="kr-stapel"><h3>{CAPTURE_ENTRY_COPY.expectedGoods}</h3>
            {goodsChoice ? <p role="status">{CAPTURE_ENTRY_COPY.chooseExpected}</p> : null}
            {capture.expectedOrders!.map(order => <Button key={order.id} data-spec-id="rein.erwartet-waehlen" text={order.number + " · " + (order.customerName ?? CAPTURE_ENTRY_COPY.missingCustomer) + " · " + (order.title ?? CAPTURE_ENTRY_COPY.missingTitle)}
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
  </Dialog>{onsite&&capture?<PackageOnsiteEditor capture={capture} ports={ports} onCapture={setCapture} onClose={()=>{setOnsite(false);if(getCapture)void getCapture(capture.id).then(result=>{if(result.code==='OK')setCapture(result.capture);});}} onPause={()=>onClose(PACKAGE_ONSITE_COPY.savedDraft)} onDone={message=>onClose(message)}/>:null}</>;
}
