'use client'

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

type LockerState = 'IDLE' | 'REGISTER' | 'OCCUPIED' | 'UNREGISTER' | 'TAMPERED' | 'SERVER_ERROR';

// From the API — what the DB actually knows
interface LockerAPIData {
  locker_id: string;
  weight: number;
  status: LockerState;
}

// Local UI simulation layer on top of API data (admin only)
interface LockerSimState {
  locker_id: string;
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
  role: 'Admin' | 'User';
}

const getStateColor = (state: LockerState | string) => {
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

const POLL_INTERVAL_MS = 600000;

export default function Dashboard() {
  const router = useRouter();

  const [session, setSession] = useState<UserSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [lockers, setLockers] = useState<LockerAPIData[]>([]);
  const [lockersLoading, setLockersLoading] = useState(true);
  const [lockersRefreshing, setLockersRefreshing] = useState(false);
  const [simStates, setSimStates] = useState<Record<string, LockerSimState>>({});
  const [selectedLockerId, setSelectedLockerId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Single source of truth for polling
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionUinRef = useRef<string | null>(null);

  // ----------------------------------------------------------------
  // Polling — one function, one interval
  // ----------------------------------------------------------------
  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling(); // always clear before starting to prevent duplicates
    intervalRef.current = setInterval(() => {
      if (sessionUinRef.current) {
        fetchLockers(sessionUinRef.current, true);
      }
    }, POLL_INTERVAL_MS);
  };

  // ----------------------------------------------------------------
  // Fetch lockers
  // ----------------------------------------------------------------
  const fetchLockers = async (uid: string, background = false) => {
    if (background) {
      setLockersRefreshing(true);
    } else {
      setLockersLoading(true);
    }
    try {
      const res = await fetch(`/api/get-lockers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid }),
      });
      const raw = await res.json();
      const data: LockerAPIData[] = Array.isArray(raw) ? raw : [];
      setLockers(data);

      setSimStates(prev => {
        const next = { ...prev };
        data.forEach((l) => {
          const key = String(l.locker_id);
          const existing = prev[key];
          if (!existing || existing.state !== l.status) {
            next[key] = {
              locker_id: key,
              state: l.status,
              currentWeight: l.weight,
              ownerUINs: existing?.ownerUINs ?? [],
              previousState: l.status,
            } as LockerSimState;
          }
        });
        return next;
      });

      if (data.length > 0 && !selectedLockerId) {
        setSelectedLockerId(String(data[0]?.locker_id) ?? null);
      }

    } catch (err) {
      console.error("Failed to fetch lockers:", err);
    } finally {
      setLockersLoading(false);
      setLockersRefreshing(false);
    }
  };

  // ----------------------------------------------------------------
  // Session check — runs once, starts polling after first fetch
  // ----------------------------------------------------------------
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/session');
        if (!res.ok) {
          router.push('/');
          return;
        }
        const data = await res.json();
        sessionUinRef.current = data.user_id;
        setSession({ uin: data.user_id, role: data.role });
        await fetchLockers(data.user_id);
        startPolling(); // starts exactly once, after initial fetch
      } catch {
        router.push('/');
      } finally {
        setSessionLoading(false);
      }
    }

    checkSession();

    return () => stopPolling(); // cleanup on unmount
  }, []);

  // ----------------------------------------------------------------
  // Logout
  // ----------------------------------------------------------------
  const handleLogout = async () => {
    stopPolling();
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  // ----------------------------------------------------------------
  // Backend API test calls
  // ----------------------------------------------------------------
  const addUser = async () => {
    const qrdata = JSON.stringify({ subject: { uin: "4104961936", dob: "2004/02/17", name: "Cellin Louise Cheng" } });
    const res = await fetch(`/api/locker/add-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrData: qrdata, locker_id: 2 }),
    });
    const data = await res.json();
    console.log("🗄️| added lockers:", data);
  };

  const fetchAuditLogs = async () => {
    const res = await fetch(`/api/get-audit-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: session?.uin }),
    });
    const data = await res.json();
    console.log("📑| audit logs returned:", data);
  };

  const revokeLockerAccess = async () => {
    const res = await fetch(`/api/locker/revoke-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: String(2), user_id: String(10101) }),
    });
    const data = await res.json();
    console.log("🚫 | Access for locker revoked:", data);
  };

  const getLockerStatus = async () => {
    const res = await fetch(`/api/locker/get-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: String(2) }),
    });
    const data = await res.json();
    console.log(`🗄️| status of locker 2:`, data);
  };

  const openLocker = async () => {
    const qrdata = JSON.stringify({ subject: { uin: "4104961936", dob: "2004/02/17", name: "Cellin Louise Cheng" } });
    const res = await fetch(`/api/locker/open-locker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrData: qrdata, locker_id: 2 }),
    });
    const data = await res.json();
    console.log(`🔒| open locker 2:`, data);
  };

  const startRegistration = async () => {
    const res = await fetch(`/api/locker/start-reg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: 2 }),
    });
    const data = await res.json();
    console.log(`🗄️| start registration for locker 2:`, data);
  };

  const unregisterLocker = async () => {
    const res = await fetch(`/api/locker/unreg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: 2, weight: 0 }),
    });
    const data = await res.json();
    console.log(`🗄️| unregister locker 2:`, data);
  };

  const updateWeight = async () => {
    const res = await fetch(`/api/locker/update-weight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: 2, weight: 0 }),
    });
    const data = await res.json();
    console.log(`🗄️| update weight locker 2:`, data);
  };

  const closeLocker = async () => {
    const res = await fetch(`/api/locker/close-locker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: 2, weight: 100 }),
    });
    const data = await res.json();
    console.log(`🗄️| close locker 2:`, data);
  };

  const finishReg = async () => {
    const res = await fetch(`/api/locker/finish-reg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: 2 }),
    });
    const data = await res.json();
    console.log(`🗄️| Finish registration for locker 2:`, data);
  };

  // ----------------------------------------------------------------
  // UI Simulator
  // ----------------------------------------------------------------
  const pushHardwareEvent = (locker_id: string, action: string, newState: Partial<LockerSimState>, logDetails: string) => {
    setSimStates(prev => ({
      ...prev,
      [locker_id]: { ...(prev[locker_id] ?? {}), ...newState } as LockerSimState
    }));
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      action,
      details: logDetails,
    };
    setLogs(prevLogs => [newLog, ...prevLogs]);
  };

  const generateRandomUIN = () => `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const generateRandomWeight = () => +(Math.random() * (5.00 - 0.50) + 0.50).toFixed(2);

  const selectedSim = selectedLockerId ? simStates[selectedLockerId] : null;

  const simulateScan = () => {
    if (!selectedLockerId || !selectedSim) return;
    if (selectedSim.state === 'IDLE') {
      const newUIN = generateRandomUIN();
      pushHardwareEvent(selectedLockerId, "ID Scan", { state: 'REGISTER', ownerUINs: [newUIN] }, `Primary user (${newUIN}) authenticated.`);
    } else if (selectedSim.state === 'OCCUPIED') {
      const temporaryWeight = +(selectedSim.currentWeight * 0.4).toFixed(2);
      pushHardwareEvent(selectedLockerId, "Access Scan", { currentWeight: temporaryWeight }, "Authorized user scanned ID. Door unlocked for temporary access.");
    }
  };

  const simulateMultiScan = () => {
    if (!selectedLockerId || !selectedSim || selectedSim.state !== 'REGISTER') return;
    const coUserUIN = generateRandomUIN();
    pushHardwareEvent(selectedLockerId, "Co-User Scan", { ownerUINs: [...selectedSim.ownerUINs, coUserUIN] }, `Secondary user (${coUserUIN}) appended to session.`);
  };

  const simulateDeposit = () => {
    if (!selectedLockerId || !selectedSim) return;
    const newWeight = generateRandomWeight();
    if (selectedSim.state === 'REGISTER') {
      pushHardwareEvent(selectedLockerId, "Door Closed", { state: 'OCCUPIED', currentWeight: newWeight }, `Initial baseline mass registered at ${newWeight} kg.`);
    } else if (selectedSim.state === 'OCCUPIED') {
      pushHardwareEvent(selectedLockerId, "Door Closed", { currentWeight: newWeight }, `Door closed. New baseline mass registered at ${newWeight} kg.`);
    }
  };

  const simulateTheft = () => {
    if (!selectedLockerId) return;
    pushHardwareEvent(selectedLockerId, "Tamper Detected", { state: 'TAMPERED', currentWeight: 0.00 }, "CRITICAL: Unauthorized mass drop.");
  };

  const simulateFailedCheckout = () => {
    if (!selectedLockerId) return;
    pushHardwareEvent(selectedLockerId, "Checkout Denied", { state: 'UNREGISTER', currentWeight: 1.20 }, "User attempted checkout, but items remain inside.");
  };

  const simulateClearCheckout = () => {
    if (!selectedLockerId) return;
    pushHardwareEvent(selectedLockerId, "Session Ended", { state: 'IDLE', currentWeight: 0.00, ownerUINs: [] }, "Compartment verified empty. Ledger cleared.");
  };

  const simulateNetworkError = () => {
    if (!selectedLockerId || !selectedSim || selectedSim.state === 'SERVER_ERROR') return;
    pushHardwareEvent(selectedLockerId, "System Timeout", { state: 'SERVER_ERROR', previousState: selectedSim.state }, "Lost connection to MOSIP Testbed.");
  };

  const simulateNetworkRestore = () => {
    if (!selectedLockerId || !selectedSim) return;
    const targetState = selectedSim.previousState || 'IDLE';
    pushHardwareEvent(selectedLockerId, "Network Restored", { state: targetState }, `Connection re-established. Resuming ${targetState} phase.`);
  };

  const simulateAdminOverride = (locker_id: string) => {
    pushHardwareEvent(locker_id, "Admin Override", { state: 'IDLE', currentWeight: 0.00, ownerUINs: [] }, "Tamper flag cleared by administrator. Locker reset to IDLE.");
  };

  // ----------------------------------------------------------------
  // Guard
  // ----------------------------------------------------------------
  if (sessionLoading || !session) {
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
          <Badge variant="outline" className="bg-white text-green-700 border-green-700">ONLINE</Badge>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-slate-800">
            Log Out
          </Button>
        </div>
      </header>

      <Separator className="mb-8" />

      {/* Tamper alert banner — shown if any locker is tampered */}
      {Object.values(simStates).some(s => s.state === 'TAMPERED') && session.role === 'Admin' && (
        <div className="mb-6 bg-red-600 border-2 border-red-800 rounded-xl p-4 shadow-lg animate-pulse flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white text-red-600 rounded-full p-2 font-black text-xl w-10 h-10 flex items-center justify-center">!</div>
            <div>
              <h2 className="text-white font-extrabold text-lg uppercase tracking-wider">Critical Security Alert</h2>
              <p className="text-red-100 text-sm font-medium">Unauthorized mass shift detected. Immediate physical inspection required.</p>
            </div>
          </div>
        </div>
      )}

      {/* Locker grid */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900">Lockers</h2>
          {lockersRefreshing && (
            <span className="text-xs text-slate-400 animate-pulse">Refreshing...</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (sessionUinRef.current) {
              fetchLockers(sessionUinRef.current, true);
              startPolling(); // reset the countdown
            }
          }}
          disabled={lockersRefreshing || lockersLoading}
        >
          {lockersRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lockersLoading ? (
          <p className="text-slate-500 text-sm">Loading lockers...</p>
        ) : lockers.length === 0 ? (
          <p className="text-slate-500 text-sm">No lockers assigned.</p>
        ) : (
          lockers.map((locker) => {
            const sim = simStates[String(locker.locker_id)];
            const displayState = (session.role === 'Admin' && sim) ? sim.state : locker.status;
            const displayWeight = (session.role === 'Admin' && sim) ? sim.currentWeight : locker.weight;
            const displayOwners = (session.role === 'Admin' && sim) ? sim.ownerUINs : [];
            const isSelected = selectedLockerId === String(locker.locker_id);

            return (
              <Card
                key={locker.locker_id}
                className={`shadow-sm border-2 cursor-pointer transition-all ${isSelected && session.role === 'Admin' ? 'border-indigo-500' : 'border-slate-200'}`}
                onClick={() => session.role === 'Admin' && setSelectedLockerId(String(locker.locker_id))}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg font-semibold">Locker {locker.locker_id}</CardTitle>
                  <Badge className={getStateColor(displayState)}>{displayState}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between mt-2">
                    <div className="text-sm text-slate-500">
                      <p>Current Load: <span className="font-mono text-slate-900 font-medium">{displayWeight.toFixed(2)} kg</span></p>
                      {session.role === 'Admin' && (
                        <p>Owner UINs: <span className="font-mono text-slate-900">{displayOwners.length > 0 ? displayOwners.join(', ') : 'None'}</span></p>
                      )}
                    </div>
                    {displayState === 'TAMPERED' && session.role === 'Admin' && (
                      <Button
                        onClick={(e) => { e.stopPropagation(); simulateAdminOverride(String(locker.locker_id)); }}
                        variant="destructive"
                        size="sm"
                        className="font-bold shadow-sm"
                      >
                        Clear (Admin)
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Separator className="my-8" />

      {/* Logs */}
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

      {/* Admin panel */}
      {session.role === 'Admin' && (
        <div className="mt-16 p-6 border border-slate-200 rounded-xl bg-white shadow-sm space-y-8">

          {/* Simulator — targets selected locker */}
          <div>
            <div className="mb-1">
              <h2 className="text-lg font-bold text-slate-900">UI State Simulators</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Targeting: <span className="font-mono font-bold text-indigo-700">
                {selectedLockerId ? `Locker ${selectedLockerId}` : 'None — click a locker card above'}
              </span>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button onClick={simulateScan} disabled={!selectedSim || (selectedSim.state !== 'IDLE' && selectedSim.state !== 'OCCUPIED')} variant="outline" className="border-blue-200 text-blue-700 disabled:opacity-50">1. Scan ID</Button>
              <Button onClick={simulateMultiScan} disabled={!selectedSim || selectedSim.state !== 'REGISTER'} variant="outline" className="border-yellow-200 text-yellow-700 disabled:opacity-50">1.5 Co-User Scan</Button>
              <Button onClick={simulateDeposit} disabled={!selectedSim || (selectedSim.state !== 'REGISTER' && selectedSim.state !== 'OCCUPIED')} variant="outline" className="border-green-200 text-green-700 disabled:opacity-50">2. Close Door</Button>
              <Button onClick={simulateTheft} disabled={!selectedSim || selectedSim.state !== 'OCCUPIED'} variant="outline" className="border-red-200 text-red-700 border-2 disabled:opacity-50">! Force Theft</Button>
              <Button onClick={simulateFailedCheckout} disabled={!selectedSim || selectedSim.state !== 'OCCUPIED'} variant="outline" className="border-orange-200 text-orange-700 disabled:opacity-50">? Failed Checkout</Button>
              <Button onClick={simulateClearCheckout} disabled={!selectedSim || (selectedSim.state !== 'OCCUPIED' && selectedSim.state !== 'UNREGISTER')} variant="outline" className="border-slate-300 disabled:opacity-50">3. Valid Checkout</Button>
              <Button onClick={simulateNetworkError} disabled={!selectedSim || selectedSim.state === 'SERVER_ERROR'} variant="outline" className="border-slate-800 text-slate-800">X Network Drop</Button>
              <Button onClick={simulateNetworkRestore} disabled={!selectedSim || selectedSim.state !== 'SERVER_ERROR'} variant="outline" className="border-slate-300 disabled:opacity-50">O Network Restore</Button>
            </div>
          </div>

          <Separator />

          {/* Backend API tests */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-indigo-900">Backend API Tests</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button onClick={() => fetchLockers(session.uin)} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Fetch Lockers</Button>
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
  );
}