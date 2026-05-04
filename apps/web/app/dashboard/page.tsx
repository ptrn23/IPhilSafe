'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
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

interface UserSession {
  uin: string;
  role: 'ADMIN' | 'USER';
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

export default function Dashboard() {
  const router = useRouter();
  
  const [session, setSession] = useState<UserSession | null>(null);

  const [locker, setLocker] = useState<LockerData>({
    id: "Locker 1",
    state: "IDLE",
    currentWeight: 0.00,
    ownerUINs: [],
    previousState: 'IDLE',
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  useEffect(() => {
    const savedSession = localStorage.getItem('iphilsafe_session');
    if (!savedSession) {
      router.push('/');
    } else {
      setSession(JSON.parse(savedSession));
    }
  }, [router]);

  const fetchLockers = async () => {
    const id = 10101
    const res = await fetch(`/api/get-lockers`, {
      method: "POST",
      headers:{ "Content-Type": "application/json" },
      body: JSON.stringify({ 
        user_id: String(id) }),
    });
    const data = await res.json();
    console.log("🗄️| lockers returned:", data);
  };

  const addUser = async () => {
    const qrdata = JSON.stringify({ subject: {
      uin: "4104961936",
      dob: "2004/02/17", //  check format
      name: "Cellin Louise Cheng"
    } });
    const lockerid = 2
    const res = await fetch(`/api/locker/add-user`, {
      method: "POST",
      headers:{ "Content-Type": "application/json" },
      body: JSON.stringify({ qrData: qrdata, locker_id: lockerid }),
    });
    const data = await res.json();
    console.log("🗄️| added lockers:", data);
  };

  const fetchAuditLogs = async () => {
    const id = 10101
    const res = await fetch(`/api/get-audit-logs`, {
      method: "POST",
      headers:{ "Content-Type": "application/json" },
      body: JSON.stringify({ 
        user_id: String(id) }),
    });
    const data = await res.json();
    console.log("📑| audit logs returned:", data);
  };

  const revokeLockerAccess = async () => {
    const u_id = 10101
    const l_id = 2
    const res = await fetch(`/api/locker/revoke-access`, {
      method: "POST",
      headers:{ "Content-Type": "application/json" },
      body: JSON.stringify({ 
        locker_id: String(l_id), 
        user_id: String(u_id) 
      }),
    });
    const data = await res.json();
    console.log("🚫 | Access for locker revoked :", data);
  };

  const getLockerStatus = async () => {
    const l_id = 2
    const res = await fetch(`/api/locker/get-status`, {
      method: "POST",
      headers:{ "Content-Type": "application/json" },
      body: JSON.stringify({ 
        locker_id: String(l_id), 
      }),
    });
    const data = await res.json();
    console.log(`🗄️| status of locker ${l_id} :`, data);
  }; 

  const openLocker = async () => {
    const qrdata = JSON.stringify({ subject: {
      uin: "4104961936",
      dob: "2004/02/17", //  check format
      name: "Cellin Louise Cheng"
    } });
    const lockerid = 2
    const res = await fetch(`/api/locker/open-locker`, {
      method: "POST",
      headers:{ "Content-Type": "application/json" },
      body: JSON.stringify({ qrData: qrdata, locker_id: lockerid }),
    });
    const data = await res.json();
    console.log(`🔒| open locker ${lockerid} for user ${JSON.parse(qrdata).subject.uin} :`, data);
  }; 

  const startRegistration = async () => {
    const l_id = 2
    const res = await fetch(`/api/locker/start-reg`, {
      method: "POST",
      headers:{ "Content-Type": "application/json" },
      body: JSON.stringify({ 
        locker_id: l_id, 
      }),
    });
    const data = await res.json();
    console.log(`🗄️| start registration for locker ${l_id}:`, data);
  }; 

  const unregisterLocker = async () => {
    const l_id = 2
    const res = await fetch(`/api/locker/unreg`, {
      method: "POST",
      headers:{ "Content-Type": "application/json" },
      body: JSON.stringify({ 
        locker_id: l_id, 
        weight: 0
      }),
    });
    const data = await res.json();
    console.log(`🗄️| unregister locker ${l_id}:`, data);
  }; 

  const updateWeight = async () => {
    const l_id = 2
    const new_weight = 0
    const res = await fetch(`/api/locker/update-weight`, {
      method: "POST",
      headers:{ "Content-Type": "application/json" },
      body: JSON.stringify({ 
        locker_id: l_id, 
        weight: new_weight
      }),
    });
    const data = await res.json();
    console.log(`🗄️| update weight ${l_id}:`, data);
  }; 

  const closeLocker = async () => {
    const l_id = 2
    const new_weight = 100
    const res = await fetch(`/api/locker/close-locker`, {
      method: "POST",
      headers:{ "Content-Type": "application/json" },
      body: JSON.stringify({ 
        locker_id: l_id, 
        weight: new_weight
      }),
    });
    const data = await res.json();
    console.log(`🗄️| close locker ${l_id}:`, data);
  }; 

  const finishReg = async () => {
    const l_id = 2
    const res = await fetch(`/api/locker/finish-reg`, {
      method: "POST",
      headers:{ "Content-Type": "application/json" },
      body: JSON.stringify({ 
        locker_id: l_id, 
      }),
    });
    const data = await res.json();
    console.log(`🗄️| Finish registration for locker ${l_id}:`, data);
  }; 

  const pushHardwareEvent = (action: string, newLockerState: Partial<LockerData>, logDetails: string) => {
    setLocker(prev => ({ ...prev, ...newLockerState }));
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      action: action,
      details: logDetails,
    };
    setLogs(prevLogs => [newLog, ...prevLogs]);
  };

  const generateRandomUIN = () => `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const generateRandomWeight = () => +(Math.random() * (5.00 - 0.50) + 0.50).toFixed(2);

  const simulateScan = () => {
    if (locker.state === 'IDLE') {
      const newUIN = generateRandomUIN();
      pushHardwareEvent("ID Scan", { state: 'REGISTER', ownerUINs: [newUIN] }, `Primary user (${newUIN}) authenticated.`);
    } else if (locker.state === 'OCCUPIED') {
      const temporaryWeight = +(locker.currentWeight * 0.4).toFixed(2); 
      pushHardwareEvent("Access Scan", { currentWeight: temporaryWeight }, "Authorized user scanned ID. Door unlocked for temporary access.");
    }
  };

  const simulateMultiScan = () => {
    if (locker.state !== 'REGISTER') return;
    const coUserUIN = generateRandomUIN();
    pushHardwareEvent("Co-User Scan", { ownerUINs: [...locker.ownerUINs, coUserUIN] }, `Secondary user (${coUserUIN}) appended to session.`);
  };

  const simulateDeposit = () => {
    const newWeight = generateRandomWeight();
    if (locker.state === 'REGISTER') {
      pushHardwareEvent("Door Closed", { state: 'OCCUPIED', currentWeight: newWeight }, `Initial baseline mass registered at ${newWeight} kg.`);
    } else if (locker.state === 'OCCUPIED') {
      pushHardwareEvent("Door Closed", { currentWeight: newWeight }, `Door closed. New baseline mass registered at ${newWeight} kg.`);
    }
  };

  const simulateTheft = () => pushHardwareEvent("Tamper Detected", { state: 'TAMPERED', currentWeight: 0.00 }, "CRITICAL: Unauthorized mass drop.");
  const simulateFailedCheckout = () => pushHardwareEvent("Checkout Denied", { state: 'UNREGISTER', currentWeight: 1.20 }, "User attempted checkout, but items remain inside.");
  const simulateClearCheckout = () => pushHardwareEvent("Session Ended", { state: 'IDLE', currentWeight: 0.00, ownerUINs: [] }, "Compartment verified empty. Ledger cleared.");
  
  const simulateNetworkError = () => {
    if (locker.state === 'SERVER_ERROR') return;
    pushHardwareEvent("System Timeout", { state: 'SERVER_ERROR', previousState: locker.state }, "Lost connection to MOSIP Testbed.");
  };

  const simulateNetworkRestore = () => {
    const targetState = locker.previousState || 'IDLE';
    pushHardwareEvent("Network Restored", { state: targetState }, `Connection re-established. Resuming ${targetState} phase.`);
  };

  const simulateAdminOverride = () => pushHardwareEvent("Admin Override", { state: 'IDLE', currentWeight: 0.00, ownerUINs: [] }, "Tamper flag cleared by administrator. Locker reset to IDLE.");

  const handleLogout = () => {
    localStorage.removeItem('iphilsafe_session');
    router.push('/');
  };

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-xl">Loading environment...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">IPhilSafe Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Logged in as: <span className="font-mono font-bold text-slate-800">{session.uin}</span> 
            <Badge variant="secondary" className="ml-2 bg-slate-200">{session.role}</Badge>
          </p>
        </div>
        
        <div className="flex gap-4 items-center">
          <Badge variant="outline" className="bg-white text-green-700 border-green-700">
            ONLINE
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-slate-800">
            Log Out
          </Button>
        </div>
      </header>

      <Separator className="mb-8" />

      {locker.state === 'TAMPERED' && session.role === 'ADMIN' && (
        <div className="mb-6 bg-red-600 border-2 border-red-800 rounded-xl p-4 shadow-lg animate-pulse flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white text-red-600 rounded-full p-2 font-black text-xl w-10 h-10 flex items-center justify-center">!</div>
            <div>
              <h2 className="text-white font-extrabold text-lg uppercase tracking-wider">Critical Security Alert</h2>
              <p className="text-red-100 text-sm font-medium">Unauthorized mass shift detected in {locker.id}. Immediate physical inspection required.</p>
            </div>
          </div>
          <Button onClick={simulateAdminOverride} variant="outline" className="bg-white text-red-700 border-transparent hover:bg-red-50 font-bold">
            Acknowledge & Clear
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">{locker.id}</CardTitle>
            <Badge className={getStateColor(locker.state)}>{locker.state}</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between mt-2">
              <div className="text-sm text-slate-500">
                <p>Current Load: <span className="font-mono text-slate-900 font-medium">{locker.currentWeight.toFixed(2)} kg</span></p>
                <p>Owner UINs: <span className="font-mono text-slate-900">{locker.ownerUINs.length > 0 ? locker.ownerUINs.join(', ') : 'None'}</span></p>
              </div>
              
              {locker.state === 'TAMPERED' && session.role === 'ADMIN' && (
                <Button onClick={simulateAdminOverride} variant="destructive" size="sm" className="font-bold shadow-sm">
                  Clear (Admin)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="mb-8" />

      <div className="mt-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Logs</h2>
        <Card className="shadow-sm border-slate-200">
          <ScrollArea className="h-[250px] rounded-md border-0">
            <Table>
              <TableHeader className="bg-slate-100 sticky top-0">
                <TableRow>
                  <TableHead className="w-[120px]">Timestamp</TableHead>
                  <TableHead className="w-[150px]">Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-slate-500 py-8">
                      No events recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs text-slate-500">{log.timestamp}</TableCell>
                      <TableCell className="font-medium text-slate-900">{log.action}</TableCell>
                      <TableCell className="text-slate-600">{log.details}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      </div>

      {session.role === 'ADMIN' && (
        <div className="mt-16 p-6 border border-slate-200 rounded-xl bg-white shadow-sm space-y-8">
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">UI State Simulators</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button onClick={simulateScan} disabled={locker.state !== 'IDLE' && locker.state !== 'OCCUPIED'} variant="outline" className="border-blue-200 text-blue-700 disabled:opacity-50">1. Scan ID</Button>
              <Button onClick={simulateMultiScan} disabled={locker.state !== 'REGISTER'} variant="outline" className="border-yellow-200 text-yellow-700 disabled:opacity-50">1.5 Co-User Scan</Button>
              <Button onClick={simulateDeposit} disabled={locker.state !== 'REGISTER' && locker.state !== 'OCCUPIED'} variant="outline" className="border-green-200 text-green-700 disabled:opacity-50">2. Close Door</Button>
              <Button onClick={simulateTheft} disabled={locker.state !== 'OCCUPIED'} variant="outline" className="border-red-200 text-red-700 border-2 disabled:opacity-50">! Force Theft</Button>
              <Button onClick={simulateFailedCheckout} disabled={locker.state !== 'OCCUPIED'} variant="outline" className="border-orange-200 text-orange-700 disabled:opacity-50">? Failed Checkout</Button>
              <Button onClick={simulateClearCheckout} disabled={locker.state !== 'OCCUPIED' && locker.state !== 'UNREGISTER'} variant="outline" className="border-slate-300 disabled:opacity-50">3. Valid Checkout</Button>
              <Button onClick={simulateNetworkError} disabled={locker.state === 'SERVER_ERROR'} variant="outline" className="border-slate-800 text-slate-800">X Network Drop</Button>
              <Button onClick={simulateNetworkRestore} disabled={locker.state !== 'SERVER_ERROR'} variant="outline" className="border-slate-300 disabled:opacity-50">O Network Restore</Button>
            </div>
          </div>

          <Separator />

          <div>
             <div className="mb-4">
              <h2 className="text-lg font-bold text-indigo-900">Backend API Tests</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button onClick={fetchLockers} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Fetch Lockers</Button>
              <Button onClick={addUser} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Add User</Button>
              <Button onClick={revokeLockerAccess} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Revoke Access</Button>
              <Button onClick={getLockerStatus} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Get Status</Button>
              <Button onClick={openLocker} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Open Locker</Button>
              <Button onClick={startRegistration} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Start Reg Period</Button>
              <Button onClick={finishReg} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Finish Reg Period</Button>
              <Button onClick={unregisterLocker} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Unregister Locker</Button>
              <Button onClick={updateWeight} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Update Weight</Button>
              <Button onClick={fetchAuditLogs} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Fetch Audit Logs</Button>
              <Button onClick={closeLocker} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Close Locker</Button>
            </div>
          </div>

        </div>
      )}

    </div>
  )
}