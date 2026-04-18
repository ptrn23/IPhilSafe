'use client'

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"\

type LockerState = 'IDLE' | 'REGISTER' | 'OCCUPIED' | 'UNREGISTER' | 'TAMPERED' | 'SERVER_ERROR';

interface LockerData {
  id: string;
  state: LockerState;
  currentWeight: number;
  ownerUINs: string[]; 
}

export default function Dashboard() {
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
            <CardTitle className="text-lg font-semibold">Locker A</CardTitle>
            <Badge className="bg-blue-600 hover:bg-blue-700">Claimed</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-500 mt-2">
              <p>Current Load: <span className="font-mono text-slate-900 font-medium">6.7 kg</span></p>
              <p>Owner UIN: <span className="font-mono text-slate-900">****-6767</span></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}