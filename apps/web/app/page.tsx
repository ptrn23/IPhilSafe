'use client'

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"

type LockerState = 'IDLE' | 'REGISTER' | 'OCCUPIED' | 'UNREGISTER' | 'TAMPERED' | 'SERVER_ERROR';

interface LockerData {
  id: string;
  state: LockerState;
  currentWeight: number;
  ownerUINs: string[]; 
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
    pushHardwareEvent("ID Scan", { state: 'REGISTER', ownerUINs: ["1234-5678"] }, "Primary user authenticated via MOSIP.");
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
    pushHardwareEvent("System Timeout", { state: 'SERVER_ERROR' }, "Lost connection to MOSIP Testbed.");
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
            <div className="text-sm text-slate-500 mt-2">
              <p>Current Load: <span className="font-mono text-slate-900 font-medium">{locker.currentWeight.toFixed(2)} kg</span></p>
              <p>Owner UIN: <span className="font-mono text-slate-900">{locker.ownerUINs.join(', ')}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="mb-8" />

      <div className="mt-16 p-6 border border-slate-200 rounded-xl bg-white shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">DEV TOOLS HERE!</h2>
          <p className="text-sm text-slate-500">For simulation purposes for now</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button onClick={simulateScan} variant="outline" className="border-blue-200 text-blue-700">1. Scan ID</Button>
          <Button onClick={simulateMultiScan} variant="outline" className="border-yellow-200 text-yellow-700">1.5 Co-User Scan</Button>
          <Button onClick={simulateDeposit} variant="outline" className="border-green-200 text-green-700">2. Close Door</Button>
          <Button onClick={simulateTheft} variant="outline" className="border-red-200 text-red-700 border-2">! Force Theft</Button>
          <Button onClick={simulateFailedCheckout} variant="outline" className="border-orange-200 text-orange-700">? Failed Checkout</Button>
          <Button onClick={simulateClearCheckout} variant="outline" className="border-slate-300">3. Valid Checkout</Button>
          <Button onClick={simulateNetworkError} variant="outline" className="border-slate-800 text-slate-800">X Network Drop</Button>
        </div>
      </div>
    </div>
  )
}