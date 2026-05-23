"use client";
import { useState, useRef, useEffect } from "react";
import { Camera, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ocrService, OCRScan } from "@/lib/services/ocrService";
import { eventsRepository } from "@/lib/repositories/eventsRepository";

export function CameraCapture({
  onScanComplete,
  onCancel,
}: {
  onScanComplete: (scan: OCRScan) => void;
  onCancel?: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Stop camera stream safely
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Kamera-API wird vom Browser nicht unterstützt.");
        }
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        setStream(activeStream);
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }
      } catch (err: unknown) {
        console.error("Camera access error:", err);
        const errorMessage = err instanceof Error ? err.message : "Kamera-Zugriff verweigert oder nicht verfügbar.";
        setError(errorMessage);
      }
    }
    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Draw current video frame to canvas
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64 (ready for real OCR API)
    // const imageData = canvas.toDataURL("image/jpeg", 0.8);
    
    setScanning(true);
    await eventsRepository.addEvent({ eventType: "OCR_SCAN_STARTED" });
    
    // We pass the simulated scan for now, but the picture was taken!
    const scan = await ocrService.simulateScan("document");
    
    await eventsRepository.addEvent({ eventType: "OCR_SCAN_COMPLETED" });
    setScanning(false);
    stopCamera();
    onScanComplete(scan);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setScanning(true);
    await eventsRepository.addEvent({ eventType: "OCR_SCAN_STARTED" });
    const scan = await ocrService.simulateScan("document");
    await eventsRepository.addEvent({ eventType: "OCR_SCAN_COMPLETED" });
    setScanning(false);
    stopCamera();
    onScanComplete(scan);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto animate-in zoom-in-95 duration-300">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Back button */}
      {onCancel && !scanning && (
        <button
          onClick={() => {
            stopCamera();
            onCancel();
          }}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm self-start px-3 py-2 rounded-xl hover:bg-slate-100 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </button>
      )}

      <div className="flex flex-col items-center justify-center h-[460px] w-full bg-slate-900 rounded-3xl relative overflow-hidden shadow-2xl border border-slate-800">
        
        {/* Real Camera Feed */}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-950">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="font-bold text-white mb-2">Kamera-Fehler</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${scanning ? 'opacity-30' : 'opacity-100'}`} 
          />
        )}

        {/* Fake Camera Viewfinder Overlay */}
        <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-80 border-2 border-dashed border-white/50 rounded-xl relative">
            {/* Laser Scanner Effect */}
            {scanning && (
              <div className="absolute left-0 right-0 h-1 bg-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-scan" />
            )}
          </div>
        </div>

        {scanning ? (
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white font-bold animate-pulse text-lg tracking-wide">
              KI analysiert Dokument...
            </p>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col items-center gap-8 mt-auto mb-12">
            {!error && (
              <Button
                onClick={handleCapture}
                className="w-24 h-24 rounded-full bg-white hover:bg-slate-200 border-4 border-slate-300 shadow-[0_0_40px_rgba(255,255,255,0.3)] flex items-center justify-center active:scale-90 transition-transform"
              >
                <div className="w-20 h-20 rounded-full border-2 border-slate-800 bg-white flex items-center justify-center">
                  <Camera className="h-8 w-8 text-slate-800" />
                </div>
              </Button>
            )}
            <div className="text-white font-bold bg-black/60 px-6 py-3 rounded-full backdrop-blur-md">
              {error ? "Bitte Bild manuell hochladen" : "Dokument ausrichten und auslösen"}
            </div>
          </div>
        )}
      </div>

      {/* Datei-Upload Alternative */}
      {!scanning && (
        <div className="flex justify-center">
          <label className="cursor-pointer flex items-center gap-2 text-slate-500 hover:text-blue-700 font-bold text-sm px-4 py-2 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all">
            <Camera className="w-4 h-4" />
            Bild aus Datei hochladen
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}
    </div>
  );
}
