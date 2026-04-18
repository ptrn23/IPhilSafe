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

  const handleSimulateScan = () => {
    // IDLE -> REGISTER
    setLocker({ ...locker, state: 'REGISTER', ownerUINs: ["1234-5678"] });
  };

  const handleSimulateDeposit = () => {
    // REGISTER -> OCCUPIED
    setLocker({ ...locker, state: 'OCCUPIED', currentWeight: 2.45 });
  };

  const handleSimulateTheft = () => {
    // OCCUPIED -> TAMPERED
    setLocker({ ...locker, state: 'TAMPERED', currentWeight: 0.00 });
  };

  const handleSimulateCheckout = () => {
    // OCCUPIED -> UNREGISTER -> IDLE (We'll skip straight to IDLE for the quick simulation)
    setLocker({ id: "Locker A", state: 'IDLE', currentWeight: 0.00, ownerUINs: [] });
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
        
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSimulateScan} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
            1. Scan PhilSys QR
          </Button>
          <Button onClick={handleSimulateDeposit} variant="outline" className="border-green-200 text-green-700 hover:bg-green-50">
            2. Deposit & Close Door
          </Button>
          <Button onClick={handleSimulateTheft} variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
            ! Force Weight Drop
          </Button>
          <Button onClick={handleSimulateCheckout} variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50">
            3. Checkout & Empty
          </Button>
        </div>
      </div>
    </div>
  )
}