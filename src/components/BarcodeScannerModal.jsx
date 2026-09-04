import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

export default function BarcodeScannerModal({ isOpen, onClose, onScan }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Initialisation après rendu du DOM
    const timer = setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          onScan(decodedText);
          scanner.clear().catch(console.error);
          onClose();
        },
        (errorMessage) => {
          // ignorer les erreurs mineures d'analyse continue de trame
        }
      );

      scannerRef.current = scanner;
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
            <Camera size={24} />
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Scanner Code-Barres</h3>
          </div>
          <button
            onClick={() => {
              if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
              }
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Présentez le code-barres ou le QR code devant la caméra de votre ordinateur.
        </p>

        <div id="reader" className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"></div>
      </div>
    </div>
  );
}
