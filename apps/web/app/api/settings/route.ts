import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@repo/db';

export async function GET() {
  try {
    const settings = await prisma.systemSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        weightTolerance: 5,
        emptyWeightThreshold: 10,
        registrationTimer: 300,
        unregistrationTimer: 60,
        ignoreDuplicateScanTimer: 3,
        getStatusTimer: 10,
        weightUpdateTimer: 30

      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch system settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest
) {
  try {
    const body = await req.json();
    const {
      weightTolerance, 
      emptyWeightThreshold, 
      registrationTimer, 
      unregistrationTimer, 
      ignoreDuplicateScanTimer, 
      getStatusTimer, 
      weightUpdateTimer } = body;
    // Strict check for the params
    if (
      !weightTolerance || 
      !emptyWeightThreshold || 
      !registrationTimer  || 
      !unregistrationTimer || 
      !ignoreDuplicateScanTimer || 
      !getStatusTimer || 
      !weightUpdateTimer  ) {
      return NextResponse.json({ error: "Route parameters not found" }, { status: 400 });
    }
    const parsedTolerance = parseInt(weightTolerance, 10);
    const parsedEmpty = parseInt(emptyWeightThreshold, 10);
    const parsedTimer = parseInt(registrationTimer, 10);
    const parsedUnregTimer = parseInt(unregistrationTimer, 10);
    const parsedDupliScanTimer = parseInt(ignoreDuplicateScanTimer, 10);
    const parsedGetStatusTimer = parseInt(getStatusTimer, 10);
    const parsedWeightUpdateTimer = parseInt(weightUpdateTimer, 10);

    if (
      isNaN(parsedTolerance) || parsedTolerance < 0 || 
      isNaN(parsedEmpty) || parsedEmpty < 0 || 
      isNaN(parsedTimer) || parsedTimer < 5 ||
      isNaN(parsedUnregTimer) || parsedUnregTimer < 0 ||
      isNaN(parsedDupliScanTimer) || parsedDupliScanTimer < 0 ||
      isNaN(parsedGetStatusTimer) || parsedGetStatusTimer < 0 ||
      isNaN(parsedWeightUpdateTimer) || parsedWeightUpdateTimer < 0
    ) {
      return NextResponse.json({ error: "Invalid integer parameters" }, { status: 400 });
    }

    const updatedSettings = await prisma.systemSettings.update({
      where: { id: 1 },
      data: {
        weightTolerance: parsedTolerance,
        emptyWeightThreshold: parsedEmpty,
        registrationTimer: parsedTimer,
        unregistrationTimer: parsedUnregTimer,
        ignoreDuplicateScanTimer: parsedDupliScanTimer,
        getStatusTimer: parsedGetStatusTimer,
        weightUpdateTimer: parsedWeightUpdateTimer,
      },
    });

    return NextResponse.json({ 
      message: "Settings updated successfully", 
      settings: updatedSettings 
    });

  } catch (error) {
    console.error("Settings Update Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}