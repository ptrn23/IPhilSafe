'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRScanner from '@/components/QRScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// ----------------------------------------------------------------
// Add or remove dev users here — buttons are auto-generated
// ----------------------------------------------------------------
const DEV_USERS: { label: string; name: string; uin: string; dob: string }[] = [
  { label: "Cellin (4104961936)", name:"Cellin Louise Cheng", uin: "4104961936", dob: "2004/02/17" },
  { label: "Paul (4960564187)", name:"Paul Timothy Necasio", uin: "4960564187", dob: "2005/02/23" },
  // { label: "Name (UIN)", name: "Name", uin: "UIN", dob: "YYYY/MM/DD" },
];

const buildDevQRPayload = (uin: string, name: string, dob: string): string =>
  JSON.stringify({
    uin,
    name: name,
    dob: dob,
    file: "",
    address_line1: "",
    address_line2: "",
    address_line3: "",
    location1: "",
    location3: "",
    zone: "",
    postal_code: "",
  });

export default function LandingPage() {
  const router = useRouter();
  const [devInput, setDevInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ----------------------------------------------------------------
  // If session cookie already exists, skip to dashboard
  // ----------------------------------------------------------------
  useEffect(() => {
    async function checkSession() {
      const res = await fetch('/api/session');
      if (res.ok) router.push('/dashboard');
    }
    checkSession();
  }, [router]);

  // ----------------------------------------------------------------
  // Core login handler — used by scanner, quick login, and manual input
  // ----------------------------------------------------------------
  const handleInitialScan = async (rawQrString: string) => {
    setError('');
    setIsLoading(true);
    try {
      JSON.parse(rawQrString); // throws if malformed

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
          {/* QR Camera Scanner */}
          <QRScanner onScanSuccess={handleInitialScan} />

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Developer Bypass */}
          <div className="space-y-4 bg-slate-100 p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase">Developer Bypass</p>

            {/* Quick login buttons */}
            <div className="space-y-2">
              <p className="text-xs text-slate-400">Quick Login</p>
              <div className="flex flex-col gap-2">
                {DEV_USERS.map((user) => (
                  <Button
                    key={user.uin}
                    variant="secondary"
                    className="w-full justify-start font-mono text-xs"
                    disabled={isLoading}
                    onClick={() => handleInitialScan(buildDevQRPayload(user.uin, user.name, user.dob))}
                  >
                    {isLoading ? "Verifying..." : `→ ${user.label}`}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Manual JSON input */}
            <div className="space-y-2">
              <p className="text-xs text-slate-400">Manual JSON Input</p>
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
                {isLoading ? "Verifying..." : "Simulate Scan"}
              </Button>
            </div>
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