'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QRScanner from '@/components/QRScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LandingPage() {
  const router = useRouter();
  const [devInput, setDevInput] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (rawQrString: string) => {
    setError('');

    // 1. DELETE the mock parsing logic below
    // 2. UNCOMMENT the fetch call below
    // 3. API should return { uin: string, role: string }
    
    /*
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_data: rawQrString })
      });
      
      if (!response.ok) throw new Error("MOSIP Verification Failed");
      
      // If using cookies, the backend handles the session! 
      // Just redirect the user:
      router.push('/dashboard');
    } catch (err) {
      setError("Verification failed. Please try again.");
    }
    */

    try {
      const parsed = JSON.parse(rawQrString);
      const uin = parsed.subject?.UIN || parsed.uin;
      if (!uin) throw new Error("Invalid QR: No UIN found");
      const role = uin === '1234-5678-9012' ? 'ADMIN' : 'USER';
      localStorage.setItem('iphilsafe_session', JSON.stringify({ uin, role }));
      router.push('/dashboard');

    } catch (err) {
      console.error(err);
      setError("Invalid QR format. Are you sure this is a PhilSys ID?");
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
          <QRScanner onScanSuccess={handleLogin} />

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground">Or</span></div>
          </div>

          <div className="space-y-3 bg-slate-100 p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase">Developer Bypass</p>
            <Input 
              placeholder='Paste JSON String here...' 
              value={devInput}
              onChange={(e) => setDevInput(e.target.value)}
              className="font-mono text-xs"
            />
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => handleLogin(devInput)}
            >
              Simulate Scan
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