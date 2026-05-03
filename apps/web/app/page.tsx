'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRScanner from '@/components/QRScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"; // <-- NEW IMPORT
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

type LockerState = 'IDLE' | 'REGISTER' | 'OCCUPIED' | 'UNREGISTER' | 'TAMPERED' | 'SERVER_ERROR';

interface LockerData {
  id: string;
  state: LockerState;
  currentWeight: number;
  ownerUINs: string[];
  previousState?: LockerState; 
}

interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
}

const getStateColor = (state: LockerState) => {
  switch (state) {
    case 'IDLE': return "bg-green-600 hover:bg-green-700";
    case 'REGISTER': return "bg-yellow-500 hover:bg-yellow-600";
    case 'OCCUPIED': return "bg-blue-600 hover:bg-blue-700";
    case 'UNREGISTER': return "bg-orange-500 hover:bg-orange-600";
    case 'TAMPERED': return "bg-red-600 hover:bg-red-700 hover:animate-pulse";
    case 'SERVER_ERROR': return "bg-slate-200 text-slate-800 border-slate-400";
    default: return "bg-slate-500";
  }
};

export default function LandingPage() {
  const router = useRouter();
  const [devInput, setDevInput] = useState('');
  const [error, setError] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [pendingUin, setPendingUin] = useState('');

  useEffect(() => {
    const savedSession = localStorage.getItem('iphilsafe_session');
    if (savedSession) router.push('/dashboard');
  }, [router]);

  const handleInitialScan = async (rawQrString: string) => {
    setError('');
    try {
      const parsed = JSON.parse(rawQrString);
      const uin = parsed.subject?.UIN || parsed.uin || parsed.qr_data;
      if (!uin) throw new Error("Invalid QR: No UIN found");

      // 1. DELETE the setShowRoleModal logic below
      // 2. fetch the user's role from the database
      // 3. save to session and router.push('/dashboard')
      
      // MOCK: Intercept the login and ask for the role
      setPendingUin(uin);
      setShowRoleModal(true);

    } catch (err) {
      setError("Invalid QR format. Please try again.");
    }
  };

  const finalizeMockLogin = (role: 'ADMIN' | 'USER') => {
    localStorage.setItem('iphilsafe_session', JSON.stringify({ uin: pendingUin, role }));
    setShowRoleModal(false);
    router.push('/dashboard');
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
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground">Or</span></div>
          </div>

          <div className="space-y-3 bg-slate-100 p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase">Developer Bypass</p>
            <Input 
              placeholder='Paste JSON String here (e.g. {"uin": "1234-5678"})' 
              value={devInput}
              onChange={(e) => setDevInput(e.target.value)}
              className="font-mono text-xs"
            />
            <Button variant="secondary" className="w-full" onClick={() => handleInitialScan(devInput)}>
              Simulate Scan
            </Button>
          </div>

          {error && <p className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded-md">{error}</p>}
        </CardContent>
      </Card>

      <Dialog open={showRoleModal} onOpenChange={setShowRoleModal}>
        <DialogContent className="sm:max-w-md bg-white p-6">
          <DialogHeader>
            <DialogTitle>MOCK LOG IN</DialogTitle>
            <DialogDescription>
              Select how you want to log in as UIN: <span className="font-mono font-bold text-black">{pendingUin}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-4">
            <Button onClick={() => finalizeMockLogin('ADMIN')} className="w-full bg-slate-900 text-white hover:bg-slate-800">
              Log in as ADMIN
            </Button>
            <Button onClick={() => finalizeMockLogin('USER')} variant="outline" className="w-full">
              Log in as USER
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}