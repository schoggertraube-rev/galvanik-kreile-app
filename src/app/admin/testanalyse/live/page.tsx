"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useTestpilot } from '@/components/testpilot/TestpilotProvider';

export default function LiveTestSession() {
  const { startSession, stopSession, isRecording, session, exportSessionMarkdown } = useTestpilot();
  const [screenRecording, setScreenRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const handleStartScreenRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false // Ask for audio? Requirements say prioritize text over voice if risky. Audio might not be supported/granted. Let's keep it simple.
      });

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        setScreenRecording(false);
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `test-recording-${session?.sessionId || Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
      };

      mediaRecorder.start();
      setScreenRecording(true);
      
      // Stop recording if user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenRecording();
      };
      
    } catch (err) {
      console.error("Screen recording failed or denied", err);
      alert("Bildschirmaufnahme wird auf diesem Gerät nicht unterstützt oder wurde verweigert. Bitte normale Geräteaufnahme verwenden. Die App speichert trotzdem Zeitmarker, Klickpfade und Testnotizen.");
    }
  };

  const stopScreenRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setScreenRecording(false);
  };

  const handleStartAll = () => {
    startSession();
  };

  const handleStopAll = () => {
    stopSession();
    if (screenRecording) {
      stopScreenRecording();
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 text-slate-900 dark:text-slate-100">
      <header className="border-b pb-4 dark:border-slate-800">
        <Link href="/admin/testanalyse" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
          &larr; Zurück zum Dashboard
        </Link>
        <h1 className="text-3xl font-bold font-playfair">Live-Testsession starten</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">Starte eine neue Aufzeichnung. Alle Testnotizen werden dieser Session zugeordnet.</p>
      </header>

      <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border dark:border-slate-800 space-y-6">
        
        {isRecording ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4 text-green-800 dark:text-green-200">
            <h3 className="font-bold flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
              Testsession läuft
            </h3>
            <p className="text-sm mt-1">Die Session {session?.sessionId} wird aktuell aufgezeichnet.</p>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-4">
            <p>Aktuell läuft keine Aufzeichnung.</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {!isRecording ? (
            <button 
              onClick={handleStartAll}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-md w-full sm:w-auto self-start"
            >
              1. Testsession starten
            </button>
          ) : (
            <div className="flex gap-4 flex-wrap">
              <button 
                onClick={handleStopAll}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-md"
              >
                Testsession beenden
              </button>
              
              <button 
                onClick={exportSessionMarkdown}
                className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold py-3 px-6 rounded-md"
              >
                Report herunterladen
              </button>
            </div>
          )}

          <div className="border-t dark:border-slate-800 pt-6 mt-2">
            <h3 className="font-semibold mb-2">Optionale Bildschirmaufnahme</h3>
            {screenRecording ? (
              <button 
                onClick={stopScreenRecording}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md text-sm"
              >
                Bildschirmaufnahme stoppen
              </button>
            ) : (
              <button 
                onClick={handleStartScreenRecording}
                disabled={!isRecording}
                className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-md text-sm disabled:opacity-50"
                title={!isRecording ? "Bitte zuerst die Testsession starten" : ""}
              >
                2. Bildschirmaufnahme starten
              </button>
            )}
            <p className="text-sm text-slate-500 mt-2">
              Erfordert Browser-Freigabe. Das Video wird am Ende lokal als .webm heruntergeladen. Es findet kein Cloud-Upload statt.
            </p>
          </div>

        </div>
      </div>
      
    </div>
  );
}
