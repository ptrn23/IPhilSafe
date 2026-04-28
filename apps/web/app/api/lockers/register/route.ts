import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/db';

export async function POST(req: NextRequest) {
  try {
    // Adding a log here so you can see it in your VS Code terminal
    console.log("POST request received at /api/lockers/register");

    const body = await req.json();
    const { lockerId } = body;

    const locker = await prisma.locker.upsert({
      where: { lockerId: Number(lockerId) },
      update: {},
      create: {
        lockerId: Number(lockerId),
        weight: 0,
      },
    });

    return NextResponse.json({ message: "Registered", lockerId: locker.lockerId }, { status: 201 });
  } catch (error) {
    console.error("Error in register route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}