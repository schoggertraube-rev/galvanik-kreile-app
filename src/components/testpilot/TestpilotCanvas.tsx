"use client";

import React, { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';

interface TestpilotCanvasProps {
  onSave: (base64Image: string) => void;
  onCancel: () => void;
}

export function TestpilotCanvas({ onSave, onCancel }: TestpilotCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(true);
  const [screenshot, setScreenshot] = useState<HTMLImageElement | null>(null);
  const [color, setColor] = useState('#EF4444'); // Red by default
  const [lineWidth, setLineWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  
  // Context to draw on
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const captureScreen = async () => {
      try {
        const dataUrl = await toPng(document.body, {
          filter: (node) => {
            if (node instanceof HTMLElement) {
              return node.getAttribute('data-testpilot-ignore') !== 'true';
            }
            return true;
          },
          pixelRatio: 1, // Keep scale at 1 to match CSS pixels for drawing
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: '#ffffff'
        });

        const img = new Image();
        img.onload = () => {
          setScreenshot(img);
          setIsCapturing(false);
        };
        img.src = dataUrl;
      } catch (err) {
        console.error("Fehler beim Erstellen des Screenshots", err);
        setIsCapturing(false);
        onCancel();
      }
    };

    captureScreen();
  }, [onCancel]);

  useEffect(() => {
    if (screenshot && canvasRef.current && containerRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Match canvas size to the window inner dimensions
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Draw the screenshot onto the canvas
      ctx.drawImage(screenshot, 0, 0, canvas.width, canvas.height);
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctxRef.current = ctx;
    }
  }, [screenshot, color, lineWidth]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;
    setIsDrawing(true);
    setHasDrawn(true);
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctxRef.current || !canvasRef.current) return;
    e.preventDefault(); // Prevent scrolling on touch devices
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing || !ctxRef.current) return;
    ctxRef.current.closePath();
    setIsDrawing(false);
  };

  const handleCancelClick = () => {
    if (hasDrawn) {
      if (window.confirm("Bist du sicher? Deine Zeichnung geht verloren.")) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  const handleSave = () => {
    if (canvasRef.current) {
      onSave(canvasRef.current.toDataURL('image/png'));
    }
  };

  if (isCapturing) {
    return (
      <div className="fixed inset-0 z-10000 bg-black/50 flex flex-col items-center justify-center text-white" data-testpilot-ignore="true">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
        <p className="font-medium">Erstelle Screenshot...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-10000 bg-black/80 flex flex-col" data-testpilot-ignore="true" ref={containerRef}>
      {/* Toolbar */}
      <div className="h-16 bg-slate-900 flex items-center justify-between px-6 shrink-0 border-b border-slate-700 shadow-xl z-10 text-white">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {['#EF4444', '#EAB308', '#22C55E', '#3B82F6', '#FFFFFF', '#000000'].map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'scale-110 border-white shadow-lg' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                title={`Farbe ${c}`}
              />
            ))}
          </div>
          <div className="w-px h-8 bg-slate-700 mx-2"></div>
          <input 
            type="range" 
            min="2" 
            max="20" 
            value={lineWidth} 
            onChange={(e) => setLineWidth(parseInt(e.target.value))}
            className="w-24 accent-blue-500"
            title="Strichdicke"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCancelClick}
            className="px-4 py-2 rounded-md font-medium bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Abbrechen
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 rounded-md font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2"
          >
            <span>Fertig</span>
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 relative overflow-hidden bg-slate-800 flex items-center justify-center p-4">
        {screenshot && (
          <div className="relative shadow-2xl rounded-sm overflow-hidden" style={{ 
            maxWidth: '100%', 
            maxHeight: '100%',
            aspectRatio: `${screenshot.width} / ${screenshot.height}`
          }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              onTouchCancel={stopDrawing}
              style={{
                width: '100%',
                height: '100%',
                cursor: 'crosshair',
                touchAction: 'none', // Prevent scrolling on mobile
                display: 'block'
              }}
            />
          </div>
        )}
      </div>
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-6 py-2 rounded-full text-slate-300 text-sm font-medium shadow-lg z-10">
        Zeichne direkt auf den Screenshot, um Probleme zu markieren
      </div>
    </div>
  );
}
