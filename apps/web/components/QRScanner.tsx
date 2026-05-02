'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

export default function QRScanner({ onScanSuccess }: QRScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isScanning || !scannerRef.current) return;

    const html5QrcodeScanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    html5QrcodeScanner.render(
      (text) => {
        html5QrcodeScanner.clear();
        setIsScanning(false);
        onScanSuccess(text);
      },
      (error) => {
        // ignore
      }
    );
    
    return () => {
      html5QrcodeScanner.clear().catch(console.error);
    };
  }, [isScanning, onScanSuccess]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
      {!isScanning ? (
        <Button onClick={() => setIsScanning(true)} className="w-full" size="lg">
          Open Camera Scanner
        </Button>
      ) : (
        <div className="w-full">
          <div id="qr-reader" ref={scannerRef} className="w-full overflow-hidden rounded-xl border-2 border-primary" />
          <Button onClick={() => setIsScanning(false)} variant="outline" className="w-full mt-4">
            Cancel Scan
          </Button>
        </div>
      )}
    </div>
  );
}