'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRScanner from '@/components/QRScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LandingPage() {
  const router = useRouter();
  const [devInput, setDevInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If a session cookie already exists, go straight to dashboard
    async function checkSession() {
      const res = await fetch('/api/session');
      if (res.ok) router.push('/dashboard');
    }
    checkSession();
  }, [router]);

  const handleInitialScan = async (rawQrString: string) => {
    setError('');
    setIsLoading(true);
    try {
      // 1. Validate the QR string is parseable before sending
      JSON.parse(rawQrString); // throws if malformed

      // 2. Send the raw QR string to the login API
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_payload: rawQrString }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed. Please try again.');
        return;
      }

      // 3. Session cookie is set by the API via Set-Cookie header.
      //    Just redirect — no localStorage needed.
      router.push('/dashboard');

    } catch (err) {
      setError("Invalid QR format. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-4xl font-extrabold tracking-tight">IPhilSafe</CardTitle>
          <CardDescription className="text-lg">Scan your PhilSys National ID to enter.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          <QRScanner onScanSuccess={handleInitialScan} />

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div className="space-y-3 bg-slate-100 p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase">Developer Bypass</p>
            <Input
              placeholder='Paste JSON String here (e.g. {"uin": "1234-5678"})'
              value={devInput}
              onChange={(e) => setDevInput(e.target.value)}
              className="font-mono text-xs"
              disabled={isLoading}
            />
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => handleInitialScan(devInput)}
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Simulate Scan'}
            </Button>
          </div>

          {error && (
            <p className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded-md">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}