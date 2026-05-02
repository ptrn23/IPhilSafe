import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/db';
import { create_audit_log } from '../../../utils';
export async function POST(
    req: Request,
    { params }: { params: {locker_id: string } }

) {
  try {
    // Adding a log here so you can see it in your VS Code terminal
    console.log("POST request received at /api/lockers/register");

    const {locker_id } = await params;
    // Strict check for the params
    if (!locker_id) {
      return NextResponse.json({ error: "Route parameters not found" }, { status: 400 });
    }

    const l_id = parseInt(locker_id, 10)

    // check if locker exists
    const locker = await prisma.locker.findUnique({
      where: { lockerId: l_id }
    });

    if (!locker){
      return NextResponse.json({ error: "Locker not found" }, { status: 404 });
    }

    // check if already in registering period
    const latestRegLog = await prisma.auditLog.findFirst({
      where: {
        lockerId: l_id, 
        sysType: "Registering"
      },
      orderBy: {createdAt: "desc"},
    })

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (latestRegLog && latestRegLog.createdAt >= fiveMinutesAgo){
      return NextResponse.json({ error: `Registration period has already started` }, { status: 404 });
    }

    // if not, create log
    create_audit_log(l_id, 'Registering', "Registration period started")

    return NextResponse.json({ message: "Regsitration start", lockerId: locker.lockerId }, { status: 201 });
  } catch (error) {
    console.error("Error in register route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}