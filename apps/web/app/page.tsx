'use client'

import { useState } from "react";
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
  const [locker, setLocker] = useState<LockerData>({
    id: "Locker A",
    state: "IDLE",
    currentWeight: 0.00,
    ownerUINs: [],
    previousState: 'IDLE',
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);

  // --- THE BACKEND ABSTRACTION ENGINE ---
  const pushHardwareEvent = (action: string, newLockerState: Partial<LockerData>, logDetails: string) => {
    setLocker(prev => ({ ...prev, ...newLockerState }));
    
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      action: action,
      details: logDetails,
    };
    
    setLogs(prevLogs => [newLog, ...prevLogs]);

    // TODO: await fetch('/api/hardware-event', { method: 'POST', body: JSON.stringify({ action, newLockerState }) });
  };

  const simulateScan = () => {
    if (locker.state === 'IDLE') {
      pushHardwareEvent("ID Scan", { state: 'REGISTER', ownerUINs: ["1234-5678"] }, "Primary user authenticated via MOSIP.");
    } else if (locker.state === 'OCCUPIED') {
      pushHardwareEvent("Access Scan", { currentWeight: 1.20 }, "Authorized user scanned ID. Door unlocked for temporary access.");
    }
  };

  const simulateMultiScan = () => {
    if (locker.state !== 'REGISTER') return alert("Must be in REGISTER state to add co-users!");
    
    pushHardwareEvent("Co-User Scan", { ownerUINs: [...locker.ownerUINs, "9999-0000"] }, "Secondary user appended to session.");
  };

  const simulateDeposit = () => {
    pushHardwareEvent("Door Closed", { state: 'OCCUPIED', currentWeight: 2.45 }, "Baseline mass registered.");
  };

  const simulateTheft = () => {
    pushHardwareEvent("Tamper Detected", { state: 'TAMPERED', currentWeight: 0.00 }, "CRITICAL: Unauthorized mass drop.");
  };

  const simulateFailedCheckout = () => {
    pushHardwareEvent("Checkout Denied", { state: 'UNREGISTER', currentWeight: 1.20 }, "User attempted checkout, but items remain inside.");
  };

  const simulateClearCheckout = () => {
    pushHardwareEvent("Session Ended", { state: 'IDLE', currentWeight: 0.00, ownerUINs: [] }, "Compartment verified empty. Ledger cleared.");
  };

  const simulateNetworkError = () => {
    if (locker.state === 'SERVER_ERROR') return;
    pushHardwareEvent("System Timeout", { state: 'SERVER_ERROR', previousState: locker.state }, "Lost connection to MOSIP Testbed.");
  };

  const simulateNetworkRestore = () => {
    const targetState = locker.previousState || 'IDLE';
    pushHardwareEvent("Network Restored", { state: targetState }, `Connection re-established. Resuming ${targetState} phase.`);
  };

  const simulateAdminOverride = () => {
    pushHardwareEvent("Admin Override", { state: 'IDLE', currentWeight: 0.00, ownerUINs: [] }, "Tamper flag cleared by administrator. Locker reset to IDLE.");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">IPhilSafe Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Capstone Project by Team 10</p>
        </div>
        <Badge variant="outline" className="bg-white text-green-700 border-green-700">
          ONLINE
        </Badge>
      </header>

      <Separator className="mb-8" />

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
              
              {locker.state === 'TAMPERED' && (
                <Button 
                  onClick={simulateAdminOverride} 
                  variant="destructive" 
                  size="sm"
                  className="font-bold shadow-sm"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="mb-8" />

      <div className="mt-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Chain of Custody Logs</h2>
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
                      No events recorded yet. Click a Dev Tool button to simulate hardware.
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

      <div className="mt-16 p-6 border border-slate-200 rounded-xl bg-white shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">DEV TOOLS HERE!</h2>
          <p className="text-sm text-slate-500">For simulation purposes for now</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button 
            onClick={simulateScan} 
            disabled={locker.state !== 'IDLE' && locker.state !== 'OCCUPIED'}
            variant="outline" className="border-blue-200 text-blue-700 disabled:opacity-50">
            1. Scan ID
          </Button>
          
          <Button 
            onClick={simulateMultiScan} 
            disabled={locker.state !== 'REGISTER'}
            variant="outline" className="border-yellow-200 text-yellow-700 disabled:opacity-50">
            1.5 Co-User Scan
          </Button>
          
          <Button 
            onClick={simulateDeposit} 
            disabled={locker.state !== 'REGISTER' && locker.state !== 'UNREGISTER'}
            variant="outline" className="border-green-200 text-green-700 disabled:opacity-50">
            2. Close Door
          </Button>
          
          <Button 
            onClick={simulateTheft} 
            disabled={locker.state !== 'OCCUPIED'}
            variant="outline" className="border-red-200 text-red-700 border-2 disabled:opacity-50">
            ! Force Theft
          </Button>
          
          <Button 
            onClick={simulateFailedCheckout} 
            disabled={locker.state !== 'OCCUPIED'}
            variant="outline" className="border-orange-200 text-orange-700 disabled:opacity-50">
            ? Failed Checkout
          </Button>
          
          <Button 
            onClick={simulateClearCheckout} 
            disabled={locker.state !== 'OCCUPIED' && locker.state !== 'UNREGISTER'}
            variant="outline" className="border-slate-300 disabled:opacity-50">
            3. Valid Checkout
          </Button>
          
          <Button 
            onClick={simulateNetworkError} 
            variant="outline" className="border-slate-800 text-slate-800">
            X Network Drop
          </Button>

          <Button
            onClick={simulateNetworkRestore}
            disabled={locker.state !== 'SERVER_ERROR'}
            variant="outline" className="border-slate-300 disabled:opacity-50">
            O Network Restore
          </Button>
        </div>
      </div>
    </div>
  )
}