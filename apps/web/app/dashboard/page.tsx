'use client'

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

type LockerState = 'IDLE' | 'REGISTER' | 'OCCUPIED' | 'UNREGISTER' | 'TAMPERED' | 'SERVER_ERROR';

// From the API — what the DB actually knows
interface LockerAPIData {
  locker_id: string;
  weight: number;
  status: LockerState;
  users?: { user: { name: string } }[];
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
  logId: string;          // log_id
  createdAt: string;      // created_at
  lockerId: number;       // locker_id
  logMsg: string;         // log_msg
  sysType: string;        // sys_type
  user_id: string | null; // user_id
}

interface UserSession {
  uin: string;
  role: 'Admin' | 'User';
}

interface SettingsState {
  weightTolerance: number;
  emptyWeightThreshold: number;
  registrationTimer: number;
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
  const [logsLoading, setLogsLoading] = useState(false);
  const [settings, setSettings] = useState<SettingsState>({
    weightTolerance: 5,
    emptyWeightThreshold: 20,
    registrationTimer: 300,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

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
  // Fetch System Settings (Singleton)
  // ----------------------------------------------------------------
  const fetchSystemSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings({
          weightTolerance: data.weightTolerance,
          emptyWeightThreshold: data.emptyWeightThreshold,
          registrationTimer: data.registrationTimer,
        });
      }
    } catch (err) {
      console.error("Error loading hardware calibration parameters:", err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSettingChange = (field: keyof SettingsState, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: parseInt(value, 10) || 0,
    }));
  };
  
  const saveSystemSettings = async () => {
    setSettingsSaving(true);
    setSettingsMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error("Failed to update database calibration");
      
      setSettingsMessage("✓ Settings updated successfully");
      setTimeout(() => setSettingsMessage(null), 3500);
    } catch (err) {
      setSettingsMessage("✕ Error: Failed to update settings");
    } finally {
      setSettingsSaving(false);
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
        if (data.role === 'Admin') {
          await fetchSystemSettings();
        }
        
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

  // --- FETCH LOGS ---
  const fetchRealAuditLogs = async (uin: string) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/get-audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uin })
      });

      if (!res.ok) throw new Error("Failed to fetch logs");
      
      const data: LogEntry[] = await res.json();

      const sortedLogs = data.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setLogs(sortedLogs.slice(0, 50));
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.uin) {
      fetchRealAuditLogs(session.uin);
    }
  }, [session?.uin]);

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
  const addUser = async (locker_id:any = 2, qr_data = JSON.stringify({uin: "4104961936", dob: "2004/02/17", name: "Cellin Louise Cheng" } )) => {
    const res = await fetch(`/api/locker/add-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_data: qr_data, locker_id: locker_id }),
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

  const revokeLockerAccess = async (locker_id:any = 2) => {
    const res = await fetch(`/api/locker/revoke-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: locker_id, user_id: String(10101) }),
    });
    const data = await res.json();
    console.log("🚫 | Access for locker revoked:", data);
  };

  const getLockerStatus = async (locker_id:any = 2) => {
    const res = await fetch(`/api/locker/get-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: locker_id}),
    });
    const data = await res.json();
    console.log(`🗄️| status of locker 2:`, data);
  };

  const openLocker = async (locker_id:any = 2, qr_data = JSON.stringify({ uin: "4104961936", dob: "2004/02/17", name: "Cellin Louise Cheng" } )) => {
    const res = await fetch(`/api/locker/open-locker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_data: qr_data, locker_id: locker_id }),
    });
    const data = await res.json();
    console.log(`🔒| open locker 2:`, data);
  };

  const startRegistration = async (locker_id:any = 2) => {
    const res = await fetch(`/api/locker/start-reg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: locker_id }),
    });
    const data = await res.json();
    console.log(`🗄️| start registration for locker 2:`, data);
  };

  const unregisterLocker = async (locker_id:any = 2, qr_data:any = JSON.stringify({ uin: "4104961936", dob: "2004/02/17", name: "Cellin Louise Cheng" } )) => {
    const res = await fetch(`/api/locker/unreg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        locker_id: locker_id, 
        weight: 0, 
        qr_data: qr_data 
      }),
    });
    const data = await res.json();
    console.log(`🗄️| unregister locker 2:`, data);
  };

  const updateWeight = async (locker_id:any = 2, newWeight:any = 100) => {
    const res = await fetch(`/api/locker/update-weight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: locker_id, weight: newWeight }),
    });
    const data = await res.json();
    console.log(`🗄️| update weight locker 2:`, data);
  };

  const closeLocker = async (locker_id:any = 2, weight:any= 100) => {
    const res = await fetch(`/api/locker/close-locker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: locker_id, weight: weight }),
    });
    const data = await res.json();
    console.log(`🗄️| close locker 2:`, data);
  };

  const finishReg = async (locker_id:any = 2) => {
    const res = await fetch(`/api/locker/finish-reg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locker_id: locker_id }),
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
    setLogs(prevLogs => [...prevLogs]);
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
      pushHardwareEvent(selectedLockerId, "Door Closed", { state: 'OCCUPIED', currentWeight: newWeight }, `Initial baseline mass registered at ${newWeight} g.`);
    } else if (selectedSim.state === 'OCCUPIED') {
      pushHardwareEvent(selectedLockerId, "Door Closed", { currentWeight: newWeight }, `Door closed. New baseline mass registered at ${newWeight} g.`);
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
            const displayOwners = locker.users ? locker.users.map((item: { user: { name: string } }) => item.user.name) : [];
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
                      <p>Current Load: <span className="font-mono text-slate-900 font-medium">
                        {displayState === 'OCCUPIED'
                          ? `${displayWeight.toFixed(2)} g`
                          : displayState === 'TAMPERED'
                          ? `${displayWeight.toFixed(2)} g (last recorded)`
                          : '--'}
                        </span></p>
                      {session.role === 'Admin' && (
                        <p>
                          Owners: <span className="font-mono text-slate-900">
                            {displayOwners.length > 0 ? displayOwners.join(', ') : 'None'}
                          </span>
                        </p>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Logs</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAuditLogs()}
            disabled={logsLoading}
            className="border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            {logsLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
        
        <Card className="shadow-sm border-slate-200">
          <ScrollArea className="h-[400px] rounded-md border-0">
            <Table>
              <TableHeader className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[100px]">Locker</TableHead>
                  <TableHead className="w-[150px]">Type</TableHead>
                  <TableHead className="w-[150px]">User ID</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500 py-12">
                      {logsLoading ? "Querying audit logs..." : "No logs found for this user."}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.logId} className="hover:bg-slate-50/50">
                      <TableCell className="text-slate-400 font-mono text-xs">
                        #{log.logId}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {new Date(log.createdAt).toLocaleString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-700">
                        L-{log.lockerId}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-200 text-slate-800 text-[10px] font-bold uppercase tracking-wider">
                          {log.sysType.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-blue-600">
                        {log.user_id || "SYSTEM"}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm leading-relaxed">
                        {log.logMsg}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      </div>

      {/* --- Locker settings --- */}
      {session.role === 'Admin' && (
        <Card className="shadow-sm border-slate-200 max-w-xl mt-8">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">
              Global Settings
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {settingsLoading ? (
              <div className="text-xs text-slate-500 animate-pulse">Querying database...</div>
            ) : (
              <>
                {/* Weight Tolerance */}
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block">
                      Weight Tolerance
                    </label>
                    <span className="text-xs text-slate-500 block">
                      Tolerated change in mass before tamper state is triggered
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      step="1"
                      value={settings.weightTolerance}
                      onChange={(e) => handleSettingChange("weightTolerance", e.target.value)}
                      className="font-mono text-right"
                    />
                    <span className="text-sm text-slate-500 font-mono">g</span>
                  </div>
                </div>

                {/* Empty Locker Threshold */}
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block">
                      Empty Weight Threshold
                    </label>
                    <span className="text-xs text-slate-500 block">
                      Threshold for recognizing an empty locker during checkout
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      step="1"
                      value={settings.emptyWeightThreshold}
                      onChange={(e) => handleSettingChange("emptyWeightThreshold", e.target.value)}
                      className="font-mono text-right"
                    />
                    <span className="text-sm text-slate-500 font-mono">g</span>
                  </div>
                </div>

                {/* Registration Timer */}
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block">
                      Registration Timer
                    </label>
                    <span className="text-xs text-slate-500 block">
                      Duration to scan co-user credentials
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      step="5"
                      value={settings.registrationTimer}
                      onChange={(e) => handleSettingChange("registrationTimer", e.target.value)}
                      className="font-mono text-right"
                    />
                    <span className="text-sm text-slate-500 font-mono">sec</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="flex justify-between items-center bg-slate-50 rounded-b-lg pt-4">
            <span className={`text-xs font-medium ${settingsMessage?.includes("✓") ? "text-green-600" : "text-red-600"}`}>
              {settingsMessage || ""}
            </span>
            <Button 
              onClick={saveSystemSettings} 
              disabled={settingsSaving || settingsLoading}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              {settingsSaving ? "Saving..." : "Save Settings"}
            </Button>
          </CardFooter>
        </Card>
      )}

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
              <Button onClick={() => {
                const qr_data = prompt("Enter qr data in string form:");
                if (qr_data != null){
                  addUser(selectedLockerId, qr_data)
                }
                
              }} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Add User for {selectedLockerId ? `Locker ${selectedLockerId}` : 'None — Locker 2 default'}</Button>
              <Button onClick={() => revokeLockerAccess(selectedLockerId)} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Revoke Access for {selectedLockerId ? `Locker ${selectedLockerId}` : 'None — Locker 2 default'}</Button>
              <Button onClick={() => getLockerStatus(selectedLockerId)} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Get Status for {selectedLockerId ? `Locker ${selectedLockerId}` : 'None — Locker 2 default'}</Button>
              <Button onClick={() => {
                const qr_data = prompt("Enter qr data in string form:"); 
                
                if (qr_data != null){
                  openLocker(selectedLockerId, qr_data)};
                }
              } variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Open Locker for {selectedLockerId ? `Locker ${selectedLockerId}` : 'None — Locker 2 default'}</Button>
              <Button onClick={() => {
                const newWeight = prompt("Enter new weight:");
                if (newWeight != null){
                  closeLocker(selectedLockerId, newWeight)
                }
              
              }} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Close Locker for {selectedLockerId ? `Locker ${selectedLockerId}` : 'None — Locker 2 default'}</Button>
              <Button onClick={() => startRegistration(selectedLockerId)} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Start Reg Period for {selectedLockerId ? `Locker ${selectedLockerId}` : 'None — Locker 2 default'}</Button>
              <Button onClick={() => finishReg(selectedLockerId)} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Finish Reg Period for {selectedLockerId ? `Locker ${selectedLockerId}` : 'None — Locker 2 default'}</Button>
              <Button onClick={() => {
                const qr_data = prompt("Enter qr data in string form:"); 
                
                if (qr_data != null){
                  unregisterLocker(selectedLockerId, qr_data)
                }
              }} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Unregister Locker for {selectedLockerId ? `Locker ${selectedLockerId}` : 'None — Locker 2 default'}</Button>
              <Button onClick={() => {
                const newWeight = prompt("Enter new weight:");
                if (newWeight != null){
                  updateWeight(selectedLockerId, newWeight)
                }
              
              }} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Update Weight for {selectedLockerId ? `Locker ${selectedLockerId}` : 'None — Locker 2 default'}</Button>
              <Button onClick={fetchAuditLogs} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">Fetch Audit Logs</Button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}